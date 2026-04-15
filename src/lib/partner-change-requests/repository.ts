import { isPartnerPortalMock } from "../partner-portal.ts";
import {
  approveMockPartnerChangeRequest,
  cancelMockPartnerChangeRequest,
  createMockPartnerChangeRequest,
  getMockPartnerChangeRequestContext,
  listMockPartnerChangeRequests,
  rejectMockPartnerChangeRequest,
  updateMockPartnerImmediateFields,
} from "../mock/partner-change-requests.ts";
import { getSupabasePendingRequests, getSupabaseRequestContext } from "./context.ts";
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

export const partnerChangeRequestRepository: PartnerChangeRequestRepository = {
  async getRequestContext(companyIds: string[], partnerId: string) {
    if (isPartnerPortalMock) {
      return getMockPartnerChangeRequestContext(companyIds, partnerId);
    }
    return getSupabaseRequestContext(companyIds, partnerId);
  },

  async listPendingRequests(companyIds?: string[]) {
    if (isPartnerPortalMock) {
      return listMockPartnerChangeRequests(companyIds);
    }
    return getSupabasePendingRequests(companyIds);
  },

  async createRequest(input: PartnerChangeRequestCreateInput) {
    if (isPartnerPortalMock) {
      return createMockPartnerChangeRequest(input);
    }
    return createSupabaseRequest(input);
  },

  async cancelRequest(input: PartnerChangeRequestCancelInput) {
    if (isPartnerPortalMock) {
      return cancelMockPartnerChangeRequest(input);
    }
    return cancelSupabaseRequest(input);
  },

  async approveRequest(input: PartnerChangeRequestReviewInput) {
    if (isPartnerPortalMock) {
      return approveMockPartnerChangeRequest(input);
    }
    return approveSupabaseRequest(input);
  },

  async rejectRequest(input: PartnerChangeRequestReviewInput) {
    if (isPartnerPortalMock) {
      return rejectMockPartnerChangeRequest(input);
    }
    return rejectSupabaseRequest(input);
  },
};

export async function getPartnerChangeRequestContext(
  companyIds: string[],
  partnerId: string,
) {
  return partnerChangeRequestRepository.getRequestContext(companyIds, partnerId);
}

export async function listPartnerChangeRequests(companyIds?: string[]) {
  return partnerChangeRequestRepository.listPendingRequests(companyIds);
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
