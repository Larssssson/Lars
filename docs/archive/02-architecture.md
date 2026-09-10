# Architecture

## Four layers

```
  SURFACES      Dashboard · Chat · Word/Outlook add-in · Teams/Slack · Mobile (Readout) · Email digest
                                        │
  TOOLS         Ledger · Pitch · Redline · Table · Signal · Dossier · Whip · Readout · Bridge
                each a skill: format knowledge + prompt + validators. Thin by design.
                                        │
  CONTEXT       ── THE ACCOUNT GRAPH ──
                clients · dossiers · files · documents · stakeholders
                positions · interactions · deliverables · commitments
                                        │
  SOURCES       EUR-Lex · OEIL · EP & Council agendas · national parliaments · registers
                press subscriptions · firm drive · Outlook · calendars · time system
```

Rule: **tools never talk to sources directly, and never to each other
except through the graph.** A tool that reaches around the graph creates
a second source of truth, and the second source of truth is where every
system like this starts to rot.

---

## The account graph

Nine entity types. That is the whole model, and keeping it at nine is a
design goal.

**Client** — the paying entity. Sector, jurisdictions, products, public
positions, competitors, key people, engagement history, commercial terms.

**Dossier** — a body of work for a client. Usually a policy area. Has
objectives, a strategy, a team, a budget, a term.

**File** — a legislative or regulatory object with an institutional
lifecycle: a proposal, a bill, a consultation, a delegated act, a case.
Files are shared across clients (many clients care about the AI Act); the
*client's position on* a file is not.

**Document** — an artefact with text: a legal text, a committee report, a
press piece, a paper we wrote. Versioned, with provenance.

**Stakeholder** — a person or institution. Cards, per Dossier.

**Position** — what a client thinks about a provision, at a date, with a
rationale and a fallback. Versioned, because positions move; the history
is what stops us contradicting ourselves in month nine.

**Interaction** — a meeting, call, email, event, submission. Who, when,
what was said, what was promised, whether it is declarable.

**Commitment** — something someone owes someone, with an owner and a date.
Extracted from interactions, surfaced in Bridge.

**Deliverable** — something we gave a client. Type, date, effort, which
sources it used, who approved it. Feeds the value report and the audit
trail.

### Two relationships carry most of the value

`Client —position→ File` — the consistency spine. Everything the suite
writes for a client on a file is checked against it, and drift is flagged
before it reaches a client, not after.

`Stakeholder —interaction→ Firm` — the relationship asset. Firm-wide, not
consultant-wide. This is the thing that makes a departing senior hire less
catastrophic, which is a genuine institutional argument for the project
and one worth making to whoever signs off the budget.

---

## Sources: what is realistically available

Ranked by effort, because this is where a project like this actually
stalls.

**Free, structured, reliable** — build against these first.
EUR-Lex (SPARQL endpoint and web services, full-text of everything);
the Legislative Observatory (OEIL) for procedure state; EP open data for
MEPs, committee composition, roll-call votes, tabled amendments; Council
public register for agendas and outcomes; Have Your Say for consultations;
national parliaments — the Bundestag's DIP API, Riksdagen's open data,
Folketing, Tweede Kamer — most Nordic and DACH parliaments publish
genuinely usable open data.

**Free, unstructured, tedious** — scraping, fragile, needs monitoring.
Committee draft agendas (often PDFs posted late), Commission DGs' own
pages, most regulators, most national gazettes, the Transparency Register's
own data.

**Paid, already subscribed** — Politico Pro, Contexte, Agence Europe,
MLex, Dods, Euractiv. Check terms before ingesting: most licences prohibit
systematic storage and redistribution. Realistic pattern: link and quote
briefly for the consultant's own use, never bulk-copy into a client
deliverable, and never redistribute. Get this reviewed by whoever handles
the firm's contracts, early — it constrains the design.

**Internal, highest value, hardest politically** — the firm's own drive,
Outlook, calendars, time-recording. The whole institutional-memory argument
depends on these, and access to them is a trust negotiation with partners,
not an integration ticket. Plan for it to take longer than the code.

