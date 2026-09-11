# Supply-chain positioning

The module built after the case work showed that three of four clients cannot
rely on a tender scanner.

## Why Vorlagen, and why they are not opportunities

Bundeswehr procurement above €25m requires Haushaltsausschuss approval — on a
statutory footing since July 2022 through §54 Abs. 3 BHO and §5 Abs. 3 BwFinG.
There were 55 Vorlagen in 2023, 97 in 2024 and 103 in 2025.

**A Vorlage is an approval, not a tender.** Nobody can bid for one. What it
tells you is that money has been committed to a programme and the contract has
not yet been let — which, for a supplier who will not be the prime, is the
moment that matters. Under the BwPBBG's abolition of Losaufteilung, "will not be
the prime" describes most companies the size of the ones in this case set.

So Vorlagen are modelled as their own record type and reported separately, in
different language. Conflating them with the shortlist would have a consultant
telling a client to bid for something that cannot be bid for.

## What it produces

Per client: the approved programmes whose capability overlaps theirs, the primes
carrying each, the timing argument, and any structural blocker. Plus a **prime
index** — which contractors keep appearing in this client's domains. That is the
target list, and it is the deliverable.

```
→ Hochenergielaser-Waffensystem zur Nächstbereichsverteidigung der Marine
    overlap:  counter_uas, defence
    argument: Approved 2026-07-08. Rheinmetall and MBDA Deutschland carry it.
              Money is committed and the contract is not yet let — approach now,
              not after award. In service from 2029, so the supplier decisions
              are being taken now.
    BLOCKER:  no EU establishment — under the BwPBBG the authority may restrict
              participation to EU-resident bidders, so the prime route is the
              only route
```

That blocker line is DroneShield's. For them it is not an obstruction, it is the
strategy: they already reach European militaries through a Benelux reseller, and
this says to do more of that rather than less.

## Two false positives it was built to prevent

Both came out of running the module, and both are the same failure — treating a
vocabulary match as a fact.

### Tag collision across civil and military work

Marvel Fusion's project carries `lasers` and `photonics`. The
Hochenergielaser-Waffensystem approved on 8 July 2026 carries `lasers`. A naive
matcher sends a civil fusion-energy company to Rheinmetall about a naval
directed-energy weapon.

The overlap is real. The lead is not. **Application domain gates capability
overlap**, and the gate is logged rather than applied silently:

```
NOT A LEAD: Hochenergielaser-Waffensystem zur Nächstbereichsver
  capability overlap on lasers, but this is a defence programme and the
  client's application domain is civil. Tag collision, not a lead. Raise
  only if the client opts into dual-use work.
```

An unknown application domain excludes as well, with its own reason. Guessing
here would be confident nonsense of exactly the kind that ends a consultant's
credibility in one meeting.

### Sector tags are not capability tags

`defence` sits on every defence client and every defence Vorlage. An overlap
consisting only of it means "both of these are defence", which pointed a
counter-UAS interceptor company at submarine-hunting frigates.

A match now requires at least one tag outside `{defence, manufacturing, ai,
energy}`. Broad-only overlaps are still logged, but summarised as a count rather
than listed — with 103 Vorlagen a year, listing every "both are defence"
rejection would drown the output it is meant to make trustworthy.

**The general lesson, worth carrying into the rest of the taxonomy:** tags of
different kinds were being mixed in one namespace. Sector, capability, platform
and application domain are four different things, and matching on the union of
them produces confident nonsense. Both bugs were in the taxonomy, not the logic.

## The source seam

Every source splits in two:

- `fetch_raw()` touches the network. Fragile, breaks when a page is redesigned, and **not implemented** — deliberately. A stub that quietly returned fixtures would be the silent-failure mode this project exists to avoid.
- `parse_records()` is pure. Dicts in, typed records out. Tested against captured fixtures, runs anywhere.

This is why the whole module could be built in an environment with no outbound
network at all. The gateway here denies CONNECT to every source host —
`api.ted.europa.eu`, `search.dip.bundestag.de`, `oeffentlichevergabe.de`,
`ec.europa.eu`, `bundestag.de`, and the defence trade press. Fixtures were
captured by hand from published reporting instead.

**Nothing in this repository has ever contacted a live source.** Implementing
`fetch_raw("vorlagen", ...)` is work for a machine with egress, and it is the
one part of this that has to be developed elsewhere.

## Coverage, stated plainly

Three of the sixteen Vorlagen approved on 8 July 2026 — the ones the reviewed
sources named individually. The session totalled roughly €9.5bn. The other
thirteen are not captured.

This number goes in the report header, every time, including when the news is
good. A positioning brief that looks thin because the source is thin must say
so, or it is indistinguishable from a quiet quarter.

## Run it

```
python3 -m radar.run --positioning
python3 -m radar.run --positioning --case tytan-technologies
```
