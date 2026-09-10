# Build plan

One person. Claude Code. Four weeks to something that runs weekly on a real
client. No rollout, no budget request, nobody to convince yet.

The whole plan rests on one constraint that turns out to be a gift: **you
have to convince nobody**. That removes the largest risk from the earlier
design — internal adoption — and replaces it with a much simpler test. Does
it find things you would have missed?

---

## Shape of the thing

A repository, not a platform.

```
cases/            one folder per client or prospect
profiles/         sector profiles: CPV sets, programme families, typical eligibility
reference/        CPV, AGVO rate bands, de-minimis, Schwellenwerte, GRW map — dated, sourced
sources/          one adapter per source, independently testable
skills/           intake · qualify · brief · digest
runs/             dated output: shortlist, kill log, coverage
decisions.md      go/no-go and outcome, per opportunity
```

Python for the source adapters — TED, the Datenservice and the EU portal
all have real APIs, and this part is ordinary scripting. Claude Code skills
for intake, assessment, brief-writing and the digest. Deterministic
knockouts as plain code with tests, never as a prompt.

**The reference layer is data, not knowledge.** Rate bands, thresholds and
ceilings live in dated files with links. Nothing is recalled from model
memory. This is the same rule as "no source, no sentence", applied to the
system's own constants.

---

## Week 1 — Prove the qualification by hand

No scanning. No automation. Take **one real client** and **twenty
opportunities you already know about** — things the firm has pursued, won,
lost, or looked at and dismissed.

Build the profile. Write the knockout rules. Run them by hand against the
twenty. Ask the only question that matters:

> Do the rules produce the answers a good consultant produces?

Where they disagree, either the rule is wrong or the consultant was — and
finding out which is the actual work of week one. This step feels like a
detour and it is the difference between a system that is trusted and one
that is second-guessed forever.

Deliverable: an eligibility profile schema and a knockout rule set that
survives contact with twenty real cases.

## Week 2 — Procurement, end to end

TED and the Datenservice Öffentlicher Einkauf. Ingest, normalise,
deduplicate on notice identifiers, match loosely on CPV, run the knockouts,
write briefs for survivors.

Choose procurement first because the data is the best in the landscape and
the pipeline proves itself fastest. By Friday you should be able to run one
command and get a real shortlist for a real client.

Deliverable: procurement half working, on one case, from source to brief.

## Week 3 — Funding

Förderdatenbank and Förderportal for the federal programme catalogue, two
or three Projektträger for the deadlines that actually bind, the EU Funding
& Tenders Portal, and the Förderbanken of the Länder where your first
client actually sits.

The funding side is messier and the eligibility logic is heavier — AGVO
articles, rate bands, de-minimis arithmetic, Vorhabenbeginn. It is also
where most of the differentiated value is, because this is the part
commercial databases do worst.

Deliverable: both halves running on one case.

## Week 4 — State, digest, and the honest test

Status tracking, the change diff, re-surfacing triggers, the coverage
statement, the kill log, the weekly digest format.

Then the test that decides whether any of this is real:

**Back-test for recall.** Take twenty to thirty opportunities the firm
actually knows about — pursued, won, lost, or spotted late. Would the
system have surfaced each one, in time? Recall is the number that matters,
because a false negative is invisible in production and you will never
otherwise learn it happened.

Report that number to yourself honestly. If it is 60%, the system is not
ready and you now know exactly where the holes are. If it is 90%, you have
something worth showing someone.

Deliverable: a weekly digest that runs, and a measured recall figure.

---

## Then: two weeks of running it for real

Run it every Monday on one client. Read every brief. Check every kill.

You are looking for three things:

- **False negatives** — did you hear about something from another route that the system should have found?
- **Kills that were wrong** — a rule too aggressive, a profile field stale
- **Briefs you did not trust** — and specifically why, because that is a design note

Only after this does anyone else see it.

---

## What to build later, and only when earned

**More Länder.** Add a Förderbank when a client needs it, not before.

**More sectors.** Sector knowledge is a profile — CPV sets, programme
families, typical eligibility patterns — so adding one is data entry, not
engineering. This is also how a colleague who cannot program contributes,
which is the only realistic path to "firm-wide" given who is building it.

**The prospect scan as a business-development instrument.** Profile a
target company from public sources, scan it, and walk into the first
meeting with three opportunities they did not know they were eligible for.
This is the most commercially interesting use and it needs no new
machinery — only the confidence that the scan is right, which the back-test
provides.

**The client-facing radar.** The same content, edited by a consultant,
delivered on a cadence as a retainer product. Only once the internal
version has run for a quarter without embarrassing anyone.

---

## Two things to find out this week

**What your colleagues actually have.** You did not know, which is fine at
this stage — but it decides what "firm-wide" can ever mean. Specifically:
does anyone else have Claude Code, or only the chat interface? Has IT
approved anything? If the answer is "chat only", the distribution unit is a
Project with skills and a well-structured profile format, not a repository
— and that changes what you build in month three, not month one.

**Whether anyone is already doing this.** Fördermittelberatung is a
crowded advisory market in Germany, and someone in the firm may already
have a manual version, a spreadsheet, or a client relationship built on it.
Finding them makes you faster; not finding them until month four makes you
look careless.

Neither blocks week one. Both should be answered before week five.
