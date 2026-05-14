import json
from typing import List, Dict, Optional, Tuple


def count_total_states(definition_str: Optional[str]) -> Optional[int]:
    """Walk the ASL definition, count every named state (top-level + nested in Map/Parallel)."""
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
            if "Iterator" in s and isinstance(s["Iterator"], dict):
                total += _walk_states(s["Iterator"])
            if "ItemProcessor" in s and isinstance(s["ItemProcessor"], dict):
                total += _walk_states(s["ItemProcessor"])
            if "Branches" in s and isinstance(s["Branches"], list):
                for b in s["Branches"]:
                    total += _walk_states(b)
    return total


_STATE_ENTERED_TYPES = {
    "TaskStateEntered",
    "PassStateEntered",
    "ChoiceStateEntered",
    "WaitStateEntered",
    "SucceedStateEntered",
    "FailStateEntered",
    "MapStateEntered",
    "ParallelStateEntered",
}


def count_states_entered(events: List[Dict]) -> int:
    """Number of distinct state names entered so far.

    Map iterations re-enter the same state many times — counting distinct names
    gives a clean "progress through the flow" indicator that fits within the
    total-states-in-definition denominator.
    """
    seen = set()
    for ev in events:
        if ev.get("type") in _STATE_ENTERED_TYPES:
            name = (ev.get("stateEnteredEventDetails") or {}).get("name")
            if name:
                seen.add(name)
    return len(seen)


def find_current_step(events_newest_first: List[Dict]) -> Optional[Dict]:
    """For RUNNING execution. Returns {name, transitioning: bool, mapIteration: Optional[int]}."""
    depth = 0
    last_entered_name = None
    for ev in events_newest_first:
        t = ev.get("type", "")
        if t == "TaskStateExited" or t.endswith("StateExited"):
            depth += 1
        elif t == "TaskStateEntered" or t.endswith("StateEntered"):
            details = ev.get("stateEnteredEventDetails") or {}
            name = details.get("name")
            if depth == 0:
                if last_entered_name is None:
                    return {"name": name, "transitioning": False}
                return {"name": name, "transitioning": False}
            depth -= 1
            if last_entered_name is None:
                last_entered_name = name
    if last_entered_name:
        return {"name": last_entered_name, "transitioning": True}
    return None


def find_failed_step(events_newest_first: List[Dict]) -> Dict:
    """Returns {stateName, errorType, errorMessage, mapIteration}."""
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
                details = ev.get("stateEnteredEventDetails") or {}
                failed_state = details.get("name")
                break
            depth -= 1
        elif t == "MapIterationStarted" and map_iteration is None:
            d = ev.get("mapIterationStartedEventDetails") or {}
            map_iteration = d.get("index")

    return {
        "stateName": failed_state,
        "errorType": error_type,
        "errorMessage": error_message,
        "mapIteration": map_iteration,
    }


def extract_project_id(input_str: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Returns (project_id, process_group_id)."""
    if not input_str:
        return None, None
    try:
        data = json.loads(input_str)
    except Exception:
        return None, None
    pid = _dig(data, "project_id")
    pgid = _dig(data, "process_group_id") or _dig(data, "processGroupId")
    return pid, pgid


def _dig(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            v = obj[key]
            if isinstance(v, (str, int)):
                return str(v)
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
