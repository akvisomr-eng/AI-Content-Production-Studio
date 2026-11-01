'use client';

import { createAuthClient } from '@neondatabase/auth';

const authUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL;
export const authClient = authUrl ? createAuthClient(authUrl) : null;
