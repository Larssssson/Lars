# Agora — Förder- und Vergabe-Radar

> Working design. Nothing is built yet; this repository is the specification.

Enter a case — a client, a project, a prospect, or four scribbled lines
from a phone call — and the system scans German and EU public funding
programmes and public procurement notices, kills everything the client
cannot actually win, and returns a short list of qualified opportunities
with a go/no-go recommendation on each.

Weekly, per client, standing.

---

## The one idea

**Matching is a commodity. Qualification is the product.**

Keyword and CPV matching is already sold by Vergabe24, subreport, the
Deutsches Ausschreibungsblatt and every Fördermitteldatenbank on the
market. A system that outputs "47 hits" has rebuilt something a client can
buy for a few hundred euros a year.

The consultancy value sits one step later, and it is the step nobody sells:

> Is this client genuinely antragsberechtigt? What is the Förderquote once
> AGVO Art. 25 and their KMU status are applied? Is there de-minimis
> headroom left this year? Has Vorhabenbeginn already killed it? Is the
> real deadline the Vollantrag date or the Skizze-Stichtag six weeks
> earlier? For a tender: do they clear the Eignungskriterien, and who won
> the last three comparable Vergaben?

That is a hundred fiddly, checkable rules sitting on public documents. It
is exactly the work a well-built system carries and a human should not be
doing at 22:00.

---

## The governing asymmetry

The two error types are not symmetrical, and the whole design follows from
this:

| | Cost | Visibility |
|---|---|---|
| **False positive** — surfaced something ineligible | Ten minutes of reading | Immediate, self-correcting |
| **False negative** — missed something they could have won | Potentially millions, and the account | **Never discovered** |

So: **cast wide, kill late, log every kill.**

Nothing is filtered silently at ingestion. The net is deliberately
over-inclusive; the elimination happens at the qualification stage, where
every rejection is recorded with the rule that fired and the line of the
Bekanntmachung that triggered it.

**The rejection log is a feature, not debug output.** A scanner you cannot
audit is a scanner you cannot stake a client relationship on. "37 killed,
here is why each" is the output that earns trust — and the only one that
lets you catch the engine being wrong.

---

## The pipeline

```
   CASE INTAKE          four input shapes, one eligibility profile
        │               interrogates for what's missing, highest-information question first
        ▼
   SCAN                 TED · Datenservice Öffentlicher Einkauf · service.bund.de
        │               Förderdatenbank · Förderportal · Projektträger · 16 Länder-Förderbanken
        │               EU Funding & Tenders Portal · KfW · BAFA — all open data
        ▼
   MATCH                deliberately loose. CPV sets, Förderzweck, sector, region, volume
        │
        ▼
   QUALIFY              ① deterministic knockouts, each logged
        │               ② model assessment of fit, money, competition, effort — every claim sourced
        ▼
   BRIEF                one page per survivor: what, when really, how much,
        │               why it fits, what could still disqualify, go / no-go / watch
        ▼
   DIGEST               weekly, per client: act now · new · changed · coverage note
                        state carried week to week, so "new" means new
```

---

## Read in this order

1. [**Concept**](docs/00-concept.md) — why qualification is the product, and what the system deliberately refuses to do
2. [**The case**](docs/01-the-case.md) — four input shapes, one profile; the eligibility spine; the intake interrogation
3. [**Sources**](docs/02-sources.md) — the German and EU open-data map, honestly graded, including where coverage is genuinely incomplete
4. [**Qualification**](docs/03-qualification.md) — the knockout rules, the fit assessment, the brief format
5. [**Cadence**](docs/04-cadence.md) — the weekly digest, state, re-surfacing, and why an empty week must announce itself
6. [**Build plan**](docs/05-build-plan.md) — four weeks, one person, Claude Code
7. [**Risks**](docs/06-risks.md) — false negatives, eligibility hallucination, deadline liability, and the RDG boundary

The earlier nine-tool concept is in [`docs/archive/`](docs/archive/), with
a note on what carried forward and what was wrong.

---

## Scope decisions already made

**Both funding and procurement**, one system, one case object — though the
qualification logic barely overlaps and is built as two rule sets.

**Stops at the qualified shortlist.** It does not draft the Projektskizze,
the Vorhabenbeschreibung or the tender response. That was a deliberate
scoping decision: a hallucinated eligibility claim inside a submitted
application costs a client real money, and the line is easier to hold if
it is never crossed.

**Open sources only.** No paid database subscriptions, so no licence
constraints on storage or reuse — which also means the system can be
demonstrated to anyone without a procurement conversation first.

**Public data first.** An eligibility profile — Rechtsform, KMU status,
Betriebsstätte, de-minimis headroom — is not confidential material. Version
one works without a single client document, so it does not wait on a data
policy.

**One person, four weeks, one real client.** Not a rollout. The design
generalises later; it is built now to be useful to exactly one consultant.
