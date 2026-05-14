import boto3
import time
from typing import List, Dict, Optional
from cachetools import TTLCache, LRUCache
import config

_session = None


def session():
    global _session
    if _session is None:
        kwargs = {"region_name": config.AWS_REGION}
        if config.AWS_ACCESS_KEY_ID and config.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_access_key_id"] = config.AWS_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = config.AWS_SECRET_ACCESS_KEY
        _session = boto3.Session(**kwargs)
    return _session


def sfn():
    return session().client("stepfunctions")


_sm_cache = TTLCache(maxsize=1, ttl=config.STATE_MACHINE_LIST_TTL)
_running_history_cache = TTLCache(maxsize=2048, ttl=config.RUNNING_HISTORY_TTL)
_failed_history_cache = LRUCache(maxsize=config.FAILED_HISTORY_CACHE_SIZE)
_describe_cache = TTLCache(maxsize=2048, ttl=30)
_sm_def_cache = TTLCache(maxsize=64, ttl=3600)


def clear_caches() -> None:
    _sm_cache.clear()
    _running_history_cache.clear()
    _failed_history_cache.clear()
    _describe_cache.clear()
    _sm_def_cache.clear()
    _redrive_cache.clear()


def describe_state_machine(arn: str) -> Dict:
    if arn in _sm_def_cache:
        return _sm_def_cache[arn]
    res = sfn().describe_state_machine(stateMachineArn=arn)
    _sm_def_cache[arn] = res
    return res


def list_state_machines() -> List[Dict]:
    if "all" in _sm_cache:
        return _sm_cache["all"]
    client = sfn()
    out = []
    paginator = client.get_paginator("list_state_machines")
    for page in paginator.paginate():
        for sm in page.get("stateMachines", []):
            name = sm["name"]
            if config.STATE_MACHINE_NAME:
                if name != config.STATE_MACHINE_NAME:
                    continue
            elif not name.startswith(config.STATE_MACHINE_PREFIX):
                continue
            display = name
            if display.startswith(config.STATE_MACHINE_PREFIX):
                display = display[len(config.STATE_MACHINE_PREFIX):]
            if display.endswith("-prod"):
                display = display[:-5]
            out.append({"arn": sm["stateMachineArn"], "name": name, "displayName": display})
    _sm_cache["all"] = out
    return out


def list_executions(state_machine_arn: str, status: Optional[str] = None,
                    start_after_epoch: Optional[float] = None) -> List[Dict]:
    client = sfn()
    out = []
    kwargs = {"stateMachineArn": state_machine_arn, "maxResults": 1000}
    if status:
        kwargs["statusFilter"] = status
    paginator = client.get_paginator("list_executions")
    for page in paginator.paginate(**kwargs):
        for e in page.get("executions", []):
            if start_after_epoch is not None:
                if e["startDate"].timestamp() < start_after_epoch:
                    return out
            out.append(e)
    return out


def describe_execution(arn: str) -> Dict:
    if arn in _describe_cache:
        return _describe_cache[arn]
    res = sfn().describe_execution(executionArn=arn)
    _describe_cache[arn] = res
    return res


def get_history_for_running(arn: str, max_events: int = 200) -> List[Dict]:
    if arn in _running_history_cache:
        return _running_history_cache[arn]
    events = _fetch_history(arn, reverse=True, max_events=max_events)
    _running_history_cache[arn] = events
    return events


def get_history_for_failed(arn: str) -> List[Dict]:
    if arn in _failed_history_cache:
        return _failed_history_cache[arn]
    events = _fetch_history(arn, reverse=True, max_events=1000, stop_on_failure=True)
    _failed_history_cache[arn] = events
    return events


def _fetch_history(arn: str, reverse: bool, max_events: int, stop_on_failure: bool = False) -> List[Dict]:
    client = sfn()
    out = []
    kwargs = {"executionArn": arn, "reverseOrder": reverse, "maxResults": 200,
              "includeExecutionData": False}
    while True:
        resp = client.get_execution_history(**kwargs)
        for ev in resp.get("events", []):
            out.append(ev)
            if stop_on_failure and ev.get("type") in (
                "ExecutionFailed", "ExecutionAborted", "ExecutionTimedOut"
            ):
                pass
            if len(out) >= max_events:
                return out
        token = resp.get("nextToken")
        if not token:
            break
        kwargs["nextToken"] = token
    return out


_redrive_cache = TTLCache(maxsize=2048, ttl=300)


def get_redrive_events(arn: str) -> List[Dict]:
    """Walk full history forward-order, collect every ExecutionRedriven event."""
    if arn in _redrive_cache:
        return _redrive_cache[arn]
    client = sfn()
    out = []
    kwargs = {
        "executionArn": arn,
        "reverseOrder": False,
        "maxResults": 200,
        "includeExecutionData": False,
    }
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
    return f"https://{config.AWS_REGION}.console.aws.amazon.com/states/home?region={config.AWS_REGION}#/v2/executions/details/{arn}"
