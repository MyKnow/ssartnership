type HeaderSource = {
  get(name: string): string | null;
};

function getFirstForwardedIp(value: string | null) {
  const ipAddress = value?.split(',')[0]?.trim();
  return ipAddress ? ipAddress.slice(0, 128) : null;
}

export function getClientIp(headerStore: HeaderSource) {
  return (
    getFirstForwardedIp(headerStore.get('x-vercel-forwarded-for')) ??
    getFirstForwardedIp(headerStore.get('x-forwarded-for')) ??
    getFirstForwardedIp(headerStore.get('x-real-ip'))
  );
}
