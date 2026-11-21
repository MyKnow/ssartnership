/**
 * 광고성 정보(마케팅) 수신 자격 판정 규칙.
 *
 * 동의는 활성 마케팅 정책에 대한 `member_policy_consents` 행으로 남고,
 * 철회는 `push_preferences.marketing_enabled = false`로만 기록된다.
 * 동의 행은 감사 증적이라 철회 후에도 지우지 않으므로, 동의 행 존재만으로
 * 발송 자격을 판정하면 철회한 회원에게 광고성 알림이 나간다.
 *
 * 발송·회원 목록·이벤트 조건 등 모든 경로는 이 모듈의 predicate만 사용한다.
 */

export type MarketingConsentInput = {
  /** 현재 활성화된 마케팅 정책 문서가 있는지 */
  hasActiveMarketingPolicy: boolean;
  /** 활성 마케팅 정책(현재 버전)에 대한 동의 기록이 있는지 */
  hasCurrentPolicyConsent: boolean;
  /** 회원의 현재 마케팅 수신 설정. 설정 행이 없으면 null/undefined로 전달한다. */
  marketingEnabled: boolean | null | undefined;
};

export function hasEffectiveMarketingConsent(input: MarketingConsentInput) {
  return (
    input.hasActiveMarketingPolicy &&
    input.hasCurrentPolicyConsent &&
    input.marketingEnabled === true
  );
}

export type MarketingPreferenceRow = {
  member_id: string | null;
  marketing_enabled: boolean | null;
};

/**
 * 활성 정책 동의 회원 집합과 수신 설정 행을 결합해 실제 수신 자격이 있는
 * 회원 ID 집합을 만든다. 수신 설정 행이 없는 회원은 철회 상태로 본다.
 */
export function getEffectiveMarketingConsentMemberIds(
  policyConsentMemberIds: Iterable<string>,
  preferences: Iterable<MarketingPreferenceRow>,
) {
  const enabledMemberIds = new Set<string>();
  for (const preference of preferences) {
    if (preference.member_id && preference.marketing_enabled === true) {
      enabledMemberIds.add(preference.member_id);
    }
  }

  const effective = new Set<string>();
  for (const memberId of policyConsentMemberIds) {
    if (
      hasEffectiveMarketingConsent({
        hasActiveMarketingPolicy: true,
        hasCurrentPolicyConsent: true,
        marketingEnabled: enabledMemberIds.has(memberId),
      })
    ) {
      effective.add(memberId);
    }
  }
  return effective;
}
