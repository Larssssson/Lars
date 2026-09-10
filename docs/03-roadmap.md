# What to build first

## Scoring

Every candidate scored 1–5 on four axes:

- **Freq** — how often a consultant does it
- **Pain** — how much it is hated
- **Fit** — how well it suits current AI (structured input, checkable output)
- **Risk** — consequence of being wrong (**lower is better to build early**)

| Tool | Freq | Pain | Fit | Risk | Verdict |
|---|:--:|:--:|:--:|:--:|---|
| **Readout** (packs + capture) | 5 | 4 | 5 | 2 | **Build first.** Daily, hated, safe, and it seeds the graph |
| **Signal** (monitoring → brief) | 5 | 5 | 4 | 3 | **Build first.** Highest visible pain, immediate client-facing value |
| **Redline** (review + diff) | 3 | 5 | 4 | 4 | **Build second.** Biggest single time sink; needs care |
| **Ledger** (budgets) | 2 | 4 | 5 | 2 | **Build second.** Cheap, self-contained, instantly loved |
| **Bridge** (dashboard) | 5 | 3 | 3 | 1 | **Grows.** Starts as a flag list; a dashboard with no data is a demo |
| **Pitch** (proposals) | 2 | 5 | 4 | 3 | Phase 2 — depends on a credentials library existing |
| **Dossier** (stakeholders) | 4 | 3 | 3 | 3 | Phase 2 — accumulates from Readout, so it builds itself |
| **Table** (amendments) | 2 | 4 | 3 | 5 | Phase 3 — highest craft, highest risk, needs Redline first |
| **Whip** (vote mapping) | 2 | 3 | 3 | 5 | Phase 3 — needs a dense Dossier and back-testing to be trusted |

The ordering has a logic beyond the scores: **the early tools feed the
graph the later tools need.** Readout fills Dossier. Signal fills file
state. Redline fills positions. Build Whip first and it has nothing to
reason over.

---

## The wedge

If you build one thing, build **Readout**.

Not because it is the most impressive — Redline is — but because:

- Every consultant has 3–8 meetings a week. Adoption is immediate and
  visible.
- The meeting pack is a genuine gift: it removes the 07:45 scramble
  before a 09:00 with a rapporteur's assistant, and it is obviously
  better than what the consultant would have done in fifteen minutes.
- Being obviously useful *before* it asks for anything is what earns the
  right to ask for the readout — which is the part that fills the graph.
- Risk is low. A meeting pack with an error is caught by the consultant
  reading it on the metro. A client note with an error is not.
- It produces the demo that unlocks internal funding: a partner walks into
  a meeting with a pack nobody spent an hour making.

The failure mode to design against: consultants take the pack and never
file the readout. If that happens, the graph starves and the whole suite is
just a document generator. Countermeasures, in order of importance: voice
capture on a phone that takes thirty seconds; the readout auto-drafting
the follow-up email the consultant has to write anyway; and Bridge showing
open commitments that only exist if readouts are filed.

---

## Phases

### Phase 0 — Foundation (weeks 1–4)
The account graph schema, and one client's account populated by hand. A
repository, markdown, no infrastructure. Do this for a *real* client, not
a fictional one — fictional clients hide every hard problem. One
consultant, closely involved, who wants this to exist.

### Phase 1 — The wedge (weeks 5–12)
Readout end to end: calendar-triggered meeting packs, voice capture,
structured filing, commitments into tasks. Signal for one client: sources,
relevance profile, weekly brief draft. Bridge as a flag list, nothing more.

*Success test:* the pilot consultant complains when it breaks. That is the
only adoption metric that means anything.

### Phase 2 — The analysis engine (months 4–7)
Redline: obligation extraction, then the version diff, then impact
assessment. Ledger. Signal across the whole client base. Dossier cards
accumulating from Phase 1's readouts.

*Success test:* an analysis a senior consultant sends to a client after
editing rather than rewriting.

### Phase 3 — The craft tools (months 8–12)
Pitch with a real credentials library. Table with survival tracking. Whip
in shadow mode, back-tested against votes that already happened, and not
shown to anyone outside the team until its calibration is honest.

*Success test:* a pitch won where the compliance matrix or the credentials
match made a visible difference.

### Phase 4 — Institutionalisation (year 2)
Compliance module and register filings. Timesheet drafting. Firm-wide
relationship graph across offices. Full institutional-memory search.
Client-facing portal, if and only if the graph is dense enough that the
portal shows something a client cannot get elsewhere.

---

## Measuring whether it worked

**Do not measure "time saved".** It is unfalsifiable, everyone inflates
it, and it makes people defensive about their own speed.

Measure instead:

| Metric | Why it is honest |
|---|---|
| Realisation rate | Does the firm bill more of what it works? Real money, on the P&L |
| Non-billable share | The suite should shrink admin, not billable analysis |
| Time from event to client note | Was the client told first? Directly competitive |
| Readouts filed per meeting held | The health of the graph. If it drops, everything downstream is dying |
| Proposal win rate, by whether Pitch was used | Slow signal, but the one management cares about |
| Amendment survival rate | The only objective measure of policy craft |
| Whip calibration | Predicted vs actual, published internally |
| Deliverables per €10k of fee | Value density; the renewal conversation in one number |

And one qualitative test that beats all of them: **when the tool is down
for a day, does anyone notice?**

---

## What not to build

Worth writing down, because these will all be suggested:

**An LLM that answers "what does EU law say about X" from memory.** It
will be wrong in ways that look right. Every answer comes from a retrieved
document or there is no answer.

**Automated client emails.** The relationship is the business. A client
who suspects the analysis is machine-sent stops paying for judgement.

**A prediction market on legislative outcomes.** Fun, demo-friendly,
uncalibrated, and a single confident wrong call destroys more trust than
fifty right ones build.

**Automated register filings.** Legally significant statements. A human
signs, every time.

**Scraping anything the firm's press licences forbid.** Cheap to do,
expensive to be caught doing.

**A general-purpose "ask anything" chatbot as the main surface.** It
demos beautifully and it teaches consultants nothing about what the suite
is actually good at. Specific tools with specific outputs get used.
