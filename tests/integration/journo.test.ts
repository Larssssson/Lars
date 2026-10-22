import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import {
  approvePendingOwner,
  becomeOwner,
  canReveal,
  createContact,
  maskPhone,
  missingForVerification,
  revealDetail,
  revokeVerification,
  updateContact,
  verifyContact,
} from "@/lib/domain/journo/contacts";
import { commitContactImport, defaultDecision, guessMapping, loadImportFile, previewContactImport, uploadContactFile } from "@/lib/domain/journo/import";
import { maintenanceList, weeklyContactMaintenance } from "@/lib/domain/journo/maintenance";
import { deleteContact, exportContactData, exportContactPdf } from "@/lib/domain/journo/privacy";
import { contactView, listContacts, whoKnows } from "@/lib/domain/journo/queries";
import { createContactRequest, decideContactRequest, listContactRequests, remindOpenRequests } from "@/lib/domain/journo/requests";
import { bookmarkedRecipients, suggestJournalists, toggleBookmark } from "@/lib/domain/journo/suggestions";
import { ForbiddenError } from "@/lib/domain/permissions";
import { completeOffboarding, offboardingOverview, reassignTask, resolveOwnedContact } from "@/lib/domain/permissions/offboarding";
import { createPrismaClient } from "@/lib/db";
import { clientByName, FIXED_NOW, resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

const contact = (firstName: string) => db.journalist.findFirstOrThrow({ where: { firstName }, include: { contactDetails: true, owners: true } });
const later = (hours: number) => new Date(FIXED_NOW.getTime() + hours * 3_600_000);

async function fixture(name: string) {
  const mime = name.endsWith(".csv") ? "text/csv" : name.endsWith(".vcf") ? "text/vcard" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return { name, mimeType: mime, data: new Uint8Array(await readFile(path.resolve("fixtures/contacts", name))) };
}

describe("Journo Hub: Seed und Liste (BRIEFING 7.5, 13.2)", () => {
  it("Medien, Journalisten, Owner und Artikel wie vorgegeben", async () => {
    expect(await db.media.count({ where: { isSampleData: true } })).toBe(6);
    const all = await db.journalist.findMany({ include: { owners: true, contactDetails: true, articles: true } });
    expect(all).toHaveLength(8);
    expect(all.every((j) => j.isSampleData)).toBe(true);
    const tim = all.find((j) => j.firstName === "Tim")!;
    expect(tim.owners).toHaveLength(0);
    expect(all.find((j) => j.firstName === "Jana")!.owners).toHaveLength(2);
    expect(all.find((j) => j.firstName === "Jana")!.articles).toHaveLength(3);
    expect(all.find((j) => j.firstName === "Peter")!.articles).toHaveLength(3);
    for (const j of all) {
      expect(j.contactDetails.find((d) => d.kind === "TELEFON")!.value).toMatch(/^\+493055501\d\d$/);
      expect(j.contactDetails.find((d) => d.kind === "MAIL")!.value).toBe(`${j.firstName}.${j.lastName}@example.org`.toLowerCase());
    }
  });

  it("Liste mit Filtern, verifizierte zuerst, ohne Kontaktdaten", async () => {
    const list = await listContacts(db);
    expect(list.slice(0, 3).every((c) => c.status === "VERIFIZIERT")).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/example\.org|5550/);
    expect(list.find((c) => c.name === "Jana Hofmann")!.lastWrittenAt).not.toBeNull();
    expect((await listContacts(db, { status: "PRESSESPIEGEL" })).map((c) => c.name).sort()).toEqual(["Sabine Vogt", "Tim Neumann"]);
    expect((await listContacts(db, { topic: "Drohnen" })).map((c) => c.name)).toEqual(["Ole Brandt"]);
    expect((await listContacts(db, { mediaType: "LEITMEDIUM" })).length).toBe(4);
    expect((await listContacts(db, { desk: "politik" })).map((c) => c.name).sort()).toEqual(["Jana Hofmann", "Sabine Vogt", "Tim Neumann"]);
    const [lukas] = await usersByKey(db, ["lukas"] as const);
    expect((await listContacts(db, { ownerId: lukas.id })).map((c) => c.name).sort()).toEqual(["Jana Hofmann", "Peter Albrecht"]);
  });

  it("Wer kennt jemanden bei diesem Medium: Tim Neumann ohne Owner zeigt Miriam Krause", async () => {
    const [laura] = await usersByKey(db, ["laura"] as const);
    const tim = await contact("Tim");
    const view = await contactView(db, laura, tim.id, {}, FIXED_NOW);
    expect(view.whoKnows).toEqual([expect.objectContaining({ name: "Miriam Krause", owners: ["Juliana"] })]);
    expect((await contactView(db, laura, (await contact("Jana")).id, {}, FIXED_NOW)).whoKnows).toBeNull();
    expect(await whoKnows(db, tim.mediaId!)).toHaveLength(1);
  });
});

