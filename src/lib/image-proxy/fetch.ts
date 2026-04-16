import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingHttpHeaders, RequestOptions } from "node:http";
import { isPublicIpAddress } from "./ip";
import { IMAGE_FETCH_TIMEOUT_MS, ImageProxyError, MAX_IMAGE_BYTES } from "./shared";

async function resolvePublicImageAddress(hostname: string) {
  const resolvedIpVersion = net.isIP(hostname);
  if (resolvedIpVersion === 4 || resolvedIpVersion === 6) {
    if (!isPublicIpAddress(hostname)) {
      throw new ImageProxyError("Blocked host", 400);
    }
    return hostname;
  }

  let lookupResults: Array<{ address: string }>;
  try {
    lookupResults = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new ImageProxyError("Failed to resolve image host", 502);
  }

  const publicAddresses = lookupResults
    .map((entry) => entry.address)
    .filter((address) => isPublicIpAddress(address));

  if (publicAddresses.length === 0) {
    throw new ImageProxyError("Blocked host", 400);
  }

  return publicAddresses[0];
}

function parseTargetPort(target: URL) {
  if (!target.port) {
    return undefined;
  }

  const port = Number.parseInt(target.port, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ImageProxyError("Unsupported port", 400);
  }

  return port;
}

function getContentType(headers: IncomingHttpHeaders) {
  const value = headers["content-type"];
  if (Array.isArray(value)) {
    return value[0] ?? "application/octet-stream";
  }
  return value ?? "application/octet-stream";
}

function getContentLength(headers: IncomingHttpHeaders) {
  const value = headers["content-length"];
  if (Array.isArray(value)) {
    return Number.parseInt(value[0] ?? "", 10);
  }
  return Number.parseInt(value ?? "", 10);
}

export async function fetchPublicImage(target: URL) {
  const resolvedAddress = await resolvePublicImageAddress(target.hostname);
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;
  const requestOptions: RequestOptions = {
    protocol: target.protocol,
    hostname: resolvedAddress,
    port: parseTargetPort(target),
    method: "GET",
    path: `${target.pathname}${target.search}`,
    headers: {
      Accept: "image/*",
      "Accept-Encoding": "identity",
      Host: target.host,
    },
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    timeout: IMAGE_FETCH_TIMEOUT_MS,
    ...(isHttps
      ? {
          servername: target.hostname,
        }
      : {}),
  };

  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = client.request(requestOptions, (incoming) => {
      resolve(incoming);
    });

    request.on("error", (error) => {
      reject(error);
    });
    request.on("timeout", () => {
      request.destroy(new ImageProxyError("Failed to fetch image", 502));
    });
    request.end();
  });

  const statusCode = response.statusCode ?? 0;
  if (statusCode < 200 || statusCode >= 300) {
    response.resume();
    throw new ImageProxyError("Failed to fetch image", 502);
  }

  const contentType = getContentType(response.headers);
  if (!contentType.startsWith("image/")) {
    response.resume();
    throw new ImageProxyError("Unsupported media type", 415);
  }

  const contentLength = getContentLength(response.headers);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    response.resume();
    throw new ImageProxyError("Image too large", 413);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  await new Promise<void>((resolve, reject) => {
    response.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > MAX_IMAGE_BYTES) {
        reject(new ImageProxyError("Image too large", 413));
        response.destroy();
        return;
      }
      chunks.push(buffer);
    });
    response.on("end", () => {
      resolve();
    });
    response.on("error", (error) => {
      reject(
        error instanceof ImageProxyError
          ? error
          : new ImageProxyError("Failed to fetch image", 502),
      );
    });
    response.on("aborted", () => {
      reject(new ImageProxyError("Failed to fetch image", 502));
    });
  });

  return {
    body: Buffer.concat(chunks),
    contentType,
  };
}
