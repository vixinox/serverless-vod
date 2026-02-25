import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import prisma from "./prisma";

const oauthProxyUrl = process.env.OAUTH_HTTP_PROXY ?? "http://127.0.0.1:10808";
const oauthProxyEnabled = process.env.NODE_ENV !== "production" && process.env.OAUTH_HTTP_PROXY_ENABLED !== "false";
const oauthProxyHosts = new Set([
  "oauth2.googleapis.com",
  "accounts.google.com",
  "api.github.com",
  "github.com",
]);

if (oauthProxyEnabled) {
  const proxyAgent = new ProxyAgent(oauthProxyUrl);
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    try {
      const hostname = new URL(targetUrl).hostname;
      if (oauthProxyHosts.has(hostname)) {
        return (undiciFetch as any)(targetUrl, {
          ...init,
          dispatcher: proxyAgent,
        });
      }
    } catch {
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  }) as typeof globalThis.fetch;
}

const normalizeGithubValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeImageUrl = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return url || undefined;
};

const buildGithubNoreplyEmail = (profile: unknown) => {
  if (!profile || typeof profile !== "object") return undefined;

  const record = profile as Record<string, unknown>;
  const email = normalizeGithubValue(record.email);
  if (email) return email.toLowerCase();

  const login = normalizeGithubValue(record.login);
  const id = normalizeGithubValue(record.id);

  if (id && login) return `${id}+${login}@users.noreply.github.com`.toLowerCase();
  if (id) return `${id}@users.noreply.github.com`.toLowerCase();
  if (login) return `${login}@users.noreply.github.com`.toLowerCase();

  return undefined;
};

const getGithubAvatar = (profile: unknown) => {
  if (!profile || typeof profile !== "object") return undefined;
  return normalizeImageUrl((profile as Record<string, unknown>).avatar_url);
};

const getGoogleAvatar = (profile: unknown) => {
  if (!profile || typeof profile !== "object") return undefined;
  return normalizeImageUrl((profile as Record<string, unknown>).picture);
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) => ({
        email: buildGithubNoreplyEmail(profile),
        image: getGithubAvatar(profile),
      }),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) => ({
        image: getGoogleAvatar(profile),
      }),
    },
  },
  plugins: [nextCookies()],
});