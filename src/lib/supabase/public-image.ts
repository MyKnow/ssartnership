const PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/";

export type SupabasePublicImageTransportConfig = {
  internalSupabaseUrl?: string;
  publicSupabaseUrl?: string;
};

function parseOriginUrl(value: string | undefined): URL | null {
  if (!value || value !== value.trim() || /[\u0000-\u001F\u007F\\]/u.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function hasSafePublicObjectPath(target: URL) {
  if (!target.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return false;
  }

  const segments = target.pathname.slice(PUBLIC_OBJECT_PREFIX.length).split("/");
  if (segments.length < 2) {
    return false;
  }

  return segments.every((segment) => {
    if (!segment) {
      return false;
    }

    try {
      const decoded = decodeURIComponent(segment);
      return (
        decoded !== ""
        && decoded !== "."
        && decoded !== ".."
        && !decoded.includes("%")
        && !decoded.includes("/")
        && !decoded.includes("\\")
        && !/[\u0000-\u001F\u007F]/u.test(decoded)
      );
    } catch {
      return false;
    }
  });
}

/**
 * Returns the private gateway URL only for public Storage objects at the
 * configured public Supabase origin. It never maps signed or arbitrary URLs.
 */
export function resolveInternalPublicSupabaseImageTarget(
  target: URL,
  config: SupabasePublicImageTransportConfig = {
    publicSupabaseUrl: process.env.SUPABASE_URL,
    internalSupabaseUrl: process.env.SUPABASE_INTERNAL_URL,
  },
): URL | null {
  const publicOrigin = parseOriginUrl(config.publicSupabaseUrl);
  const internalOrigin = parseOriginUrl(config.internalSupabaseUrl);
  if (
    !publicOrigin
    || !internalOrigin
    || target.username
    || target.password
    || target.origin !== publicOrigin.origin
    || target.hash
    || target.search
    || !hasSafePublicObjectPath(target)
  ) {
    return null;
  }

  const internalTarget = new URL(target.href);
  internalTarget.protocol = internalOrigin.protocol;
  internalTarget.host = internalOrigin.host;
  return internalTarget;
}
