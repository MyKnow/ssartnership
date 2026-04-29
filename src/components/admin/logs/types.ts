import type { LogGroup } from '@/lib/log-insights';

export type NormalizedLog = {
  id: string;
  group: LogGroup;
  name: string;
  label: string;
  status: string | null;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  actorMmUsername: string | null;
  identifier: string | null;
  ipAddress: string | null;
  path: string | null;
  referrer: string | null;
  targetType: string | null;
  targetId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
  actorSearchLabel: string;
  searchText: string;
};

export type SortFilter = 'newest' | 'oldest' | 'actor' | 'ip';
export type GroupFilter = 'all' | LogGroup;
export type StatusFilter = 'all' | 'success' | 'failure' | 'blocked';
