"""25-Mio-Vorlagen — Bundeswehr procurement approvals by the Haushaltsausschuss.

Why this source exists in a radar that is otherwise about opportunities.

Bundeswehr procurement above EUR 25m requires Haushaltsausschuss approval, on a
statutory footing since July 2022 through §54 Abs. 3 BHO and §5 Abs. 3 BwFinG.
There were 55 such Vorlagen in 2023, 97 in 2024 and 103 in 2025.

A Vorlage is NOT an opportunity. Nobody can bid for one. It is a *leading
indicator*: money has been committed to a programme, and contracts follow. For a
supplier who cannot be a prime — which, under the BwPBBG's abolition of
Losaufteilung, means most companies of the size in this case set — the value is
knowing which programme just got funded and which prime is carrying it, while
there is still time to position as a subcontractor.

So Vorlagen produce positioning advice, not shortlist entries. They are modelled
as their own record type for exactly that reason.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .base import load_fixture


@dataclass
class Vorlage:
    session_date: date
    title: str
    domains: list[str]
    source_url: str
    retrieved: date
    verified: bool
    value_eur: int | None = None
    value_note: str | None = None
    primes: list[str] = field(default_factory=list)
    in_service_from: int | None = None
    notes: str | None = None

    @property
    def year(self) -> int:
        return self.session_date.year


def _as_date(raw: Any) -> date:
    return raw if isinstance(raw, date) else date.fromisoformat(str(raw))


def parse_records(raw: list[dict[str, Any]]) -> list[Vorlage]:
    """Pure. Raw dicts in, typed Vorlagen out. Tested against captured fixtures."""
    out: list[Vorlage] = []
    for r in raw:
        out.append(
            Vorlage(
                session_date=_as_date(r["session_date"]),
                title=r["title"],
                domains=list(r.get("domains") or []),
                source_url=r["source_url"],
                retrieved=_as_date(r["retrieved"]),
                verified=bool(r.get("verified", False)),
                value_eur=r.get("value_eur"),
                value_note=r.get("value_note"),
                primes=list(r.get("primes") or []),
                in_service_from=r.get("in_service_from"),
                notes=r.get("notes"),
            )
        )
    return sorted(out, key=lambda v: v.session_date, reverse=True)


def load(offline: bool = True) -> list[Vorlage]:
    if offline:
        return parse_records(load_fixture("vorlagen"))
    from .base import fetch_raw
    return parse_records(fetch_raw("vorlagen", date(2026, 1, 1)))
