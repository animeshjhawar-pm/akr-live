import psycopg2
from psycopg2.extras import execute_values
from typing import Iterable, Dict
import config


def fetch_project_names(project_ids: Iterable[str]) -> Dict[str, str]:
    ids = [p for p in {pid for pid in project_ids if pid} if _is_uuid(p)]
    if not ids or not config.DB_URL:
        return {}
    with psycopg2.connect(config.DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, name FROM projects WHERE id = ANY(%s::uuid[])",
                (ids,),
            )
            return {row[0]: row[1] for row in cur.fetchall()}


def _is_uuid(s: str) -> bool:
    if not isinstance(s, str) or len(s) != 36:
        return False
    parts = s.split("-")
    return len(parts) == 5 and all(c in "0123456789abcdef-" for c in s.lower())
