---
title: 협력사 결제 운영 설정
type: guide
status: current
authority: normative
---

# 협력사 결제 운영 설정

운영자용 안내다. 협력사 플랜 결제 화면이 쓰는 사업자 상태조회 API 키와 관리자 입금 계좌는 서버 전용 환경 변수로 관리한다. 두 값 모두 `NEXT_PUBLIC_` 접두사를 붙이지 않고, 파트너 포털의 인증된 서버 렌더링 화면에서만 필요한 값만 내려준다.

## 환경 변수를 두는 곳

- 로컬 확인: 브랜치에 맞는 로컬 profile 파일(`.env.preview` 또는 `.env.production`). 선택 규칙은 [교차 플랫폼 개발환경](../../operations/runbooks/cross-platform-development.md#6-환경변수와-로컬-profile)을 따른다. `.env` 파일은 사용하지 않는다.
- 운영: 해당 환경(Preview 또는 Production) 서버의 앱 runtime env 파일. 값을 바꾼 뒤 앱 컨테이너를 다시 시작해야 반영된다. 서버 비밀 값이므로 이미지 빌드 인자에 넣지 않는다. 형식과 필수 여부는 `deploy/self-host/runtime-env.mjs`가 정본이다.

## 사업자 상태조회 API 키

사업자 상태조회는 공공데이터포털의 `국세청_사업자등록정보 진위확인 및 상태조회 서비스`를 사용한다.

1. 공공데이터포털에 로그인한다.
2. `국세청_사업자등록정보 진위확인 및 상태조회 서비스` 상세 페이지에서 활용신청을 진행한다.
3. 승인 후 `마이페이지 > 데이터활용 > Open API > 활용신청 현황`에서 일반 인증키를 확인한다.
4. 위 위치에 `NTS_BUSINESS_STATUS_SERVICE_KEY`로 등록한다. Preview와 Production에 각각 등록하고 앱을 다시 시작한다.

인코딩/디코딩 인증키는 모두 사용할 수 있다. 앱은 값에 `%`가 포함되어 있지 않으면 호출 시 URL 인코딩한다. 이 API의 응답은 휴업/폐업 상태와 과세유형 확인용이다. 상호, 대표자명, 주소, 업태, 종목은 자동 채움 대상이 아니므로 파트너가 직접 입력해야 한다. 레거시 별칭 `DATA_GO_KR_SERVICE_KEY`는 운영 env 확인 전까지 남겨 두지만 새로 쓰지 않는다.

## 관리자 입금 계좌

1. `PARTNER_BILLING_BANK_NAME`, `PARTNER_BILLING_BANK_ACCOUNT`, `PARTNER_BILLING_ACCOUNT_HOLDER`를 위 위치에 등록한다.
2. 계좌를 바꾸면 Preview와 Production 값을 모두 갱신하고 앱을 다시 시작한다.
3. 값이 비어 있으면 파트너 포털은 계좌를 노출하지 않고 "관리자가 입금 계좌를 안내"하는 문구를 표시한다.
