"use client";

import { useActionState } from "react";
import { passwordLoginAction, type PasswordLoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export function PasswordLoginForm() {
  const [state, action, pending] = useActionState<PasswordLoginState, FormData>(passwordLoginAction, {});
  const p = t.auth.password;
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {p.name}
        <input name="name" autoComplete="username" required defaultValue={state.name ?? ""} className="h-10 rounded-md border border-input bg-card px-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {p.password}
        <input name="password" type="password" autoComplete="current-password" required className="h-10 rounded-md border border-input bg-card px-3 text-base" />
      </label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>{p.submit}</Button>
    </form>
  );
}
