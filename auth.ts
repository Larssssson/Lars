import NextAuth from "next-auth";
import { createAuthProvider } from "@/lib/adapters";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_MAX_AGE = 12 * 60 * 60; // BRIEFING 11: Sitzungen laufen nach 12 Stunden ab

export const authProvider = createAuthProvider(env(), async (userId) =>
  prisma.user.findFirst({ where: { id: userId, active: true }, select: { id: true, name: true, email: true } }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login", error: "/kein-zugang" },
  providers: authProvider.providers(),
  callbacks: {
    /** Nur angelegte, aktive Nutzer kommen herein; Zuordnung über die Mailadresse. */
    async signIn({ user }) {
      if (!user.email) return "/kein-zugang";
      const known = await prisma.user.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" }, active: true },
        select: { id: true },
      });
      return known ? true : "/kein-zugang";
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const known = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
          select: { id: true },
        });
        token.userId = known?.id;
      }
      return token;
    },
    async session({ session, token }) {
      return { ...session, userId: typeof token.userId === "string" ? token.userId : undefined };
    },
  },
});
