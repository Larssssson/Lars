# Qualification

The engine. Three stages, and the split between the first two is the most
important design decision in the system.

---

## Stage 1 — Knockouts

**Code, not model judgement.** Binary questions with checkable answers,
evaluated deterministically, each writing an audit line.

A model asked "is this company a KMU?" will sometimes answer from
impression. Code given a headcount, a turnover, a balance sheet total and
an ownership structure gives the same answer every time, and can be pointed
at the rule it applied. Eligibility is exactly the kind of question that
should never be decided by inference.

### Funding knockouts

| Rule | Kills when |
|---|---|
| Deadline passed | Stichtag or Skizzenfrist is behind us |
| Deadline unreachable | A Vollantrag is due in fewer days than one takes to prepare |
| Rechtsform | Legal form excluded by the Richtlinie |
| KMU test | Required and failed, including group consolidation |
| Standort | No Betriebsstätte in a required Land or Fördergebiet |
| **Vorhabenbeginn** | Project already started, no vorzeitiger Maßnahmenbeginn |
| De-minimis | Headroom below the programme's likely award |
| Kumulierung | Same costs already funded elsewhere |
| Sector exclusion | WZ-Code or activity excluded |
| Unternehmen in Schwierigkeiten | AGVO exclusion triggered |
| Antragsteller type | Requires a Hochschule, a Kommune, a Verbund the client will not join |

### Procurement knockouts

| Rule | Kills when |
|---|---|
| Frist passed or unreachable | Bewerbungsfrist or Angebotsfrist, whichever binds first |
| Mindestumsatz | Client's relevant-field turnover below the floor |
| References | No comparable reference of required value, scope or recency |
| Qualifications | Named personnel qualifications not held |
| Präqualifikation | Required, not held, cannot be obtained in time |
| Geography | Delivery location outside what the client can serve |
| Legal form or Eignung | Formal requirement unmet, and Eignungsleihe not permitted |
| Los structure | Only Lose the client cannot serve |

### The audit line

Every kill records the rule, the client value, the required value, the
source, and the retrieval date:

```
KILLED  BMWK Klimaschutzverträge — Runde 3
  rule:      vorhabenbeginn
  client:    project start 2026-03-01 (cases/muster-gmbh/projects/…yaml, as_of 2026-08-14)
  required:  no start before Zuwendungsbescheid
  source:    Förderrichtlinie §7 Abs. 2 — foerderportal.bund.de/…, retrieved 2026-09-08
  reversible: only via vorzeitiger Maßnahmenbeginn, application still open
```

That last field matters. **Some kills are reversible** — a
Bietergemeinschaft fixes a Mindestumsatz failure, Eignungsleihe fixes a
missing qualification, a vorzeitiger Maßnahmenbeginn can rescue a start
date, a de-minimis ceiling resets with the fiscal year. A kill flagged
reversible is not a dead end, it is **a piece of advice**: here is what the
client would have to change to be eligible.

That is arguably the most commercially valuable output in the system, and
it only exists because the rejections were logged rather than filtered
away.

---

## Stage 2 — Assessment

What survives goes to a model, for the questions that need reading rather
than arithmetic. Every claim quotes the source document.

**Fit.** Does the project actually serve the Förderzweck, or merely touch
it? Does what the client does map onto the Leistungsbeschreibung? Stated in
one or two sentences with the relevant lines quoted.

**Money.** For funding: eligible cost base × Förderquote, with the AGVO
article and rate band named, and the enterprise-size and collaboration
bonuses shown as applied. For procurement: contract value or framework
volume, Lose, term and renewal options.

**Competition.** For procurement this is real intelligence and it is
public: award notices name who won comparable contracts and at what price.
Three past awards tell a client more about their chances than any amount of
strategy. For funding: how oversubscribed the programme looks, whether it
is a two-stage Skizze competition, how many awards the last round made.

**Effort.** An honest estimate in consultant-days and client-days. A
Projektskizze is not a Vollantrag is not a Verbundantrag with four
partners; a tender with a 70/30 quality weighting is not one decided on
price. Effort is what turns a shortlist into a decision.

**Strategic value beyond the money.** A reference that unlocks a category.
A framework position that pays out for four years. A relationship with a
Projektträger or a Vergabestelle that will matter again. Consultants weigh
this instinctively; writing it down is what makes a no-go defensible.

---

## Stage 3 — The brief

One page per survivor. Fixed structure, so a consultant can read forty of
them a month without re-orienting.

```
─────────────────────────────────────────────────────────────
ZIM — Kooperationsprojekt (AiF Projekt GmbH)                GO
─────────────────────────────────────────────────────────────
FRIST        Skizze: none — laufend. Vollantrag: rolling.
             Realistic submission: 6–8 weeks from decision.
             [Richtlinie §9, retrieved 2026-09-08]

GELD         Eligible costs ≈ €820k (Personal €610k, Fremd €210k)
             Rate 45% (kleines Unternehmen, industrielle Forschung,
             +10 KMU, +15 Kooperation, AGVO Art. 25)
             ≈ €370k Zuschuss

PASST WEIL   Programme targets pre-competitive R&D with a named
             partner. Client's electrolyser stack work is TRL 4–5.
             "…industrielle Forschung und experimentelle
             Entwicklung…" [Richtlinie §2]

RISIKO       Kooperationspartner not yet secured — the programme
             requires a signed Kooperationsvereinbarung at
             application. TU Cottbus contact exists but unconfirmed.

AUFWAND      Consultant ≈ 6 days. Client ≈ 4 days, mostly technical
             description and cost planning.

EMPFEHLUNG   GO. Best money-to-effort ratio on this shortlist, and
             the partner requirement is solvable. Decide by 2026-10-15
             to keep the 8-week runway.
─────────────────────────────────────────────────────────────
```

Notes on the format:

- **The deadline is quoted, never computed.** Shown with its source and
  retrieval date. A wrong Frist is the error most likely to cause real harm.
- **The rate is shown as assembled**, not as a number. A consultant needs to
  check the arithmetic, and a client will ask where 45% came from.
- **Risk is what survived the knockouts but is not certain** — the things a
  deterministic rule could not settle.
- **The recommendation carries a decide-by date**, because the real
  constraint is usually the runway, not the deadline.

---

## Scoring, and why it is deliberately crude

Every ranked list invites a false-precision score. Resist it. Three bands:

**GO** — eligible, worth the effort, act now
**WATCH** — eligible but blocked on something knowable: a partner, a
reference, a fiscal year rolling over, a decision the client has not taken
**NO-GO** — survived the knockouts but not worth pursuing, with a reason

A 0–100 score implies a calibration nobody has. Three bands and a written
reason are more useful and more honest, and they force the sentence that
actually carries the judgement.

---

## Learning from decisions

Every go/no-go is recorded with its reason, and every outcome — submitted,
won, lost, abandoned — is recorded against it. Over a year this produces:

- **Which knockout rules fire most**, and therefore which client profile
  fields are worth maintaining properly
- **Which reversible kills were actually reversed**, which is the evidence
  that the advice is worth giving
- **Whether the effort estimates were right**, which is the only way they
  become right
- **Win rate by opportunity type**, which eventually makes the go/no-go
  recommendation evidence-based rather than a considered guess

None of that requires machine learning. It requires writing the decision
down next to the outcome, which almost nobody does.