describe("Kontaktdaten verdeckt und aufdecken (BRIEFING 7.5, 11)", () => {
  it("Owner und CVD decken auf, jedes Aufdecken steht im Protokoll; andere sehen nur die letzten 2 Ziffern", async () => {
    const [laura, lukas, lars] = await usersByKey(db, ["laura", "lukas", "lars"] as const);
    const jana = await contact("Jana");
    const phone = jana.contactDetails.find((d) => d.kind === "TELEFON")!;
    const view = await contactView(db, laura, jana.id, {}, FIXED_NOW);
    expect(view.mayReveal).toBe(false);
    expect(view.details.find((d) => d.kind === "TELEFON")!.masked).toBe(maskPhone("+49305550101"));
    expect(view.details.find((d) => d.kind === "TELEFON")!.masked.endsWith("01")).toBe(true);
    expect(JSON.stringify(view.details)).not.toContain("5550101");
    await expect(revealDetail(deps, laura, phone.id, {})).rejects.toThrow(ForbiddenError);

    expect(await revealDetail(deps, lukas, phone.id, {})).toBe("+49305550101");
    // Mika ist CVD? nein; Lars ist CVD und Owner, Hannah weder noch
    const [hannah] = await usersByKey(db, ["hannah"] as const);
    await expect(revealDetail(deps, hannah, phone.id, {})).rejects.toThrow(ForbiddenError);
    const lea = await contact("Lea");
    expect(await revealDetail(deps, lars, lea.contactDetails[0]!.id, {})).toMatch(/example|\+49/);
    expect(await db.revealLog.count()).toBe(2);
    const audit = await db.auditLog.findMany({ where: { action: "CONTACT_REVEALED" } });
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toMatch(/5550|example\.org/);
  });

  it("Freigabe gilt für den gewählten Kunden, Projektfreigabe nur im Projekt (DECISIONS D-012)", async () => {
    const [laura, lukas] = await usersByKey(db, ["laura", "lukas"] as const);
    const [covenant, rafael] = [await clientByName(db, "Covenant"), await clientByName(db, "Rafael")];
    const jana = await contact("Jana");
    await db.contactAccessGrant.create({ data: { journalistId: jana.id, userId: laura.id, clientId: covenant.id, grantedBy: lukas.id } });
    expect(await canReveal(db, laura, jana.id, { clientId: covenant.id }, FIXED_NOW)).toBe(true);
    expect(await canReveal(db, laura, jana.id, { clientId: rafael.id }, FIXED_NOW)).toBe(false);
    expect(await canReveal(db, laura, jana.id, {}, FIXED_NOW)).toBe(false);
    const project = await db.project.findFirstOrThrow({ where: { clientId: covenant.id } });
    const peter = await contact("Peter");
    await db.contactAccessGrant.create({ data: { journalistId: peter.id, userId: laura.id, clientId: covenant.id, projectId: project.id, grantedBy: lukas.id } });
    expect(await canReveal(db, laura, peter.id, { clientId: covenant.id }, FIXED_NOW)).toBe(false);
    expect(await canReveal(db, laura, peter.id, { clientId: covenant.id, projectId: project.id }, FIXED_NOW)).toBe(true);
  });

  it("Vorhandene Kontaktdaten ändert nur, wer sie sehen darf; leere darf jeder ergänzen", async () => {
    const [laura, robin] = await usersByKey(db, ["laura", "robin"] as const);
    const ole = await contact("Ole");
    await expect(updateContact(deps, laura, ole.id, { firstName: "Ole", lastName: "Brandt" }, { phone: "030 5550199" })).rejects.toThrow(/nur ändern/);
    await updateContact(deps, laura, ole.id, { firstName: "Ole", lastName: "Brandt", region: "Bonn" }, { linkedin: "linkedin.com/in/beispiel" });
    await updateContact(deps, robin, ole.id, { firstName: "Ole", lastName: "Brandt" }, { phone: "030 5550199" });
    expect((await contact("Ole")).contactDetails.find((d) => d.kind === "TELEFON")!.value).toBe("+49305550199");
    await expect(updateContact(deps, robin, ole.id, { firstName: "Ole", lastName: "Brandt" }, { phone: "12" })).rejects.toThrow(/nicht erkannt/);
  });
});

