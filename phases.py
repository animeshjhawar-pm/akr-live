"""Maps individual state names in the AKR state machine to high-level pipeline phases."""

from typing import List, Optional, Tuple

# Ordered list of phases (for sorting/index). Each entry is (phase_name, [state names...]).
PHASES: List[Tuple[str, List[str]]] = [
    ("Setup", ["OrganizeProject", "ProcessProducts"]),
    (
        "Seed Keywords",
        [
            "GenerateSeedKeywords",
            "CreateHeaders",
            "GetKeywordCombinations",
            "GetKeywordSearchAngles",
            "GetRagKeywords",
            "CollateSeedKeywords",
        ],
    ),
    ("Keyword Score", ["GetKeywordScoreMap", "GetKeywordScore", "AccumulateKeywordsScore"]),
    (
        "Broad Matches",
        [
            "GetChunkedBroadMatches",
            "GetBroadMatches",
            "AccumulateChunkedBroadMatches",
            "AccumulateAllBroadMatches",
        ],
    ),
    (
        "SERP & Clustering",
        [
            "FetchSerpBatches",
            "FetchSerpData",
            "MergeSerpResults",
            "BuildKeywordGraph",
            "GenerateKeywordClusters",
        ],
    ),
    ("Page Type", ["ProcessBatches", "IdentifyPageType"]),
    (
        "Topical Map",
        [
            "GenerateTopicForBatch",
            "ScoreKeywords",
            "FetchTopicalSerp",
            "MergeTopicalSerpResults",
            "BuildTopicalGraph",
            "MergeTopicalClusters",
        ],
    ),
    ("Cleanup", ["ProcessCleanup"]),
]

_STATE_TO_PHASE = {state: i for i, (_, states) in enumerate(PHASES) for state in states}


def phase_for_state(state_name: Optional[str]) -> Optional[dict]:
    if not state_name:
        return None
    idx = _STATE_TO_PHASE.get(state_name)
    if idx is None:
        return {"name": "Unknown", "index": -1, "total": len(PHASES)}
    return {"name": PHASES[idx][0], "index": idx + 1, "total": len(PHASES)}


def phase_list() -> List[str]:
    return [name for name, _ in PHASES]


def phase_detail() -> List[dict]:
    return [{"name": name, "states": states} for name, states in PHASES]
