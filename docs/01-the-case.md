# The case

Four things get typed in. One profile comes out.

| Input shape | What you actually have | What the system must do |
|---|---|---|
| **A client company** | Name, sector, rough size, an existing relationship | Build a standing profile; scanning never ends |
| **A specific project** | "An electrolyser in Brandenburg, €14m, FID in Q2" | Add a project layer to the company profile; finite question, finite answer |
| **A loose brief** | Four lines scribbled after a call | Interrogate. Most of what eligibility turns on is missing |
| **A prospect** | A company name and public information only | Build what can be built from Handelsregister, Bundesanzeiger and the website; mark the rest as assumed, loudly |

The prospect case deserves emphasis, because it is the business-development
weapon: a profile assembled entirely from public sources, scanned, and
turned into three opportunities the company did not know it was eligible
for. That is a first meeting that opens itself. It also has the highest
error rate, because every unverified field is a guess — so assumed values
render differently from confirmed ones, everywhere, all the way through to
the brief.

---

## The eligibility spine

The fields that actually decide outcomes. Everything else is colour.

### Entity facts — stable, established once

| Field | Why it matters |
|---|---|
| Rechtsform | Programmes exclude by legal form; gemeinnützig status opens and closes doors |
| Headcount, Jahresumsatz, Bilanzsumme | The EU KMU definition: under 250 staff **and** turnover ≤ €50m **or** balance sheet ≤ €43m |
| Ownership and group structure | Partnerunternehmen and verbundene Unternehmen are consolidated into the KMU test — the most common quiet disqualifier |
| Sitz and every Betriebsstätte, by Land and Kreis | Länder programmes require presence in the Land; GRW rates depend on the Fördergebiet of the district |
| Gründungsdatum | Start-up programmes cap company age |
| WZ-Code / sector | Sector exclusions, and the primary matching key on the funding side |
| Unternehmen in Schwierigkeiten | An AGVO exclusion, checkable from published accounts, routinely missed |

### State facts — change, must be maintained

| Field | Why it matters |
|---|---|
| **De-minimis received, per entity, rolling three fiscal years** | Headroom against the ceiling. Clients do not track this; reconstructing it is a recurring consultancy task |
| Other public funding committed to the same costs | Kumulierungsverbot |
| Certifications — ISO 9001 / 14001 / 27001, Präqualifikation | Eignungsnachweise on the procurement side |
| Reference projects, with value, scope and date | The binding constraint on most tenders |
| Umsatz in the relevant field, last three years | Mindestumsatz requirements in Eignungskriterien |
| Personnel with named qualifications | Frequently a hard requirement, frequently the reason a bid is not possible |

The de-minimis field is worth building carefully. It is the one number the
system tracks that the client themselves usually cannot produce, it changes
what is possible, and maintaining it correctly is visible, chargeable value
in its own right.

### Project facts — per case

| Field | Why it matters |
|---|---|
| What the project is, technically | Förderzweck matching |
| Where — Land and Kreis | Länder programmes, GRW rate |
| **Planned start, and whether Vorhabenbeginn has occurred** | A single date that eliminates most Zuschüsse outright |
| Investment volume, split into Personal / Investitionen / Fremdleistungen | Determines eligible costs and therefore the actual money |
| Research character — industrielle Forschung vs. experimentelle Entwicklung | Sets the AGVO Art. 25 rate band |
| TRL | Programme-level fit; many calls specify a range |
| Willingness to enter a Verbund | Many programmes require or strongly prefer consortia |
| Climate / digital character | Increasingly a gating criterion rather than a bonus |

### Capacity facts — procurement only

Delivery geography, willingness to form a Bietergemeinschaft or use
Eignungsleihe, subcontracting appetite, and whether the client can meet
Tariftreue and LkSG-related declarations.

---

## The intake interrogation

The loose brief is the common case and the whole reason intake needs
designing. Nobody fills in a sixty-field form.

**Ask the highest-information question first.** Order the questions by how
many candidate opportunities each one eliminates, and stop when the
remaining questions no longer change the shortlist.

In practice four or five questions do most of the work:

1. **Which Land is the Betriebsstätte in?** — immediately partitions sixteen Förderbanken and every Landesprogramm
2. **KMU or not?** — moves Förderquoten by 10 to 20 points and gates entire programmes
3. **Has the project started?** — a yes eliminates most grants in one stroke
4. **Roughly how much de-minimis in the last three years?** — even a rough answer tells you whether small programmes are worth surfacing
5. **Research, investment, or operations?** — routes to entirely different programme families

Then stop. Ask for the sixth thing only when the shortlist is genuinely
sensitive to it, and say why you are asking: *"This matters because ZIM
requires it and ZIM is currently your largest candidate."*

Anything still unknown is carried as an **explicit assumption**, propagated
into every brief that depends on it, and listed at the top of the digest as
"answers that would change this shortlist". That list is also the agenda
for the next client call, which makes the tool useful before it has
finished being right.

---

## Storage

One folder per case. Markdown with YAML front matter, version-controlled —
which gives history, diffs and "who changed this" for free, and which means
a consultant edits a profile in any text editor without a database or a
login.

```
cases/
  muster-gmbh/
    entity.yaml          the stable facts, with a source and a date per field
    state.yaml           de-minimis ledger, certifications, references
    projects/
      elektrolyseur-brandenburg.yaml
    runs/
      2026-09-08/
        shortlist.md     the briefs
        rejected.md      the kill log
        coverage.md      what scanned, what didn't
    decisions.md         go / no-go, who decided, why — the record that makes next year's scan smarter
```

Every field carries `source` and `as_of`. A profile field with no source is
an assumption, and the system renders it as one — the same discipline as
the rest of the design, applied to the input rather than the output.
