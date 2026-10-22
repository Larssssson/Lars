"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { registerDeviceAction, registerMockDeviceAction } from "@/app/(app)/profil/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { detectPlatform, deviceLabel, urlBase64ToUint8Array, type Platform } from "@/lib/push-client";

type State = "checking" | "unsupported" | "ios-install" | "denied" | "ready" | "enabled";
type BrowserInfo = { platform: Platform; label: string; initial: State };

let cachedInfo: BrowserInfo | null = null;
/** Gerät und Push-Fähigkeit des Browsers; gibt es nur im Browser, daher null auf dem Server. */
function readBrowserInfo(): BrowserInfo {
  if (cachedInfo) return cachedInfo;
  const ua = navigator.userAgent;
  const platform = detectPlatform(ua, navigator.maxTouchPoints);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const initial: State = platform === "ios" && !standalone ? "ios-install" : !supported ? "unsupported" : Notification.permission === "denied" ? "denied" : "ready";
  cachedInfo = { platform, label: deviceLabel(ua, navigator.maxTouchPoints), initial };
  return cachedInfo;
}
const noSubscribe = () => () => undefined;

/**
 * "Push einrichten" (BRIEFING 10.3): Anleitung je Gerät, Erlaubnis, Abonnement beim Push-Dienst.
 * Ohne VAPID-Schlüssel (Ersatz-Modus) lässt sich ein Ersatz-Gerät registrieren.
 */
export function PushSetup({ publicKey }: { publicKey: string | null }) {
  const p = t.account.push;
  const info = useSyncExternalStore(noSubscribe, readBrowserInfo, () => null);
  const [override, setOverride] = useState<State | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const platform = info?.platform ?? "desktop";
  const label = info?.label ?? "";
  const state: State = override ?? info?.initial ?? "checking";

  // schon eingerichtet? Dann gibt es ein Abonnement beim registrierten Service Worker
  useEffect(() => {
    if (info?.initial !== "ready" || !publicKey) return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setOverride("enabled");
      })
      .catch(() => undefined);
  }, [info, publicKey]);

  function enable() {
    if (!publicKey) return;
    start(async () => {
      setMessage(null);
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setOverride(permission === "denied" ? "denied" : "ready");
          return;
        }
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
        const result = await registerDeviceAction(JSON.parse(JSON.stringify(subscription)), label);
        setMessage(result ?? null);
        if (!result?.error) setOverride("enabled");
      } catch {
        setMessage({ error: p.errors.failed });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="push-setup">
      <p className="text-sm text-muted-foreground">{p.intro}</p>
      <div>
        <h3 className="text-sm font-medium">{p.platform[platform]}</h3>
        <ol className="mt-1 list-decimal pl-5 text-sm">
          {p.steps[platform].map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      {!publicKey ? (
        <>
          <p className="text-sm text-muted-foreground">{p.mockMode}</p>
          <ActionForm action={registerMockDeviceAction.bind(null, label)}>
            <SubmitButton variant="outline" size="sm">{p.mockRegister}</SubmitButton>
          </ActionForm>
        </>
      ) : state === "ios-install" ? (
        <p role="status" className="text-sm">{p.iosInstallFirst}</p>
      ) : state === "unsupported" ? (
        <p role="status" className="text-sm">{p.unsupported}</p>
      ) : state === "denied" ? (
        <p role="status" className="text-sm">{p.denied}</p>
      ) : state === "enabled" ? (
        <p role="status" className="text-sm font-medium">{p.enabled}</p>
      ) : (
        <div><Button size="sm" onClick={enable} disabled={pending || state === "checking"}>{pending ? p.working : p.enable}</Button></div>
      )}
      <div aria-live="polite">
        {message?.error && <p role="alert" className="text-sm text-destructive">{message.error}</p>}
        {message?.ok && <p className="text-sm text-muted-foreground">{message.ok}</p>}
      </div>
    </div>
  );
}