describe("Verifizieren und Owner (BRIEFING 7.5, 6.7)", () => {
  it("Verifizieren nur mit Telefon, Mail und erstem Kontakt; wer verifiziert, wird Owner; CVD entzieht mit Grund", async () => {
    const [laura, robin, lars] = await usersByKey(db, ["laura", "robin", "lars"] as const);
    const stefan = await contact("Stefan");
    expect(await missingForVerification(db, stefan.id)).toEqual(["Datum des ersten Kontakts"]);
    await expect(verifyContact(deps, robin, stefan.id)).rejects.toThrow(/Zum Verifizieren fehlt: Datum des ersten Kontakts/);
    await updateContact(deps, laura, stefan.id, { firstName: "Stefan", lastName: "Lorenz", mediaId: stefan.mediaId, desk: "Lokales", topics: stefan.topics, firstContactAt: FIXED_NOW });
    await verifyContact(deps, robin, stefan.id);
    const verified = await contact("Stefan");
    expect(verified).toMatchObject({ status: "VERIFIZIERT", verifiedBy: robin.id });
    expect(verified.owners.map((o) => o.userId).sort()).toEqual([laura.id, robin.id].sort());

    await expect(revokeVerification(deps, laura, stefan.id, "Daten veraltet")).rejects.toThrow(ForbiddenError);
    await expect(revokeVerification(deps, lars, stefan.id, " ")).rejects.toThrow(DomainError);
    await revokeVerification(deps, lars, stefan.id, "Daten veraltet");
    expect(await contact("Stefan")).toMatchObject({ status: "MANUELL", verifiedBy: null });
    expect(await db.auditLog.count({ where: { action: "CONTACT_VERIFICATION_REVOKED" } })).toBe(1);

    const created = await createContact(deps, laura, { firstName: "Neue", lastName: "Person" }, { mail: "neue.person@example.org" });
    expect(created.status).toBe("MANUELL");
    expect((await contact("Neue")).owners.map((o) => o.userId)).toEqual([laura.id]);
  });

  it("Höchstens 3 aktive Owner, ein vierter braucht einen CVD", async () => {
    const [laura, robin, mika, lukas, lars] = await usersByKey(db, ["laura", "robin", "mika", "lukas", "lars"] as const);
    const covenant = await clientByName(db, "Covenant");
    const jana = await contact("Jana");
    await expect(becomeOwner(deps, laura, jana.id)).rejects.toThrow(/freigegebenen Anfrage/);
    for (const user of [laura, robin]) {
      const request = await createContactRequest(deps, user, { journalistId: jana.id, clientId: covenant.id, reason: "Hintergrundgespräch" });
      await decideContactRequest(deps, lukas, request.id, "FREIGEBEN");
    }
    expect(await becomeOwner(deps, laura, jana.id)).toEqual({ pending: false });
    expect(await becomeOwner(deps, robin, jana.id)).toEqual({ pending: true });
    const pending = await db.contactOwner.findFirstOrThrow({ where: { journalistId: jana.id, userId: robin.id } });
    expect(pending.pendingApproval).toBe(true);
    expect(await db.notification.count({ where: { kind: "CONTACT_OWNER_APPROVAL" } })).toBe(2);
    expect(await canReveal(db, robin, jana.id, {}, FIXED_NOW)).toBe(false);
    await expect(approvePendingOwner(deps, mika, pending.id)).rejects.toThrow(ForbiddenError);
    await approvePendingOwner(deps, lars, pending.id);
    expect(await canReveal(db, robin, jana.id, {}, FIXED_NOW)).toBe(true);
  });
});

