import { sanitizeHttpUrl } from "./validation.ts";

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
    return sanitizeHttpUrl(value);
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
    return sanitizeHttpUrl(mapUrl);
  }
  if (isNationwide(location)) {
    return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  }
  return undefined;
}

export function getContactDisplay(link?: string) {
  if (!link) {
    return null;
  }
  if (isInstagram(link)) {
    const href = toInstagramUrl(link);
    if (!href) {
      return null;
    }
    return {
      label: toInstagramLabel(link),
      href,
      type: "instagram" as const,
    };
  }
  if (isPhone(link)) {
    return {
      label: link,
      href: `tel:${normalizePhone(link)}`,
      type: "phone" as const,
    };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) {
    return {
      label: link,
      href: `mailto:${link}`,
      type: "email" as const,
    };
  }
  if (isUrl(link)) {
    const href = sanitizeHttpUrl(link);
    if (!href) {
      return null;
    }
    return {
      label: link,
      href,
      type: "web" as const,
    };
  }
  return null;
}

function toLinkHref(link: string) {
  if (isInstagram(link)) {
    return toInstagramUrl(link);
  }
  if (isPhone(link)) {
    return `tel:${normalizePhone(link)}`;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) {
    return `mailto:${link}`;
  }
  return sanitizeHttpUrl(link);
}

export function getReservationAction(link?: string) {
  if (!link) {
    return null;
  }
  const href = toLinkHref(link);
  if (!href) {
    return null;
  }
  return { label: "예약하기", href };
}

export function getInquiryAction(link?: string) {
  if (!link) {
    return null;
  }
  const href = toLinkHref(link);
  if (!href) {
    return null;
  }
  if (isKakaoPlus(link) || isInstagram(link) || isPhone(link) || isUrl(link)) {
    return { label: "문의하기", href };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) {
    return { label: "문의하기", href };
  }
  return null;
}

export function normalizeReservationInquiry(
  reservationLink?: string,
  inquiryLink?: string,
) {
  const reservation = reservationLink?.trim() ?? "";
  const inquiry = inquiryLink?.trim() ?? "";
  if (!reservation && inquiry && isBookingLink(inquiry)) {
    return { reservationLink: inquiry, inquiryLink: "" };
  }
  return { reservationLink: reservation, inquiryLink: inquiry };
}
