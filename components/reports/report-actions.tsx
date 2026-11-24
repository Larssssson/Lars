"use client";

import { approveReportAction, deleteReportAction } from "@/app/(app)/reporting/actions";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/** Ausgeben (Word, PDF, PowerPoint), Freigeben nach vier Augen, Löschen. */
export function ReportActions({ reportId, approved, canApprove, canDelete }: { reportId: string; approved: boolean; canApprove: boolean; canDelete: boolean }) {
  const d = t.reports.detail;
  const href = (art: string) => `/api/reporting/${reportId}/export?art=${art}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker mr-2">{d.export}</span>
        <Button asChild size="sm" variant="outline"><a href={href("docx")} download>{d.word}</a></Button>
        <Button asChild size="sm" variant="outline"><a href={href("pdf")} download>{d.pdf}</a></Button>
        <Button asChild size="sm" variant="outline"><a href={href("pptx")} download>{d.pptx}</a></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {canApprove && (
          <ActionForm action={approveReportAction.bind(null, reportId, !approved)}>
            <SubmitButton size="sm" variant={approved ? "outline" : "default"}>{approved ? d.reopen : d.approve}</SubmitButton>
          </ActionForm>
        )}
        {canDelete && (
          <ActionForm action={deleteReportAction.bind(null, reportId)} confirm={d.deleteConfirm}>
            <SubmitButton size="sm" variant="ghost" className="text-destructive">{d.delete}</SubmitButton>
          </ActionForm>
        )}
        <p className="text-xs text-muted-foreground">{d.approveHint}</p>
      </div>
    </div>
  );
}
