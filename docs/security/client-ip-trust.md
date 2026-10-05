---
title: 클라이언트 IP 신뢰 계약
type: security-policy
status: current
authority: normative
---

# 클라이언트 IP 신뢰 계약

레이트리밋, 관리자 IP 허용목록, 활동·보안 로그의 `ip_address`는 모두 같은 판정 결과를 쓴다. 판정은 `src/lib/client-ip.ts` 한 곳에서만 하며, 다른 코드는 클라이언트 주소 헤더를 직접 읽지 않는다.

## 앱 계약

- `SELF_HOST_MODE=real`일 때만 `X-Forwarded-For`의 첫 값을 신뢰한다.
- 첫 값은 128자 이하이고 `net.isIP`를 통과해야 한다. IPv6는 소문자로, IPv4-mapped IPv6는 IPv4로 정규화한다.
- 그 외 모드(로컬 mock, 테스트, 미설정)와 형식이 맞지 않는 값은 `null`(판정 불가)이다. `X-Real-IP`나 호스팅 플랫폼 전용 헤더는 어떤 모드에서도 읽지 않는다.

## 배포 체인 전제

앱 계약은 아래 구성이 유지될 때만 안전하다. 셋 중 하나라도 바뀌면 앱 계약과 계약 테스트를 같은 변경에서 갱신한다.

1. 공개 엣지 Caddy는 클라이언트가 보낸 `X-Forwarded-For`·`X-Real-IP`를 신뢰하지 않는다(`trusted_proxies` 없음). 엣지는 접속 상대(`{remote_host}`) 기준으로 값을 설정해 전달한다.
2. 앱 VM의 relay Caddy는 `trusted_proxies`로 엣지 단일 홉만 신뢰하고 값을 이어 붙인다. 따라서 앱이 받는 첫 값은 엣지가 기록한 접속 상대다.
3. 앱 컨테이너 포트는 loopback에만 게시하고, 외부 유입은 relay를 거친다.

CDN이나 추가 프록시를 엣지 앞에 둘 때는 첫 값이 더 이상 접속 상대가 아니다. 이때는 신뢰 홉 구성을 다시 설계한 뒤 전환한다.

## 내부 홉 주소

전달 헤더 없이 앱에 닿은 요청(loopback 호출, Next 이미지 옵티마이저가 `/api/image`를 부르는 내부 호출)은 라우트 처리 단계에서 Next 서버가 접속 상대 주소로 `X-Forwarded-For`를 채운다. 그래서 `SELF_HOST_MODE=real`에서도 이런 요청은 `null`이 아니라 relay 컨테이너나 Docker gateway 같은 내부 홉 주소로 판정된다. 옵티마이저 호출은 모든 사용자의 요청이 이 주소 하나로 모이므로, 공개 이미지 프록시는 공개 주소에만 IP 쿼터를 적용한다.

## 판정 불가(`null`) 처리

| 경로 | `null`일 때 |
| --- | --- |
| 익명 폼(제안, 제휴 신청) | 미판정 요청이 공유하는 보수적 버킷 하나로 묶는다(`getClientRateLimitIdentifier`). |
| 회원·관리자 로그인 throttle | IP 키 없이 계정 키만 적용한다. 관리자 비밀번호 로그인은 회원 로그인으로 넘어가므로 같은 throttle을 쓴다. |
| 공개 이미지 프록시 | 내부 홉 주소와 같이 IP 쿼터를 건너뛰고 원격 fetch 크기·시간 한도로 요청당 비용을 바운드한다. IP 쿼터는 프로세스 로컬 버킷이라 요청당 DB 왕복이 없다. |
| 관리자 IP 허용목록 | `ADMIN_ALLOWED_IPS`가 설정돼 있으면 거부한다. |
| 활동·보안 로그 | `ip_address`를 비워 둔다. |

공개 이미지 프록시의 요청당 상한은 DNS 해석부터 HTTP 본문 수신까지 합쳐 8초·8 MiB다. 상태 코드·MIME·선언된 길이가 허용 범위를 벗어나면 원격 응답 스트림을 즉시 닫고, 길이가 없는 응답도 실제 수신 바이트를 센다. 주소 해석과 HTTP 전송에 각각 새 제한 시간을 주지 않는다. 운영 상한과 하위 호출 제약은 [신뢰성 기준](../operations/reliability.md)에 둔다.

## 검증

- 앱 동작: [보안 하드닝 테스트](../../tests/security-hardening.test.mts), [회원 인증 보안](../../tests/member-auth-security.test.mts)
- 배포 체인 전제: [클라이언트 IP 신뢰 계약 테스트](../../tests/client-ip-trust-contract.test.mts)
- 이미지 프록시 쿼터: [이미지 프록시 레이트리밋](../../tests/image-proxy-rate-limit.test.mts)
- 이미지 전송 경계: [DNS·전송 시간·응답 중단](../../tests/unit/image-proxy-fetch-bounds.test.ts)

운영 주소, 방화벽 규칙, 허용목록 값은 이 공개 문서에 기록하지 않는다.