describe("Kontaktanfrage (BRIEFING 6.7)", () => {
  it("Owner bekommen Push und Glocke; Freigeben, Übernehmen, Ablehnen; Antwort an den Anfragenden", async () => {
    const [laura, robin, hannah, lukas, lars] = await usersByKey(db, ["laura", "robin", "hannah", "lukas", "lars"] as const);
    const covenant = await clientByName(db, "Covenant");
    const jana = await contact("Jana");
    const r1 = await createContactRequest(deps, laura, { journalistId: jana.id, clientId: covenant.id, reason: "Interview zum Standort", urgency: "DRINGEND" });
    expect(deps.push.sent.filter((p) => [lukas.id, lars.id].includes(p.userId))).toHaveLength(2);
    expect(JSON.stringify(deps.push.sent)).not.toMatch(/Hofmann|example\.org/);
    await expect(createContactRequest(deps, laura, { journalistId: jana.id, clientId: covenant.id, reason: "noch mal" })).rejects.toThrow(/schon eine offene/);
    await expect(decideContactRequest(deps, robin, r1.id, "FREIGEBEN")).rejects.toThrow(ForbiddenError);
    await decideContactRequest(deps, lukas, r1.id, "FREIGEBEN");
    expect(await canReveal(db, laura, jana.id, { clientId: covenant.id }, FIXED_NOW)).toBe(true);
    expect(await db.notification.count({ where: { userId: laura.id, kind: "CONTACT_REQUEST_ANSWERED" } })).toBe(1);
    await expect(decideContactRequest(deps, lars, r1.id, "ABLEHNEN", "zu spät")).rejects.toThrow(/schon entschieden/);
    await expect(createContactRequest(deps, laura, { journalistId: jana.id, clientId: covenant.id, reason: "x" })).rejects.toThrow(/bereits sehen/);

    const r2 = await createContactRequest(deps, robin, { journalistId: jana.id, clientId: covenant.id, reason: "Roundtable-Einladung" });
    await decideContactRequest(deps, lars, r2.id, "UEBERNEHMEN");
    const task = await db.task.findFirstOrThrow({ where: { ownerId: lars.id, title: "Kontakt ansprechen: Jana Hofmann" } });
    expect(task).toMatchObject({ clientId: covenant.id, type: "AUFGABE" });

    const r3 = await createContactRequest(deps, hannah, { journalistId: jana.id, clientId: covenant.id, reason: "Pitch" });
    await expect(decideContactRequest(deps, lukas, r3.id, "ABLEHNEN")).rejects.toThrow(/Begründung/);
    await decideContactRequest(deps, lukas, r3.id, "ABLEHNEN", "Jana ist im Urlaub");
    expect(await db.contactRequest.findUniqueOrThrow({ where: { id: r3.id } })).toMatchObject({ status: "ABGELEHNT", decisionNote: "Jana ist im Urlaub" });
    expect(await db.auditLog.count({ where: { action: "CONTACT_ACCESS_GRANTED" } })).toBe(1);
  });

  it("Erinnerung einmal nach 24 Stunden; ohne Owner entscheiden CVDs; CVDs sehen alle Anfragen", async () => {
    const [laura, lars, lukas, hannah] = await usersByKey(db, ["laura", "lars", "lukas", "hannah"] as const);
    const covenant = await clientByName(db, "Covenant");
    const tim = await contact("Tim");
    const peter = await contact("Peter");
    await createContactRequest(deps, laura, { journalistId: tim.id, clientId: covenant.id, reason: "Politik-Interview" });
    // Tim hat keinen Owner: beide CVDs werden benachrichtigt
    expect(new Set(deps.push.sent.map((p) => p.userId))).toEqual(new Set([lars.id, lukas.id]));
    await createContactRequest(deps, hannah, { journalistId: peter.id, clientId: covenant.id, reason: "Hintergrund" });
    const before = deps.push.sent.length;
    deps.clock.now = later(23);
    expect(await remindOpenRequests(deps)).toBe(0);
    deps.clock.now = later(25);
    expect(await remindOpenRequests(deps)).toBe(2);
    expect(deps.push.sent.length).toBe(before + 3);
    expect(await remindOpenRequests(deps)).toBe(0);

    const cvdView = await listContactRequests(deps, lars);
    expect(cvdView.all).toHaveLength(2);
    expect(cvdView.toMe.map((r) => r.journalist.firstName).sort()).toEqual(["Tim"]);
    const lauraView = await listContactRequests(deps, laura);
    expect(lauraView.all).toHaveLength(0);
    expect(lauraView.mine).toHaveLength(1);
  });
});

