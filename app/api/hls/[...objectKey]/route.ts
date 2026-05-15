import { NextRequest } from "next/server";

const localstackEndpoint = (process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566").replace(/\/$/, "");
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";

/**
 * 把播放器请求的 HLS 路径转换成 LocalStack 对象地址。
 * objectKey 可能包含多级目录，逐段编码以保留路径分隔符。
 */
function buildTargetUrl(objectKey: string, searchParams: URLSearchParams) {
  const encodedKey = objectKey
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  const target = new URL(`${localstackEndpoint}/${hlsBucket}/${encodedKey}`);
  const query = searchParams.toString();
  if (query) {
    target.search = query;
  }

  return target;
}

function pickForwardHeaders(headers: Headers) {
  const forward = new Headers();
  const range = headers.get("range");
  // HLS 播放和拖动进度时，浏览器可能只请求文件的一部分。
  // 透传 Range 后，上游可返回 206 Partial Content。
  if (range) {
    forward.set("range", range);
  }
  return forward;
}

/**
 * 透传播放器依赖的响应头。
 * content-range / accept-ranges 描述分片范围，etag / last-modified 用于缓存校验。
 */
function createProxyResponse(upstream: Response) {
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  const acceptRanges = upstream.headers.get("accept-ranges");
  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");

  if (contentType) responseHeaders.set("content-type", contentType);
  if (contentLength) responseHeaders.set("content-length", contentLength);
  if (contentRange) responseHeaders.set("content-range", contentRange);
  if (acceptRanges) responseHeaders.set("accept-ranges", acceptRanges);
  if (etag) responseHeaders.set("etag", etag);
  if (lastModified) responseHeaders.set("last-modified", lastModified);

  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ objectKey: string[] }> },
) {
  const { objectKey } = await params;
  const key = objectKey?.join("/") ?? "";
  if (!key) {
    return new Response("Missing object key", { status: 400 });
  }

  const targetUrl = buildTargetUrl(key, request.nextUrl.searchParams);
  const upstream = await fetch(targetUrl, {
    method: "GET",
    headers: pickForwardHeaders(request.headers),
    cache: "no-store",
  });

  return createProxyResponse(upstream);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ objectKey: string[] }> },
) {
  const { objectKey } = await params;
  const key = objectKey?.join("/") ?? "";
  if (!key) {
    return new Response(null, { status: 400 });
  }

  const targetUrl = buildTargetUrl(key, request.nextUrl.searchParams);
  const upstream = await fetch(targetUrl, {
    method: "HEAD",
    headers: pickForwardHeaders(request.headers),
    cache: "no-store",
  });

  return createProxyResponse(upstream);
}
