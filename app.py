import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

import aws_client
import db
import history_parser
import phases

app = FastAPI(title="AKR Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pool = ThreadPoolExecutor(max_workers=32)


async def run(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_pool, lambda: fn(*args, **kwargs))


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "hasAwsKey": bool(os.getenv("AWS_ACCESS_KEY_ID")),
        "hasAwsSecret": bool(os.getenv("AWS_SECRET_ACCESS_KEY")),
        "hasDbUrl": bool(os.getenv("DB_URL")),
        "stateMachineName": os.getenv("STATE_MACHINE_NAME"),
        "stateMachinePrefix": os.getenv("STATE_MACHINE_PREFIX"),
        "region": os.getenv("AWS_REGION"),
    }


@app.get("/api/state-machines")
async def state_machines():
    sms = await run(aws_client.list_state_machines)
    enriched = []
    for sm in sms:
        try:
            d = await run(aws_client.describe_state_machine, sm["arn"])
            total = history_parser.count_total_states(d.get("definition"))
        except Exception:
            total = None
        enriched.append({**sm, "totalStates": total, "consoleUrl": _sm_console_url(sm["arn"])})
    return {"stateMachines": enriched}


def _sm_console_url(arn: str) -> str:
    import config as _c
    return f"https://{_c.AWS_REGION}.console.aws.amazon.com/states/home?region={_c.AWS_REGION}#/statemachines/view/{arn}"


@app.get("/api/executions/redrives")
async def execution_redrives(arn: str):
    events = await run(aws_client.get_redrive_events, arn)
    return {"redrives": events}


@app.get("/api/phases")
async def get_phases():
    return {"phases": phases.phase_detail()}


@app.post("/api/cache/clear")
async def clear_cache():
    await run(aws_client.clear_caches)
    return {"ok": True}


def _parse_arns(state_machine_arns: Optional[str]) -> List[str]:
    if not state_machine_arns:
        return [sm["arn"] for sm in aws_client.list_state_machines()]
    return [a for a in state_machine_arns.split(",") if a.strip()]


async def _sm_total_states_map(arns: List[str]) -> dict:
    async def one(arn):
        try:
            d = await run(aws_client.describe_state_machine, arn)
            return arn, history_parser.count_total_states(d.get("definition"))
        except Exception:
            return arn, None

    results = await asyncio.gather(*[one(a) for a in arns])
    return dict(results)


@app.get("/api/executions/running")
async def running(stateMachineArns: Optional[str] = None):
    arns = await run(_parse_arns, stateMachineArns)
    sm_map = {sm["arn"]: sm for sm in await run(aws_client.list_state_machines)}
    total_map = await _sm_total_states_map(arns)

    async def for_sm(arn):
        execs = await run(aws_client.list_executions, arn, "RUNNING")
        return arn, execs

    results = await asyncio.gather(*[for_sm(a) for a in arns])
    all_execs = [(arn, e) for arn, execs in results for e in execs]

    async def enrich(arn, ex):
        desc = await run(aws_client.describe_execution, ex["executionArn"])
        events = await run(aws_client.get_history_for_running, ex["executionArn"])
        current = history_parser.find_current_step(events)
        step_index = history_parser.count_states_entered(events)
        pid, pgid = history_parser.extract_project_id(desc.get("input"))
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
            "totalSteps": total_map.get(arn),
            "phase": phases.phase_for_state(current["name"] if current else None),
            "projectId": pid,
            "processGroupId": pgid,
            "redriveCount": desc.get("redriveCount", 0),
            "redriveDate": _iso(desc.get("redriveDate")),
            "input": desc.get("input"),
            "consoleUrl": aws_client.console_url(ex["executionArn"]),
        }

    enriched = await asyncio.gather(*[enrich(a, e) for a, e in all_execs])
    pids = [r["projectId"] for r in enriched if r["projectId"]]
    project_names = await run(db.fetch_project_names, pids)
    for r in enriched:
        r["projectName"] = project_names.get(r["projectId"]) if r["projectId"] else None

    return {"executions": enriched, "fetchedAt": datetime.now(timezone.utc).isoformat()}


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


async def _terminal_executions(statuses: List[str], hours: int, stateMachineArns: Optional[str]):
    arns = await run(_parse_arns, stateMachineArns)
    sm_map = {sm["arn"]: sm for sm in await run(aws_client.list_state_machines)}
    total_map = await _sm_total_states_map(arns)
    cutoff = time.time() - hours * 3600

    async def for_sm_status(arn, status):
        execs = await run(aws_client.list_executions, arn, status, cutoff)
        return arn, execs

    pairs = [(a, s) for a in arns for s in statuses]
    results = await asyncio.gather(*[for_sm_status(a, s) for a, s in pairs])
    all_execs = [(arn, e) for arn, execs in results for e in execs]

    async def enrich(arn, ex):
        desc = await run(aws_client.describe_execution, ex["executionArn"])
        events = await run(aws_client.get_history_for_failed, ex["executionArn"])
        failure = history_parser.find_failed_step(events) if ex["status"] != "SUCCEEDED" else {}
        step_index = history_parser.count_states_entered(events)
        pid, pgid = history_parser.extract_project_id(desc.get("input"))
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
            "failedStep": failure.get("stateName"),
            "mapIteration": failure.get("mapIteration"),
            "errorType": failure.get("errorType"),
            "errorMessage": failure.get("errorMessage"),
            "stepIndex": step_index,
            "totalSteps": total_map.get(arn),
            "phase": phases.phase_for_state(failure.get("stateName")),
            "projectId": pid,
            "processGroupId": pgid,
            "redriveCount": desc.get("redriveCount", 0),
            "redriveDate": _iso(desc.get("redriveDate")),
            "input": desc.get("input"),
            "consoleUrl": aws_client.console_url(ex["executionArn"]),
        }

    enriched = await asyncio.gather(*[enrich(a, e) for a, e in all_execs])
    pids = [r["projectId"] for r in enriched if r["projectId"]]
    project_names = await run(db.fetch_project_names, pids)
    for r in enriched:
        r["projectName"] = project_names.get(r["projectId"]) if r["projectId"] else None
    return enriched


@app.get("/api/executions/failed")
async def failed(hours: int = 168, stateMachineArns: Optional[str] = None):
    rows = await _terminal_executions(["FAILED", "TIMED_OUT", "ABORTED"], hours, stateMachineArns)
    return {"executions": rows, "fetchedAt": datetime.now(timezone.utc).isoformat()}


@app.get("/api/executions/succeeded")
async def succeeded(hours: int = 168, stateMachineArns: Optional[str] = None):
    rows = await _terminal_executions(["SUCCEEDED"], hours, stateMachineArns)
    return {"executions": rows, "fetchedAt": datetime.now(timezone.utc).isoformat()}


FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
