import { NextResponse } from "next/server";

export class ApiRouteError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiRouteError("请求体不是合法 JSON", 400);
  }
}

export function requireTrimmedString(value: unknown, message: string) {
  if (typeof value !== "string") {
    throw new ApiRouteError(message, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ApiRouteError(message, 400);
  }

  return trimmed;
}

export function getOptionalTrimmedSearchParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

export function getPositiveIntSearchParam(url: URL, key: string, fallback: number) {
  const raw = url.searchParams.get(key);

  if (raw === null) {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    throw new ApiRouteError(`${key} 必须是正整数`, 400);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ApiRouteError(`${key} 必须是正整数`, 400);
  }

  return value;
}

export function createRouteErrorResponse(
  error: unknown,
  fallbackMessage: string,
  overrides?: Record<string, number>,
) {
  if (error instanceof ApiRouteError) {
    return jsonResponse({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const status =
    overrides?.[message] ??
    (message === "未登录" ? 401 : message.includes("不存在") ? 404 : 400);

  return jsonResponse({ error: message }, { status });
}

export function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const body = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? Number(value) : value,
  );

  return new NextResponse(body, {
    ...init,
    headers,
  });
}
