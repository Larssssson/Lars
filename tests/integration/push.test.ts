import { beforeEach, describe, expect, it } from "vitest";
import type { PushDevice, PushMessage } from "@/lib/adapters/push/types";
import { createPrismaClient } from "@/lib/db";
import { DomainError } from "@/lib/domain/errors";
import { notify } from "@/lib/domain/notifications";
import { listDevices, MAX_DEVICES, registerDevice, removeDevice, sendTestPush } from "@/lib/domain/notifications/devices";
import { ForbiddenError } from "@/lib/domain/permissions";
import { resetAndSeed, testDeps, usersByKey, type TestDeps } from "./helpers";

const db = createPrismaClient();
let deps: TestDeps;

beforeEach(async () => {
  await resetAndSeed(db);
  deps = await testDeps(db);
});

const device = (n: number) => ({
  endpoint: `https://push.example.org/geraet/${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  label: `Gerät ${n}`,
});

describe("Push-Geräte (BRIEFING 10.3)", () => {
  it("mehrere Geräte registrieren, einzeln entfernen, nur eigene", async () => {
    const [laura, robin] = await usersByKey(db, ["laura", "robin"]);
    await registerDevice(deps, laura, device(1));
    await registerDevice(deps, laura, device(2));
    await registerDevice(deps, laura, { ...device(2), label: "iPhone · Safari" });
    const devices = await listDevices(db, laura.id);
    expect(devices.map((d) => d.deviceLabel)).toEqual(["Gerät 1", "iPhone · Safari"]);
    await expect(removeDevice(deps, robin, devices[0]!.id)).rejects.toThrow(ForbiddenError);
    await removeDevice(deps, laura, devices[0]!.id);
    expect(await listDevices(db, laura.id)).toHaveLength(1);
    // dasselbe Gerät, andere Person angemeldet: das Abonnement wandert
    await registerDevice(deps, robin, device(2));
    expect(await listDevices(db, laura.id)).toHaveLength(0);
    expect(await listDevices(db, robin.id)).toHaveLength(1);
  });

  it("prüft Endpunkt und Schlüssel und begrenzt die Zahl der Geräte", async () => {
    const [laura] = await usersByKey(db, ["laura"]);
    await expect(registerDevice(deps, laura, { ...device(1), endpoint: "http://unsicher.example.org/x" })).rejects.toThrow(DomainError);
    await expect(registerDevice(deps, laura, { ...device(1), keys: { p256dh: "kurz", auth: "x" } })).rejects.toThrow(DomainError);
    for (let i = 0; i < MAX_DEVICES; i++) await registerDevice(deps, laura, device(i));
    await expect(registerDevice(deps, laura, device(99))).rejects.toThrow("höchstens");
    await registerDevice(deps, laura, device(0));
  });

  it("Testnachricht an alle eigenen Geräte, steht in der Glocke und zählt als Push", async () => {
    const [laura] = await usersByKey(db, ["laura"]);
    await expect(sendTestPush(deps, laura)).rejects.toThrow("zuerst ein Gerät");
    await registerDevice(deps, laura, device(1));
    await registerDevice(deps, laura, device(2));
    expect(await sendTestPush(deps, laura)).toBe(2);
    expect(deps.push.sent.at(-1)).toMatchObject({ userId: laura.id, title: "Testnachricht von impress", link: "/profil", devices: 2 });
    expect(await db.notification.count({ where: { userId: laura.id, kind: "PUSH_TEST", isPush: true } })).toBe(1);
  });

  it("Push geht an alle Geräte; Geräte, die der Push-Dienst nicht mehr kennt, werden entfernt", async () => {
    const [laura] = await usersByKey(db, ["laura"]);
    await registerDevice(deps, laura, device(1));
    await registerDevice(deps, laura, device(2));
    const received: { message: PushMessage; devices: PushDevice[] }[] = [];
    deps.push.send = async (message, devices) => {
      received.push({ message, devices });
      return { expired: [device(2).endpoint] };
    };
    await notify(deps, { userId: laura.id, kind: "TASK_URGENT", title: "Dringend: PM", link: "/aufgaben/x", push: true, pushBody: "Covenant · PM · Frist" });
    expect(received[0]!.devices.map((d) => d.endpoint).sort()).toEqual([device(1).endpoint, device(2).endpoint]);
    expect(received[0]!.message).toMatchObject({ title: "impress", body: "Covenant · PM · Frist", link: "/aufgaben/x" });
    expect((await listDevices(db, laura.id)).map((d) => d.deviceLabel)).toEqual(["Gerät 1"]);
    // ohne Push nur die Glocke
    await notify(deps, { userId: laura.id, kind: "COMMENT", title: "Kommentar", link: "/", push: false });
    expect(received).toHaveLength(1);
  });
});
