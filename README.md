# Agora — a tool suite for public affairs consultants

> Working concept. Nothing here is built yet; this repository is the design.

Public affairs consultants do not have a software problem. They have a
**context re-entry problem**.

Every task — a budget, a proposal, an amendment, a briefing, a monitoring
note — requires the same twenty facts: who the client is, what they sell,
where they operate, what file we are on, what we have already said in
public, who the rapporteur is, what she said in committee last March, what
we promised in the last steering meeting. A consultant re-assembles those
twenty facts from memory, from Outlook, from a shared drive, and from a
colleague who is on holiday — several times a day, for every client.

Generic AI tools do not fix this. They move the re-assembly into a chat
window: you paste the same background in for the fifteenth time, get a
fluent draft with a half-invented article number in it, and spend forty
minutes checking it. The tool was faster than writing. The task was not.

**Agora is built the other way round.** One shared context layer per
client account; every tool reads from it and writes back to it. Tools are
thin. The context is the product.

---

## The nine tools

| Tool | What it does | Replaces |
|---|---|---|
| **Ledger** | Budgets, retainer scoping, fee models, burn tracking | The partner's private Excel |
| **Pitch** | Proposals, RFP/tender responses, compliance matrices | Copy-paste from the last proposal |
| **Redline** | Legislative text review, version diffs, impact assessment | Three PDFs side by side on one screen |
| **Table** | Amendment drafting in institutional format, survival tracking | Word, and hope |
| **Signal** | Monitoring, filtered per client, into a client-ready brief | 400 unread Politico alerts |
| **Dossier** | Stakeholder cards, relationship graph, meeting history | A colleague's memory |
| **Whip** | Coalition and vote mapping, path-to-majority | A whiteboard photo in WhatsApp |
| **Readout** | Meeting packs before, structured readouts after | Notes that die in a notebook |
| **Bridge** | The dashboard: accounts, deadlines, burn, risk, time, compliance | Nothing. This is the gap. |

Full specifications: [`docs/01-tool-catalogue.md`](docs/01-tool-catalogue.md)

---

## Read in this order

1. [**The thesis**](docs/00-concept.md) — why the context layer is the product, and the three rules the suite is built on
2. [**Tool catalogue**](docs/01-tool-catalogue.md) — all nine tools, specified: inputs, outputs, the hard parts
3. [**Architecture**](docs/02-architecture.md) — the account graph, sources, how to actually build it
4. [**Roadmap**](docs/03-roadmap.md) — what to build first and why, scored
5. [**A day with it**](docs/04-day-in-the-life.md) — Tuesday, 08:10 to 18:30
6. [**Risks and guardrails**](docs/05-risks-and-guardrails.md) — the ways this goes wrong, and the design answers

---

## The three rules

**1. No source, no sentence.** Every factual claim in a generated
deliverable carries a citation to a document, an article, a URL, a dated
meeting note. A claim without a source is rendered as a visible gap for a
human to fill, never as fluent prose. In this trade a wrong article number
in a client note is not a bug, it is a lost account.

**2. Draft to the last mile, never to the client.** Every output is a
draft addressed to a consultant, not a deliverable addressed to a client.
Nothing sends itself. The suite's job is to move work from a blank page to
a good third draft, which is where the consultant's judgement starts
paying.

**3. Capture is a by-product.** No tool asks the consultant to maintain a
database. The stakeholder card updates because a readout was filed. The
timesheet drafts itself because documents were written and meetings
happened. If capture requires discipline, it will not happen — every firm
that has bought a CRM knows this.
