"""Data model for the radar.

Two ideas carry most of the weight here:

1.  Every eligibility-critical field is *sourced*. A bare scalar in YAML is
    treated as an assumption and rendered as one everywhere it propagates.
2.  A rule whose input is unknown returns UNRESOLVED, never a kill and never
    a pass. Silently killing on missing data manufactures exactly the false
    negatives the design says are unrecoverable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml

KILL = "kill"
UNRESOLVED = "unresolved"

REPO = Path(__file__).resolve().parent.parent


@dataclass
class Sourced:
    """A fact, with provenance. `assumed` when nobody has confirmed it."""

    value: Any
    source: str | None = None
    as_of: date | None = None
    assumed: bool = False

    @property
    def known(self) -> bool:
        return self.value is not None

    def __str__(self) -> str:
        if not self.known:
            return "unknown"
        mark = " [assumed]" if self.assumed else ""
        return f"{self.value}{mark}"

    def cite(self) -> str:
        if self.assumed or not self.source:
            return "no source — assumption"
        stamp = f", as_of {self.as_of}" if self.as_of else ""
        return f"{self.source}{stamp}"


def _sourced(raw: Any) -> Sourced:
    """Accept either a bare scalar (an assumption) or a {value, source, as_of} map."""
    if isinstance(raw, dict) and "value" in raw:
        as_of = raw.get("as_of")
        if isinstance(as_of, datetime):
            as_of = as_of.date()
        return Sourced(
            value=raw["value"],
            source=raw.get("source"),
            as_of=as_of,
            assumed=raw.get("assumed", raw.get("source") is None),
        )
    return Sourced(value=raw, assumed=True)


def _as_date(raw: Any) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    return date.fromisoformat(str(raw))


@dataclass
class Case:
    slug: str
    name: str
    legal_form: Sourced
    country: Sourced                 # ISO-2, where the entity is established
    sites: Sourced                   # list of {land, kreis} for German presence
    founded: Sourced
    headcount: Sourced
    turnover_eur: Sourced
    balance_sheet_eur: Sourced
    ownership_status: Sourced        # autonomous | partner_exempt | linked | None
    listed: Sourced
    application_domain: Sourced      # civil | dual_use | military
    activity: Sourced                # free text, for fit assessment
    de_minimis_used_eur: Sourced
    turnover_in_field_eur: Sourced
    references: Sourced
    project: dict[str, Sourced] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> "Case":
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        project = {k: _sourced(v) for k, v in (raw.get("project") or {}).items()}
        return cls(
            slug=raw["slug"],
            name=raw["name"],
            legal_form=_sourced(raw.get("legal_form")),
            country=_sourced(raw.get("country")),
            sites=_sourced(raw.get("sites")),
            founded=_sourced(raw.get("founded")),
            headcount=_sourced(raw.get("headcount")),
            turnover_eur=_sourced(raw.get("turnover_eur")),
            balance_sheet_eur=_sourced(raw.get("balance_sheet_eur")),
            ownership_status=_sourced(raw.get("ownership_status")),
            listed=_sourced(raw.get("listed")),
            application_domain=_sourced(raw.get("application_domain")),
            activity=_sourced(raw.get("activity")),
            de_minimis_used_eur=_sourced(raw.get("de_minimis_used_eur")),
            turnover_in_field_eur=_sourced(raw.get("turnover_in_field_eur")),
            references=_sourced(raw.get("references")),
            project=project,
            notes=raw.get("notes") or [],
        )

    @property
    def laender(self) -> list[str]:
        if not self.sites.known:
            return []
        return [s["land"] for s in self.sites.value if "land" in s]


@dataclass
class Opportunity:
    slug: str
    title: str
    kind: str                        # funding | procurement
    issuer: str
    source_url: str
    retrieved: date | None
    verified: bool                   # did a human confirm this record?
    deadline: date | None = None
    deadline_kind: str | None = None  # skizze | vollantrag | angebot | laufend
    deadline_source: str | None = None
    prep_days: int | None = None
    requires_sme: bool = False
    requires_country: list[str] | None = None
    requires_land: list[str] | None = None
    excludes_third_country: bool = False
    civil_use_only: bool = False
    no_vorhabenbeginn: bool = False
    de_minimis_ceiling_eur: int | None = None
    min_turnover_eur: int | None = None
    min_references: int | None = None
    domains: list[str] = field(default_factory=list)
    volume_eur: int | None = None
    notes: str | None = None

    @classmethod
    def load(cls, path: Path) -> "Opportunity":
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        raw["retrieved"] = _as_date(raw.get("retrieved"))
        raw["deadline"] = _as_date(raw.get("deadline"))
        known = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in raw.items() if k in known})


@dataclass
class Finding:
    """One rule's verdict on one opportunity."""

    outcome: str          # KILL | UNRESOLVED
    rule: str
    client: str           # what we hold about the client
    required: str         # what the opportunity demands
    source: str           # where the requirement comes from
    reversible: str | None = None
    needs: str | None = None   # UNRESOLVED only: the fact that would settle it

    def render(self) -> str:
        head = "KILLED" if self.outcome == KILL else "UNRESOLVED"
        lines = [
            f"{head}  rule: {self.rule}",
            f"  client:      {self.client}",
            f"  required:    {self.required}",
            f"  source:      {self.source}",
        ]
        if self.reversible:
            lines.append(f"  reversible:  {self.reversible}")
        if self.needs:
            lines.append(f"  needs:       {self.needs}")
        return "\n".join(lines)


@dataclass
class Result:
    case: Case
    opportunity: Opportunity
    findings: list[Finding]

    @property
    def killed(self) -> list[Finding]:
        return [f for f in self.findings if f.outcome == KILL]

    @property
    def unresolved(self) -> list[Finding]:
        return [f for f in self.findings if f.outcome == UNRESOLVED]

    @property
    def status(self) -> str:
        if self.killed:
            return KILL
        if self.unresolved:
            return UNRESOLVED
        return "shortlist"


def load_cases(root: Path = REPO / "cases") -> list[Case]:
    return [Case.load(p) for p in sorted(root.glob("*.yaml"))]


def load_opportunities(root: Path = REPO / "opportunities") -> list[Opportunity]:
    return [Opportunity.load(p) for p in sorted(root.glob("*.yaml"))]
