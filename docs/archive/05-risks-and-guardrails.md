# Risks and guardrails

The ways this goes wrong, roughly in order of how likely they are to
actually happen.

---

## 1. Adoption failure — the most likely outcome

Not a technical risk. The default fate of internal tools at professional
services firms: built, demoed, praised, unused.

**Why it happens.** Senior people are the ones with the context worth
capturing, and they are the ones with the least patience for new software
and the most legitimate scepticism. If the suite asks a Director to change
how they work before it has given them anything, it is dead.

**Design answers.**
- Give before asking. Meeting packs arrive before anyone is asked to file a readout.
- Meet people where they already are: Outlook, Word, phone. Not a new portal.
- One pilot consultant who genuinely wants this, deeply involved, on real accounts.
- Never gate anything. If a tool is mandatory, the honest signal about whether it is any good is gone forever.
- Watch the readout-filing rate weekly. It is the leading indicator of everything.

---

## 2. The fluent-and-wrong problem

The characteristic failure of language models in this profession is not
gibberish, it is a beautifully written paragraph citing Article 17(4) of a
regulation whose Article 17 has three paragraphs. It reads like the work of
a competent junior. It is caught by an expert, sometimes.

**Design answers.**
- Retrieval only. No answer from model memory about what a text says, ever.
- Every citation validated against the actual document before it renders. A citation that does not resolve is an error, not a warning.
- Unsourced claims rendered as visible gaps, not smoothed into prose.
- Two-pass verification on anything client-facing: generate, then check each claim against sources in a separate pass.
- Confidence stated, and calibrated against outcomes, not vibes.
- Cultural rule, stated out loud and repeatedly: **the consultant who sends it owns it.** No "the tool said so" has ever been an acceptable answer to a client, and pretending otherwise creates the conditions for the one incident that ends the project.

---

## 3. Client confidentiality and competing mandates

A public affairs firm routinely serves clients on opposite sides. The
suite's central premise — one graph, richly connected — is in direct
tension with the Chinese walls that make that possible.

**Design answers.**
- Segregation enforced at the retrieval layer, not by prompt instruction. A prompt asking a model not to mention something is not a control.
- Access control on the Client and Dossier entities, inherited by everything beneath.
- Shared entities (a File, a public Stakeholder record) are readable across accounts; the *client's position on* a file never is.
- Ethical-wall flags that hard-block retrieval between designated accounts.
- Full audit log: who retrieved what, when. Answerable when a client asks — and one eventually will, probably during a pitch.
- Get this reviewed externally before any second client is onboarded, not after.

---

## 4. Data protection — the one that gets underestimated

Dossier holds structured, systematically-processed records about
identifiable people, many of them public officials, held for commercial
purposes. That is squarely within GDPR, and "it's all public information"
is not the defence people assume it is: aggregating public data into
profiles is itself processing, and profiling has its own rules.

**Design answers.**
- Lawful basis established per category before build, with actual legal advice. Legitimate interest is probably available; it needs a documented balancing test, not an assumption.
- A hard, enforced line between **professional record** (voted, said, holds this role, met us on this date) and **personal note** (opinions about someone's character, their private life). The second category should probably not exist in the system at all. Decide this explicitly and early — retrofitting a deletion is much worse than never collecting.
- Retention limits with automatic expiry. A stakeholder card from 2019 about someone who left politics in 2021 is a liability, not an asset.
- Subject-access readiness: if an MEP asks what you hold on them, the answer must be producible in days, and must not be embarrassing.
- Transparency Register and national lobbying regimes have their own disclosure rules that interact with all of this.

---

## 5. Over-automation eroding judgement

A subtler risk, on a longer horizon. If juniors never assemble a briefing
from scratch, do they learn how a file works? The reconstruction work the
suite removes is also how consultants build intuition. In ten years, does
the firm have seniors who can tell when the tool is wrong?

**Design answers.**
- Tools show their working — the diff, the sources, the reasoning — rather than only the conclusion. Reading a good analysis with its sources is itself training.
- Juniors review tool output against sources as an explicit part of the job, framed as apprenticeship rather than QA.
- Deliberately keep some things manual. Amendment drafting and political strategy are craft; the tool assists and never leads.
- This is a real cost, not a solved problem. Name it, watch it, revisit it annually.

---

## 6. Source fragility

The suite depends on a dozen external sources, most of them public-sector
websites that change without notice and were not built for machine access.
Half the maintenance burden of this project will be here, and it never
appears in the initial estimate.

**Design answers.**
- Every source behind its own adapter with its own tests.
- Health monitoring: a source that returns zero results for 48 hours raises an alarm rather than silently producing an empty brief.
- Graceful degradation: an empty brief must say "three sources unavailable", never look like a quiet week.
- Budget maintenance explicitly. Roughly 30% of ongoing engineering, forever.

---

## 7. Licensing on paid content

Politico Pro, MLex, Contexte and similar have terms that generally prohibit
systematic copying, storage and redistribution. Ingesting them into a
searchable client-facing system is very plausibly a breach, and these are
publishers with active enforcement and relationships across the industry.

**Design answers.**
- Legal review of every subscription's terms before ingesting a single article.
- Default to link-and-short-quote for internal use; never bulk-store; never reproduce into a client deliverable.
- Where a licence permits more, get it in writing; where it does not, treat the source as read-only for humans.

---

## 8. The EU AI Act, on your own doorstep

A firm advising clients on the AI Act while deploying an internal AI system
should be visibly beyond reproach about it. Most of this suite is
low-risk, but two things deserve attention: anything touching employment
decisions (do not let timesheet or capacity data feed performance
assessment without thought — that direction leads to high-risk
classification), and transparency obligations toward clients about
AI-assisted deliverables.

**Design answers.**
- Document the classification analysis; it is cheap now and expensive later.
- Decide the client-disclosure position deliberately. The defensible one, and probably the commercially better one: be straightforward that AI assists production while a named consultant is accountable for every deliverable. Clients increasingly expect this; being caught not saying it is far worse than saying it.
- Keep the timesheet and capacity data walled off from HR processes by design.

---

## 9. Cost drift

Long contexts, strong models, many clients, continuous monitoring. Costs
can grow quietly to a number that makes the project look bad in a budget
review even while it is working.

**Design answers.**
- Route by task: small models for filtering and routing, strong models only for analysis and client-facing text.
- Cache standing account context aggressively — it is the same tokens on every call for that client.
- Batch monitoring rather than streaming everything through a large model.
- Report cost per account against fee per account, monthly. If the suite costs 0.5% of an account's fee it is invisible; at 5% it needs defending, and you want to know which one is true before someone else asks.

---

## The single biggest risk, stated plainly

**Building all nine tools before anyone uses one.**

Every failure mode above is survivable except this one. A year of platform
work with nothing in a consultant's hands produces a system built on
assumptions about a job nobody involved is currently doing, and by the time
it meets reality the budget is spent and the goodwill with it.

Build Readout. Put it in one consultant's hands in eight weeks. Let them
tell you everything in this repository that is wrong.
