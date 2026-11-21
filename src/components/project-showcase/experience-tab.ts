// Pending-tab helpers for the showcase experience flow.
//
// The panel opens a blank tab synchronously inside the click handler so popup
// blockers allow it, then points it at the project after the server records
// the experience. When the browser blocks that first tab, a second
// window.open() after the await is blocked the same way, so the panel shows a
// manual link instead of retrying.

export type PendingExperienceTab = {
  opener: unknown;
  close: () => void;
  location: { assign: (url: string) => void };
};

type WindowOpen = (
  url: string,
  target: string,
) => PendingExperienceTab | null;

export type ExperienceTabNavigation = "opened" | "blocked";

export function openPendingExperienceTab(open: WindowOpen): PendingExperienceTab | null {
  try {
    const tab = open("about:blank", "_blank");
    if (tab) tab.opener = null;
    return tab;
  } catch {
    return null;
  }
}

export function closePendingExperienceTab(tab: PendingExperienceTab | null) {
  if (!tab) return;
  try {
    tab.close();
  } catch {
    // The tab may already be closed or cross-origin; nothing else to clean up.
  }
}

export function navigatePendingExperienceTab(
  tab: PendingExperienceTab | null,
  destination: string,
): ExperienceTabNavigation {
  if (!tab) return "blocked";
  try {
    tab.location.assign(destination);
    return "opened";
  } catch {
    closePendingExperienceTab(tab);
    return "blocked";
  }
}
