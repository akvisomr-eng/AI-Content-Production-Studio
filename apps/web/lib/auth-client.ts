'use client';

import { createAuthClient } from '@neondatabase/auth';

type AuthError = { message?: string } | null | undefined;
type AuthResult<T> = { data?: T | null; error?: AuthError };
type StudioAuthClient = {
  signIn: { email: (input: { email: string; password: string }) => Promise<AuthResult<unknown>> };
  signUp: { email: (input: { name: string; email: string; password: string }) => Promise<AuthResult<unknown>> };
  getSession: () => Promise<AuthResult<{ user?: { email?: string | null } }>>;
  token: () => Promise<AuthResult<{ token?: string }>>;
  signOut: () => Promise<unknown>;
};

const authUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL;
export const authClient: StudioAuthClient | null = authUrl
  ? createAuthClient(authUrl) as unknown as StudioAuthClient
  : null;
