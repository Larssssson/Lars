# Concept

## What the work actually is

A consultant asked to find funding or contracts for a client does five
things, and only one of them is worth a consultant's hourly rate.

1. **Find** what is out there — mechanical, high-volume, tedious
2. **Filter** to what plausibly relates — mechanical, judgement-light
3. **Qualify** whether the client can actually win it — rule-heavy, checkable, and the place errors are expensive
4. **Decide** whether it is worth pursuing — genuine judgement
5. **Prepare** the application or the bid — craft, and out of scope here

Steps 1 and 2 are sold as a product by half a dozen German vendors. Step 4
is the consultant's job and should stay there. Step 5 is where the fee is,
and it is deliberately out of scope.

**Step 3 is the gap.** It is too fiddly to do well by hand across dozens of
opportunities a week, too rule-bound to be interesting, and too consequential
to skip. It is the entire target of this system.

---

## Why qualification is hard enough to be worth automating

A single German funding opportunity turns on all of the following before it
is worth ten minutes of a consultant's attention:

- **Rechtsform** — some programmes exclude Einzelunternehmen, some require gemeinnützig, some require a Betriebsstätte and not merely a Sitz
- **KMU-Status** under the EU definition — and the Partnerunternehmen and verbundene Unternehmen rules that quietly disqualify a Mittelständler owned by a group
- **Standort** — Land-level programmes require presence in that Land; GRW rates depend on the Fördergebiet the district sits in
- **Vorhabenbeginn** — if the project has already started without a vorzeitiger Maßnahmenbeginn, most Zuschüsse are simply gone. A single date kills the opportunity outright and it is the most common avoidable loss
- **De-minimis headroom** — a running total over three fiscal years, per entity, that clients almost never track and consultants have to reconstruct
- **Kumulierungsverbot** — what other funding is already committed to the same costs
- **AGVO-Artikel** — which state-aid article the programme runs under determines the Förderquote, and the rate differs by enterprise size and by whether the work is industrielle Forschung or experimentelle Entwicklung
- **Unternehmen in Schwierigkeiten** — an AGVO exclusion that is checkable and routinely missed
- **The real deadline** — a Förderrichtlinie may run for three years while the Skizzen-Stichtag is in eleven days

And a procurement opportunity turns on a different set: CPV fit,
Eignungskriterien (Mindestumsatz, comparable references, personnel
qualifications), Präqualifikation, whether a Bietergemeinschaft or
Eignungsleihe is permitted, the Zuschlagskriterien weighting, whether it is
a Rahmenvereinbarung and how many Lose, and the Bewerbungsfrist as distinct
from the Angebotsfrist.

None of that is intellectually difficult. All of it is checkable against a
public document. It is precisely the shape of work that is miserable for a
human at volume and reliable for a system with the rules written down.

---

## The design consequence: two engines, not one model

The qualification stage is split, and the split is load-bearing.

### Deterministic knockouts

Eligibility questions with binary answers run as **code, not model
judgement**: date comparisons, headcount thresholds, Land matching,
de-minimis arithmetic, deadline arithmetic.

A model asked "is this company a KMU?" will sometimes say yes because the
company feels like a KMU. Code given a headcount, a turnover, a balance
sheet total and an ownership structure gives the same answer every time and
can be pointed at the rule it applied.

Every knockout writes a line: the rule, the input value, the threshold, and
the source. That line is what makes the rejection log auditable.

### Sourced assessment

What survives goes to a model for the questions that genuinely need
reading: does this project actually serve the programme's Förderzweck; how
does the Leistungsbeschreibung map to what the client does; how
oversubscribed does this call look; what would preparation actually cost.

Every claim here quotes the Bekanntmachung. **No source, no sentence** —
an assertion the system cannot point at renders as a visible gap, not as
fluent prose. A client acts on "you are eligible for this", and being
persuasively wrong about it is the failure mode that ends the engagement.

---

## What it deliberately does not do

**It does not write the application.** Not the Projektskizze, not the
Vorhabenbeschreibung, not the tender response. The scoping decision is
deliberate: a fabricated eligibility claim inside a submitted document is a
different order of problem from one in an internal shortlist, and the line
is easier to hold if it is never crossed. Preparation is where the fee is,
and it should stay human.

**It does not decide.** Go / no-go / watch is a recommendation with a
stated reason. The consultant decides, and the reason is there so they can
disagree with it specifically.

**It does not give legal advice.** Stating that a programme's text requires
X and that the client's profile records Y is a factual comparison. Stating
that the client "is entitled to" funding under AGVO is an opinion on the
application of law, which in Germany runs into the Rechtsdienstleistungs­
gesetz. The output is phrased as the former throughout — see
[risks](06-risks.md).

**It does not silently filter.** Anything discarded is discarded visibly,
with a reason. This is the single most important behavioural commitment in
the system.

---

## What carried over from the first design

Three principles survived the pivot intact and are worth restating, because
they now do more work than they did before:

**No source, no sentence.** Now enforced at the point where it matters
most: eligibility claims.

**Draft to the last mile, never to the client.** The digest is addressed to
a consultant. Nothing goes to a client without someone reading it, and
nothing is ever submitted anywhere by the system.

**The structured context is the asset, the tools are thin.** In the first
design that meant an account graph. Here it means the **eligibility
profile** — and it compounds in the same way. A client profiled once is
profiled for every programme, every tender, and every year. Fifty profiled
clients is an asset a competitor cannot assemble quickly, because most of
it comes from conversations rather than from public records.
