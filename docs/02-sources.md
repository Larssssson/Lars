# Sources

All open. No paid subscriptions, therefore no licence constraints on
storage or reuse — and no procurement conversation before a demo.

Graded by what it costs to build and keep working, because that is where
projects like this actually stall.

---

## Procurement — above threshold

Well served. Build here first; it is the fastest route to something real.

**TED — Tenders Electronic Daily.** Every EU above-threshold notice,
including all German ones. Structured eForms since late 2023, with a search
API and bulk downloads. The single most reliable source in this document.
Notice types matter: Vorinformation, Auftragsbekanntmachung, and
**Vergabebekanntmachung** — the award notice, which names who won and at
what price. Award notices are the competitive-intelligence layer and are
routinely ignored.

**Datenservice Öffentlicher Einkauf** (`oeffentlichevergabe.de`). The German
federal open-data service for Bekanntmachungen, publishing in eForms and
OCDS. The key German source, and it improves as more platforms connect to
it. Build against this and TED together; expect overlap and deduplicate on
notice identifiers.

**Schwellenwerte** are reference data, not knowledge. They change on a
two-year cycle and differ by contracting authority type and by contract
type. Hold them in a dated file with a link to the source; never let them
live in a prompt or in code, and never let the model recall them.

---

## Procurement — below threshold

**This is where honesty matters more than coverage.** The Unterschwellen­
bereich is genuinely fragmented: UVgO and VOB/A Abschnitt 1 at federal
level, sixteen Landesvergabegesetze with their own Wertgrenzen, and
publication spread across federal, Land, municipal and commercial
platforms with no single aggregator.

What is reachable:

- **service.bund.de** — the federal Bekanntmachungsservice
- **Land-level Vergabemarktplätze** — each Land differs in platform, format and completeness
- **Commercial front-ends** — DTVP, subreport ELViS, Vergabe24, eVergabe.de. Many notices are publicly viewable even where the platform is commercial; the *systematic collection* of them is the part to check before automating

No open source covers this completely, and any system claiming otherwise is
wrong. The design answer is a **coverage statement per Land**, shown in
every digest: which platforms were scanned, which were not, and when each
last responded. A client is entitled to know the shape of the hole.

Practical note: by contract value the money is above threshold; by count,
most opportunities are below it. For most clients the above-threshold layer
plus one or two Land platforms relevant to their Betriebsstätten is enough
to be useful, and pretending to national below-threshold coverage is a
promise that will break.

---

## Funding — federal

**Förderdatenbank des Bundes** (`foerderdatenbank.de`). The aggregator of
Bund, Länder and EU programmes, run under BMWK. Programme-level rather than
call-level: it tells you a Förderrichtlinie exists, not that a Stichtag is
in eleven days. Essential for building the programme catalogue, insufficient
for deadline monitoring.

**Bundesanzeiger** and the ministries. Förderbekanntmachungen are published
by BMWK/BMWE, BMBF, BMDV, BMUV, BMEL, BMG and others, each on its own
schedule and page structure.

**Förderportal des Bundes** (`foerderportal.bund.de`). Bekanntmachungen and
the application machinery (easy-Online, profi). Closer to call level.

**Projektträger.** PtJ (Jülich), VDI/VDE-IT, DLR-PT, PTKA, TÜV Rheinland
and others actually run the calls. Their pages carry the Stichtage, the
Skizzen deadlines and the FAQs that determine whether an application is
realistic. Anyone who has done this work knows the Projektträger matters
more than the ministry — the system should record which Projektträger runs
each programme, because it is also who you call.

**KfW** and **BAFA** run programme families of their own, with their own
publication rhythms.

---

## Funding — Länder

Sixteen Förderbanken, each with its own programmes, formats and pages:
NRW.BANK, LfA Bayern, L-Bank Baden-Württemberg, IBB Berlin, ILB
Brandenburg, NBank Niedersachsen, WIBank Hessen, SAB Sachsen, IB
Sachsen-Anhalt, IFB Hamburg, BAB Bremen, ISB Rheinland-Pfalz, SIKB
Saarland, IB.SH Schleswig-Holstein, TAB Thüringen, LFI
Mecklenburg-Vorpommern. Plus EFRE and ESF+ programmes administered at Land
level.

Sixteen adapters is not a week-one project. Build the two or three Länder
where the first client actually has Betriebsstätten, and let the coverage
statement say plainly that the others are not scanned.

---

## Funding — EU

**EU Funding & Tenders Portal** has a search API covering Horizon Europe,
Digital Europe, LIFE, EU4Health, CEF and the rest. Structured, reliable,
and worth including from the start because Horizon and Digital Europe are
relevant across all four of the sectors in scope.

**Innovation Fund** (CINEA) and **Interreg** programmes publish separately.

---

## Reference data — the layer that is not a source

Not scanned. Maintained deliberately, dated, with a link to the authority,
and never recalled from model memory. This is where the qualification
engine gets its thresholds:

- **CPV** — the full code list, plus curated per-sector code sets
- **AGVO / GBER** — which article each programme runs under, and the rate bands: research category, enterprise size bonuses, collaboration bonuses, and the caps
- **De-minimis** — the current ceiling and the rolling three-fiscal-year rule
- **Schwellenwerte** — current values by authority and contract type, with the effective date
- **EU KMU definition** — including the Partnerunternehmen and verbundene Unternehmen consolidation rules
- **GRW-Fördergebietskarte** — district-level status and rates
- **WZ-Code** to programme-family mapping

Every file dated, every file sourced. When a Schwellenwert changes, one
file changes and every past brief remains explicable, because it recorded
which version it used.

---

## Build order for sources

| Order | Source | Why |
|---|---|---|
| 1 | TED | Best structured data in the whole landscape; proves the pipeline end to end |
| 2 | Datenservice Öffentlicher Einkauf | The German procurement core |
| 3 | EU Funding & Tenders Portal | An API, and relevant to every sector in scope |
| 4 | Förderdatenbank + Förderportal | Builds the federal programme catalogue |
| 5 | Two or three Projektträger | Where the real deadlines live |
| 6 | The Förderbanken of the first client's Länder | Only the ones that matter |
| 7 | Land procurement platforms, one at a time | Fragmented; add only where a client needs it |

---

## Keeping them alive

Roughly a third of ongoing effort, forever, and it never appears in the
first estimate.

- One adapter per source, each independently testable
- **Health monitoring**: a source returning zero results for 48 hours raises an alarm rather than quietly shrinking the digest
- **Graceful degradation**: an empty week must say "three sources did not respond", never look like a quiet week. This is the difference between a tool that fails safely and one that fails silently — and silent failure on a funding deadline is the exact scenario that ends a client relationship
- Retrieval date recorded on every record, and shown wherever a deadline is shown