describe("Import (BRIEFING 7.5, 13.4)", () => {
  it("CSV: Zuordnung, Vorschau mit Dubletten, Übernehmen als Import mit Owner", async () => {
    const [mika] = await usersByKey(db, ["mika"] as const);
    const file = await uploadContactFile(deps, mika, await fixture("kontakte_sample.csv"));
    const { parsed } = await loadImportFile(deps, mika, file.id);
    expect(parsed.rows).toHaveLength(25);
    const mapping = guessMapping(parsed.columns);
    expect(mapping).toEqual({ Vorname: "firstName", Nachname: "lastName", Medium: "media", Ressort: "desk", "E-Mail": "email", Telefon: "phone", Notiz: "notes" });
    const rows = await previewContactImport(deps, mika, file.id, mapping);
    const dupes = rows.filter((r) => r.duplicate);
    expect(dupes.map((r) => [`${r.firstName} ${r.lastName}`, r.duplicate!.reason])).toEqual([
      ["Jana Hofmann", "MAIL"],
      ["Peter Albrecht", "TELEFON"],
      ["Stefan Lorenz", "NAME_MEDIUM"],
    ]);
    expect(rows.filter((r) => r.problems.includes("NO_MAIL")).map((r) => r.firstName)).toEqual(["Nina", "Noah"]);
    expect(rows.map(defaultDecision).filter((d) => d === "MERGE")).toHaveLength(3);

    const result = await commitContactImport(deps, mika, { fileId: file.id, mapping, decisions: { 2: "SKIP" }, mappingName: "Standard CSV" });
    expect(result).toEqual({ created: 21, merged: 3, skipped: 1 });
    const imported = await db.journalist.findMany({ where: { status: "IMPORT", isSampleData: false }, include: { owners: true } });
    expect(imported).toHaveLength(21);
    expect(imported.every((j) => j.owners.length === 1 && j.owners[0]!.userId === mika.id)).toBe(true);
    expect(await db.media.findUnique({ where: { name: "Wirtschaftswoche Ost" } })).toMatchObject({ type: "ONLINE" });
    const peter = await contact("Peter");
    expect(peter.contactDetails.filter((d) => d.kind === "MAIL").map((d) => [d.value, d.isPrimary])).toEqual([
      ["peter.albrecht@example.org", true],
      ["p.albrecht@example.org", false],
    ]);
    expect(peter.status).toBe("VERIFIZIERT");
    expect(await db.importMapping.count({ where: { kind: "KONTAKTE" } })).toBe(1);
    // die Datei wird nach dem Import entfernt
    await expect(loadImportFile(deps, mika, file.id)).rejects.toThrow();
  });

  it("vCard (iCloud) mit zwei Telefonnummern und XLSX", async () => {
    const [hannah] = await usersByKey(db, ["hannah"] as const);
    const vcf = await uploadContactFile(deps, hannah, await fixture("kontakte_sample.vcf"));
    const { parsed } = await loadImportFile(deps, hannah, vcf.id);
    const rows = await previewContactImport(deps, hannah, vcf.id, guessMapping(parsed.columns));
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({ firstName: "Greta", lastName: "Fischer", media: "Tagesblatt Nord", function: "Redakteurin Politik", phones: ["+491515550131", "+49305550132"] });
    expect(rows.find((r) => r.firstName === "Anton")!.notes).toBe("kennt Ole Brandt, gut");
    expect(rows.find((r) => r.firstName === "Peter")!.duplicate).toMatchObject({ kind: "EXISTING", reason: "MAIL" });
    const result = await commitContactImport(deps, hannah, { fileId: vcf.id, mapping: guessMapping(parsed.columns), decisions: {} });
    expect(result).toEqual({ created: 9, merged: 1, skipped: 0 });
    expect((await contact("Greta")).contactDetails.filter((d) => d.kind === "TELEFON")).toHaveLength(2);

    const xlsx = await uploadContactFile(deps, hannah, await fixture("kontakte_sample.xlsx"));
    const loaded = await loadImportFile(deps, hannah, xlsx.id);
    expect(loaded.parsed.rows).toHaveLength(25);
    expect(loaded.parsed.rows[1]).toMatchObject({ Vorname: "Karl", Telefon: "030 5550150" });
    // fremde Importdateien sind nicht lesbar
    const [laura] = await usersByKey(db, ["laura"] as const);
    await expect(loadImportFile(deps, laura, xlsx.id)).rejects.toThrow();
  });

  it("Dubletten innerhalb der Datei und als neu anlegen", async () => {
    const [mika] = await usersByKey(db, ["mika"] as const);
    const csv = "Vorname;Nachname;Medium;E-Mail\nA;B;X;a@example.org\nC;D;Y;a@example.org\nJana;Hofmann;Tagesblatt Nord;\n";
    const file = await uploadContactFile(deps, mika, { name: "k.csv", mimeType: "text/csv", data: new TextEncoder().encode(csv) });
    const mapping = { Vorname: "firstName", Nachname: "lastName", Medium: "media", "E-Mail": "email" } as const;
    const rows = await previewContactImport(deps, mika, file.id, mapping);
    expect(rows[1]!.duplicate).toEqual({ kind: "IN_FILE", row: 1, reason: "MAIL" });
    expect(rows[2]!.duplicate).toMatchObject({ kind: "EXISTING", reason: "NAME_MEDIUM" });
    await expect(previewContactImport(deps, mika, file.id, { Vorname: "firstName" })).rejects.toThrow(/Vor- und Nachname/);
    const result = await commitContactImport(deps, mika, { fileId: file.id, mapping, decisions: { 2: "NEW", 3: "NEW" } });
    expect(result).toEqual({ created: 3, merged: 0, skipped: 0 });
    expect(await db.journalist.count({ where: { firstName: "Jana", lastName: "Hofmann" } })).toBe(2);
  });
});

