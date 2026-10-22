import Link from "next/link";
import {
  confirmSectionAction,
  decideSuggestionAction,
  deleteKpiAction,
  deleteRuleAction,
  deleteServiceAction,
  deleteSpeakerAction,
  saveKpiAction,
  saveServiceAction,
  saveSpeakerAction,
  suggestChangeAction,
  updateSectionAction,
  uploadProfileDocumentAction,
} from "@/app/(app)/kunden/[id]/profil/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { t } from "@/i18n";
import type { loadProfile } from "@/lib/domain/clients/profile";
import {
  COMPLIANCE_STALE_DAYS,
  PROFILE_SECTIONS,
  PROFILE_STALE_DAYS,
  sectionFields,
  type Fact,
  type SectionContent,
} from "@/lib/domain/clients/profile-sections";
import type { servicesWithProgress } from "@/lib/domain/clients/services";
import { canEditProfilePart, canManageGoalsKpisServices, profileAccess, type NamedActor, type PermissionContext } from "@/lib/domain/permissions";
import { dateKey, formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export type Profile = Awaited<ReturnType<typeof loadProfile>>;
export type ProfileContext = {
  profile: Profile;
  services: Awaited<ReturnType<typeof servicesWithProgress>>;
  user: NamedActor;
  ctx: PermissionContext;
  names: Map<string, string>;
  members: { name: string; kind: "LEAD" | "TEAM" }[];
  now: Date;
};

const DAY = 86_400_000;
const p = t.profile;

/** Alter der Bestätigung und Warnstufe (BRIEFING 7.7: 90 Tage Warnung, Compliance nach 365 Tagen rot). */
function staleness(key: string, confirmedAt: Date | null, now: Date): { days: number | null; level: "ok" | "warn" | "red" } {
  if (!confirmedAt) return { days: null, level: "warn" };
  const days = Math.floor((now.getTime() - confirmedAt.getTime()) / DAY);
  if (key === "compliance" && days > COMPLIANCE_STALE_DAYS) return { days, level: "red" };
  return { days, level: days > PROFILE_STALE_DAYS ? "warn" : "ok" };
}

function FieldValue({ type, value }: { type: "text" | "list" | "facts"; value: SectionContent[string] | undefined }) {
  if (type === "text") return typeof value === "string" && value.trim() ? <p className="whitespace-pre-wrap">{value}</p> : <p className="text-muted-foreground">{p.empty}</p>;
  const list = Array.isArray(value) ? value : [];
  if (!list.length) return <p className="text-muted-foreground">{p.empty}</p>;
  if (type === "list") return <ul className="list-disc pl-5">{(list as string[]).map((v, i) => <li key={i}>{v}</li>)}</ul>;
  return (
    <ul className="flex flex-col gap-1">
      {(list as Fact[]).map((f, i) => (
        <li key={i}>{f.text}{(f.source || f.date) && <span className="text-xs text-muted-foreground"> · {[f.source, f.date].filter(Boolean).join(", ")}</span>}</li>
      ))}
    </ul>
  );
}

function formValue(type: "text" | "list" | "facts", value: SectionContent[string] | undefined): string {
  if (type === "text") return typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  if (type === "list") return (list as string[]).join("\n");
  return (list as Fact[]).map((f) => [f.text, f.source, f.date].filter((x) => x !== undefined).join(" | ")).join("\n");
}

function suggestionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    const v = value as { name: string; function?: string; topics?: string[] };
    return [v.name, v.function, v.topics?.length ? v.topics.join(", ") : null].filter(Boolean).join(" · ");
  }
  if (value && typeof value === "object" && "text" in value) {
    const v = value as Fact;
    return [v.text, v.source, v.date].filter(Boolean).join(" · ");
  }
  return "";
}

