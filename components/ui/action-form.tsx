"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type ActionState = { error?: string; ok?: string } | undefined;

/** Formular mit Server Action; zeigt Fehler und Erfolgsmeldung an (aria-live). */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Rückfrage vor dem Absenden */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      <div aria-live="polite" className="contents">
        {state?.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="mt-2 text-sm text-muted-foreground">{state.ok}</p>}
      </div>
    </form>
  );
}

export function SubmitButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} className={cn(className)} {...props}>
      {children}
    </Button>
  );
}
