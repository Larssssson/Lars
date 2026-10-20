import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { compareVersions, type DiffPart } from "@/lib/domain/documents/compare";
import type { JSONNode } from "@/lib/editor/content";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

function Parts({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((p, i) => (
        <span key={i} className={cn(p.kind === "added" && "change-insertion", p.kind === "removed" && "change-deletion")}>{p.text}</span>
      ))}
    </p>
  );
}

/** Zwei Versionen nebeneinander mit markierten Unterschieden (BRIEFING 7.3). */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const document = await prisma.document.findUnique({ where: { taskId: id }, include: { versions: { orderBy: { number: "asc" } } } }).catch(() => null);
  if (!document || document.versions.length === 0) notFound();
  const pick = (n: string | undefined, fallback: number) => document.versions.find((v) => v.number === Number(n)) ?? document.versions.at(fallback)!;
  const older = pick(q.a, Math.max(0, document.versions.length - 2));
  const newer = pick(q.b, -1);
  const blocks = compareVersions(older.content as JSONNode, newer.content as JSONNode);
  const d = t.documents;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm"><Link href={`/aufgaben/${id}`} className="underline">{d.backToDocument}</Link></p>
      <h1 className="text-2xl font-semibold tracking-tight">{d.compareTitle}: {document.title}</h1>
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        {(["a", "b"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1">
            {key === "a" ? d.compareLeft : d.compareRight}
            <select name={key} defaultValue={(key === "a" ? older : newer).number} className="h-9 rounded-md border border-input bg-background px-2">
              {document.versions.map((v) => (
                <option key={v.id} value={v.number}>{d.info.versionLabel(v.number)} · {d.info.reasons[v.reason]} · {formatDateTime(v.createdAt)}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="h-9 rounded-md border px-3 hover:bg-accent">{d.info.compare}</button>
      </form>
      {blocks.every((b) => !b.changed) && <p className="text-sm text-muted-foreground">{d.compareNoDiff}</p>}
      <div className="grid gap-3" data-testid="compare">
        {blocks.map((block) => (
          <Card key={block.key} className={cn("grid gap-4 p-4 md:grid-cols-2", !block.changed && "opacity-70")}>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase md:col-span-2">{block.label}</p>
            <div aria-label={d.compareLeft}><Parts parts={block.left} /></div>
            <div aria-label={d.compareRight}><Parts parts={block.right} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
