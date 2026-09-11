"""The source seam.

Every source splits in two, and the split is the whole point:

    fetch_raw()     touches the network. Cannot run in a sandboxed session, is
                    fragile, changes when a ministry redesigns a page.
    parse_records() is pure. Takes bytes or dicts, returns typed records. Runs
                    anywhere, is tested against captured fixtures.

Keeping them apart means the fragile half is small and replaceable, and the
half that carries meaning is testable without a network. It also means this
repository can be developed in an environment with no egress at all — which is
how it was — provided fixtures are captured somewhere that has one.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent.parent
FIXTURES = REPO / "fixtures"


class SourceUnavailable(RuntimeError):
    """Raised when a source cannot be reached. Never swallowed: a scan that
    silently drops a source produces a digest that looks like a quiet week."""


def load_fixture(source: str) -> list[dict[str, Any]]:
    """Every captured record for one source, newest file last."""
    out: list[dict[str, Any]] = []
    for p in sorted((FIXTURES / source).glob("*.json")):
        payload = json.loads(p.read_text(encoding="utf-8"))
        out.extend(payload if isinstance(payload, list) else [payload])
    return out


def fetch_raw(source: str, since: date) -> list[dict[str, Any]]:
    """Network fetch. Deliberately unimplemented.

    Implement per source on a machine with egress. It is left unimplemented
    rather than stubbed to return fixtures, because a stub that quietly returns
    stale data is exactly the silent-failure mode this project is built to
    avoid — see docs/06-risks.md.
    """
    raise SourceUnavailable(
        f"{source}: no fetch implementation. Run on a machine with network access, "
        f"or use --offline to read captured fixtures from {FIXTURES / source}."
    )
