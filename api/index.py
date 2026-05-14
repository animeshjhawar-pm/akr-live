"""
Single-file FastAPI app for the AKR Dashboard.

Consolidated so Vercel's Python builder has nothing to puzzle out — the function's
entry point and all its dependencies live in api/index.py with no cross-directory
imports.
"""

import asyncio
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import boto3
import psycopg2
from cachetools import LRUCache, TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# ---------- config ----------

_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in [os.path.join(_HERE, ".env"), os.path.join(_HERE, "..", ".env")]:
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        break

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
DB_URL = os.getenv("DB_URL")
STATE_MACHINE_PREFIX = os.getenv("STATE_MACHINE_PREFIX", "stormbreaker-")
STATE_MACHINE_NAME = (os.getenv("STATE_MACHINE_NAME") or "").strip() or None


# ---------- phases ----------

PHASES: List[Tuple[str, List[str]]] = [
    ("Setup", ["OrganizeProject", "ProcessProducts"]),
    ("Seed Keywords", ["GenerateSeedKeywords", "CreateHeaders", "GetKeywordCombinations",
                       "GetKeywordSearchAngles", "GetRagKeywords", "CollateSeedKeywords"]),
    ("Keyword Score", ["GetKeywordScoreMap", "GetKeywordScore", "AccumulateKeywordsScore"]),
    ("Broad Matches", ["GetChunkedBroadMatches", "GetBroadMatches",
                       "AccumulateChunkedBroadMatches", "AccumulateAllBroadMatches"]),
    ("SERP & Clustering", ["FetchSerpBatches", "FetchSerpData", "MergeSerpResults",
                           "BuildKeywordGraph", "GenerateKeywordClusters"]),
    ("Page Type", ["ProcessBatches", "IdentifyPageType"]),
    ("Topical Map", ["GenerateTopicForBatch", "ScoreKeywords", "FetchTopicalSerp",
                     "MergeTopicalSerpResults", "BuildTopicalGraph", "MergeTopicalClusters"]),
    ("Cleanup", ["ProcessCleanup"]),
]
_STATE_TO_PHASE = {state: i for i, (_, states) in enumerate(PHASES) for state in states}

# Flat ordered list of every state in the AKR pipeline, used to map state name -> step index.
_STATE_ORDER: List[str] = [s for _, states in PHASES for s in states]
_STATE_INDEX = {name: i + 1 for i, name in enumerate(_STATE_ORDER)}
TOTAL_PIPELINE_STEPS = len(_STATE_ORDER)


def step_for_state(state_name: Optional[str]) -> Optional[int]:
    if not state_name:
        return None
    return _STATE_INDEX.get(state_name)


def phase_for_state(state_name: Optional[str]) -> Optional[dict]:
    if not state_name:
        return None
    idx = _STATE_TO_PHASE.get(state_name)
    if idx is None:
        return {"name": "Unknown", "index": -1, "total": len(PHASES)}
    return {"name": PHASES[idx][0], "index": idx + 1, "total": len(PHASES)}


# ---------- history parsing ----------

_STATE_ENTERED_TYPES = {
    "TaskStateEntered", "PassStateEntered", "ChoiceStateEntered", "WaitStateEntered",
    "SucceedStateEntered", "FailStateEntered", "MapStateEntered", "ParallelStateEntered",
}


def count_total_states(definition_str: Optional[str]) -> Optional[int]:
    if not definition_str:
        return None
    try:
        d = json.loads(definition_str)
    except Exception:
        return None
    return _walk_states(d)


def _walk_states(node) -> int:
    if not isinstance(node, dict):
        return 0
    total = 0
    states = node.get("States")
    if isinstance(states, dict):
        total += len(states)
        for s in states.values():
            if not isinstance(s, dict):
                continue
            if isinstance(s.get("Iterator"), dict):
                total += _walk_states(s["Iterator"])
            if isinstance(s.get("ItemProcessor"), dict):
                total += _walk_states(s["ItemProcessor"])
            if isinstance(s.get("Branches"), list):
                for b in s["Branches"]:
                    total += _walk_states(b)
    return total


def count_states_entered(events: List[Dict]) -> int:
    seen = set()
    for ev in events:
        if ev.get("type") in _STATE_ENTERED_TYPES:
            name = (ev.get("stateEnteredEventDetails") or {}).get("name")
            if name:
                seen.add(name)
    return len(seen)


