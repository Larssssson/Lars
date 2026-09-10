# Cadence

A standing scan, a weekly digest, per client. Which means the system has
**state**, and state is most of what separates this from a search box.

---

## What "new" has to mean

A digest that re-lists the same forty opportunities every Monday is read
once and then filtered into a folder. "New since last week" is the entire
value of the weekly rhythm, and it requires the system to remember what it
already showed and what happened to it.

Every opportunity carries a status per case:

| Status | Meaning |
|---|---|
| `new` | First appearance in this case's scan |
| `shortlisted` | Passed qualification, briefed, awaiting decision |
| `pursuing` | Decision taken, work under way |
| `killed` | Failed a knockout — with the rule and whether it is reversible |
| `passed` | Survived qualification, consultant decided no-go, with a reason |
| `expired` | Deadline gone |
| `changed` | Something material moved since we last looked |

Statuses are sticky. An opportunity killed in March does not reappear as
`new` in April unless something actually changed.

---

## Re-surfacing: the part that is easy to forget and expensive to omit

Things change, and a system that only ever looks forward will miss money it
already found. Four triggers bring a dead opportunity back:

**The opportunity changed.** Deadline extended, budget increased, Los
structure revised, a corrigendum issued, eligibility criteria loosened.
Diff each notice against the version last seen and re-qualify on any
material change.

**The client changed.** They opened a Betriebsstätte in another Land. They
crossed — or fell back under — a KMU threshold. They completed a project
that now counts as a reference. Any profile edit re-runs the knockouts
against the standing set, not just against next week's new arrivals. This
is why the profile is versioned.

**The fiscal year turned.** De-minimis headroom moves on a rolling
three-fiscal-year basis. Opportunities killed on headroom in November may
be live in January, and nobody remembers to check.

**A reversible kill became reversible in practice.** A Kooperationspartner
was found; a Bietergemeinschaft became possible; a Präqualifikation came
through. When a profile gains the missing element, everything killed for
its absence comes back.

That last one is the strongest argument for the kill log. It turns a pile
of rejections into a standing list of *what to fix about this client*, and
it pays out repeatedly.

---

## The digest

Four sections, in this order, because the order encodes urgency:

**1 — Act now.** Decide-by dates inside the next fortnight. Usually zero to
three items. If this section is routinely long, the qualification is too
loose.

**2 — New this week.** Fresh arrivals that passed qualification, briefed.

**3 — Changed.** Previously seen opportunities that moved, with the diff
shown: *"Frist extended from 30 Sep to 21 Oct; Los 2 removed."*

**4 — Coverage.** What scanned, what did not, when each source last
responded. Non-negotiable, and it goes in every digest including good weeks.

Then, below the fold: the kill log, and the standing "answers that would
change this shortlist" — the open profile questions, which double as the
agenda for the next client call.

### A quiet week must announce itself

The failure mode that ends client relationships is not a wrong brief. It is
a digest that looks calm while three sources are down and a Stichtag is
passing.

So an empty digest never renders as an empty digest. It renders as:

> **Nothing new this week.** 6 of 7 sources responded normally.
> NRW.BANK has not responded since 4 September — 3 scans missed.
> 14 opportunities remain under watch; nearest decide-by is 2 October.

---

## Rhythm around the week

- **Scan** overnight Sunday, so the digest is on the desk Monday morning
- **Digest** Monday, per client, to the responsible consultant — not to the client
- **Decisions** recorded during the week as they are taken
- **Re-qualification** triggered immediately on any profile edit, not held until Sunday

The client-facing version, when it comes, is the same content edited by a
consultant — never the raw digest forwarded. That is the "draft to the last
mile" rule, and it is also just good sense: the internal digest contains
the kill log, and a client should not read forty reasons they are
ineligible for things without a consultant framing it.

---

## What runs it

For one person with Claude Code, in ascending order of ambition:

1. **Manual weekly run.** A command, run Monday morning. No scheduling, no infrastructure, no missed-run liability. Start here — it is not embarrassing, and it forces you to read the output every week, which is exactly what version one needs.
2. **A cron job** producing the digest into the repository as a dated run folder.
3. **A scheduled agent session** that runs the scan, qualifies, writes the digest and commits it.

The jump from 1 to 3 is small once the pipeline works. The jump from
nothing to 1 is the whole project. Do not build the scheduler first.
