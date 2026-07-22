export const MOCK_MEMBER_ID = "mock-member-jung-minho";

export type MockMemberPolicyState = {
  service: number | null;
  privacy: number | null;
  marketing: number | null;
  marketingEnabled: boolean;
};

export type MockMemberRecord = {
  id: string;
  authSessionVersion: number;
  displayName: string;
  generation: number;
  campus: string;
  mattermostAccountId: string;
  mattermostUserId: string;
  mattermostUsername: string;
  mustChangePassword: boolean;
  graduateVerifiedAt: string | null;
};

type MockMemberEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_DATA_SOURCE?: string;
  MOCK_MEMBER_AUTH?: string;
  MOCK_ID?: string;
  MOCK_PW?: string;
  MOCK_MEMBER_PROFILE_IMAGE_URL?: string;
};

type MockMemberStore = {
  policyStateByMemberId: Record<string, MockMemberPolicyState>;
};

const globalScope = globalThis as typeof globalThis & {
  __ssartnershipMockMemberStore?: MockMemberStore;
};

const MOCK_MEMBER: MockMemberRecord = {
  id: MOCK_MEMBER_ID,
  authSessionVersion: 1,
  displayName: "정민호",
  generation: 15,
  campus: "서울",
  mattermostAccountId: "mock-mm-account-jung-minho",
  mattermostUserId: "mock-mm-user-jung-minho",
  mattermostUsername: "jung.minho15",
  mustChangePassword: false,
  graduateVerifiedAt: null,
};

function createEmptyPolicyState(): MockMemberPolicyState {
  return {
    service: null,
    privacy: null,
    marketing: null,
    marketingEnabled: false,
  };
}

function getStore() {
  if (!globalScope.__ssartnershipMockMemberStore) {
    globalScope.__ssartnershipMockMemberStore = {
      policyStateByMemberId: {},
    };
  }
  return globalScope.__ssartnershipMockMemberStore;
}

export function isMockDataSource(
  environment: MockMemberEnvironment = process.env,
) {
  return environment.NEXT_PUBLIC_DATA_SOURCE === "mock";
}

export function isMockMemberAuthEnabled(
  environment: MockMemberEnvironment = process.env,
) {
  return (
    environment.NODE_ENV !== "production" &&
    isMockDataSource(environment) &&
    environment.MOCK_MEMBER_AUTH === "1"
  );
}

export function verifyMockMemberCredentials(
  identifier: string,
  password: string,
  environment: MockMemberEnvironment = process.env,
) {
  if (!isMockMemberAuthEnabled(environment)) {
    return false;
  }

  const expectedIdentifier = environment.MOCK_ID?.trim().toLowerCase() ?? "";
  const expectedPassword = environment.MOCK_PW ?? "";
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (
    !expectedIdentifier
    || !expectedPassword
    || normalizedIdentifier !== expectedIdentifier
    || password.length > 256
  ) {
    return false;
  }

  let difference = password.length ^ expectedPassword.length;
  const maxLength = Math.max(password.length, expectedPassword.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (password.charCodeAt(index) || 0)
      ^ (expectedPassword.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function getMockMemberById(memberId: string) {
  return memberId === MOCK_MEMBER_ID ? { ...MOCK_MEMBER } : null;
}

export function getMockMemberProfileImageUrl(
  environment: MockMemberEnvironment = process.env,
) {
  const candidate = environment.MOCK_MEMBER_PROFILE_IMAGE_URL?.trim() ?? "";
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    candidate.length <= 200
  ) {
    return candidate;
  }
  return "/avatar-default.svg";
}

export function getMockMemberPolicyState(memberId: string) {
  if (!getMockMemberById(memberId)) {
    return null;
  }
  return {
    ...(getStore().policyStateByMemberId[memberId] ?? createEmptyPolicyState()),
  };
}

export function recordMockRequiredPolicyConsent(
  memberId: string,
  versions: { service: number; privacy: number },
) {
  if (!getMockMemberById(memberId)) {
    throw new Error("mock_member_not_found");
  }
  const current = getMockMemberPolicyState(memberId) ?? createEmptyPolicyState();
  getStore().policyStateByMemberId = {
    ...getStore().policyStateByMemberId,
    [memberId]: {
      ...current,
      service: versions.service,
      privacy: versions.privacy,
    },
  };
}

export function recordMockMarketingPolicyConsent(
  memberId: string,
  version: number | null,
  agreed: boolean,
) {
  if (!getMockMemberById(memberId)) {
    throw new Error("mock_member_not_found");
  }
  const current = getMockMemberPolicyState(memberId) ?? createEmptyPolicyState();
  getStore().policyStateByMemberId = {
    ...getStore().policyStateByMemberId,
    [memberId]: {
      ...current,
      marketing: agreed ? version : null,
      marketingEnabled: agreed,
    },
  };
}

export function resetMockMemberStore() {
  delete globalScope.__ssartnershipMockMemberStore;
}
