export function maskMattermostSenderIdentifier(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 1) {
    return "***";
  }
  if (normalized.length <= 4) {
    return `${normalized.slice(0, 1)}***`;
  }
  return `${normalized.slice(0, 2)}***${normalized.slice(-1)}`;
}
