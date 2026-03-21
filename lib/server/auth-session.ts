import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSessionFromHeaders(requestHeaders?: Headers) {
  const resolvedHeaders = requestHeaders ?? await headers();
  return auth.api.getSession({ headers: resolvedHeaders });
}

export async function getOptionalUserId(requestHeaders?: Headers) {
  const session = await getSessionFromHeaders(requestHeaders).catch(() => null);
  return session?.user?.id ?? null;
}

export async function requireUserId(requestHeaders?: Headers) {
  const userId = await getOptionalUserId(requestHeaders);

  if (!userId) {
    throw new Error("未登录");
  }

  return userId;
}
