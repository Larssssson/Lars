"""Tests for the knockout rules.

The rules decide whether a client is told they can win public money. They get
tests; the model does not get a vote.
"""

from datetime import date

import pytest

from radar.model import KILL, UNRESOLVED, Case, Opportunity, Sourced, load_cases
from radar.rules import qualify, sme_test

TODAY = date(2026, 9, 10)


def find(case: Case, opp: Opportunity, rule: str):
    return next((f for f in qualify(case, opp, TODAY) if f.rule == rule), None)


def case_by_slug(slug: str) -> Case:
    return next(c for c in load_cases() if c.slug == slug)


def bare_opp(**kw) -> Opportunity:
    defaults = dict(
        slug="t", title="t", kind="funding", issuer="t",
        source_url="https://example.invalid", retrieved=TODAY, verified=False,
    )
    return Opportunity(**{**defaults, **kw})


# ------------------------------------------------------------------ deadlines

def test_past_deadline_kills():
    opp = bare_opp(deadline=date(2026, 7, 29), deadline_kind="skizze")
    f = find(case_by_slug("marvel-fusion"), opp, "deadline_passed")
    assert f and f.outcome == KILL


def test_unreachable_deadline_kills_even_though_it_is_in_the_future():
    opp = bare_opp(deadline=date(2026, 9, 25), prep_days=40)
    f = find(case_by_slug("marvel-fusion"), opp, "deadline_unreachable")
    assert f and f.outcome == KILL
    assert "15 days" in f.client


def test_missing_deadline_does_not_kill_and_does_not_silently_pass():
    """A null deadline must not be treated as 'no deadline'."""
    opp = bare_opp(deadline=None, prep_days=40)
    assert find(case_by_slug("marvel-fusion"), opp, "deadline_passed") is None
    assert find(case_by_slug("marvel-fusion"), opp, "deadline_unreachable") is None


# -------------------------------------------------------------- establishment

def test_third_country_exclusion_kills_droneshield():
    opp = bare_opp(kind="procurement", excludes_third_country=True)
    f = find(case_by_slug("droneshield"), opp, "third_country_exclusion")
    assert f and f.outcome == KILL
    assert "subcontractor" in (f.reversible or "")


def test_third_country_exclusion_spares_a_german_bidder():
    opp = bare_opp(kind="procurement", excludes_third_country=True)
    assert find(case_by_slug("tytan-technologies"), opp, "third_country_exclusion") is None


def test_edip_country_list_excludes_australia():
    opp = bare_opp(requires_country=["DE", "LT", "NO", "UA"])
    f = find(case_by_slug("droneshield"), opp, "establishment_country")
    assert f and f.outcome == KILL


def test_contested_country_is_unresolved_not_guessed():
    """Monopulse: sources disagree between Denmark and Lithuania. Both are EU, but
    the system must not pick one to look decisive."""
    opp = bare_opp(requires_country=["DE"])
    f = find(case_by_slug("monopulse"), opp, "establishment_country")
    assert f and f.outcome == UNRESOLVED
    assert f.needs == "country of establishment"


def test_land_requirement_kills_a_company_with_no_presence_there():
    opp = bare_opp(requires_land=["NW"])
    f = find(case_by_slug("marvel-fusion"), opp, "establishment_land")
    assert f and f.outcome == KILL


def test_land_requirement_spares_a_bavarian_company():
    opp = bare_opp(requires_land=["BY"])
    assert find(case_by_slug("marvel-fusion"), opp, "establishment_land") is None


# ------------------------------------------------------------------ KMU test

def test_droneshield_sme_status_is_pedantically_undecidable():
    """EUR ~150m of turnover is over the ceiling, but the financial limb is satisfied
    by turnover OR balance sheet, and neither the balance sheet total nor the headcount
    is held. So the honest answer is "cannot decide", and the explanation names exactly
    the two numbers that would settle it — both of them one lookup away in an annual
    report. This is the system being correct rather than confident, and it is the
    behaviour that keeps the kill log trustworthy."""
    verdict, why = sme_test(case_by_slug("droneshield"))
    assert verdict is None
    assert "balance sheet total needed" in why


def test_exceeding_both_financial_ceilings_is_decisive_without_a_headcount():
    c = case_by_slug("droneshield")
    c.balance_sheet_eur = Sourced(value=200_000_000, source="test")
    verdict, why = sme_test(c)
    assert verdict is False
    assert "both turnover and balance sheet" in why


