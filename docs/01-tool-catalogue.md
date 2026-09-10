# Tool catalogue

Nine tools. Each entry: what it is, what goes in, what comes out, and —
the section that matters — **the hard part**, because every one of these
has a place where the naive version fails and the good version earns its
keep.

---

## 1. Ledger — budgets and fee models

**What it is.** The tool that turns "they want us to do EU + Germany +
Brussels presence for a year" into a defensible number, and then watches
that number for the rest of the engagement.

**In:** scope description, jurisdictions, client tier, team availability,
rate card, target margin.
**Out:** an hours model by seniority and workstream, phased over months; a
fee structure (retainer / project / hybrid / success-fee); an
out-of-pockets line; a margin check; an Excel export; a fee section that
drops straight into Pitch.

**Modes that make it actually useful:**

- **Forward** — "here's the scope, what should we charge?"
- **Reverse** — "the client has €90k for the year, what fits?" This is the
  mode consultants really need and no template supports. It outputs a
  deliverable set that fits the envelope and an explicit **out-of-scope
  list** — the most valuable page in any proposal, because it is where
  scope creep gets killed before it starts.
- **Three-tier** — lean / standard / full, in one table. Clients buy the
  middle one. Generating all three is five minutes of work that reliably
  moves the sale up a tier.

**The hard part: margin realism.** Every firm's budgets are optimistic
because they are built forward from tasks. Ledger builds them *backwards
from history*: it knows the last four monitoring retainers ran at 130% of
budgeted hours in months 1–2, that "ad-hoc advisory" always overruns, and
that a Director's 4h/month line item is fiction. It flags this at drafting
time — "comparable engagements consumed 1.35× the budgeted senior hours;
this budget clears target margin only if realisation holds above 82%" —
rather than at the post-mortem. That single feedback loop is worth more
than the drafting speed.

**Then it keeps working.** Burn tracking against actuals, surfaced in
Bridge: *62% of fee consumed at 40% of term* is a conversation to have with
the client in month 5, not a discovery in month 11.

---

## 2. Pitch — proposals and tenders

**What it is.** Modular proposal assembly with a real memory of what won.

**In:** the brief or RFP, client and sector, Ledger's fee model, chosen
team.
**Out:** a full proposal — situation analysis, our reading of the
challenge, approach and phases, workstreams, team bios, relevant
credentials, fee section, assumptions and exclusions — in house style and
the right language.

**Where the leverage is:**

- **Credentials matching.** "We did this before" is what wins. The tool
  searches past engagements for genuine analogues (same file, same
  institution, same sector, same problem shape) and drafts the case study
  at the right level of anonymisation for this client. Consultants
  currently do this from memory, which means they cite the three cases
  they personally worked on.
- **Tender compliance matrix.** For public-sector and framework tenders:
  parse the requirements, build a requirement → section → page table, and
  refuse to call the draft finished while a mandatory requirement is
  unanswered. Tenders are lost on formalities more often than on quality.
- **Scoring-weighted effort.** If methodology is 40% of the score and
  price is 20%, the tool says so before anyone spends the weekend
  polishing the wrong section.
- **Reusable blocks that improve.** Every win and loss is logged against
  the blocks used. Over two years the firm learns which framing of "our
  Brussels network" actually converts.

**The hard part: sounding like the firm, not like a model.** House voice
is enforced by example, not instruction — a curated corpus of the ten best
proposals per language, retrieved as style anchors. And a hard rule: the
situation analysis is *never* generated from the model's general
knowledge. It is generated from Signal's actual file state, or it is left
blank. A proposal that misstates where a file stands loses the pitch in
the room.

---

## 3. Redline — legislative text review

**What it is.** The analytical core of the suite, and the one that most
justifies building rather than buying.

**In:** a legislative text — Commission proposal, committee report,
Council general approach, national bill, delegated act, consultation
draft — plus the client profile.
**Out:**

