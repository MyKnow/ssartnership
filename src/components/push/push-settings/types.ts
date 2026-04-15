import type { PushPreferenceState } from "@/lib/push";

export type PushSettingsCardProps = {
  initialPreferences: PushPreferenceState;
  configured: boolean;
};

export type PreferenceKey = Exclude<keyof PushPreferenceState, "enabled">;

export type PushSettingsStatusTone = "success" | "warn" | "muted";

export type PushSettingsStatus = {
  label: string;
  tone: PushSettingsStatusTone;
};

export type PushSettingsApiResponse = {
  message?: string;
  preferences?: PushPreferenceState;
} | null;