describe("Pflege, Auskunft, Löschen (BRIEFING 7.5, 11)", () => {
  it("Wöchentliche Pflege: mögliche Dubletten und Kontakte ohne Aktivität, nichts wird geändert", async () => {
    const [laura, lars, lukas] = await usersByKey(db, ["laura", "lars", "lukas"] as const);
    expect(await maintenanceList(db, FIXED_NOW)).toEqual({ duplicates: [], inactive: [] });
    await createContact(deps, laura, { firstName: "Jana", lastName: "Hofmann", mediaId: (await contact("Jana")).mediaId });
    const lea = await contact("Lea");
    await db.journalist.update({ where: { id: lea.id }, data: { lastActivityAt: new Date("2024-01-01T00:00:00Z") } });
    const list = await weeklyContactMaintenance(deps);
    expect(list.duplicates).toEqual([expect.objectContaining({ reason: "NAME_MEDIUM" })]);
    expect(list.inactive.map((c) => c.name)).toEqual(["Lea Schubert"]);
    expect(await db.notification.findMany({ where: { kind: "CONTACT_MAINTENANCE" }, select: { userId: true } })).toEqual(
      expect.arrayContaining([{ userId: lars.id }, { userId: lukas.id }]),
    );
    expect(await db.journalist.count({ where: { firstName: "Jana" } })).toBe(2);
  });

  it("Auskunft als JSON und PDF nur für CVDs; Löschen entfernt alles außer den Artikeln", async () => {
    const [laura, lars] = await usersByKey(db, ["laura", "lars"] as const);
    const jana = await contact("Jana");
    await expect(exportContactData(deps, laura, jana.id)).rejects.toThrow(ForbiddenError);
    const data = await exportContactData(deps, lars, jana.id);
    expect(data.contactDetails.map((d) => d.value)).toContain("jana.hofmann@example.org");
    expect(data.articles).toHaveLength(3);
    expect(data.owners.map((o) => o.name).sort()).toEqual(["Lars Scholtyssyk", "Lukas"]);
    const pdf = await exportContactPdf(data);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");

    await expect(deleteContact(deps, laura, jana.id)).rejects.toThrow(ForbiddenError);
    await deleteContact(deps, lars, jana.id);
    expect(await db.journalist.count({ where: { id: jana.id } })).toBe(0);
    expect(await db.contactDetail.count({ where: { journalistId: jana.id } })).toBe(0);
    expect(await db.contactOwner.count({ where: { journalistId: jana.id } })).toBe(0);
    expect(await db.article.count({ where: { headline: { contains: "Bundeswehr plant" } } })).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "CONTACT_DELETED" } });
    expect(JSON.stringify(audit)).not.toMatch(/Jana|Hofmann|example/);
  });
});

