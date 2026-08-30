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

export function getClientIp(headerStore: HeaderSource) {
  return (
    getTrustedPlatformClientIp(headerStore) ??
    getFirstForwardedIp(headerStore.get('x-real-ip')) ??
    getFirstForwardedIp(headerStore.get('x-forwarded-for'))
  );
}
