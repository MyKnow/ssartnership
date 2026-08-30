type HeaderSource = {
  get(name: string): string | null;
};

function getFirstForwardedIp(value: string | null) {
  const ipAddress = value?.split(',')[0]?.trim();
  return ipAddress ? ipAddress.slice(0, 128) : null;
}

export function getTrustedPlatformClientIp(headerStore: HeaderSource) {
  return getFirstForwardedIp(headerStore.get('x-vercel-forwarded-for'));
}

function shouldRequireTrustedPlatformHeader() {
  return process.env.VERCEL === '1';
}

export function getClientIp(headerStore: HeaderSource) {
  const trustedIp = getTrustedPlatformClientIp(headerStore);
  if (trustedIp) {
    return trustedIp;
  }

  if (shouldRequireTrustedPlatformHeader()) {
    return null;
  }

  return (
    getFirstForwardedIp(headerStore.get('x-real-ip')) ??
    getFirstForwardedIp(headerStore.get('x-forwarded-for'))
  );
}
