"""Run the knockout engine over every case and every opportunity.

    python3 -m radar.run [--case SLUG] [--today YYYY-MM-DD]

Prints, per case: the shortlist, the unresolved set (which is also the intake
question list), and the kill log.
"""

from __future__ import annotations

import argparse
from datetime import date

from .model import ADVISORY, KILL, UNRESOLVED, Case, Result, load_cases, load_opportunities
from .positioning import position, prime_index
from .rules import qualify
from .sources.vorlagen import load as load_vorlagen

BAR = "=" * 78
DASH = "-" * 78


def run(case_slug: str | None, today: date) -> list[Result]:
    cases = [c for c in load_cases() if case_slug in (None, c.slug)]
    opps = load_opportunities()
    return [Result(c, o, qualify(c, o, today)) for c in cases for o in opps]


def report(results: list[Result], today: date) -> None:
    by_case: dict[str, list[Result]] = {}
    for r in results:
        by_case.setdefault(r.case.name, []).append(r)

    for name, rows in by_case.items():
        shortlist = [r for r in rows if r.status == "shortlist"]
        unresolved = [r for r in rows if r.status == UNRESOLVED]
        killed = [r for r in rows if r.status == KILL]

        print(f"\n{BAR}\n{name}   —   scan of {today}\n{BAR}")
        print(
            f"{len(shortlist)} shortlisted · {len(unresolved)} undecidable · "
            f"{len(killed)} killed · {len(rows)} scanned"
        )

        print(f"\n  SHORTLIST\n{DASH}")
        if not shortlist:
            print("  (nothing survived qualification)")
        for r in shortlist:
            unverified = "" if r.opportunity.verified else "   [UNVERIFIED RECORD]"
            print(f"  · {r.opportunity.title}{unverified}")
            if r.opportunity.deadline is None:
                print(f"      deadline: NOT ESTABLISHED — {r.opportunity.deadline_source}")
            else:
                print(f"      deadline: {r.opportunity.deadline} ({r.opportunity.deadline_kind})")
                print(f"      source:   {r.opportunity.deadline_source}")

        # Advisories are facts about the client, not about one opportunity. Collapse
        # them, and list what each one bears on — repeating the same warning under every
        # matching call is the noise that gets a digest filtered into a folder.
        advisories: dict[tuple[str, str], tuple[object, list[str]]] = {}
        for r in rows:
            for f in r.advisories:
                key = (f.rule, f.client)
                advisories.setdefault(key, (f, []))[1].append(r.opportunity.title)
        if advisories:
            print(f"\n  ADVISORY — does not block, but say it to the client\n{DASH}")
            for f, bears_on in advisories.values():
                print(f"  ! {f.client}")
                print(f"      basis:  {f.source}")
                print(f"      do:     {f.reversible}")
                print(f"      bears on {len(bears_on)} opportunit{'y' if len(bears_on) == 1 else 'ies'} in this scan:")
                for title in bears_on:
                    print(f"        - {title}")

        print(f"\n  CANNOT DECIDE — these are the intake questions\n{DASH}")
        if not unresolved:
            print("  (none)")
        seen: set[str] = set()
        for r in unresolved:
            for f in r.unresolved:
                if f.needs and f.needs not in seen:
                    seen.add(f.needs)
                    print(f"  ? {f.needs}")
                    print(f"      blocks: {r.opportunity.title}")
                    print(f"      because: {f.client}")

        print(f"\n  KILL LOG\n{DASH}")
        for r in killed:
            print(f"  {r.opportunity.title}")
            for f in r.killed:
                for line in f.render().splitlines():
                    print(f"    {line}")
            print()


def positioning_report(cases: list[Case], today: date) -> None:
    """Vorlagen are approvals, not tenders. Nobody can bid for one — so this
    report is kept separate from the shortlist, and worded differently."""
    vorlagen = load_vorlagen(offline=True)
    print(f"\n{BAR}\nSUPPLY-CHAIN POSITIONING — 25-Mio-Vorlagen\n{BAR}")
    print(
        f"{len(vorlagen)} Vorlagen captured. These are Haushaltsausschuss approvals, not\n"
        f"opportunities: money is committed and the contract is not yet let. The action is\n"
        f"to reach the prime before award, not to bid.\n"
        f"COVERAGE: 3 of the 16 Vorlagen approved on 2026-07-08 — the ones the reviewed\n"
        f"sources named individually. For scale: 103 Vorlagen in 2025."
    )

    for case in cases:
        matches, excluded = position(case, vorlagen, today)
        broad = [e for e in excluded if "broad tag" in e.reason]
        gated = [e for e in excluded if e not in broad]
        print(f"\n  {case.name}\n{DASH}")

        if not matches:
            print("  No leads.")
        for m in matches:
            print(f"  → {m.vorlage.title}")
            print(f"      overlap:  {', '.join(m.overlap)}")
            print(f"      argument: {m.argument}")
            if m.vorlage.value_note:
                print(f"      value:    {m.vorlage.value_note}")
            for b in m.blockers:
                print(f"      BLOCKER:  {b}")
            print(f"      source:   {m.vorlage.source_url}")

        idx = prime_index(matches)
        if idx:
            print("\n      PRIMES TO APPROACH")
            for name, titles in idx:
                print(f"        {name} — {len(titles)} programme(s): {'; '.join(t[:44] for t in titles)}")

        for e in gated:
            print(f"\n      NOT A LEAD: {e.vorlage.title[:54]}")
            print(f"        {e.reason}")
        if broad:
            print(f"\n      {len(broad)} further Vorlage(n) rejected on sector tag alone "
                  f"(no shared capability).")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case")
    ap.add_argument("--today", default="2026-09-11")
    ap.add_argument("--positioning", action="store_true",
                    help="supply-chain positioning from 25-Mio-Vorlagen instead of the shortlist")
    args = ap.parse_args()
    today = date.fromisoformat(args.today)
    cases = [c for c in load_cases() if args.case in (None, c.slug)]
    if args.positioning:
        positioning_report(cases, today)
    else:
        report(run(args.case, today), today)


if __name__ == "__main__":
    main()
