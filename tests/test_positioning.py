"""Tests for supply-chain positioning.

The first two tests are the ones that matter. They pin the guard that stops a
capability tag from being mistaken for a lead.
"""

from datetime import date

from radar.model import Sourced, load_cases
from radar.positioning import position, prime_index
from radar.sources.vorlagen import load

TODAY = date(2026, 9, 11)
VORLAGEN = load()


def case_by_slug(slug: str):
    return next(c for c in load_cases() if c.slug == slug)


def test_civil_client_is_not_offered_a_weapons_programme_on_a_tag_collision():
    """Marvel Fusion's project carries `lasers`; so does the naval Hochenergielaser.
    A naive matcher sends a fusion-energy company to Rheinmetall about a directed-
    energy weapon. It must not, and the exclusion must be stated rather than silent."""
    matches, excluded = position(case_by_slug("marvel-fusion"), VORLAGEN, TODAY)
    assert matches == []
    laser = [e for e in excluded if "Hochenergielaser" in e.vorlage.title]
    assert len(laser) == 1
    assert "lasers" in laser[0].overlap        # the overlap is real
    assert "Tag collision, not a lead" in laser[0].reason   # and it is still not a lead


def test_the_gate_is_application_domain_not_capability():
    """Same client, same tags, opted into dual-use: now it is a lead."""
    c = case_by_slug("marvel-fusion")
    c.application_domain = Sourced(value="dual_use", source="client instruction")
    matches, _ = position(c, VORLAGEN, TODAY)
    assert any("Hochenergielaser" in m.vorlage.title for m in matches)


def test_unknown_application_domain_excludes_rather_than_guesses():
    c = case_by_slug("marvel-fusion")
    c.application_domain = Sourced(value=None)
    matches, excluded = position(c, VORLAGEN, TODAY)
    assert matches == []
    assert any("application domain unknown" in e.reason for e in excluded)


# ---------------------------------------------------------- the real leads

def test_counter_uas_client_gets_the_laser_programme_with_its_primes():
    matches, _ = position(case_by_slug("tytan-technologies"), VORLAGEN, TODAY)
    laser = next(m for m in matches if "Hochenergielaser" in m.vorlage.title)
    assert "counter_uas" in laser.overlap
    assert laser.vorlage.primes == ["Rheinmetall", "MBDA Deutschland"]
    assert "approach now, not after award" in laser.argument
    assert "2029" in laser.argument


def test_german_client_has_no_third_country_blocker():
    matches, _ = position(case_by_slug("tytan-technologies"), VORLAGEN, TODAY)
    assert all(m.blockers == [] for m in matches)


def test_non_eu_client_is_told_the_prime_route_is_the_only_route():
    matches, _ = position(case_by_slug("droneshield"), VORLAGEN, TODAY)
    laser = next(m for m in matches if "Hochenergielaser" in m.vorlage.title)
    assert any("BwPBBG" in b for b in laser.blockers)
    assert any("prime route is the only route" in b for b in laser.blockers)


def test_dual_established_eu_client_has_no_blocker():
    """Monopulse is established in DK and LT; either leg clears the restriction."""
    matches, _ = position(case_by_slug("monopulse"), VORLAGEN, TODAY)
    assert matches, "uav/defence overlap should match CFSN"
    assert all(m.blockers == [] for m in matches)


def test_unnamed_prime_is_framed_as_the_opening_it_is():
    matches, _ = position(case_by_slug("monopulse"), VORLAGEN, TODAY)
    cfsn = next(m for m in matches if "CFSN" in m.vorlage.title)
    assert cfsn.vorlage.primes == []
    assert "finding out who it is, is the next task" in cfsn.argument


def test_prime_index_ranks_the_target_list():
    matches, _ = position(case_by_slug("tytan-technologies"), VORLAGEN, TODAY)
    idx = prime_index(matches)
    assert [p for p, _ in idx] == ["Rheinmetall", "MBDA Deutschland"]


def test_no_overlap_means_no_match_rather_than_a_stretch():
    """Nobody in this case set should be pointed at frigate shipbuilding."""
    for slug in ["tytan-technologies", "monopulse", "droneshield"]:
        matches, _ = position(case_by_slug(slug), VORLAGEN, TODAY)
        assert not any("MEKO" in m.vorlage.title for m in matches)
