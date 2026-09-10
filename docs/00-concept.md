# The thesis

## What the job actually is

Strip the glamour off public affairs and the work is four verbs, repeated
across every client and every file:

**Know** what is happening (monitoring, intelligence, stakeholder mapping)
**Judge** what it means for this client (impact assessment, risk, options)
**Say** something about it (papers, amendments, briefings, talking points)
**Show** that you did it (reports, readouts, registers, invoices)

A consultant's billable hour is spent almost entirely in *Judge*. That is
the part clients cannot do themselves and the reason the retainer exists.

Almost every consultant's actual day is spent in *Know*, *Say* and *Show*.
Reading agendas. Reformatting a paper into a one-pager. Writing the
readout. Filling in timesheets. Assembling the quarterly report. Rebuilding
the same budget model in a fresh spreadsheet because last quarter's is
buried in a subfolder.

**The suite's entire purpose is to give hours back to *Judge*.** Any tool
that automates judgement is building the wrong thing — it produces
confident, unaccountable advice, which is the one product a public affairs
firm cannot sell. Any tool that automates *Know*, *Say* and *Show* is
printing money.

---

## Why the context layer is the product

Consider a real, small task: a client asks what a Council general approach
means for them. To answer it you need:

- the Council text, and the Commission proposal it modifies
- the diff between them, at article level
- the client's product portfolio and which articles bite on it
- what we told this client three weeks ago (so we don't contradict it)
- what the client has said publicly (so we don't contradict *them*)
- who moved the text in Council and whether it holds in trilogue

Six context objects. A generic chat tool has none of them, so you paste,
and paste, and the answer is only as good as what you remembered to paste.
A tool suite that has all six *standing* answers the question in one
sentence of prompting — and answers the next forty questions too.

So the architecture is inverted from how software like this usually gets
built. Not: nine apps that each hold their own data. Instead:

```
                    ┌──────────────────────────────┐
                    │      THE ACCOUNT GRAPH        │
                    │  clients · dossiers · files   │
                    │  stakeholders · positions     │
                    │  interactions · deliverables  │
                    └──────────────┬───────────────┘
                                   │
   ┌────────┬────────┬────────┬────┴───┬────────┬────────┬────────┐
 Ledger   Pitch   Redline   Table   Signal  Dossier   Whip   Readout
   └────────┴────────┴────────┴────────┴────────┴────────┴────────┘
                                   │
                          Bridge (the dashboard)
```

Each tool is a few hundred lines of prompt, format knowledge and
validation. The graph is the asset. Rip out any tool and the firm loses a
convenience; rip out the graph and it loses its memory.

The strategic consequence: **the suite gets better the longer the firm uses
it**, because the graph accumulates. That is a moat a competitor cannot
buy, and it is the argument for building rather than licensing.

---

## The three rules

### 1. No source, no sentence

Every factual assertion in a generated deliverable carries a pointer: an
article reference, a document ID, a URL, a dated meeting note. Unsourced
claims are not smoothed into fluent prose — they render as an explicit gap:

> The rapporteur has signalled openness to a transition period.
> `[UNSOURCED — verify before sending]`

This is not a nicety. A hallucinated article number in a client note is a
lost account, and worse, a client who acts on it. Fluency is the enemy
here: the failure mode of language models in this profession is being
*persuasively* wrong about a recital that does not exist. The design
answer is to make unsourced statements visibly ugly.

Corollary: **retrieval over recall.** The suite never answers from the
model's memory of EU law. It answers from a document it just read, and
tells you which one.

### 2. Draft to the last mile, never to the client

Nothing the suite produces is addressed to a client. Every output is
addressed to a consultant, in draft, with its own uncertainty marked.
Nothing auto-sends. Nothing auto-files to a register. Nothing auto-posts.

This is partly liability and partly craft: the value a consultant adds is
in the last 20% of a document, and a tool that pretends to deliver 100%
takes away the 80% *and* the incentive to check. A tool that honestly
delivers a good third draft with the weak spots flagged is used forever.

### 3. Capture is a by-product

The graph is only valuable if it is populated, and every firm that has
bought a CRM knows what happens when populating it is a task: it does not
get populated.

So no tool in this suite asks anyone to maintain a database. Instead:

- File a meeting readout (which you want, because it writes your follow-ups) → the stakeholder card updates itself
- Draft a paper (which you were doing anyway) → the position library learns what we now say
- Do a week of work → the timesheet arrives pre-drafted for approval
- Log a Commission meeting in the readout → the Transparency Register return builds itself

Every capture mechanism is bolted onto something the consultant already
had selfish reason to do. Where that isn't possible, the data doesn't get
captured, and the suite is designed to work without it.

---

## What this is *not*

**Not a monitoring subscription.** Politico, Agence Europe, Contexte,
MLex, Dods already do feeds well, and better than you will. Agora consumes
them; it does not compete with them. The value added is the step nobody
sells: turning a feed into *this client's* two-paragraph note.

**Not a CRM.** Salesforce with a lobbying skin has been tried repeatedly
and dies of data-entry starvation. The graph is populated by rule 3 or not
at all.

**Not a replacement for the consultant's network.** The suite makes a
consultant's relationships more legible and more transferable within the
firm. It does not create them, and a tool that pretends it can will be
resented by exactly the senior people whose buy-in decides whether it is
adopted.

**Not, initially, a client-facing product.** Build it as an internal tool
where mistakes are cheap and the feedback loop is a colleague down the
corridor. There is a client portal in this eventually — see the roadmap —
but selling before the graph is dense is selling an empty database.
