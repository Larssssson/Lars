import { redirect } from "next/navigation";
import { authProvider } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { devLoginAction, entraLoginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const devUsers =
    authProvider.kind === "dev"
      ? await prisma.user.findMany({ where: { active: true }, orderBy: [{ role: "desc" }, { name: "asc" }] })
      : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-2xl font-bold tracking-tight">{t.common.appName}</p>
        <p className="text-sm text-muted-foreground">{t.common.appClaim}</p>
      </div>
      {authProvider.kind === "entra" ? (
        <Card>
          <CardTitle>{t.auth.loginTitle}</CardTitle>
          <p className="mt-2 mb-4 text-sm text-muted-foreground">{t.auth.loginIntro}</p>
          <form action={entraLoginAction}>
            <Button type="submit" className="w-full">
              {t.auth.loginWithMicrosoft}
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <h1 className="text-base font-semibold">{t.auth.devLoginTitle}</h1>
          <p className="mt-2 mb-4 text-sm text-muted-foreground">{t.auth.devLoginIntro}</p>
          <ul className="flex flex-col gap-2">
            {devUsers.map((user) => (
              <li key={user.id}>
                <form action={devLoginAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <Button type="submit" variant="outline" className="w-full justify-between">
                    <span>{t.auth.devLoginAs(user.name)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.common.roles[user.role]}
                      {user.isAdmin ? ` · ${t.common.admin}` : ""}
                    </span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
