"""Deterministic knockout rules.

Every rule is a pure function of (case, opportunity, today) and returns a
Finding or None. No model judgement anywhere in this file — that is the point
of it. A model asked "is this company a KMU?" will sometimes answer from
impression; this file answers from the headcount.

Three outcomes, and the third is the one most systems get wrong:

    KILL        the rule fired, with a stated reason
    UNRESOLVED  the rule cannot fire because we do not hold the fact
    None        the rule does not apply, or the case passes it

UNRESOLVED exists because killing on missing data manufactures invisible
false negatives, and passing on missing data manufactures false confidence.
Neither is acceptable, so the unknown is surfaced as a question instead.
"""

from __future__ import annotations

from datetime import date
from typing import Callable

from .model import KILL, UNRESOLVED, Case, Finding, Opportunity

# EU SME definition, Empfehlung 2003/361/EG Art. 2
SME_MAX_HEADCOUNT = 250
SME_MAX_TURNOVER = 50_000_000
SME_MAX_BALANCE = 43_000_000

Rule = Callable[[Case, Opportunity, date], Finding | None]
REGISTRY: list[Rule] = []


def rule(fn: Rule) -> Rule:
    REGISTRY.append(fn)
    return fn


# ---------------------------------------------------------------- deadlines


@rule
def deadline_passed(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if opp.deadline is None or opp.deadline >= today:
        return None
    return Finding(
        outcome=KILL,
        rule="deadline_passed",
        client=f"today {today}",
        required=f"{opp.deadline_kind or 'deadline'} {opp.deadline}",
        source=opp.deadline_source or opp.source_url,
        reversible="only if the call reopens or a further Stichtag is announced",
    )


@rule
def deadline_unreachable(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if opp.deadline is None or opp.prep_days is None or opp.deadline < today:
        return None
    runway = (opp.deadline - today).days
    if runway >= opp.prep_days:
        return None
    return Finding(
        outcome=KILL,
        rule="deadline_unreachable",
        client=f"{runway} days of runway",
        required=f"{opp.prep_days} days to prepare a credible submission",
        source=opp.deadline_source or opp.source_url,
        reversible="a partner with a prepared submission, or the next Stichtag",
    )


# ------------------------------------------------------------ establishment


@rule
def establishment_country(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if not opp.requires_country:
        return None
    if not case.country.known:
        return Finding(
            UNRESOLVED, "establishment_country", "country unknown",
            f"establishment in {'/'.join(opp.requires_country)}",
            opp.source_url, needs="country of establishment",
        )
    if case.country.value in opp.requires_country:
        return None
    return Finding(
        outcome=KILL,
        rule="establishment_country",
        client=f"established in {case.country.value} ({case.country.cite()})",
        required=f"establishment in {'/'.join(opp.requires_country)}",
        source=opp.source_url,
        reversible="an EU subsidiary with genuine activity may qualify — verify the call's control provisions",
    )


@rule
def third_country_exclusion(case: Case, opp: Opportunity, today: date) -> Finding | None:
    """BwPBBG lets the contracting authority restrict participation to EU-resident bidders."""
    if not opp.excludes_third_country:
        return None
    if not case.country.known:
        return Finding(
            UNRESOLVED, "third_country_exclusion", "country unknown",
            "EU-resident bidder", opp.source_url, needs="country of establishment",
        )
    if case.country.value in EU_MEMBER_STATES:
        return None
    return Finding(
        outcome=KILL,
        rule="third_country_exclusion",
        client=f"established in {case.country.value} (third country)",
        required="participation restricted to EU-resident applicants or bidders",
        source=opp.source_url,
        reversible="bid as subcontractor to an EU prime, or via an EU-resident subsidiary",
    )


@rule
def establishment_land(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if not opp.requires_land:
        return None
    if not case.sites.known:
        return Finding(
            UNRESOLVED, "establishment_land", "no Betriebsstätten recorded",
            f"Betriebsstätte in {'/'.join(opp.requires_land)}",
            opp.source_url, needs="list of Betriebsstätten by Land",
        )
    if set(case.laender) & set(opp.requires_land):
        return None
    return Finding(
        outcome=KILL,
        rule="establishment_land",
        client=f"Betriebsstätten in {', '.join(case.laender) or 'none in Germany'}",
        required=f"Betriebsstätte in {'/'.join(opp.requires_land)}",
        source=opp.source_url,
        reversible="a Betriebsstätte in the Land — a real one; a registered address will not survive audit",
    )


# --------------------------------------------------------------- KMU status


def sme_test(case: Case) -> tuple[bool | None, str]:
    """EU SME test, Empfehlung 2003/361/EG.

    SME  <=>  headcount < 250  AND  (turnover <= 50m  OR  balance sheet <= 43m)

    Returns (is_sme, explanation); None means undecidable on the facts held, and
    the explanation then names the single field that would settle it.

    Order matters. Evaluate everything that is decisive on known values before
    giving up on an unknown one — an early return on a missing headcount will
    report "cannot decide" about a company whose figures already answer the
    question. That was a real bug here, caught by the DroneShield case.
    """
    # Consolidation basis first: without it, the figures may be the wrong figures.
    if not case.ownership_status.known:
        return None, "ownership structure unknown — cannot tell whether own or consolidated figures apply"
    if case.ownership_status.value == "linked":
        return None, "linked enterprise — consolidated figures required and not held"

    over_headcount = case.headcount.known and case.headcount.value >= SME_MAX_HEADCOUNT
    over_turnover = case.turnover_eur.known and case.turnover_eur.value > SME_MAX_TURNOVER
    over_balance = case.balance_sheet_eur.known and case.balance_sheet_eur.value > SME_MAX_BALANCE
    under_turnover = case.turnover_eur.known and case.turnover_eur.value <= SME_MAX_TURNOVER
    under_balance = case.balance_sheet_eur.known and case.balance_sheet_eur.value <= SME_MAX_BALANCE

    # Decisive negatives.
    if over_headcount:
        return False, f"headcount {case.headcount.value} >= {SME_MAX_HEADCOUNT}"
    if over_turnover and over_balance:
        return False, "both turnover and balance sheet total exceed the ceilings"

    # Decisive positive.
    if case.headcount.known and (under_turnover or under_balance):
        which = "turnover" if under_turnover else "balance sheet total"
        return True, (
            f"headcount {case.headcount.value} < {SME_MAX_HEADCOUNT} "
            f"and {which} within the ceiling"
        )

    # Undecidable — name the one field that would settle it.
    if not case.headcount.known:
        if over_turnover:
            return None, (
                f"turnover EUR {case.turnover_eur.value:,} exceeds the EUR {SME_MAX_TURNOVER:,} "
                "ceiling, but the financial limb is satisfied by turnover OR balance sheet — "
                "balance sheet total needed, and headcount"
            )
        return None, "headcount unknown"
    return None, "neither turnover nor balance sheet total known"


@rule
def sme_required(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if not opp.requires_sme:
        return None
    verdict, why = sme_test(case)
    if verdict is True:
        return None
    if verdict is None:
        return Finding(
            UNRESOLVED, "sme_required", why, "KMU per Empfehlung 2003/361/EG",
            opp.source_url,
            needs="ownership structure, and headcount/turnover/balance sheet on the consolidated basis",
        )
    return Finding(
        outcome=KILL,
        rule="sme_required",
        client=why,
        required="KMU per Empfehlung 2003/361/EG (< 250 staff and turnover <= EUR 50m or balance sheet <= EUR 43m)",
        source=opp.source_url,
        reversible=None,
    )


# ----------------------------------------------------------- civil use only


@rule
def civil_use_only(case: Case, opp: Opportunity, today: date) -> Finding | None:
    """Most German civil research programmes exclude military applications."""
    if not opp.civil_use_only:
        return None
    if not case.application_domain.known:
        return Finding(
            UNRESOLVED, "civil_use_only", "application domain unknown",
            "civil application only", opp.source_url,
            needs="whether the project's application is civil, dual-use or military",
        )
    if case.application_domain.value == "civil":
        return None
    return Finding(
        outcome=KILL,
        rule="civil_use_only",
        client=f"application domain: {case.application_domain.value}",
        required="civil application only (Zivilklausel / militärische Anwendungen ausgeschlossen)",
        source=opp.source_url,
        reversible=(
            "a genuinely separable civil sub-project may qualify — but a Verbund partner "
            "with a university Zivilklausel will still block it"
        ),
    )


# ------------------------------------------------------------ project state


@rule
def vorhabenbeginn(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if not opp.no_vorhabenbeginn:
        return None
    started = case.project.get("started")
    if started is None or not started.known:
        return Finding(
            UNRESOLVED, "vorhabenbeginn", "project start status unknown",
            "no Vorhabenbeginn before Zuwendungsbescheid", opp.source_url,
            needs="whether the project has already begun, and on what date",
        )
    if started.value is False:
        return None
    return Finding(
        outcome=KILL,
        rule="vorhabenbeginn",
        client=f"project already begun ({started.cite()})",
        required="no Vorhabenbeginn before the Zuwendungsbescheid",
        source=opp.source_url,
        reversible="vorzeitiger Maßnahmenbeginn, if applied for and granted before further work",
    )


@rule
def de_minimis_headroom(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if opp.de_minimis_ceiling_eur is None:
        return None
    if not case.de_minimis_used_eur.known:
        return Finding(
            UNRESOLVED, "de_minimis_headroom", "de-minimis ledger not maintained",
            f"headroom under EUR {opp.de_minimis_ceiling_eur:,}", opp.source_url,
            needs="de-minimis aid received over the last three fiscal years, per entity",
        )
    headroom = opp.de_minimis_ceiling_eur - case.de_minimis_used_eur.value
    if headroom > 0:
        return None
    return Finding(
        outcome=KILL,
        rule="de_minimis_headroom",
        client=f"EUR {case.de_minimis_used_eur.value:,} used over three fiscal years",
        required=f"headroom under the EUR {opp.de_minimis_ceiling_eur:,} ceiling",
        source=opp.source_url,
        reversible="headroom moves as the rolling three-fiscal-year window advances",
    )


# ------------------------------------------------------- procurement Eignung


@rule
def min_turnover(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if opp.min_turnover_eur is None:
        return None
    if not case.turnover_in_field_eur.known:
        return Finding(
            UNRESOLVED, "min_turnover", "turnover in the relevant field unknown",
            f"EUR {opp.min_turnover_eur:,} minimum", opp.source_url,
            needs="turnover in the relevant field over the last three years",
        )
    if case.turnover_in_field_eur.value >= opp.min_turnover_eur:
        return None
    return Finding(
        outcome=KILL,
        rule="min_turnover",
        client=f"EUR {case.turnover_in_field_eur.value:,} in the relevant field",
        required=f"Mindestumsatz EUR {opp.min_turnover_eur:,}",
        source=opp.source_url,
        reversible="Bietergemeinschaft, or Eignungsleihe where the tender permits it",
    )


@rule
def min_references(case: Case, opp: Opportunity, today: date) -> Finding | None:
    if opp.min_references is None:
        return None
    if not case.references.known:
        return Finding(
            UNRESOLVED, "min_references", "reference list not held",
            f"{opp.min_references} comparable references", opp.source_url,
            needs="comparable reference projects with value, scope and date",
        )
    held = len(case.references.value)
    if held >= opp.min_references:
        return None
    return Finding(
        outcome=KILL,
        rule="min_references",
        client=f"{held} comparable reference(s) recorded",
        required=f"{opp.min_references} comparable references",
        source=opp.source_url,
        reversible="Bietergemeinschaft, or Eignungsleihe where permitted",
    )


# ------------------------------------------------------------------- domain


@rule
def domain_match(case: Case, opp: Opportunity, today: date) -> Finding | None:
    """Deliberately generous. Matching is where over-inclusion is a design commitment."""
    if not opp.domains:
        return None
    if not case.project:
        return None
    tags = case.project.get("domains")
    if tags is None or not tags.known:
        return None
    if set(tags.value) & set(opp.domains):
        return None
    return Finding(
        outcome=KILL,
        rule="domain_match",
        client=f"project domains: {', '.join(tags.value)}",
        required=f"call domains: {', '.join(opp.domains)}",
        source=opp.source_url,
        reversible="a different project of the same client may fit this call",
    )


EU_MEMBER_STATES = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE",
}


def qualify(case: Case, opp: Opportunity, today: date) -> list[Finding]:
    return [f for f in (r(case, opp, today) for r in REGISTRY) if f is not None]
