function isPhone(value: string) {
  return /^[+0-9()\-\s]{7,}$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isInstagram(value: string) {
  return /instagram\.com/i.test(value) || /^@[\w.]+$/.test(value);
}

function isKakaoPlus(value: string) {
  return /pf\.kakao\.com/i.test(value) || /plus\.kakao\.com/i.test(value);
}

function isBookingLink(value: string) {
  return (
    /booking\.naver\.com/i.test(value) ||
    /booking\.kakao\.com/i.test(value) ||
    /reserve\.kakao\.com/i.test(value)
  );
}

function toInstagramUrl(value: string) {
  if (/instagram\.com/i.test(value)) {
    return value;
  }
  if (value.startsWith("@")) {
    return `https://instagram.com/${value.slice(1)}`;
  }
  return `https://instagram.com/${value}`;
}

function toInstagramLabel(value: string) {
  if (value.startsWith("@")) {
    return value;
  }
  const match = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (match?.[1]) {
    return `@${match[1]}`;
  }
  return "@instagram";
}

function isNationwide(location: string) {
  return /전국/.test(location);
}

export function getMapLink(
  mapUrl: string | undefined,
  location: string,
  name: string,
) {
  if (mapUrl) {
    return mapUrl;
  }
  if (isNationwide(location)) {
    return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  }
  return undefined;
}

export function getContactDisplay(contact: string) {
  if (isInstagram(contact)) {
    return {
      label: toInstagramLabel(contact),
      href: toInstagramUrl(contact),
      type: "instagram" as const,
    };
  }
  if (isPhone(contact)) {
    return {
      label: contact,
      href: `tel:${normalizePhone(contact)}`,
      type: "phone" as const,
    };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return {
      label: contact,
      href: `mailto:${contact}`,
      type: "email" as const,
    };
  }
  if (isUrl(contact)) {
    return {
      label: contact,
      href: contact,
      type: "web" as const,
    };
  }
  return null;
}

export function getReservationAction(contact: string) {
  if (isBookingLink(contact)) {
    return { label: "예약하기", href: contact };
  }
  if (isKakaoPlus(contact)) {
    return { label: "카카오톡 문의하기", href: contact };
  }
  if (isInstagram(contact)) {
    return { label: "인스타그램 보기", href: toInstagramUrl(contact) };
  }
  if (isPhone(contact)) {
    return { label: "전화 예약하기", href: `tel:${normalizePhone(contact)}` };
  }
  if (isUrl(contact)) {
    return { label: "문의하기", href: contact };
  }
  return null;
}