def find_current_step(events_newest_first: List[Dict]) -> Optional[Dict]:
    depth = 0
    last_entered_name = None
    for ev in events_newest_first:
        t = ev.get("type", "")
        if t.endswith("StateExited"):
            depth += 1
        elif t.endswith("StateEntered"):
            name = (ev.get("stateEnteredEventDetails") or {}).get("name")
            if depth == 0:
                return {"name": name, "transitioning": False}
            depth -= 1
            if last_entered_name is None:
                last_entered_name = name
    if last_entered_name:
        return {"name": last_entered_name, "transitioning": True}
    return None


def find_failed_step(events_newest_first: List[Dict]) -> Dict:
    error_type = None
    error_message = None
    failed_state = None
    map_iteration = None

    for ev in events_newest_first:
        t = ev.get("type", "")
        if t in ("ExecutionFailed", "ExecutionAborted", "ExecutionTimedOut"):
            details = (ev.get("executionFailedEventDetails")
                       or ev.get("executionAbortedEventDetails")
                       or ev.get("executionTimedOutEventDetails") or {})
            error_type = details.get("error")
            error_message = details.get("cause")
            break

    depth = 0
    for ev in events_newest_first:
        t = ev.get("type", "")
        if t in ("TaskFailed", "LambdaFunctionFailed", "ActivityFailed"):
            d = (ev.get("taskFailedEventDetails")
                 or ev.get("lambdaFunctionFailedEventDetails")
                 or ev.get("activityFailedEventDetails") or {})
            if not error_type:
                error_type = d.get("error")
            if not error_message:
                error_message = d.get("cause")
        if t.endswith("StateExited"):
            depth += 1
        elif t.endswith("StateEntered"):
            if depth == 0:
                failed_state = (ev.get("stateEnteredEventDetails") or {}).get("name")
                break
            depth -= 1
        elif t == "MapIterationStarted" and map_iteration is None:
            map_iteration = (ev.get("mapIterationStartedEventDetails") or {}).get("index")

    return {
        "stateName": failed_state,
        "errorType": error_type,
        "errorMessage": error_message,
        "mapIteration": map_iteration,
    }


