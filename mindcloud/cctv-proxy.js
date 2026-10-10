"use strict";

const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 12 * 1024 * 1024;
const PLAYLIST_TYPES = /(?:application\/vnd\.apple\.mpegurl|application\/x-mpegurl|audio\/mpegurl|audio\/x-mpegurl|text\/plain)/i;
const MEDIA_TYPES = /(?:video\/mp2t|video\/mp4|audio\/mp4|application\/octet-stream|application\/mp2t)/i;

function localTestSource(url) {
  return process.env.NODE_ENV === "test" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1");
}

function parseSource(source) {
  if (!source) return { error: "cctv_source_not_configured" };
  let url;
  try { url = new URL(source); } catch { return { error: "cctv_source_invalid_url" }; }
  if (url.username || url.password || url.hash) return { error: "cctv_source_invalid_url" };
  if (url.protocol !== "https:" && !localTestSource(url)) {
    return { error: "cctv_source_https_required" };
  }
  return { url };
}

function parseResource(raw, sourceUrl) {
  if (!raw) return { url: new URL(sourceUrl) };
  let resource;
  try { resource = new URL(raw); } catch { return { error: "cctv_resource_invalid_url" }; }
  const source = new URL(sourceUrl);
  if (resource.origin !== source.origin || resource.username || resource.password || resource.hash) {
    return { error: "cctv_resource_origin_rejected" };
  }
  if (resource.protocol !== "https:" && !localTestSource(resource)) {
    return { error: "cctv_resource_https_required" };
  }
  return { url: resource };
}

function encodeResource(url) {
  return Buffer.from(url.toString(), "utf8").toString("base64url");
}

function proxyPath(url) {
  return "/api/cctv/stream?resource=" + encodeResource(url);
}

function rewritePlaylist(text, sourceUrl) {
  const source = new URL(sourceUrl);
  const rewrite = value => {
    const target = new URL(value, source);
    if (target.origin !== source.origin || target.username || target.password || target.hash) {
      throw new Error("cctv_playlist_cross_origin_resource_rejected");
    }
    if (target.protocol !== "https:" && !localTestSource(target)) {
      throw new Error("cctv_playlist_insecure_resource_rejected");
    }
    return proxyPath(target);
  };
  return text.split(/\r?\n/).map(line => {
    if (!line) return line;
    if (line.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => 'URI="' + rewrite(uri) + '"');
    }
    return rewrite(line);
  }).join("\n");
}

async function proxyCctvRequest({ source, resource, signal }) {
  const parsedSource = parseSource(source);
  if (parsedSource.error) return { status: 503, error: parsedSource.error };
  const parsedResource = parseResource(resource, parsedSource.url.toString());
  if (parsedResource.error) return { status: 400, error: parsedResource.error };

  let upstream;
  try {
    upstream = await fetch(parsedResource.url, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "application/vnd.apple.mpegurl, application/x-mpegURL, video/mp2t, video/mp4, application/octet-stream;q=0.8" },
      signal: signal || AbortSignal.timeout(8000)
    });
  } catch (error) {
    return { status: 502, error: "cctv_upstream_unreachable", detail: error instanceof Error ? error.message : String(error) };
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel().catch(() => {});
    return { status: 502, error: "cctv_upstream_redirect_rejected" };
  }
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => {});
    return { status: 502, error: "cctv_upstream_http_error", upstreamStatus: upstream.status };
  }

  const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim();
  const isPlaylist = /\.m3u8?$/i.test(parsedResource.url.pathname) || PLAYLIST_TYPES.test(contentType);
  const limit = isPlaylist ? MAX_PLAYLIST_BYTES : MAX_SEGMENT_BYTES;
  const declaredLength = Number(upstream.headers.get("content-length") || 0);
  if (declaredLength > limit) {
    await upstream.body?.cancel().catch(() => {});
    return { status: 413, error: "cctv_upstream_resource_too_large" };
  }
  if (!isPlaylist && contentType && !MEDIA_TYPES.test(contentType) && !/\.m4s?$|\.mp4$/i.test(parsedResource.url.pathname)) {
    await upstream.body?.cancel().catch(() => {});
    return { status: 415, error: "cctv_unsupported_media_type", contentType };
  }

  let bytes;
  try {
    bytes = Buffer.from(await upstream.arrayBuffer());
  } catch (error) {
    return { status: 502, error: "cctv_upstream_read_failed", detail: error instanceof Error ? error.message : String(error) };
  }
  if (bytes.length > limit) return { status: 413, error: "cctv_upstream_resource_too_large" };

  if (isPlaylist) {
    const body = bytes.toString("utf8");
    if (!body.trimStart().startsWith("#EXTM3U")) return { status: 502, error: "cctv_invalid_hls_playlist" };
    let rewritten;
    try { rewritten = rewritePlaylist(body, parsedResource.url.toString()); }
    catch (error) { return { status: 502, error: error instanceof Error ? error.message : "cctv_playlist_rewrite_failed" }; }
    return {
      status: 200,
      contentType: "application/vnd.apple.mpegurl; charset=utf-8",
      body: Buffer.from(rewritten, "utf8"),
      isPlaylist: true
    };
  }

  return {
    status: 200,
    contentType: contentType || "application/octet-stream",
    body: bytes,
    isPlaylist: false
  };
}

module.exports = { proxyCctvRequest, parseSource, parseResource, rewritePlaylist };
