import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingHttpHeaders, RequestOptions } from "node:http";

const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ImageProxyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ImageProxyError";
    this.status = status;
  }
}

function parseIpv4Address(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return Number.NaN;
    }
    return Number.parseInt(part, 10);
  });

  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return octets as [number, number, number, number];
}

function isBlockedIpv4Address(value: string) {
  const octets = parseIpv4Address(value);
  if (!octets) {
    return true;
  }

  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0 && c === 0) {
    return true;
  }
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }
  if (a === 192 && b === 88 && c === 99) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }
  if (a >= 224) {
    return true;
  }

  return false;
}

function parseIpv6Address(value: string) {
  const normalized = value.toLowerCase();
  if (!normalized || normalized.includes("%")) {
    return null;
  }

  if (normalized === "::") {
    return new Uint8Array(16);
  }

  const parts = normalized.split("::");
  if (parts.length > 2) {
    return null;
  }

  const parseSection = (section: string) => {
    if (!section) {
      return [];
    }

    const hextets: number[] = [];
    for (const chunk of section.split(":")) {
      if (!chunk) {
        return null;
      }

      if (chunk.includes(".")) {
        const ipv4 = parseIpv4Address(chunk);
        if (!ipv4) {
          return null;
        }
        hextets.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }

      if (!/^[0-9a-f]{1,4}$/u.test(chunk)) {
        return null;
      }

      hextets.push(Number.parseInt(chunk, 16));
    }

    return hextets;
  };

  const left = parseSection(parts[0]);
  if (!left) {
    return null;
  }
  const right = parts.length === 2 ? parseSection(parts[1]) : [];
  if (!right) {
    return null;
  }

  if (left.length + right.length > 8) {
    return null;
  }

  const hextets = [
    ...left,
    ...Array.from({ length: 8 - left.length - right.length }, () => 0),
    ...right,
  ];

  if (hextets.length !== 8) {
    return null;
  }

  const bytes = new Uint8Array(16);
  hextets.forEach((hextet, index) => {
    bytes[index * 2] = (hextet >> 8) & 0xff;
    bytes[index * 2 + 1] = hextet & 0xff;
  });
  return bytes;
}

function isIpv4MappedIpv6Address(bytes: Uint8Array) {
  return (
    bytes.length === 16 &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff &&
    bytes.slice(0, 10).every((value) => value === 0)
  );
}

function isIpv4CompatibleIpv6Address(bytes: Uint8Array) {
  return bytes.length === 16 && bytes.slice(0, 12).every((value) => value === 0);
}

function isBlockedIpv6Address(value: string) {
  const bytes = parseIpv6Address(value);
  if (!bytes) {
    return true;
  }

  if (bytes.every((byte) => byte === 0)) {
    return true;
  }
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) {
    return true;
  }

  if (isIpv4MappedIpv6Address(bytes) || isIpv4CompatibleIpv6Address(bytes)) {
    const embeddedIpv4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isBlockedIpv4Address(embeddedIpv4);
  }

  const [firstByte, secondByte] = bytes;
  if (firstByte === 0xfc || firstByte === 0xfd) {
    return true;
  }
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0x80) {
    return true;
  }
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0xc0) {
    return true;
  }
  if (firstByte === 0xff) {
    return true;
  }
  if (
    firstByte === 0x20 &&
    secondByte === 0x01 &&
    bytes[2] === 0x0d &&
    bytes[3] === 0xb8
  ) {
    return true;
  }

  return false;
}

export function isPublicIpAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (net.isIP(normalized) === 4) {
    return !isBlockedIpv4Address(normalized);
  }
  if (net.isIP(normalized) === 6) {
    return !isBlockedIpv6Address(normalized);
  }
  return false;
}

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
