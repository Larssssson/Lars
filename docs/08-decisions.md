# Decisions taken

Judgement calls made without the client in the room, recorded so they can be
overturned deliberately rather than drifted away from.

---

## D1 — Build the defence positioning sources next, not the Marvel Fusion funding sources

**The choice.** With the qualification engine working, the next increment is
either (a) the German funding source adapters that serve Marvel Fusion, where
the original design works cleanly, or (b) the defence-side leading indicators
— Haushaltsausschuss 25-Mio-Vorlagen and Vergabebekanntmachungen — which
serve TYTAN, Monopulse and DroneShield.

**Decision: (b).**

**Why.** Three of four cases are defence, so (b) serves the majority of the
book. Marvel Fusion's nearest large opportunity is already won — they
coordinate the VEGA hub — so the funding scan is less time-critical for them
than it looks. And (b) is the differentiated half: funding-database scanning
is a commodity with half a dozen German vendors, while nobody sells
systematic 25-Mio-Vorlagen tracking as a client product, and it is
parliamentary monitoring, which is what the firm is already good at.

**What would overturn this.** Marvel Fusion asking for a funding review in
the next month; or a fifth case arriving that is civil and funding-shaped,
tipping the book back.

## D2 — Say the defence coverage limit out loud, first

**Decision.** Any client-facing version, for a defence client, opens with what
the system cannot see. Not a footnote, not an appendix.

**Why.** The BwPBBG raises value limits to enable more Direktaufträge,
dispenses with Losaufteilung, and lets authorities restrict participation to
EU-resident bidders; Art. 346 TFEU and §107 Abs. 2 GWB keep security-interest
contracts unpublished entirely. A scanner covers a minority of the real flow.
A client who discovers that themselves in month four is a client who
reasonably concludes they were oversold.

The reframe is not a consolation. For a company that cannot be a prime, the
prime is the route to market, and the useful products are award notices,
supply-chain positioning and parliamentary leading indicators. That is a
better offer than an incomplete tender list — but only if it is the offer
that was made.

## D3 — Rules get a third and fourth outcome

**Decision.** `KILL`, `UNRESOLVED`, `ADVISORY`, or pass.

`UNRESOLVED` came from building against real profiles with real gaps: a rule
whose input is unknown must not kill (invisible false negative) and must not
pass (false confidence). The unresolved set is the intake question list.

`ADVISORY` came from TYTAN's headcount. It fires on opportunities the client
*does* qualify for, which is exactly the point — see D4.

## D4 — KMU status is a wasting asset, and the system says so

**The finding.** TYTAN is at roughly 200 staff, 80% of the 250 ceiling, while
building serial production toward ~3,000 units a month. Every KMU-gated
instrument — EDIP FAST equity among them — has a limited number of
application cycles left.

The Annex to Empfehlung 2003/361/EG, Art. 4(2), gives a buffer: the ceilings
must be exceeded over **two consecutive accounting periods** before the status
is lost. So crossing 250 once does not end it; it starts a clock.

**Decision.** This is advice, not a filter, so it renders as an advisory that
does not change the verdict, deduplicated to the client level and listed with
the opportunities it bears on.

**Why it matters beyond TYTAN.** It is the first output of this system that a
consultant could not have produced faster by hand, and it came from one number
the client supplied in passing. That is the shape of the product working.

## D5 — Multiple establishments are first-class

**The finding.** Monopulse is established in **both Denmark and Lithuania**.
Public sources split between the two and the profile had held the field as
unknown rather than picking the likelier reading. Both were right; the
resolution was a structure neither source described.

**Decision.** `countries` is a list. An establishment requirement is satisfied
if *any* establishment qualifies; the third-country restriction is escaped if
*any* establishment is in the EU.

**The methodological point, worth keeping.** A system that had guessed
"Lithuania" — the better-supported reading, given ILTE is the Lithuanian state
development finance institution — would have been half right and entirely
confident. The unknown was more accurate than the inference.

**The complication.** Two establishments probably means a group, and a group
means the KMU test runs on consolidated figures. Which entity holds the
contracts, the staff and the IP now decides eligibility.

## D6 — Ownership moves to intake question two

Three of four cases are blocked on the cap table, not on anything about the
project. Marvel Fusion's KMU status turns on whether a strategic investor
holds 25% or more; TYTAN's on Armira's stake beside the NATO Innovation Fund;
Monopulse's on the group structure. In each case it is one question to a CFO
and it decides which half of the German funding landscape exists.

The intake order is now: Land → **ownership** → project started? → de-minimis
→ research/investment/operations.

---

## Constraint discovered, not decided

**Source adapters cannot be built or tested in the Claude Code web sandbox.**
Outbound egress is filtered — `bmvg.de` is blocked outright. Nothing in this
repository has ever contacted a live source, and no adapter here should be
trusted until it has been run somewhere with normal network access.

This does not affect the engine, the profiles or the rules, all of which run
on local data. It does mean the source layer is work for a normally networked
machine, and it is a reason to keep adapters thin and independently testable:
they are the part that has to be developed somewhere else.