---

## Build stack

The honest recommendation for a firm that is not a software company:

**Do not build a platform first.** Build skills against a file-backed
graph, in a repository, and only introduce a database when the file layout
visibly hurts. A year of "we're building the platform" with nothing in a
consultant's hands kills projects like this.

### Phase A — file-backed, no infrastructure

```
accounts/
  acme-pharma/
    client.md              profile, sector, jurisdictions, products
    positions/
      ai-act.md            positions with dates and fallbacks
      pharma-package.md
    dossiers/
      eu-market-access/
        dossier.md         objectives, strategy, team, budget, term
        interactions/      2026-03-12-meeting-rapporteur.md
        deliverables/
files/
  ai-act/
    texts/                 versions of the legal text, tagged
    analysis/              Redline output, versioned
    stakeholders/          per-person cards
firm/
  rates.yaml               rate card, seniority levels
  style/                   the style corpus, per language and type
  credentials/             case studies for Pitch
  templates/               proposal, briefing, readout, amendment formats
```

Markdown with YAML front matter. Version-controlled — which gives audit
trail, position history and "who changed this" for free, and lets the whole
thing start as a repository a consultant clones.

**Tools as skills.** Each tool is a folder: instructions, format templates,
worked examples, validators. Claude Code's skills model fits this exactly,
and it means a policy consultant who can write clearly can improve a tool
without touching code — which is the difference between a tool that evolves
and a tool that ossifies around whatever the first developer assumed.

**Sources as MCP servers.** One per source family: `eurlex`, `ep-opendata`,
`council`, `bundestag`. Each exposes search and fetch. Clean seam, testable
in isolation, and swappable when a source changes its API — which they do.

### Phase B — when the file layout hurts

It will hurt at: full-text search across thousands of documents; the
relationship graph (genuinely graph-shaped, painful in files); concurrent
editing; and per-client access control. At that point: Postgres with
pgvector for documents and retrieval, a graph representation for
relationships (or just recursive SQL — resist Neo4j until you have a query
that needs it), object storage for source documents, and the file
repository retained as the *editable* layer with the database as the index.

### Phase C — surfaces

Consultants live in Outlook and Word. A brilliant web app they must
remember to open loses to a mediocre Word add-in that is already there.
Prioritise: Word add-in (drafting, Redline output), Outlook add-in
(readouts, meeting packs), mobile voice capture for Readout, then the
Bridge web dashboard, and Teams for alerts. The dashboard is the *last*
surface to build well, not the first — which is the opposite of how these
projects are usually scoped.

---

## Model routing

Not everything needs the largest model, and not everything tolerates the
smallest.

| Work | Needs |
|---|---|
| Legal interpretation, impact assessment, amendment drafting | Strongest available model, extended reasoning, full source text in context |
| Diffing, summarising, extraction, reformatting | Mid-tier; volume matters more than depth |
| Relevance scoring, deduplication, routing | Small and fast; runs on thousands of items an hour |
| Anything client-facing | Strongest, plus a second-pass check against sources |

Cache the standing context per account aggressively — it is the same
several thousand tokens on every call for that client, all day. Prompt
caching turns the context layer from a cost problem into a cost advantage.

---

## Evaluation

Build this from day one or the suite drifts and nobody notices until a
client does.

**Golden sets.** Twenty legislative texts with expert-written obligation
tables. Thirty past monitoring items with human relevance labels per
client. Fifteen past budgets with actual outturns. Ten past votes with the
real results. Score every release against them.

**Shadow mode.** For the first months, tools run alongside the human and
nobody sees the output but the team building it. Compare. The gap between
"impressive in a demo" and "correct on the twentieth real file" is where
this project lives or dies.

**A calibration ledger.** Every confidence score Whip and Redline emit is
logged and scored against what happened. Report the accuracy openly,
internally. A tool that says "70% confident" and is right 70% of the time
is trustworthy; one that is right 40% of the time needs to say 40%.