1. **Plain-language summary** at three lengths: one line, one paragraph, one page.
2. **Obligation extraction** — a table of *who must do what, by when, or
   face what*, with the article for each row. This is the single most
   requested artefact in the profession and it is pure mechanical labour.
3. **Client impact assessment** — each obligation scored against the
   client's actual operations, with a rating and a "why".
4. **Version diff** — the four-column table: Commission / Parliament /
   Council / current compromise, article by article, with substantive
   changes separated from drafting changes. Consultants build this by hand
   in Word and it costs a day per major file.
5. **Ambiguity register** — every "appropriate measures", "without undue
   delay", "significant" and undefined term, flagged as either a risk or
   an opening. Vagueness is where lobbying happens.
6. **Recital–article consistency check** — where a recital promises
   something the articles do not deliver, or vice versa. Good material for
   an amendment.
7. **The second-order pipeline** — every delegated act, implementing act,
   guideline, standardisation request and review clause the text creates.
   This is the map of the *next three years of work* on this file, and it
   is the most commercially valuable output in the whole suite: it
   converts a one-off file into a retainer.

**The hard part: article-level alignment across versions.** Institutions
renumber. The Parliament's Article 12 is the Council's Article 14 is the
Commission's Article 11(3). Naive text diffing produces garbage. This
needs structural parsing of the document tree plus semantic matching of
provisions across renumbering — the genuine engineering problem in this
suite, and the reason it is defensible once solved.

**Second hard part: honest uncertainty.** Legal interpretation is
contested. Redline states its confidence and, where a reading is
arguable, gives *both* readings rather than picking one. "This provision
probably captures your Class II devices" is worse than useless; "this turns
on whether 'placing on the market' includes intra-group transfers, which
is unsettled — here are both readings and what it changes" is advice.

---

## 4. Table — amendment drafting

**What it is.** Where analysis becomes legislative language. Downstream of
Redline; upstream of Whip.

**In:** the target provision, the client's objective, the fallback ladder.
**Out:** amendment text in the *exact* tabling format of the institution —
Parliament two-column with justification, Council bracketed compromise,
national committee format — plus:

- **A fallback ladder per amendment.** Ideal / acceptable / red line, drafted
  as three actual texts, not three adjectives. Negotiations move fast and
  the fallback needs to already exist in a tabling-ready form.
- **A one-line ask.** The sentence the MEP's assistant will actually read.
  If the ask cannot be said in one line, the amendment is not ready.
- **A justification** in the register the institution expects — public
  interest framing, not client interest framing.
- **Coherence check** against the rest of the text: does this amendment
  break a cross-reference, contradict a recital, or conflict with an
  amendment we tabled on Article 9?

**The hard part, and it is a good one: survival tracking.** After tabling,
Table follows the language. Which MEP tabled it. Whether it survived
committee. Whether the words appear in the final act. This produces a
metric almost no firm can currently quote to a client:

> *Of 31 amendments drafted for you, 12 were tabled by at least one MEP,
> 7 survived committee, and 4 appear in the final text — including the
> transition period in Article 43(2).*

That paragraph renews retainers. It is also, internally, the only honest
measure of whether the drafting is any good.

---

## 5. Signal — monitoring that produces briefings

**What it is.** Not a feed. A feed is an input. Signal's output is a
client-ready note.

**In:** the sources — EUR-Lex, OEIL, committee and plenary agendas,
Council agendas and outcomes, Commission work programme and Have Your Say,
national parliaments and gazettes, regulators, courts, plus the
subscription press the firm already pays for — filtered through per-client
relevance profiles.
**Out:** three distinct things, and the distinction is the whole design:

