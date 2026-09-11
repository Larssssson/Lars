"""Supply-chain positioning from 25-Mio-Vorlagen.

A Vorlage is an approval, not a tender. The action it supports is not "bid" but
"get in front of the prime before the contract is let". So this module produces
a different object from the shortlist, and the language is kept different too —
conflating the two would have a consultant telling a client to bid for something
that cannot be bid for.

THE TRAP THIS MODULE IS BUILT AROUND. Capability tags collide across civil and
military work. Marvel Fusion's project carries `lasers` and `photonics`; the
Hochenergielaser-Waffensystem approved on 8 July 2026 carries `lasers` too. A
naive tag match tells a civil fusion-energy company to approach Rheinmetall
about a naval directed-energy weapon. That is a false positive produced by
vocabulary, not by fact, and it is precisely the kind of confident nonsense that
ends a consultant's credibility in one meeting.

So capability overlap is necessary and never sufficient: application domain
gates it, and the gate is logged rather than applied silently.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from .model import Case
from .rules import EU_MEMBER_STATES
from .sources.vorlagen import Vorlage

# Tags too broad to constitute a match on their own. `defence` sits on every
# defence case and every defence Vorlage, so an overlap consisting only of it
# means "both of these are defence", which is not a lead — it pointed a
# counter-UAS interceptor company at submarine-hunting frigates. A match needs
# at least one specific capability tag.
BROAD_DOMAINS = {"defence", "manufacturing", "ai", "energy"}

DEFENCE_DOMAINS = {
    "defence", "counter_uas", "naval", "air_combat", "directed_energy",
    "missiles", "ammunition", "land_combat",
}


@dataclass
class Match:
    case: Case
    vorlage: Vorlage
    overlap: list[str]
    route: str                       # subcontract | prime | blocked
    argument: str
    blockers: list[str] = field(default_factory=list)


@dataclass
class Excluded:
    case: Case
    vorlage: Vorlage
    overlap: list[str]
    reason: str


def _case_domains(case: Case) -> set[str]:
    tags = case.project.get("domains")
    return set(tags.value or []) if tags is not None and tags.known else set()


def _is_defence(vorlage: Vorlage) -> bool:
    return bool(set(vorlage.domains) & DEFENCE_DOMAINS)


def position(case: Case, vorlagen: list[Vorlage], today: date) -> tuple[list[Match], list[Excluded]]:
    matches: list[Match] = []
    excluded: list[Excluded] = []
    client_domains = _case_domains(case)

    for v in vorlagen:
        overlap = sorted(client_domains & set(v.domains))
        if not overlap:
            continue
        if not (set(overlap) - BROAD_DOMAINS):
            excluded.append(Excluded(
                case, v, overlap,
                reason=(
                    f"overlap is only on the broad tag{'s' if len(overlap) > 1 else ''} "
                    f"{', '.join(overlap)} — both are defence work, which is not a lead. "
                    f"No shared capability."
                ),
            ))
            continue

        # The gate. Capability overlap is not enough.
        if _is_defence(v) and case.application_domain.value == "civil":
            excluded.append(Excluded(
                case, v, overlap,
                reason=(
                    f"capability overlap on {', '.join(overlap)}, but this is a defence "
                    f"programme and the client's application domain is civil. Tag collision, "
                    f"not a lead. Raise only if the client opts into dual-use work."
                ),
            ))
            continue
        if _is_defence(v) and not case.application_domain.known:
            excluded.append(Excluded(
                case, v, overlap,
                reason="application domain unknown — cannot tell whether a defence programme is a lead or noise",
            ))
            continue

        blockers: list[str] = []
        eu = bool(set(case.country_list) & EU_MEMBER_STATES)
        if not eu:
            blockers.append(
                "no EU establishment — under the BwPBBG the authority may restrict "
                "participation to EU-resident bidders, so the prime route is the only route"
            )

        route = "subcontract"
        if v.primes:
            who = " and ".join(v.primes)  # joint programmes, not alternatives
            argument = (
                f"Approved {v.session_date}. {who} carr{'ies' if len(v.primes) == 1 else 'y'} it. "
                f"Money is committed and the contract is not yet let — approach now, not after award."
            )
        else:
            argument = (
                f"Approved {v.session_date}, no prime named in the captured sources. "
                f"An unnamed prime on a programme this early is the best entry a small "
                f"supplier gets; finding out who it is, is the next task."
            )
        if v.in_service_from:
            argument += f" In service from {v.in_service_from}, so the supplier decisions are being taken now."

        matches.append(Match(case, v, overlap, route, argument, blockers))

    matches.sort(key=lambda m: (len(m.overlap), m.vorlage.session_date), reverse=True)
    return matches, excluded


def prime_index(matches: list[Match]) -> list[tuple[str, list[str]]]:
    """Which primes keep appearing in this client's domains. The target list."""
    index: dict[str, list[str]] = {}
    for m in matches:
        for p in m.vorlage.primes:
            index.setdefault(p, []).append(m.vorlage.title)
    return sorted(index.items(), key=lambda kv: len(kv[1]), reverse=True)
