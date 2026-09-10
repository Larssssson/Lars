# Risks

Ordered by how much damage they do, not how likely they are.

---

## 1. False negatives — invisible, and the reason this could quietly fail

The system misses an opportunity the client was eligible for. Nobody finds
out. The client never learns what they did not receive, you never learn the
scan was incomplete, and confidence in a tool that is actually 60% complete
grows steadily for a year.

Every other failure announces itself. This one does not.

**Answers.**
- Measure recall deliberately and repeatedly: back-test against opportunities the firm knows about from other routes, and treat the number as the system's headline metric.
- Cast wide at ingestion. Never filter silently; over-inclusion at scan and match is a design commitment, not a tuning parameter.
- Publish coverage in every digest. A hole that is stated is manageable; a hole that is hidden is the failure above.
- Keep a manual tripwire: whenever you hear about an opportunity from any other source, check whether the system had it. Log the misses.

---

## 2. Eligibility stated wrongly

"You are eligible for this" is a claim a client acts on — by committing
staff time, by delaying a project start to preserve Vorhabenbeginn, by
turning down other funding to protect de-minimis headroom. Being
persuasively wrong here is materially worse than being wrong about a policy
summary.

**Answers.**
- Eligibility knockouts are deterministic code with tests, never model judgement.
- Every eligibility statement quotes the Richtlinie or Bekanntmachung line, with the retrieval date.
- Rates are shown as assembled — article, band, bonuses — never as a bare percentage.
- Profile fields carry `source` and `as_of`; anything unsourced renders as an assumption everywhere it propagates.
- The brief distinguishes *the programme requires X and your profile records Y* from *you are eligible*. The first is a factual comparison. The second is a conclusion, and it belongs to the consultant.

---

## 3. A wrong deadline

If a client misses a Frist because the system displayed the wrong date, the
conversation that follows is not about software. On the procurement side
there is a second edge: §160 GWB gives a very short window to raise a Rüge,
so a misread date can foreclose a remedy as well as a bid.

**Answers.**
- Deadlines are **quoted, never computed**, and always shown with source and retrieval date.
- Where a programme has multiple dates — Skizze, Vollantrag, Bewerbungsfrist, Angebotsfrist, Bindefrist — all are shown, with the binding one marked.
- The brief carries a *decide-by* date derived from preparation runway, visibly distinct from the official deadline.
- Any notice whose date parsing is ambiguous is flagged for human reading rather than guessed.

---

## 4. The RDG boundary

Germany's Rechtsdienstleistungsgesetz restricts legal services by
non-lawyers. Fördermittelberatung and bid support are generally
unproblematic as ancillary services, but a system that produces
confident-sounding conclusions on the application of AGVO, de-minimis
regulation or Vergaberecht to a specific client is drifting toward
something that reads like a legal opinion.

**Answers.**
- Phrase throughout as factual comparison, not entitlement — the wording rule in risk 2 is doing double duty here.
- No output ever assesses the lawfulness of a Vergabeverfahren or advises on a Nachprüfungsverfahren. That is a lawyer's work and the system should say so and stop.
- Get the output format looked at by someone who knows the boundary before anything goes to a client. This is cheap now and expensive later.

---

## 5. Below-threshold coverage that is quietly incomplete

The Unterschwellenbereich has no complete open aggregator. By count, most
opportunities sit there. A system that scans TED and the federal service
and presents itself as covering German public procurement is overclaiming.

**Answers.**
- Per-Land coverage statement in every digest, naming what is scanned and what is not.
- Scope the promise honestly to whoever reads it: above threshold plus the Land platforms relevant to this client.
- Add Land platforms one at a time, driven by client need, and update the statement.

---

## 6. Source fragility

A dozen sources, most of them public-sector sites that change without
notice. Around a third of ongoing effort, forever, and it appears in no
initial estimate.

**Answers.**
- One adapter per source, independently testable.
- Health monitoring: zero results for 48 hours raises an alarm.
- Degradation that is loud rather than silent — see the quiet-week rule in [cadence](04-cadence.md).

---

## 7. Two clients, one opportunity

Not a technical problem, and it does not exist yet at one user — but it
arrives the moment a second consultant uses this. Two clients eligible for
the same tender, or competing for the same oversubscribed call, is a
conflict that needs a human decision and a firm policy.

**Answers.**
- Flag the overlap when it occurs; never resolve it automatically.
- Decide the policy before the second consultant is onboarded, not at the moment it first bites.

---

## 8. Scope creep into writing the application

The most predictable pressure on this project. It will be obvious, once the
shortlist works, that the system could draft the Projektskizze — and the
first draft will look good.

**Answer.** The scoping decision holds: a fabricated eligibility claim in
an internal shortlist costs ten minutes; the same claim inside a submitted
application costs a client real money and may amount to a false declaration.
The line is easier to hold if it is never crossed. Revisit it deliberately
in a year, with evidence, rather than drifting across it in a fortnight.

---

## 9. It works, and then it is one person's

Everything in this repository is built by one person, runs on one machine,
and lives in one head. That is the right call for now — it removes the
adoption risk that killed the previous design. It becomes a liability the
moment it is genuinely useful.

**Answers.**
- Keep the eligibility rules, profiles and reference data as readable data files, not embedded logic. Someone else must be able to read why an opportunity was killed without reading code.
- Write down decisions and outcomes as they happen; that record is the part that cannot be reconstructed later.
- When it works, the question to answer is not "how do we roll this out" but "who else would be better off with it" — and, given the answer to how it is built, whether they have the means to run it at all.
