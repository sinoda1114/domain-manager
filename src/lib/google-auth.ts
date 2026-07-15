import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase() ?? "";
const googleAuthRequested = Boolean(googleClientId || googleClientSecret || allowedEmail);

export function isGoogleAuthRequired() {
  return googleAuthRequested;
}

export function isGoogleAuthConfigured() {
  return Boolean(googleClientId && googleClientSecret && allowedEmail);
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: isGoogleAuthConfigured() ? [GoogleProvider({ clientId: googleClientId, clientSecret: googleClientSecret })] : [],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== "google") return false;
      return user.email?.trim().toLowerCase() === allowedEmail;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email.trim().toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = String(token.email);
      return session;
    },
  },
};

export async function isGoogleAdmin() {
  if (!isGoogleAuthConfigured()) return false;
  const session = await getServerSession(authOptions);
  return session?.user?.email?.trim().toLowerCase() === allowedEmail;
}
