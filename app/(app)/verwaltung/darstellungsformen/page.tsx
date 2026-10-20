import { FormatForm } from "@/components/admin/format-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { CLIENT_FOLDERS } from "@/lib/domain/documents/filing";
import { parseBlocks } from "@/lib/domain/documents/template";
import { isCvd } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/session";

/** Darstellungsformen in der Verwaltung (BRIEFING 7.3, 7.10, DECISIONS D-023). */
export default async function FormatsPage() {
  const user = await requireUser();
  const formats = await prisma.documentFormat.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { documents: true } } } });
  const folders = CLIENT_FOLDERS.filter((f) => !f.startsWith("99"));
  const f = t.formats;
  return (
    <div className="flex flex-col gap-4">
      {formats.map((format) => {
        const blocks = parseBlocks(format.blocks);
        return (
          <Card key={format.id} className="p-4">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {format.name}
              {format.builtIn && <Badge>{f.builtIn}</Badge>}
              <span className="text-xs font-normal text-muted-foreground">{f.inUse(format._count.documents)} · {format.sharePointFolder}</span>
            </CardTitle>
            {format.builtIn || !isCvd(user) ? (
              <>
                <p className="mt-2 text-sm">{blocks.map((b) => (b.required ? <strong key={b.key}>{b.label} </strong> : <span key={b.key}>{b.label} </span>))}</p>
                {format.rulesText && <p className="mt-1 text-xs text-muted-foreground">{format.rulesText}</p>}
              </>
            ) : (
              <div className="mt-3">
                <FormatForm id={format.id} folders={folders} values={{ name: format.name, blocks: blocks.map((b) => `${b.label}${b.required ? " *" : ""}`).join("\n"), rulesText: format.rulesText ?? "", sharePointFolder: format.sharePointFolder }} />
              </div>
            )}
          </Card>
        );
      })}
      {isCvd(user) && (
        <Card className="p-4">
          <CardTitle className="mb-3">{f.add}</CardTitle>
          <FormatForm folders={folders} />
        </Card>
      )}
    </div>
  );
}
