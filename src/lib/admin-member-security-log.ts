export type AdminMemberSecurityLog = {
  id: string;
  eventName: string;
  status: string | null;
  identifier: string | null;
  path: string | null;
  ipAddress: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
};