def extract_project_id(input_str: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not input_str:
        return None, None
    try:
        data = json.loads(input_str)
    except Exception:
        return None, None
    return _dig(data, "project_id"), (_dig(data, "process_group_id") or _dig(data, "processGroupId"))


def _dig(obj, key):
    if isinstance(obj, dict):
        if key in obj and isinstance(obj[key], (str, int)):
            return str(obj[key])
        for v in obj.values():
            r = _dig(v, key)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _dig(v, key)
            if r:
                return r
    return None


# ---------- AWS client ----------

_session = None


def _sfn():
    global _session
    if _session is None:
        kw = {"region_name": AWS_REGION}
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            kw["aws_access_key_id"] = AWS_ACCESS_KEY_ID
            kw["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
        _session = boto3.Session(**kw)
    return _session.client("stepfunctions")


_sm_cache = TTLCache(maxsize=1, ttl=600)
_sm_def_cache = TTLCache(maxsize=64, ttl=3600)
_running_history_cache = TTLCache(maxsize=2048, ttl=60)
_failed_history_cache = LRUCache(maxsize=4096)
_describe_running_cache = TTLCache(maxsize=2048, ttl=30)
_describe_terminal_cache = LRUCache(maxsize=8192)  # terminal executions are immutable
_list_running_cache = TTLCache(maxsize=64, ttl=20)
_list_terminal_cache = TTLCache(maxsize=256, ttl=60)
_redrive_cache = TTLCache(maxsize=2048, ttl=300)


def clear_caches() -> None:
    for c in (_sm_cache, _sm_def_cache, _running_history_cache, _failed_history_cache,
              _describe_running_cache, _describe_terminal_cache,
              _list_running_cache, _list_terminal_cache, _redrive_cache):
        c.clear()


def list_state_machines() -> List[Dict]:
    if "all" in _sm_cache:
        return _sm_cache["all"]
    out = []
    for page in _sfn().get_paginator("list_state_machines").paginate():
        for sm in page.get("stateMachines", []):
            name = sm["name"]
            if STATE_MACHINE_NAME:
                if name != STATE_MACHINE_NAME:
                    continue
            elif not name.startswith(STATE_MACHINE_PREFIX):
                continue
            display = name
            if display.startswith(STATE_MACHINE_PREFIX):
                display = display[len(STATE_MACHINE_PREFIX):]
            if display.endswith("-prod"):
                display = display[:-5]
            out.append({"arn": sm["stateMachineArn"], "name": name, "displayName": display})
    _sm_cache["all"] = out
    return out


def describe_state_machine(arn: str) -> Dict:
    if arn in _sm_def_cache:
        return _sm_def_cache[arn]
    res = _sfn().describe_state_machine(stateMachineArn=arn)
    _sm_def_cache[arn] = res
    return res


_TERMINAL = {"SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"}


def list_executions(arn: str, status: Optional[str] = None,
                    start_after_epoch: Optional[float] = None) -> List[Dict]:
    cache = _list_terminal_cache if status in _TERMINAL else _list_running_cache
    key = (arn, status, start_after_epoch)
    if key in cache:
        return cache[key]
    out = []
    kwargs = {"stateMachineArn": arn, "maxResults": 1000}
    if status:
        kwargs["statusFilter"] = status
    for page in _sfn().get_paginator("list_executions").paginate(**kwargs):
        for e in page.get("executions", []):
            if start_after_epoch is not None and e["startDate"].timestamp() < start_after_epoch:
                cache[key] = out
                return out
            out.append(e)
    cache[key] = out
    return out


def describe_execution(arn: str, terminal: bool = False) -> Dict:
    if terminal:
        if arn in _describe_terminal_cache:
            return _describe_terminal_cache[arn]
    elif arn in _describe_running_cache:
        return _describe_running_cache[arn]
    res = _sfn().describe_execution(executionArn=arn)
    if terminal or res.get("status") in _TERMINAL:
        _describe_terminal_cache[arn] = res
    else:
        _describe_running_cache[arn] = res
    return res


def get_history_for_running(arn: str, max_events: int = 200) -> List[Dict]:
    if arn in _running_history_cache:
        return _running_history_cache[arn]
    events = _fetch_history(arn, max_events=max_events)
    _running_history_cache[arn] = events
    return events


def get_history_for_failed(arn: str) -> List[Dict]:
    if arn in _failed_history_cache:
        return _failed_history_cache[arn]
    events = _fetch_history(arn, max_events=1000)
    _failed_history_cache[arn] = events
    return events


def _fetch_history(arn: str, max_events: int) -> List[Dict]:
    client = _sfn()
    out = []
    kwargs = {"executionArn": arn, "reverseOrder": True, "maxResults": 200,
              "includeExecutionData": False}
    while True:
        resp = client.get_execution_history(**kwargs)
        for ev in resp.get("events", []):
            out.append(ev)
            if len(out) >= max_events:
                return out
        token = resp.get("nextToken")
        if not token:
            break
        kwargs["nextToken"] = token
    return out


def get_redrive_events(arn: str) -> List[Dict]:
    if arn in _redrive_cache:
        return _redrive_cache[arn]
    client = _sfn()
    out = []
    kwargs = {"executionArn": arn, "reverseOrder": False, "maxResults": 200,
              "includeExecutionData": False}
    while True:
        resp = client.get_execution_history(**kwargs)
        for ev in resp.get("events", []):
            if ev.get("type") == "ExecutionRedriven":
                d = ev.get("executionRedrivenEventDetails") or {}
                out.append({
                    "timestamp": ev["timestamp"].isoformat() if ev.get("timestamp") else None,
                    "redriveCount": d.get("redriveCount"),
                })
        token = resp.get("nextToken")
        if not token:
            break
        kwargs["nextToken"] = token
    _redrive_cache[arn] = out
    return out


def console_url(arn: str) -> str:
    return f"https://{AWS_REGION}.console.aws.amazon.com/states/home?region={AWS_REGION}#/v2/executions/details/{arn}"


def sm_console_url(arn: str) -> str:
    return f"https://{AWS_REGION}.console.aws.amazon.com/states/home?region={AWS_REGION}#/statemachines/view/{arn}"


# ---------- DB ----------

_project_name_cache = TTLCache(maxsize=10000, ttl=1800)  # 30 min, project names rarely change


def fetch_project_names(project_ids: Iterable[str]) -> Dict[str, str]:
    wanted = {pid for pid in project_ids if pid and _is_uuid(pid)}
    if not wanted:
        return {}
    cached = {pid: _project_name_cache[pid] for pid in wanted if pid in _project_name_cache}
    missing = [pid for pid in wanted if pid not in cached]
    if missing and DB_URL:
        with psycopg2.connect(DB_URL, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id::text, name FROM projects WHERE id = ANY(%s::uuid[])", (missing,))
                for pid, name in cur.fetchall():
                    cached[pid] = name
                    _project_name_cache[pid] = name
    return cached


def _is_uuid(s) -> bool:
    if not isinstance(s, str) or len(s) != 36:
        return False
    parts = s.split("-")
    return len(parts) == 5 and all(c in "0123456789abcdef-" for c in s.lower())


# ---------- FastAPI app ----------

app = FastAPI(title="AKR Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_pool = ThreadPoolExecutor(max_workers=64)


async def run(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_pool, lambda: fn(*args, **kwargs))


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "hasAwsKey": bool(AWS_ACCESS_KEY_ID),
        "hasAwsSecret": bool(AWS_SECRET_ACCESS_KEY),
        "hasDbUrl": bool(DB_URL),
        "stateMachineName": STATE_MACHINE_NAME,
        "stateMachinePrefix": STATE_MACHINE_PREFIX,
        "region": AWS_REGION,
    }


@app.get("/api/state-machines")
async def state_machines():
    sms = await run(list_state_machines)
    out = []
    for sm in sms:
        try:
            d = await run(describe_state_machine, sm["arn"])
            total = count_total_states(d.get("definition"))
        except Exception:
            total = None
        out.append({**sm, "totalStates": total, "consoleUrl": sm_console_url(sm["arn"])})
    return {"stateMachines": out}


@app.get("/api/phases")
async def get_phases():
    return {"phases": [{"name": n, "states": s} for n, s in PHASES]}


@app.get("/api/executions/redrives")
async def execution_redrives(arn: str):
    events = await run(get_redrive_events, arn)
    return {"redrives": events}


@app.post("/api/cache/clear")
async def clear_cache():
    await run(clear_caches)
    return {"ok": True}


def _parse_arns(state_machine_arns: Optional[str]) -> List[str]:
    if not state_machine_arns:
        return [sm["arn"] for sm in list_state_machines()]
    return [a for a in state_machine_arns.split(",") if a.strip()]


async def _sm_total_states_map(arns: List[str]) -> dict:
    async def one(arn):
        try:
            d = await run(describe_state_machine, arn)
            return arn, count_total_states(d.get("definition"))
        except Exception:
            return arn, None
    return dict(await asyncio.gather(*[one(a) for a in arns]))


@app.get("/api/executions/running")
async def running(stateMachineArns: Optional[str] = None):
    arns = await run(_parse_arns, stateMachineArns)
    sm_map = {sm["arn"]: sm for sm in await run(list_state_machines)}
    total_map = await _sm_total_states_map(arns)

    results = await asyncio.gather(*[run(list_executions, a, "RUNNING") for a in arns])
    all_execs = [(arns[i], e) for i, execs in enumerate(results) for e in execs]

    async def enrich(arn, ex):
        desc, events = await asyncio.gather(
            run(describe_execution, ex["executionArn"]),
            run(get_history_for_running, ex["executionArn"]),
        )
        current = find_current_step(events)
        step_index = step_for_state(current["name"] if current else None)
        pid, pgid = extract_project_id(desc.get("input"))
        sm = sm_map.get(arn, {})
        return {
            "executionArn": ex["executionArn"],
            "executionName": ex["name"],
            "stateMachineArn": arn,
            "stateMachineName": sm.get("name"),
            "stateMachineDisplayName": sm.get("displayName"),
            "status": ex["status"],
            "startDate": ex["startDate"].isoformat(),
            "startEpoch": ex["startDate"].timestamp(),
            "currentStep": current,
            "stepIndex": step_index,
            "totalSteps": total_map.get(arn) or TOTAL_PIPELINE_STEPS,
            "phase": phase_for_state(current["name"] if current else None),
            "projectId": pid,
            "processGroupId": pgid,
            "redriveCount": ex.get("redriveCount") or desc.get("redriveCount", 0),
            "redriveDate": _iso(ex.get("redriveDate") or desc.get("redriveDate")),
            "input": desc.get("input"),
            "consoleUrl": console_url(ex["executionArn"]),
        }

    enriched = await asyncio.gather(*[enrich(a, e) for a, e in all_execs])
    project_names = await run(fetch_project_names, [r["projectId"] for r in enriched if r["projectId"]])
    for r in enriched:
        r["projectName"] = project_names.get(r["projectId"]) if r["projectId"] else None
    return {"executions": enriched, "fetchedAt": datetime.now(timezone.utc).isoformat()}


async def _enrich_terminal(arn: str, ex: Dict, sm_map: Dict, total_map: Dict,
                           walk_history: bool) -> Dict:
    desc_task = run(describe_execution, ex["executionArn"], True)
    if walk_history:
        events_task = run(get_history_for_failed, ex["executionArn"])
        desc, events = await asyncio.gather(desc_task, events_task)
        failure = find_failed_step(events)
        failed_state = failure.get("stateName")
        step_index = step_for_state(failed_state)
        map_iteration = failure.get("mapIteration")
        error_type = failure.get("errorType")
        error_message = failure.get("errorMessage")
    else:
        desc = await desc_task
        # SUCCEEDED runs reached the last step.
        step_index = TOTAL_PIPELINE_STEPS if ex["status"] == "SUCCEEDED" else None
        failed_state = None
        map_iteration = None
        error_type = None
        error_message = None

    pid, pgid = extract_project_id(desc.get("input"))
    sm = sm_map.get(arn, {})
    stop = ex.get("stopDate") or desc.get("stopDate")
    return {
        "executionArn": ex["executionArn"],
        "executionName": ex["name"],
        "stateMachineArn": arn,
        "stateMachineName": sm.get("name"),
        "stateMachineDisplayName": sm.get("displayName"),
        "status": ex["status"],
        "startDate": ex["startDate"].isoformat(),
        "startEpoch": ex["startDate"].timestamp(),
        "stopDate": stop.isoformat() if stop else None,
        "stopEpoch": stop.timestamp() if stop else None,
        "failedStep": failed_state,
        "mapIteration": map_iteration,
        "errorType": error_type,
        "errorMessage": error_message,
        "stepIndex": step_index,
        "totalSteps": total_map.get(arn) or TOTAL_PIPELINE_STEPS,
        "phase": phase_for_state(failed_state),
        "projectId": pid,
        "processGroupId": pgid,
        "redriveCount": ex.get("redriveCount") or desc.get("redriveCount", 0),
        "redriveDate": _iso(ex.get("redriveDate") or desc.get("redriveDate")),
        "input": desc.get("input"),
        "consoleUrl": console_url(ex["executionArn"]),
    }


async def _terminal(statuses: List[str], hours: int, state_machine_arns: Optional[str],
                    walk_history: bool):
    arns = await run(_parse_arns, state_machine_arns)
    sm_map = {sm["arn"]: sm for sm in await run(list_state_machines)}
    total_map = await _sm_total_states_map(arns)
    cutoff = time.time() - hours * 3600

    pairs = [(a, s) for a in arns for s in statuses]
    results = await asyncio.gather(*[run(list_executions, a, s, cutoff) for a, s in pairs])
    all_execs = [(pairs[i][0], e) for i, execs in enumerate(results) for e in execs]

    enriched = await asyncio.gather(
        *[_enrich_terminal(a, e, sm_map, total_map, walk_history) for a, e in all_execs]
    )
    project_names = await run(fetch_project_names, [r["projectId"] for r in enriched if r["projectId"]])
    for r in enriched:
        r["projectName"] = project_names.get(r["projectId"]) if r["projectId"] else None
    return enriched


@app.get("/api/executions/failed")
async def failed(hours: int = 168, stateMachineArns: Optional[str] = None):
    rows = await _terminal(["FAILED", "TIMED_OUT", "ABORTED"], hours, stateMachineArns,
                           walk_history=True)
    return {"executions": rows, "fetchedAt": datetime.now(timezone.utc).isoformat()}


@app.get("/api/executions/succeeded")
async def succeeded(hours: int = 168, stateMachineArns: Optional[str] = None):
    # walk_history=False: skip the expensive per-execution history walk. Succeeded
    # rows show duration + redrives + project, not step counts. ~10x faster.
    rows = await _terminal(["SUCCEEDED"], hours, stateMachineArns, walk_history=False)
    return {"executions": rows, "fetchedAt": datetime.now(timezone.utc).isoformat()}