describe("Reiter Journalisten im Editor (BRIEFING 7.5)", () => {
  it("Passende Kontakte mit Begründung, verifizierte zuerst; Vormerken für den Versand", async () => {
    const [laura] = await usersByKey(db, ["laura"] as const);
    const pm = await db.task.findFirstOrThrow({ where: { title: "PM Standortentscheidung" }, include: { document: true } });
    const result = await suggestJournalists(deps, laura, pm.id);
    expect(result.aiOrdered).toBe(true);
    const names = result.suggestions.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Jana Hofmann", "Peter Albrecht"]));
    const firstUnverified = result.suggestions.findIndex((s) => s.status !== "VERIFIZIERT");
    expect(result.suggestions.slice(firstUnverified).every((s) => s.status !== "VERIFIZIERT")).toBe(true);
    const peter = result.suggestions.find((s) => s.name === "Peter Albrecht")!;
    expect(peter.reason).toMatch(/Artikel zum Thema in den letzten 60 Tagen, zuletzt am \d\d\.\d\d\.\d{4}/);
    expect(peter.reason).toContain("Owner: Lukas");
    expect(JSON.stringify(result)).not.toMatch(/example\.org|5550/);

    // ohne KI: Auswahl regelbasiert
    await db.client.update({ where: { id: pm.clientId }, data: { aiAllowed: false } });
    const noAi = await suggestJournalists(deps, laura, pm.id);
    expect(noAi.aiOrdered).toBe(false);
    expect(noAi.suggestions.length).toBeGreaterThanOrEqual(names.length);

    // keine passenden Kontakte: leere Liste statt erfundener
    const safenetTask = await db.task.findFirstOrThrow({ where: { title: "Profil aufsetzen" } });
    expect((await suggestJournalists(deps, laura, safenetTask.id)).suggestions).toEqual([]);

    const jana = await contact("Jana");
    expect(await toggleBookmark(deps, laura, pm.id, jana.id)).toBe(true);
    expect(await bookmarkedRecipients(deps, pm.document!.id)).toEqual([{ id: jana.id, label: "Jana Hofmann (Tagesblatt Nord)" }]);
    expect((await suggestJournalists(deps, laura, pm.id)).suggestions.find((s) => s.id === jana.id)!.bookmarked).toBe(true);
    expect(await toggleBookmark(deps, laura, pm.id, jana.id)).toBe(false);
  });
});

