---
title: 신뢰 경계와 위협 모델
type: security-policy
status: current
authority: normative
---

# 신뢰 경계와 위협 모델

범위는 브라우저 → Next 서버 → service role/DB·Storage → 외부 발송과 CI → 이미지 게시 → 운영 수신기다. 아래는 기존 방어의 연결표이며 침해 발견 보고가 아니다.

| 보호 대상·오용 | 방어 정본 | 검증 근거 | 남은 한계 |
| --- | --- | --- | --- |
| 다른 회사·회원 정보 접근 | [Service Role 경계](./service-role-boundary.md), [관리자 접근](./admin-access-control.md) | [회사 범위](../../tests/partner-portal-scope.test.mts), [지역 범위](../../tests/admin-regional-scope.test.mts) | 실제 DB 권한은 별도 통합 확인 |
| 외부 사이트의 쿠키 기반 변경 요청 | 같은 경계의 origin·CSRF 규칙 | [CSRF](../../tests/csrf-route-contracts.test.mts) | 새 route 추가 시 누락 검토 |
| 업로드 위장·소유권 혼동·과다 사용 | [데이터 모델](../architecture/data-model.md)과 업로드 정책 | [업로드 정책](../../tests/image-upload-policy.test.mts), [quota](../../tests/image-upload-quota.test.mts) | 실제 Storage metadata 재확인 필요 |
| 토큰 탈취·재사용·계정 추측 | [인증 화면](../product/screen-specs/auth.md), 보안 경계 | [회원 인증](../../tests/member-auth-security.test.mts), [게이트](../../tests/member-required-gates.test.mts) | 운영 비밀 회전은 별도 절차 |
| 출처 IP 위조로 레이트리밋·허용목록 우회 | [클라이언트 IP 신뢰 계약](./client-ip-trust.md) | [앱 판정](../../tests/security-hardening.test.mts), [배포 체인](../../tests/client-ip-trust-contract.test.mts), [이미지 쿼터](../../tests/image-proxy-rate-limit.test.mts) | 공용 NAT 뒤 다수 사용자는 같은 IP 버킷을 공유, 이미지 옵티마이저 경유 요청은 IP 쿼터 없이 fetch 한도로만 바운드 |
| 검증 안 된 이미지·다른 SHA 배포 | [CI·수신기](../operations/runbooks/self-host-ci-maintenance.md) | [릴리스 계약](../../tests/self-host-github-release.test.mts), [수신기](../../tests/self-host-release-receiver.test.mts) | 빌드 호스트 자체의 신뢰는 별도 경계 |

새 외부 연동·개인정보·인증·업로드 변경 시 해당 행과 구현·검증 연결을 함께 검토한다. 비밀값·실회원 정보·미공개 공격 세부사항은 이 공개 문서에 기록하지 않는다.

## 결정: nonce 기반 CSP 미도입 (2026-10)

현재 전역 응답 헤더(`next.config.ts`)의 `Content-Security-Policy`는 `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `form-action 'self'`만 선언하고 `script-src`·`connect-src`·`default-src`는 두지 않는다. 같은 헤더 묶음에서 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, 운영 HSTS를 함께 보낸다.

이번 리팩토링 사이클에서는 nonce 기반 `script-src`를 도입하지 않는다.

| 검토한 선택지 | 판단 | 근거 |
| --- | --- | --- |
| nonce + `strict-dynamic` | 보류 | 요청마다 새 nonce가 필요해 모든 페이지가 동적 렌더링으로 고정되고 정적 최적화·ISR·PPR을 쓸 수 없다. 공개 카탈로그 캐시와 첫 페인트 개선이 먼저이며, 1인 운영에서 CSP 위반으로 화면이 깨지는 회귀를 감지할 관측 체계도 아직 없다. |
| `'unsafe-inline'`을 포함한 정적 `script-src` | 채택 안 함 | 인라인 스크립트 주입 방어 효과가 작아 운영 부담 대비 이득이 낮다. |
| `connect-src` 허용 목록만 추가 | 보류 | 데이터 유출 경로는 줄지만 Supabase·푸시·분석·이미지 출처를 함께 관리해야 하고 누락 시 기능이 조용히 실패한다. |
| Next 실험 기능 SRI(해시 기반) | 보류 | 실험 기능이고 빌드 시점 스크립트만 다룬다. |
| `Content-Security-Policy-Report-Only` 수집 | 다음 단계 | 위반 보고를 받을 엔드포인트와 로그 관측이 준비된 뒤 enforce 전 단계로 사용한다. |

남은 위험을 줄이는 보완 통제:

- React 기본 escaping을 따르고 `dangerouslySetInnerHTML`은 JSON-LD 직렬화와 관리자 이메일 미리보기(정제된 HTML)로 한정한다.
- 사용자 입력이 들어가는 이동 경로(`returnTo`)·오류 쿼리는 공용 sanitizer·allowlist를 거친다.
- 업로드 이미지는 서버에서 다시 인코딩하고, 원본 파일 응답은 `attachment`·`nosniff`와 필요 시 `sandbox` CSP로 제공한다.
- 클릭재킹·플러그인·`<base>` 변조·외부 폼 제출은 현재 CSP 지시어로 차단한다.

재검토 조건: 공개 페이지 렌더링 전략이 바뀌거나 첫 페인트 기준이 확보될 때, 사용자 생성 HTML·마크다운을 렌더링하는 화면이나 제3자 스크립트가 추가될 때, Next SRI가 안정 기능이 될 때. 재검토 시 Report-Only로 위반을 먼저 수집한 뒤 enforce로 전환한다.
