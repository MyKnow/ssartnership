import {
  isPartnerPortalMock,
  partnerPortalRepository,
  type PartnerPortalDemoSetupSummary,
} from "../partner-portal.ts";
import { mockPartnerPortalRepository } from "../mock/partner-portal.ts";

export const activePartnerPortalRepository = isPartnerPortalMock
  ? mockPartnerPortalRepository
  : partnerPortalRepository;

export async function listPartnerPortalDemoSetups(): Promise<
  PartnerPortalDemoSetupSummary[]
> {
  return activePartnerPortalRepository.listDemoSetups();
}