/** Offene Vorschläge eines Abschnitts mit Annehmen und Ablehnen (lernendes Profil, BRIEFING 7.7). */
export function SuggestionList({ pc, sectionKey }: { pc: ProfileContext; sectionKey?: string }) {
  const { profile, user, ctx } = pc;
  const list = profile.suggestions.filter((s) => !sectionKey || s.sectionKey === sectionKey);
  if (!list.length) return sectionKey ? null : <p className="text-sm text-muted-foreground">{p.suggestions.none}</p>;
  const files = new Map(profile.files.map((f) => [f.id, f.name]));
  return (
    <ul className="flex flex-col gap-2" data-testid={sectionKey ? `suggestions-${sectionKey}` : "suggestions"}>
      {list.map((s) => {
        const change = s.proposedChange as { field: string; value: unknown; note?: string | null };
        const field = sectionFields(s.sectionKey).find((f) => f.key === change.field);
        const mayDecide = canEditProfilePart(user, ctx, profile.client.id, field?.part ?? s.sectionKey);
        return (
          <li key={s.id} className={cn("flex flex-col gap-1 rounded-md border p-2 text-sm", s.source === "KI" && "border-sky-300 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/40")}>
            <p className="text-xs text-muted-foreground">
              <Badge className={s.source === "KI" ? "border-sky-400 text-sky-800 dark:text-sky-200" : ""}>{p.suggestions.source[s.source] ?? s.source}</Badge>{" "}
              {!sectionKey && `${p.sections[s.sectionKey] ?? s.sectionKey} · `}{p.fields[change.field] ?? change.field}
              {s.createdBy && pc.names.get(s.createdBy) && ` · ${p.suggestions.from(pc.names.get(s.createdBy)!)}`}
              {s.sourceFileId && files.get(s.sourceFileId) && ` · ${p.suggestions.fromFile(files.get(s.sourceFileId)!)}`}
            </p>
            <p>{suggestionText(change.value)}</p>
            {change.note && <p className="text-xs text-muted-foreground">{change.note}</p>}
            {mayDecide && (
              <div className="flex gap-2">
                <ActionForm action={decideSuggestionAction.bind(null, profile.client.id, s.id, true)}><SubmitButton size="sm" variant="outline" className="h-7">{p.suggestions.accept}</SubmitButton></ActionForm>
                <ActionForm action={decideSuggestionAction.bind(null, profile.client.id, s.id, false)}><SubmitButton size="sm" variant="ghost" className="h-7">{p.suggestions.reject}</SubmitButton></ActionForm>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Ein Profilabschnitt mit "bestätigt am", Warnung, Inhalt, Bearbeiten, Bestätigen und Vorschlägen. */
export function SectionCard({ pc, sectionKey, openEdit = false }: { pc: ProfileContext; sectionKey: string; openEdit?: boolean }) {
  const { profile, user, ctx, now } = pc;
  const entry = profile.sections.find((s) => s.def.key === sectionKey);
  if (!entry) return null;
  const { def, row, content } = entry;
  const clientId = profile.client.id;
  const access = profileAccess(user, ctx, clientId);
  const fields = sectionFields(def.key);
  const editable = fields.filter((f) => canEditProfilePart(user, ctx, clientId, f.part ?? def.key));
  const special = "special" in def ? def.special : null;
  const mayConfirm = special ? canEditProfilePart(user, ctx, clientId, def.key) : editable.length > 0;
  const age = staleness(def.key, row?.confirmedAt ?? null, now);
  const showAge = def.key !== "dokumente";

  return (
    <Card id={`abschnitt-${def.key}`} className="flex flex-col gap-3 p-4" data-testid={`section-${def.key}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            {p.sections[def.key]} {def.required && <Badge className="ml-1 align-middle">{p.required}</Badge>}
          </h2>
          {showAge && (
            <p className={cn("text-xs", age.level === "red" ? "font-semibold text-destructive" : age.level === "warn" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} data-testid="confirmed">
              {row?.confirmedAt ? p.confirmedAt(formatDate(row.confirmedAt), pc.names.get(row.confirmedBy ?? "") ?? "") : p.neverConfirmed}
              {age.level === "red" && age.days !== null && ` · ${p.complianceStale(Math.floor(age.days / 30.44))}`}
              {age.level === "warn" && age.days !== null && ` · ${p.stale(age.days)}`}
            </p>
          )}
        </div>
        {mayConfirm && showAge && (
          <ActionForm action={confirmSectionAction.bind(null, clientId, def.key)}>
            <SubmitButton size="sm" variant="outline" title={p.confirmHint}>{p.confirm}</SubmitButton>
          </ActionForm>
        )}
      </div>

      {fields.length > 0 && (
        <dl className="flex flex-col gap-2 text-sm">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="text-xs font-medium text-muted-foreground">{p.fields[f.key] ?? f.key}{f.part && f.part !== def.key && ` (${p.cvdOnly})`}</dt>
              <dd><FieldValue type={f.type} value={content[f.key]} /></dd>
            </div>
          ))}
        </dl>
      )}

      {editable.length > 0 && (
        <details open={openEdit}>
          <summary className="cursor-pointer text-sm font-medium">{p.edit}</summary>
          <ActionForm action={updateSectionAction.bind(null, clientId, def.key)} className="mt-3 flex flex-col gap-3">
            {editable.map((f) => (
              <Field key={f.key} label={p.fields[f.key] ?? f.key} htmlFor={`f-${def.key}-${f.key}`}>
                {f.type === "text" && !["kommunikationsziele", "beschreibung", "referenztexte", "boilerplate", "inhalt", "notiz"].includes(f.key)
                  ? <Input id={`f-${def.key}-${f.key}`} name={f.key} defaultValue={formValue(f.type, content[f.key])} />
                  : <Textarea id={`f-${def.key}-${f.key}`} name={f.key} defaultValue={formValue(f.type, content[f.key])} />}
              </Field>
            ))}
            <div><SubmitButton size="sm">{p.save}</SubmitButton></div>
          </ActionForm>
        </details>
      )}

      {special === "client" && <MasterData pc={pc} />}
      {special === "kpis" && <Kpis pc={pc} />}
      {special === "services" && <Services pc={pc} />}
      {special === "speakers" && <Speakers pc={pc} />}
      {special === "documents" && <Documents pc={pc} />}

      {access === "SUGGEST" && fields.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{p.suggest}</summary>
          <p className="mt-1 text-xs text-muted-foreground">{p.readOnlyHint}</p>
          <ActionForm action={suggestChangeAction.bind(null, clientId)} className="mt-2 flex flex-col gap-2">
            <Field label={p.suggestField} htmlFor={`s-${def.key}`}>
              <Select id={`s-${def.key}`} name="target">
                {fields.map((f) => <option key={f.key} value={`${def.key}.${f.key}`}>{p.fields[f.key] ?? f.key}</option>)}
              </Select>
            </Field>
            <Field label={p.suggestValue} htmlFor={`sv-${def.key}`}><Textarea id={`sv-${def.key}`} name="value" className="min-h-16" required /></Field>
            <div><SubmitButton size="sm" variant="outline">{p.suggestSubmit}</SubmitButton></div>
          </ActionForm>
        </details>
      )}

      <SuggestionList pc={pc} sectionKey={def.key} />
    </Card>
  );
}

function MasterData({ pc }: { pc: ProfileContext }) {
  const c = pc.profile.client;
  const f = t.clients.fields;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{f.name}</dt><dd>{c.name}</dd>
        <dt className="text-muted-foreground">{f.shortName}</dt><dd>{c.shortName}</dd>
        <dt className="text-muted-foreground">{f.industry}</dt><dd>{c.industry ?? "–"}</dd>
        <dt className="text-muted-foreground">{f.cluster}</dt><dd>{c.cluster ?? "–"}</dd>
        <dt className="text-muted-foreground">{f.lead}</dt><dd>{pc.members.filter((m) => m.kind === "LEAD").map((m) => m.name).join(", ") || "–"}</dd>
        <dt className="text-muted-foreground">{f.team}</dt><dd>{pc.members.filter((m) => m.kind === "TEAM").map((m) => m.name).join(", ") || "–"}</dd>
        <dt className="text-muted-foreground">{f.aiAllowed}</dt><dd>{c.aiAllowed ? t.common.yes : t.common.no}</dd>
        <dt className="text-muted-foreground">{t.checks.strictness}</dt><dd>{t.checks.strictnessLevels[c.checkStrictness]}</dd>
        <dt className="text-muted-foreground">{f.logo}</dt><dd>{c.logoFileId ? t.common.yes : t.clients.noLogo}</dd>
      </dl>
      <Link href={`/kunden/${c.id}`} className="self-start text-xs underline">{p.editMasterData}</Link>
    </div>
  );
}

function Kpis({ pc }: { pc: ProfileContext }) {
  const k = p.kpis;
  const manage = canManageGoalsKpisServices(pc.user);
  const clientId = pc.profile.client.id;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {pc.profile.kpis.length === 0 ? <p className="text-muted-foreground">{p.empty}</p> : (
        <ul className="divide-y">
          {pc.profile.kpis.map((kpi) => (
            <li key={kpi.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>{kpi.title}: <strong>{kpi.target}</strong> <span className="text-muted-foreground">· {kpi.period}{kpi.note ? ` · ${kpi.note}` : ""}</span></span>
              {manage && <ActionForm action={deleteKpiAction.bind(null, clientId, kpi.id)}><SubmitButton size="sm" variant="ghost" className="h-7">{k.delete}</SubmitButton></ActionForm>}
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <details>
          <summary className="cursor-pointer font-medium">{k.add}</summary>
          <ActionForm action={saveKpiAction.bind(null, clientId, null)} className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label={k.title} htmlFor="kpi-title"><Input id="kpi-title" name="title" required /></Field>
            <Field label={k.target} htmlFor="kpi-target"><Input id="kpi-target" name="target" required /></Field>
            <Field label={k.period} htmlFor="kpi-period"><Input id="kpi-period" name="period" required /></Field>
            <Field label={k.note} htmlFor="kpi-note"><Input id="kpi-note" name="note" /></Field>
            <div><SubmitButton size="sm">{k.add}</SubmitButton></div>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

function Services({ pc }: { pc: ProfileContext }) {
  const s = p.services;
  const manage = canManageGoalsKpisServices(pc.user);
  const clientId = pc.profile.client.id;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {pc.services.length === 0 ? <p className="text-muted-foreground">{t.clients.servicesEmpty}</p> : (
        <ul className="divide-y" data-testid="services">
          {pc.services.map((svc) => (
            <li key={svc.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>{svc.title} <span className="text-muted-foreground">· {s.categories[svc.category]} · {svc.period}</span></span>
              <span className="flex items-center gap-2">
                <span className={cn(svc.behind && "font-semibold text-destructive")}>{t.clients.serviceProgress(svc.done, svc.targetCount)}{svc.behind ? ` · ${t.clients.behind}` : ""}</span>
                {manage && <ActionForm action={deleteServiceAction.bind(null, clientId, svc.id)}><SubmitButton size="sm" variant="ghost" className="h-7">{s.delete}</SubmitButton></ActionForm>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <details>
          <summary className="cursor-pointer font-medium">{s.add}</summary>
          <ActionForm action={saveServiceAction.bind(null, clientId, null)} className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label={s.title} htmlFor="svc-title"><Input id="svc-title" name="title" required /></Field>
            <Field label={s.category} htmlFor="svc-cat">
              <Select id="svc-cat" name="category" defaultValue="PRESSEMITTEILUNG">
                {Object.entries(s.categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
            </Field>
            <Field label={s.count} htmlFor="svc-count"><Input id="svc-count" name="targetCount" type="number" min={1} defaultValue={1} required /></Field>
            <span />
            <Field label={s.periodStart} htmlFor="svc-from"><Input id="svc-from" name="periodStart" type="date" defaultValue={dateKey(pc.now)} required /></Field>
            <Field label={s.periodEnd} htmlFor="svc-to"><Input id="svc-to" name="periodEnd" type="date" required /></Field>
            <div><SubmitButton size="sm">{s.add}</SubmitButton></div>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

function SpeakerFields({ prefix, speaker }: { prefix: string; speaker?: { name: string; function: string; topics: string[]; quoteNeedsClientApproval: boolean } }) {
  const s = p.speakers;
  return (
    <>
      <Field label={s.name} htmlFor={`${prefix}-name`}><Input id={`${prefix}-name`} name="name" defaultValue={speaker?.name} required /></Field>
      <Field label={s.function} htmlFor={`${prefix}-fn`}><Input id={`${prefix}-fn`} name="function" defaultValue={speaker?.function} /></Field>
      <Field label={s.topics} htmlFor={`${prefix}-topics`}><Input id={`${prefix}-topics`} name="topics" defaultValue={speaker?.topics.join(", ")} /></Field>
      <Checkbox label={s.quoteApproval} name="quoteNeedsClientApproval" defaultChecked={speaker?.quoteNeedsClientApproval} />
    </>
  );
}

function Speakers({ pc }: { pc: ProfileContext }) {
  const s = p.speakers;
  const clientId = pc.profile.client.id;
  const manage = canEditProfilePart(pc.user, pc.ctx, clientId, "sprecher");
  return (
    <div className="flex flex-col gap-2 text-sm">
      {pc.profile.speakers.length === 0 ? <p className="text-muted-foreground">{p.empty}</p> : (
        <ul className="divide-y" data-testid="speakers">
          {pc.profile.speakers.map((sp) => (
            <li key={sp.id} className="flex flex-col gap-1 py-1.5">
              <span>
                <strong>{sp.name}</strong>{sp.function && `, ${sp.function}`}
                <span className="text-muted-foreground">{sp.topics.length ? ` · ${sp.topics.join(", ")}` : ""} · {s.quoteApproval}: {sp.quoteNeedsClientApproval ? s.yes : s.no}</span>
              </span>
              {manage && (
                <details>
                  <summary className="cursor-pointer text-xs">{p.edit}</summary>
                  <ActionForm action={saveSpeakerAction.bind(null, clientId, sp.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                    <SpeakerFields prefix={`sp-${sp.id}`} speaker={sp} />
                    <div><SubmitButton size="sm">{p.save}</SubmitButton></div>
                  </ActionForm>
                  <ActionForm action={deleteSpeakerAction.bind(null, clientId, sp.id)} className="mt-2"><SubmitButton size="sm" variant="ghost" className="h-7">{s.delete}</SubmitButton></ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <details>
          <summary className="cursor-pointer font-medium">{s.add}</summary>
          <ActionForm action={saveSpeakerAction.bind(null, clientId, null)} className="mt-2 grid gap-2 sm:grid-cols-2">
            <SpeakerFields prefix="sp-new" />
            <div><SubmitButton size="sm">{s.add}</SubmitButton></div>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

/** Upload einer Unterlage: Ablage im SharePoint unter 01_Kundenprofil, die KI legt Vorschläge an. */
export function UploadForm({ pc, defaultSection = "dokumente" }: { pc: ProfileContext; defaultSection?: string }) {
  const d = p.documents;
  if (profileAccess(pc.user, pc.ctx, pc.profile.client.id) !== "EDIT") return null;
  return (
    <ActionForm action={uploadProfileDocumentAction.bind(null, pc.profile.client.id)} className="flex flex-col gap-2">
      <Field label={d.file} htmlFor="profile-file"><Input id="profile-file" name="file" type="file" accept=".pdf,.docx,.txt,.md" required className="py-1.5" /></Field>
      <Field label={d.section} htmlFor="profile-file-section">
        <Select id="profile-file-section" name="sectionKey" defaultValue={defaultSection}>
          {PROFILE_SECTIONS.filter((s) => s.key !== "stammdaten").map((s) => <option key={s.key} value={s.key}>{p.sections[s.key]}</option>)}
        </Select>
      </Field>
      {!pc.profile.client.aiAllowed && <p className="text-xs text-muted-foreground">{p.aiAllowedOff}</p>}
      <div><SubmitButton size="sm">{d.upload}</SubmitButton></div>
    </ActionForm>
  );
}

function Documents({ pc }: { pc: ProfileContext }) {
  const d = p.documents;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <UploadForm pc={pc} />
      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{d.uploadedFiles}</h3>
        {pc.profile.files.length === 0 ? <p className="text-muted-foreground">{d.none}</p> : (
          <ul className="flex flex-col gap-0.5" data-testid="profile-files">
            {pc.profile.files.map((f) => (
              <li key={f.id}><a className="underline" href={`/api/dateien/${f.id}`}>{f.name}</a> <span className="text-xs text-muted-foreground">· {p.sections[f.profileSection ?? ""] ?? ""} · {formatDate(f.createdAt)}</span></li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{d.finalTexts}</h3>
        {pc.profile.finalTexts.length === 0 ? <p className="text-muted-foreground">{d.noFinalTexts}</p> : (
          <ul className="flex flex-col gap-0.5">
            {pc.profile.finalTexts.map((task) => (
              <li key={task.id}><Link className="underline" href={`/aufgaben/${task.id}`}>{task.title}</Link> <span className="text-xs text-muted-foreground">· {task.document?.documentFormat.name}{task.completedAt ? ` · ${formatDate(task.completedAt)}` : ""}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Verwerfungsregeln der Prüfung, einsehbar und löschbar (BRIEFING 7.4). */
export function DismissalRules({ pc }: { pc: ProfileContext }) {
  const r = p.rules;
  const manage = profileAccess(pc.user, pc.ctx, pc.profile.client.id) === "EDIT";
  if (!pc.profile.rules.length) return <p className="text-sm text-muted-foreground">{r.none}</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm" data-testid="dismissal-rules">
      {pc.profile.rules.map((rule) => (
        <li key={rule.id} className="flex items-start justify-between gap-2">
          <span>
            <span className="text-xs text-muted-foreground">{t.checks.categories[rule.category] ?? rule.category} · {r.created(formatDate(rule.createdAt))}</span>
            <span className="block">{rule.pattern}</span>
          </span>
          {manage && <ActionForm action={deleteRuleAction.bind(null, pc.profile.client.id, rule.id)}><SubmitButton size="sm" variant="ghost" className="h-7">{r.delete}</SubmitButton></ActionForm>}
        </li>
      ))}
    </ul>
  );
}
