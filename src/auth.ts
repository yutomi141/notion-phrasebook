import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      const allowed = process.env.AUTH_ALLOWED_EMAIL;
      if (!allowed) return false;
      return user.email === allowed;
    },
  },
});
