import { createContactAction } from "@/app/(app)/journo-hub/actions";
import { ContactFields } from "@/components/journo/contact-fields";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function NewContactPage() {
  await requireUser();
  const media = await prisma.media.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.journo.newContact}</h2>
      <ActionForm action={createContactAction} className="flex flex-col gap-4">
        <ContactFields media={media} details={{ phone: "edit", mail: "edit" }} />
        <div><SubmitButton>{t.journo.create}</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
