# What the real cases changed

Four cases were supplied: **Marvel Fusion** for Fördermittel, and **TYTAN
Technologies**, **Monopulse** and **DroneShield** for public procurement.
Profiles were built from public sources, the knockout rules were written,
and the engine was run.

Result across 28 case × opportunity pairs: **1 shortlisted, 6 undecidable,
21 killed.**

The interesting part is not the ratio. It is that the four cases do not
belong to the same product.

---

## Finding 1 — The case set splits in two, and only one half suits a scanner

**Marvel Fusion is the ideal case.** Civil application, German
establishment, Bavarian Betriebsstätte, deep-tech R&D. Its funding
landscape is published, structured, rule-bound and reachable: BMFTR
Bekanntmachungen, the Förderdatenbank, Projektträger Stichtage, Bavarian
programmes, Horizon Europe. Everything the design assumed is true here.

**The three defence cases are structurally hostile to scanning**, and not
because of anything the system does wrong. Three separate mechanisms
suppress publication of exactly the opportunities these clients care about:

- **BwPBBG**, in force 14 February 2026 and running to the end of 2035,
  extends beyond the 2022 law to *all* Bundeswehr contracts and **raises
  value limits below the EU thresholds specifically to enable more direct
  awards**. More Direktaufträge means fewer published notices.
- **Art. 346 TFEU and §107 Abs. 2 GWB** keep contracts touching essential
  security interests out of the published record entirely.
- The BwPBBG also **dispenses with Losaufteilung**, so large contracts go
  to general contractors without justification — which pushes exactly the
  companies in this case set out of the prime role and into subcontracting,
  where nothing is published at all.

A radar that promises to find German defence opportunities by scanning will
cover a minority of the real flow. **That has to be said to a defence
client in the first meeting, not discovered by them in month four.**

## Finding 2 — For defence clients, the product inverts

If the tenders cannot be found, the value moves to three things that can:

**Eligibility and positioning.** The BwPBBG lets contracting authorities
restrict participation to EU-resident applicants and bidders. That is a
standing, structural fact about DroneShield's German market access, and it
is worth more to them than any list of notices. Same for the Zivilklausel
exclusions on the funding side.

**Award-notice intelligence.** Vergabebekanntmachungen name who won, at what
value. For a company that cannot be a prime, the route to market is the
prime — and DroneShield already runs this pattern through its Benelux
reseller. Award notices are the cheapest competitive intelligence in the
whole landscape and nobody systematically reads them.

**Parliamentary leading indicators — and this is the one that should have
been in the design from the start.** Bundeswehr procurement above €25m
requires Haushaltsausschuss approval, a requirement placed on a statutory
footing in July 2022 through §54 Abs. 3 BHO and §5 Abs. 3 BwFinG. There
were 55 such Vorlagen in 2023, 97 in 2024 and 103 in 2025. They are public,
they are reported in the trade press, and they surface major programmes
*before* the contracts land.

That is parliamentary monitoring. It is what a public affairs firm already
knows how to do, and it is the natural bridge between this product and the
firm's actual competence — which the first design missed entirely by
treating funding and procurement as a purely administrative scanning
problem.

## Finding 3 — The Zivilklausel is the highest-yield knockout

German civil research funding routinely excludes military applications,
and where a programme does not, a university Verbund partner usually
carries its own Zivilklausel.

For TYTAN, Monopulse and DroneShield this closes most of the German civil
funding landscape in one rule. The honest deliverable for a defence client
is therefore a very short funding list dominated by EU defence instruments,
with an explanation — not a shortlist padded with programmes they cannot
have.

The live route is EU: EDIP's €1.5bn work programme was adopted on 30 March
2026 with first calls on the EU Funding & Tenders Portal the following day.
Over €700m goes to production increases explicitly including counter-drone
systems, €240m to joint procurement of counter-drone and air defence, and
€100m of equity to defence start-ups and SMEs through FAST. Eligibility
runs to EU Member States, Norway and Ukraine. **TYTAN and Monopulse
qualify on establishment; DroneShield does not.** That single sentence is
most of what the radar has to say to these three clients this quarter.

## Finding 4 — Ownership is the binding unknown, in three cases out of four

The design assumed the hard intake questions were about the project. They
are not. They are about the cap table.

- **Marvel Fusion** — 121 staff, comfortably inside the headcount ceiling. USD 160m raised over four rounds. Whether it is a KMU depends entirely on who holds what: under Empfehlung 2003/361/EG Art. 3(2)(a) venture capital and institutional investors may hold up to 50% without creating a partner enterprise, but a strategic corporate at 25% or more does, and pro-rata consolidation with a large company would very likely break the status.
- **TYTAN** — €30m Series A led by the NATO Innovation Fund with Armira. NIF plausibly falls within the institutional-investor exception; Armira's stake decides the rest.
- **Monopulse** — nothing known.

In every case this is *one question to a CFO*, and it determines which half
of the German funding landscape exists for that client. It belongs at
position two in the intake interrogation, immediately after the Land — the
design had it much further down.

## Finding 5 — The system must answer "I cannot decide", and that had to be built

The first design had two outcomes: killed or shortlisted. Building against
real profiles with real gaps showed that is wrong. A rule whose input is
unknown must return **UNRESOLVED** — never a kill, which manufactures
invisible false negatives, and never a pass, which manufactures false
confidence.

The unresolved set turns out to be one of the more useful outputs, because
it is literally the intake question list, ordered by what it blocks:

