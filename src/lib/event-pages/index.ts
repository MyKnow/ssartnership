import { SIGNUP_REWARD_EVENT } from "@/lib/event-pages/signup-reward";
import { REVIEW_REWARD_EVENT } from "@/lib/event-pages/review-reward";
import type { EventCampaign } from "@/lib/promotions/catalog";

export const EVENT_PAGE_DEFINITIONS = [SIGNUP_REWARD_EVENT, REVIEW_REWARD_EVENT] as const;

export function listEventPageDefinitions(): EventCampaign[] {
  return EVENT_PAGE_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function getEventPageDefinition(slug: string): EventCampaign | null {
  return EVENT_PAGE_DEFINITIONS.find((definition) => definition.slug === slug) ?? null;
}
