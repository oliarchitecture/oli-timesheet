import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const employee = await db.employee.findUnique({
          where: { email: credentials.email as string },
        });

        if (!employee || !employee.isActive) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          employee.passwordHash
        );

        if (!passwordValid) return null;

        return {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          role: employee.role,
          image: employee.photoUrl,
        };
      },
    }),
  ],
});
