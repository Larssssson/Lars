"""Run the knockout engine over every case and every opportunity.

    python3 -m radar.run [--case SLUG] [--today YYYY-MM-DD]

Prints, per case: the shortlist, the unresolved set (which is also the intake
question list), and the kill log.
"""

from __future__ import annotations

import argparse
from datetime import date

from .model import ADVISORY, KILL, UNRESOLVED, Result, load_cases, load_opportunities
from .rules import qualify

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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case")
    ap.add_argument("--today", default="2026-09-10")
    args = ap.parse_args()
    today = date.fromisoformat(args.today)
    report(run(args.case, today), today)


if __name__ == "__main__":
    main()
