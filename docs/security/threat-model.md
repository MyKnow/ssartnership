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
| 검증 안 된 이미지·다른 SHA 배포 | [CI·수신기](../operations/runbooks/self-host-ci-maintenance.md) | [릴리스 계약](../../tests/self-host-github-release.test.mts), [수신기](../../tests/self-host-release-receiver.test.mts) | 빌드 호스트 자체의 신뢰는 별도 경계 |

새 외부 연동·개인정보·인증·업로드 변경 시 해당 행과 구현·검증 연결을 함께 검토한다. 비밀값·실회원 정보·미공개 공격 세부사항은 이 공개 문서에 기록하지 않는다.