describe("Offboarding (BRIEFING 6.9)", () => {
  it("Aufgaben übertragen, Kontakte übertragen oder inaktiv lassen, erst dann sperren", async () => {
    const [laura, robin, lars, hannah] = await usersByKey(db, ["laura", "robin", "lars", "hannah"] as const);
    const overview = await offboardingOverview(db, lars, laura.id);
    expect(overview.tasks.length).toBeGreaterThan(0);
    expect(overview.contacts.map((c) => c.journalist.firstName)).toEqual(["Stefan"]);
    await expect(offboardingOverview(db, robin, laura.id)).rejects.toThrow(ForbiddenError);
    await expect(completeOffboarding(deps, lars, laura.id)).rejects.toThrow(/offene Aufgabe/);
    await expect(reassignTask(deps, lars, laura.id, overview.tasks[0]!.id, laura.id)).rejects.toThrow(DomainError);
    for (const task of overview.tasks) await reassignTask(deps, lars, laura.id, task.id, robin.id);
    await resolveOwnedContact(deps, lars, laura.id, overview.contacts[0]!.id, { kind: "NOTE", note: "Stefan bevorzugt Anrufe" });
    await completeOffboarding(deps, lars, laura.id);

    expect((await db.user.findUniqueOrThrow({ where: { id: laura.id } })).active).toBe(false);
    const stefan = await contact("Stefan");
    expect(stefan.owners).toEqual([expect.objectContaining({ userId: laura.id, active: false })]);
    expect(stefan.notes).toContain("Notiz beim Offboarding von Laura: Stefan bevorzugt Anrufe");
    expect(await db.auditLog.count({ where: { action: "USER_OFFBOARDED", entityId: laura.id } })).toBe(1);
    // die inaktive Owner bleibt sichtbar, bis ein neuer Owner eingetragen ist
    const view = await contactView(db, hannah, stefan.id, {}, FIXED_NOW);
    expect(view.owners).toEqual([expect.objectContaining({ name: "Laura", active: false })]);
    await becomeOwner(deps, lars, stefan.id);
    expect((await contact("Stefan")).owners.map((o) => o.userId)).toEqual([lars.id]);
  });

  it("Owner übertragen", async () => {
    const [robin, lars, hannah] = await usersByKey(db, ["robin", "lars", "hannah"] as const);
    const overview = await offboardingOverview(db, lars, robin.id);
    const ole = overview.contacts.find((c) => c.journalist.firstName === "Ole")!;
    await resolveOwnedContact(deps, lars, robin.id, ole.id, { kind: "TRANSFER", userId: hannah.id });
    expect((await contact("Ole")).owners.map((o) => [o.userId, o.active])).toEqual([[hannah.id, true]]);
  });
});

describe("Suche in Kontakten (DECISIONS D-022)", () => {
  it("findet Kontakte über Name und Medium, nie über Kontaktdaten", async () => {
    const { search } = await import("@/lib/domain/tasks/queries");
    expect((await search(db, "Jana Hof")).contacts.map((c) => c.lastName)).toEqual(["Hofmann"]);
    expect((await search(db, "Wehrtechnik")).contacts.map((c) => c.lastName)).toEqual(["Brandt"]);
    expect((await search(db, "example.org")).contacts).toEqual([]);
    expect((await search(db, "5550101")).contacts).toEqual([]);
  });
});