def test_marvel_fusion_sme_status_is_undecidable_without_the_cap_table():
    """121 staff is inside the ceiling, but ownership decides whose figures apply."""
    verdict, why = sme_test(case_by_slug("marvel-fusion"))
    assert verdict is None
    assert "ownership" in why


def test_unknown_ownership_produces_a_question_not_a_kill():
    opp = bare_opp(requires_sme=True)
    f = find(case_by_slug("marvel-fusion"), opp, "sme_required")
    assert f and f.outcome == UNRESOLVED
    assert "ownership" in (f.needs or "")


def test_sme_test_uses_or_between_turnover_and_balance_sheet():
    c = case_by_slug("marvel-fusion")
    c.ownership_status = Sourced(value="autonomous", source="test")
    c.turnover_eur = Sourced(value=60_000_000, source="test")
    c.balance_sheet_eur = Sourced(value=40_000_000, source="test")
    verdict, _ = sme_test(c)
    assert verdict is True, "balance sheet within ceiling should suffice"


def test_headcount_ceiling_is_decisive_regardless_of_money():
    c = case_by_slug("marvel-fusion")
    c.ownership_status = Sourced(value="autonomous", source="test")
    c.headcount = Sourced(value=250, source="test")
    c.turnover_eur = Sourced(value=1, source="test")
    verdict, _ = sme_test(c)
    assert verdict is False


def test_linked_enterprise_is_undecidable_without_consolidated_figures():
    c = case_by_slug("tytan-technologies")
    c.ownership_status = Sourced(value="linked", source="test")
    verdict, why = sme_test(c)
    assert verdict is None and "consolidated" in why


# ------------------------------------------------------------- Zivilklausel

@pytest.mark.parametrize("slug", ["tytan-technologies", "monopulse", "droneshield"])
def test_civil_only_programmes_kill_every_defence_case(slug):
    opp = bare_opp(civil_use_only=True)
    f = find(case_by_slug(slug), opp, "civil_use_only")
    assert f and f.outcome == KILL


def test_civil_only_programme_spares_marvel_fusion():
    opp = bare_opp(civil_use_only=True)
    assert find(case_by_slug("marvel-fusion"), opp, "civil_use_only") is None


# ------------------------------------------------------------ project state

def test_vorhabenbeginn_kills_a_started_project_but_flags_the_remedy():
    opp = bare_opp(no_vorhabenbeginn=True)
    f = find(case_by_slug("tytan-technologies"), opp, "vorhabenbeginn")
    assert f and f.outcome == KILL
    assert "vorzeitiger Maßnahmenbeginn" in (f.reversible or "")


def test_unknown_project_start_is_a_question():
    opp = bare_opp(no_vorhabenbeginn=True)
    f = find(case_by_slug("marvel-fusion"), opp, "vorhabenbeginn")
    assert f and f.outcome == UNRESOLVED


# ------------------------------------------------------------------ Eignung

def test_min_turnover_kills_the_small_bidder_reversibly():
    opp = bare_opp(kind="procurement", min_turnover_eur=5_000_000)
    f = find(case_by_slug("monopulse"), opp, "min_turnover")
    assert f and f.outcome == UNRESOLVED   # turnover unknown, so it is a question


def test_min_turnover_spares_droneshield():
    opp = bare_opp(kind="procurement", min_turnover_eur=5_000_000)
    assert find(case_by_slug("droneshield"), opp, "min_turnover") is None


def test_reference_shortfall_is_reversible_via_bietergemeinschaft():
    opp = bare_opp(kind="procurement", min_references=5)
    f = find(case_by_slug("droneshield"), opp, "min_references")
    assert f and f.outcome == KILL
    assert "Bietergemeinschaft" in (f.reversible or "")


# ------------------------------------------------------- the governing rule

def test_every_kill_carries_a_source_and_a_client_value():
    """The kill log is the product. An unauditable kill is a bug."""
    opps = [
        bare_opp(civil_use_only=True),
        bare_opp(requires_sme=True),
        bare_opp(deadline=date(2020, 1, 1)),
        bare_opp(excludes_third_country=True),
        bare_opp(requires_land=["NW"]),
    ]
    for case in load_cases():
        for opp in opps:
            for f in qualify(case, opp, TODAY):
                assert f.rule and f.client and f.required and f.source, f
