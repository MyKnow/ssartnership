import net from "node:net";

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
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;

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
  if (!left) return null;
  const right = parts.length === 2 ? parseSection(parts[1]) : [];
  if (!right) return null;
  if (left.length + right.length > 8) return null;

  const hextets = [
    ...left,
    ...Array.from({ length: 8 - left.length - right.length }, () => 0),
    ...right,
  ];
  if (hextets.length !== 8) return null;

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

/**
 * IPv4를 내장하는 IPv6 전환 대역. 게이트웨이를 거쳐 임의의 IPv4(사설 대역 포함)로
 * 도달할 수 있어 내장 주소를 신뢰할 수 없으므로 대역 전체를 차단한다.
 * - 64:ff9b::/96  NAT64 well-known prefix (RFC 6052)
 * - 64:ff9b:1::/48 NAT64 local-use prefix (RFC 8215)
 * - 2002::/16     6to4 (RFC 3056, RFC 7526으로 폐기)
 * - 2001::/32     Teredo (RFC 4380)
 * - ::ffff:0:0:0/96 SIIT IPv4-translated (RFC 2765). 내장 IPv4로 평가하는
 *   IPv4-mapped(`::ffff:0:0/96`)와 달리 대역째 차단한다.
 *
 * 이 판정은 이미지 프록시·프로필 사진 원격 fetch와 웹 푸시 endpoint 신뢰 검사가 함께
 * 쓴다. DNS64 resolver 뒤에서는 공개 호스트도 64:ff9b::로 해석돼 위 경로가 모두
 * 거부되므로, 서버 egress는 네이티브 IPv4/IPv6 resolver를 전제로 한다.
 */
function isIpv4TransitionIpv6Address(bytes: Uint8Array) {
  const isNat64Prefix = bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b;
  if (isNat64Prefix && bytes.slice(4, 12).every((value) => value === 0)) return true;
  if (isNat64Prefix && bytes[4] === 0x00 && bytes[5] === 0x01) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return true;
  const isSiitPrefix =
    bytes.slice(0, 8).every((value) => value === 0) &&
    bytes[8] === 0xff &&
    bytes[9] === 0xff &&
    bytes[10] === 0x00 &&
    bytes[11] === 0x00;
  if (isSiitPrefix) return true;
  return false;
}

function isBlockedIpv6Address(value: string) {
  const bytes = parseIpv6Address(value);
  if (!bytes) {
    return true;
  }

  if (bytes.every((byte) => byte === 0)) return true;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return true;

  if (isIpv4MappedIpv6Address(bytes) || isIpv4CompatibleIpv6Address(bytes)) {
    const embeddedIpv4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isBlockedIpv4Address(embeddedIpv4);
  }

  if (isIpv4TransitionIpv6Address(bytes)) return true;

  const [firstByte, secondByte] = bytes;
  if (firstByte === 0xfc || firstByte === 0xfd) return true;
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0x80) return true;
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0xc0) return true;
  if (firstByte === 0xff) return true;
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