- **The alert** — real-time, rare, triggered only by conditions the client
  defined ("any movement on Article 17", "any Council working party on the
  file", "our name in a committee document"). If alerts fire daily they get
  muted, and then the one that mattered is missed too.
- **The weekly brief** — drafted, per client, in the firm's format: what
  happened, what it means for *you*, what we are doing about it, what to
  watch. The "what it means for you" paragraph is the entire product; the
  event list is the commodity part every competitor also has.
- **The consultant's morning brief** — cross-account, at 07:30: overnight
  movement on any of my files, what needs me today, what I owe someone.

**The hard part: relevance without a training set.** A new client has no
history to learn from. The bootstrap is an explicit profile — CPV/NACE
codes, product categories, legal bases, named files, named competitors,
named politicians — and then thumbs-up/thumbs-down on each brief item
tunes it. Two weeks of feedback beats any amount of clever cold-start
inference.

**Second hard part: deduplication across sources.** One Council agreement
generates eleven items across nine sources. Signal must cluster them into
one event with several citations, or it has recreated the inbox it was
built to replace.

---

## 6. Dossier — stakeholders and the relationship graph

**What it is.** A living card for every person who matters on a file, and
the firm-wide map of who knows whom.

**Per-person card:** role, committee memberships and substitutes, group
and national party, rapporteurships and shadow roles, positions taken on
*this* file with quotes and dates, voting record where it exists, staff and
advisers, stated priorities, home-constituency angle, and — the part only
we have — **our history with them**: every meeting, what was said, what was
promised, what is outstanding.

**Firm-wide relationship graph.** For a firm with offices in several
capitals this is the most under-exploited asset that already exists.
"Nobody in Brussels knows this MEP, but the Stockholm office ran a
campaign with her former chief of staff in 2023" is a warm introduction
that currently only happens by chance at a Christmas party.

**The hard part: it must never become a task.** Cards populate from
Readout filings, from documents drafted, from calendar entries, from
public sources. A card that requires manual maintenance is a card that is
eighteen months stale, which is worse than no card because someone will
trust it.

**Second hard part: data protection.** These are records about real,
identifiable people, several of them public officials, held for a
commercial purpose. GDPR applies in full: lawful basis, retention limits,
subject-access readiness, and a hard line between professional record
("voted against in ENVI on 12 March") and personal note ("dislikes the
CEO"). The second category needs an explicit policy decision before a line
of code is written — see [risks](05-risks-and-guardrails.md).

---

## 7. Whip — coalition and vote mapping

**What it is.** Turning stakeholder cards into a plan for winning a vote.

**In:** the file, the committee or chamber, our position, Dossier cards.
**Out:**

- **Influence × alignment matrix** — the classic four quadrants (champions,
  persuadables, blockers, bystanders), but generated from evidence with
  each placement citing what put the person there.
- **Vote projection** — seat by seat, group by group, with a confidence
  band, and a total against the threshold that actually applies.
- **Path to majority** — the good bit. Not "we need 30 more votes" but
  *these seven people*, ordered by how movable they are, with the argument
  most likely to move each and who in our network can carry it.
- **Coalition designer** — which trade associations, NGOs, unions, national
  authorities and companies share this position, which of them we can be
  seen with, and where a coalition is a liability rather than an asset.
- **Opposition brief** — the other side's best argument, stated at full
  strength. Consultants systematically under-model this and get surprised
  in the room.

**The hard part: calibration.** A confident vote count that is wrong is
actively harmful — it directs a campaign at the wrong people. Whip must
score its own confidence honestly, distinguish *evidence* (a recorded
vote, a public statement) from *inference* (a group's general line), and
be back-tested against actual outcomes. Every prediction is logged and
scored after the vote; the tool reports its own accuracy. If it cannot beat
a senior consultant's gut, it should say so and be used as a checklist
instead.

---

## 8. Readout — meeting packs in, intelligence out

**What it is.** The loop that most firms leave open, closed. The highest
frequency tool in the suite and, per the roadmap, the wedge.

**Before the meeting** — generated automatically the evening before from
the calendar entry:

- who you are meeting, one page, with a photo
- their positions on this file, quoted and dated
- our history with them and anything outstanding from last time
- our three asks, in priority order
- their likely three objections, with rebuttals
- what we want to learn (an intelligence shopping list, not just a pitch)
- a leave-behind one-pager, formatted and ready to print

**After the meeting** — dictate or type two hundred messy words; get back:

- a structured readout in house format
- **commitments** — theirs and ours, with owners and dates, pushed to tasks
- **intelligence** — routed to the right stakeholder cards and file notes
- **register-relevant facts** — logged for Bridge's compliance module
- a suggested follow-up email, drafted

**The hard part: the thirty-second rule.** If filing a readout takes more
than thirty seconds of a consultant's attention, it will not happen on the
walk back from the Berlaymont, and everything downstream starves. The
input has to be voice, on a phone, immediately, in whatever language the
consultant thinks in — and the tool has to do the structuring. This is a
user-experience problem, not an AI problem, and it is where this tool
succeeds or dies.

---

## 9. Bridge — the dashboard

**What it is.** Not a reporting layer over the other eight. An
**exception-management** layer: it shows what is off-track, not what is
happening.

A dashboard that shows everything gets glanced at once a week. A dashboard
that shows five things needing attention today gets opened every morning.

**Account cockpit** — per client: the files, where each sits on the
legislative timeline, upcoming decision points, fee burn against term,
deliverables due, open commitments, last client contact.

**The flag engine** — the reason to open it:

| Flag | Trigger |
|---|---|
| Budget drift | Burn > 1.3 × elapsed term |
| Client silence | No substantive contact in 21 days |
| Renewal window | Retainer ends in < 90 days, no renewal conversation logged |
| Value gap | Fee > €X consumed, fewer than N deliverables filed |
| Deadline compression | Tabling deadline in < 5 working days, no draft in Table |
| Position drift | Draft contradicts our filed position on the same file |
| Capacity | Consultant's committed hours > availability next 2 weeks |
| Register overdue | Declarable meeting logged, not yet in a filing |

**Deadline engine.** Legislative calendars are knowable: consultation
closes, tabling deadlines, committee votes, plenary sessions, transposition
dates. Bridge derives them from the file, back-plans internal deadlines
from them (draft to client 5 days before tabling; client sign-off 2 days
before), and puts them in the consultant's actual calendar.

**Timesheets.** Draft entries assembled from documents produced, meetings
attended, files touched. The consultant corrects and approves in two
minutes on Friday instead of reconstructing a fortnight on the 30th. This
is the least glamorous item in this document and the one most likely to
make the suite loved internally — and it materially improves realisation,
which is a real number on the P&L.

**Compliance.** EU Transparency Register declarations, meetings with
Commission officials and their required publication, EP access-badge
obligations, and national regimes — Germany's Lobbyregister, Ireland's
three-times-yearly returns, Austria, France's HATVP, and the rest.
Meetings logged in Readout populate the returns; Bridge tracks what is
declarable and when it is due, and drafts the filing. **It never files.**
A human submits, always.

**Conflict check.** Before onboarding: does this prospect's position on any
live file conflict with an existing client's? A structured check against
the graph, run in minutes, replacing a partner's recollection.

---

## Cross-cutting capabilities

Not tools; properties every tool must have.

**Multilingual by default.** Draft in EN, deliver in DE/SV/DA/FR/NL/PL/FI.
Not machine translation of a finished English document — generation in the
target language with the legal terminology of that jurisdiction, because
"regulation" and *Verordnung* and *förordning* do not map cleanly and a
client's general counsel will notice.

**House style, enforced by example.** A style corpus per language and per
deliverable type, retrieved as anchors at generation time.

**Institutional memory search.** Across every deliverable the firm has ever
produced: "have we written on data localisation before?" answered in
seconds, with the actual paragraphs. This is the quiet compounding asset,
and it is the argument that wins the internal budget for the project.

**Client data segregation.** Hard walls between accounts, enforced at the
retrieval layer, auditable. In a firm serving competing clients this is
not a feature, it is a licence to operate.

**Audit trail.** Every generated deliverable records its sources, its model
version, its prompt, and the human who approved it. When a client asks
where a number came from — and one day, one will — the answer takes ten
seconds.
