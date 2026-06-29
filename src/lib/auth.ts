import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  isLocked,
  recordFailedLogin,
  resetFailedLogins,
  notifyIfNewDevice,
} from "./login-security";

export const authOptions: NextAuthOptions = {
  // Kratší platnost přihlášení (7 dní) místo výchozích 30
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  jwt: { maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { tenant: true },
        });
        if (!user) return null;

        // Rate-limit: dočasně zamčený účet odmítneme (ochrana proti hádání hesla)
        if (isLocked(user)) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) {
          await recordFailedLogin(user);
          return null;
        }

        // Úspěch — vynulovat počítadlo a (u nového zařízení) upozornit e-mailem
        await resetFailedLogins(user);
        await notifyIfNewDevice(user, req);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          providerId: user.providerId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          role?: string;
          tenantId?: string;
          tenantSlug?: string;
          providerId?: string;
        };
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
        token.providerId = u.providerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          role?: string;
          tenantId?: string;
          tenantSlug?: string;
          providerId?: string;
        };
        u.role = token.role as string | undefined;
        u.tenantId = token.tenantId as string | undefined;
        u.tenantSlug = token.tenantSlug as string | undefined;
        u.providerId = token.providerId as string | undefined;
      }
      return session;
    },
  },
};