```
? ownership structure, and headcount/turnover/balance sheet on the consolidated basis
    blocks: ZIM — Zentrales Innovationsprogramm Mittelstand, Kooperationsprojekt
    because: ownership structure unknown — cannot tell whether own or consolidated
             figures apply
```

Monopulse demonstrates the same discipline on a different field. Public
sources conflict on whether it is Danish or Lithuanian; the investor, ILTE,
is the Lithuanian state development finance institution, which points to
Lithuania but does not establish it. The profile records the country as
unknown rather than picking the likelier one. Both candidates are EU Member
States so EU eligibility is unaffected either way — but German Land
programmes and any local-presence requirement are not, and a guess there
would look exactly like an answer.

## Finding 6 — A real bug, found by a real case

The first SME implementation checked headcount first and returned
"undecidable" whenever it was missing. DroneShield has no published
headcount but roughly €150m of revenue, so a company obviously outside the
definition came back as unknown.

The fix was to evaluate everything decidable on known values before giving
up on an unknown one. The honest outcome for DroneShield is still
"cannot decide" — the financial limb is satisfied by turnover **or**
balance sheet, and the balance sheet total is not held — but the
explanation now names exactly the two numbers that would settle it, both
one lookup away in an annual report.

That is pedantic, and it is right. A rule that guesses on DroneShield is a
rule that guesses on a borderline case where it matters.

## Finding 7 — Eligibility and capacity run in opposite directions

Worth remembering before generalising from any single client:

| | Eligible? | Capable? |
|---|---|---|
| **Marvel Fusion** | Strong — German, Bavarian, civil | Unknown as a bidder; not the question for them |
| **TYTAN** | Strong for EU defence instruments; blocked from civil funding | Thin on references and turnover |
| **Monopulse** | EU, so eligible; no German presence | Weakest — a €1.12m raise will fail most Mindestumsatz and reference tests |
| **DroneShield** | Blocked nearly everywhere | Strongest by a distance |

DroneShield clears the Eignung thresholds that kill the other three, and is
excluded from the instruments they qualify for. For the small EU companies
the **reversible kills** — Bietergemeinschaft, Eignungsleihe,
subcontracting to a prime — are not a footnote to the product. They are the
product.

## Finding 8 — The ministry renamed, and catalogues written before 2025 are stale

BMBF is now **BMFTR** (Bundesministerium für Forschung, Technologie und
Raumfahrt). Any programme catalogue, source list or bookmark predating the
change carries the wrong name and quite possibly dead URLs. A small thing
that will silently degrade a source adapter, and an argument for the
reference layer being dated files rather than anything anyone remembers.

---

## What this changes in the plan

1. **Marvel Fusion becomes the week-one case.** It is the one where the design works as written, and week one is for proving the rules against known answers — not for discovering that a whole market is unpublished.
2. **Add the parliamentary leading-indicator source** — Haushaltsausschuss 25-Mio-Vorlagen — to the source build order. It is public, it is high-signal, and it plays to what the firm is already good at.
3. **Add award notices as a first-class source**, not a nice-to-have. For clients who cannot be primes they are the main intelligence product.
4. **Move ownership to question two** in the intake interrogation.
5. **State the defence coverage limit in writing, up front**, in any client-facing version. The system cannot promise to find German defence tenders and should never imply it.
6. **Keep the three-outcome model.** Killed, undecidable, shortlisted.

## How to run it

```
python3 -m radar.run                      # every case, every opportunity
python3 -m radar.run --case marvel-fusion
python3 -m pytest tests/ -q               # 26 tests
```

Case profiles are in `cases/`, opportunity records in `opportunities/`,
rules in `radar/rules.py`. Every opportunity record carries `verified:
true|false` — the BMFTR fusion Bekanntmachungen and the EDIP work programme
are real and sourced; the ZIM, Bavarian and Bundeswehr records are marked
unverified fixtures that exercise specific rules, and their dates are
explicitly labelled as illustrative so nobody acts on them.

---

## Second pass — three facts from the client

Supplied after the first run: Marvel Fusion's ownership still unknown, TYTAN
at roughly 200 staff, Armira's stake unknown, and Monopulse established in
**both** Denmark and Lithuania.

Two of the three changed the engine's answers.

**TYTAN at 200 staff produced the system's first piece of real advice.** It
still qualifies as a KMU — that is the point. At 80% of the ceiling and
scaling toward serial production, its KMU-gated eligibility is a wasting
asset. Art. 4(2) of the Annex to Empfehlung 2003/361/EG gives a two-period
buffer before the status is actually lost, so the window is open but closing,
and anything KMU-gated should be applied for now. This is the first output in
the project that a consultant could not have produced faster by hand, and it
came out of one number mentioned in passing.

**Monopulse was not a source conflict.** The company is established in Denmark
and Lithuania both; the reporting that looked contradictory was each outlet
seeing one half. The profile had recorded the field as unknown rather than
resolving to Lithuania — the better-supported reading, since ILTE is the
Lithuanian state development finance institution. Guessing would have produced
a confident half-truth. The engine now treats establishment as a list, and
Monopulse consequently clears EDIP on establishment and escapes the BwPBBG
third-country restriction on either leg. Its scan went from zero shortlisted
to one.

**Marvel Fusion's ownership is still the binding unknown**, and the client
does not have it either. That is itself informative: it is a question for the
company's CFO or its cap table, not for the consultant, and it is now the
first thing to ask in the next conversation. Until it is answered, every
KMU-gated German programme stays undecidable for them.

Scan after the second pass: **2 shortlisted · 5 undecidable · 21 killed**,
across 28 pairs, with one client-level advisory.
