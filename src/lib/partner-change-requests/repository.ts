import { isPartnerPortalMock } from "../partner-auth/portal.ts";
import {
  approveMockPartnerChangeRequest,
  cancelMockPartnerChangeRequest,
  createMockPartnerChangeRequest,
  getMockPartnerChangeRequestContext,
  listMockPartnerChangeRequestPage,
  listMockPartnerChangeRequests,
  rejectMockPartnerChangeRequest,
  updateMockPartnerImmediateFields,
} from "../mock/partner-change-requests.ts";
import {
  getSupabasePendingRequestPage,
  getSupabasePendingRequests,
  getSupabaseRequestContext,
} from "./context.ts";
import {
  approveSupabaseRequest,
  cancelSupabaseRequest,
  createSupabaseRequest,
  rejectSupabaseRequest,
} from "./commands.ts";
import { updateSupabasePartnerImmediateFields } from "./immediate.ts";
import type {
  PartnerChangeRequestCancelInput,
  PartnerChangeRequestCreateInput,
  PartnerChangeRequestListInput,
  PartnerChangeRequestRepository,
  PartnerChangeRequestReviewInput,
  PartnerImmediateUpdateInput,
} from "./shared.ts";

export async function updatePartnerImmediateFields(
  input: PartnerImmediateUpdateInput,
) {
  if (isPartnerPortalMock) {
    return updateMockPartnerImmediateFields(input);
  }
  return updateSupabasePartnerImmediateFields(input);
}

const mockRepository = {
  getRequestContext: getMockPartnerChangeRequestContext,
  listPendingRequests: listMockPartnerChangeRequests,
  listPendingRequestsPage: listMockPartnerChangeRequestPage,
  createRequest: createMockPartnerChangeRequest,
  cancelRequest: cancelMockPartnerChangeRequest,
  approveRequest: approveMockPartnerChangeRequest,
  rejectRequest: rejectMockPartnerChangeRequest,
} satisfies PartnerChangeRequestRepository;

const supabaseRepository = {
  getRequestContext: getSupabaseRequestContext,
  listPendingRequests: getSupabasePendingRequests,
  listPendingRequestsPage: getSupabasePendingRequestPage,
  createRequest: createSupabaseRequest,
  cancelRequest: cancelSupabaseRequest,
  approveRequest: approveSupabaseRequest,
  rejectRequest: rejectSupabaseRequest,
} satisfies PartnerChangeRequestRepository;

export const partnerChangeRequestRepository: PartnerChangeRequestRepository = isPartnerPortalMock ? mockRepository : supabaseRepository;

export async function getPartnerChangeRequestContext(
  companyIds: string[],
  partnerId: string,
  accountId?: string,
) {
  return partnerChangeRequestRepository.getRequestContext(
    companyIds,
    partnerId,
    accountId,
  );
}

export async function listPartnerChangeRequests(companyIds?: string[]) {
  return partnerChangeRequestRepository.listPendingRequests(companyIds);
}

export async function listPartnerChangeRequestPage(
  input: PartnerChangeRequestListInput,
) {
  return partnerChangeRequestRepository.listPendingRequestsPage(input);
}

export async function createPartnerChangeRequest(
  input: PartnerChangeRequestCreateInput,
) {
  return partnerChangeRequestRepository.createRequest(input);
}

export async function cancelPartnerChangeRequest(
  input: PartnerChangeRequestCancelInput,
) {
  return partnerChangeRequestRepository.cancelRequest(input);
}

export async function approvePartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  return partnerChangeRequestRepository.approveRequest(input);
}

export async function rejectPartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  return partnerChangeRequestRepository.rejectRequest(input);
}
