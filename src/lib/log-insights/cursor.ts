import { isUuid } from '@/lib/uuid';
import type { AdminLogsCursor } from './shared';

export function encodeAdminLogsCursor(cursor: AdminLogsCursor) {
  return `${encodeURIComponent(cursor.createdAt)}:${cursor.id}`;
}

export function parseAdminLogsCursor(value: string | null | undefined): AdminLogsCursor | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return null;
  }

  const separatorIndex = normalized.lastIndexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  let createdAt = '';
  try {
    createdAt = decodeURIComponent(normalized.slice(0, separatorIndex));
  } catch {
    return null;
  }

  const id = normalized.slice(separatorIndex + 1);
  if (!Number.isFinite(Date.parse(createdAt)) || !isUuid(id)) {
    return null;
  }

  return { createdAt, id: id.toLowerCase() };
}
