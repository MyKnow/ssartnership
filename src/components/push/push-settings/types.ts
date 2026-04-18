import type { PushPreferenceState } from "@/lib/push";

export type PushSettingsCardProps = {
  initialPreferences: PushPreferenceState;
  configured: boolean;
};

export type PreferenceKey = Exclude<keyof PushPreferenceState, "enabled">;
export type ChannelPreferenceKey = Extract<keyof PushPreferenceState, "enabled" | "mmEnabled">;

export type PushSettingsStatusTone = "success" | "warn" | "muted";

export type PushSettingsStatus = {
  label: string;
  tone: PushSettingsStatusTone;
};

export type PushSettingsApiResponse = {
  message?: string;
  preferences?: PushPreferenceState;
} | null;

export type PushDeviceSummary = {
  id: string;
  label: string;
  isCurrent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};
