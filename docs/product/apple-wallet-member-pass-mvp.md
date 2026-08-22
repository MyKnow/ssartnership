# Apple Wallet 회원 인증 패스 MVP

작성 기준일: 2026-08-11
관련 Issue: [#301](https://github.com/MyKnow/ssartnership/issues/301)

## 결정

- 첫 월렛 출시는 Apple Wallet만 지원한다.
- Samsung Wallet은 파트너 신청과 승인 상태 확인까지만 진행하고, 카드 발급 연동은 별도 작업으로 미룬다.
- 패스 이름은 `싸트너십 회원 인증`이며 공식 SSAFY 학생증이나 신분증을 표방하지 않는다.
- Apple Wallet의 `generic` pass를 사용한다.
- 파일럿 대상은 15기 교육생과 운영진이다. 수료생, 다른 기수, 쿠폰, NFC는 범위 밖이다.
- 기존 30초 웹 인증 QR은 주 인증 수단이자 fallback으로 유지한다. Wallet은 더 빠르게 꺼내는 보조 수단이다.

## 사용자 흐름

1. 회원은 기존 필수 게이트를 모두 통과한 뒤 `/certification`에 진입한다.
2. Wallet 데이터 이용 내용을 확인하고 `Apple Wallet 패스 발급하기`를 누른다.
3. 서버는 현재 회원 자격을 다시 확인하고 회원별 Apple pass credential을 생성하거나 기존 credential을 재사용한다.
4. 서버가 서명한 `.pkpass`를 반환하고 iPhone이 Apple Wallet에 추가한다.
5. 제휴처는 패스의 QR을 스캔한다.
6. 검증 페이지가 현재 회원 상태, 필수 동의, 사진 승인, pass 폐기 여부를 실시간으로 다시 확인한다.
7. 회원은 `/certification`에서 패스를 다시 받거나 폐기할 수 있다.

Wallet 데이터 이용 동의의 초기 버전은 `1`이며, 저장 항목이나 이용 목적이 바뀌면 버전을 올리고 다시 동의를 받는다.

## 표시 정보와 데이터 최소화

패스에 표시하는 정보:

- 이름
- 기수
- 캠퍼스
- 역할
- `싸트너십 회원 인증`과 비공식 인증 안내

패스에 포함하지 않는 정보:

- 프로필 사진
- 회원 UUID
- 이메일
- Mattermost 계정·ID
- 내부 DB 식별자

QR에는 충분히 긴 임의 public ID와 서버 서명만 넣는다. 검증 페이지는 승인된 프로필 사진을 서버에서 별도로 스트리밍할 수 있지만 URL, 로그, 분석 이벤트에는 회원 식별자나 token 원문을 남기지 않는다.

## 자격 규칙

발급, 재발급, Wallet 업데이트, QR 검증은 모두 같은 현재 상태를 기준으로 한다.

- 로그인한 회원이어야 한다.
- 삭제되거나 비활성화된 회원이 아니어야 한다.
- 비밀번호 변경이 필요한 상태가 아니어야 한다.
- 현재 필수 정책 동의를 완료해야 한다.
- 본인 사진이 승인 상태여야 한다.
- 15기 교육생 또는 운영진이어야 한다.
- pass가 폐기 상태가 아니어야 한다.

회원 게이트 우선순위는 `비밀번호 변경 → 필수 약관 동의 → 본인 사진 → 원래 목적지`를 유지한다. Wallet을 새 필수 게이트로 만들지 않는다.

## 보안 계약

- Apple Pass Type ID certificate, private key, WWDR certificate, Wallet master key는 서버 전용 환경 변수에서만 읽는다.
- `APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64`는 정확히 32바이트인 장기 Wallet master key다. APNs push token 암호화, device identifier hash, QR 서명, Apple `authenticationToken`은 서로 다른 고정 context로 HMAC-SHA256 subkey를 파생해 용도를 분리한다.
- QR token과 Apple `authenticationToken`은 `publicId`와 Pass Type ID를 포함해 결정론적으로 파생한다. 신규 발급과 업데이트 재생성에서 값이 같고, 다른 애플리케이션 인증 secret의 회전과 무관하다.
- `APPLE_WALLET_ENABLED=true`이면 `NEXT_PUBLIC_SITE_URL`의 명시적인 공개 HTTPS origin이 필수다. 코드 상수나 배포 환경 추론값으로 대체하지 않는다.
- 설정 오류에는 환경 변수 이름만 포함하며 master key 또는 token 원문은 포함하지 않는다.
- 서명 키와 인증 token은 브라우저 번들, 응답 오류, 로그, 분석 속성에 노출하지 않는다.
- 한 회원·플랫폼에는 하나의 canonical credential만 활성화한다.
- 발급·재발급·폐기는 idempotency key와 request fingerprint로 중복 실행을 막는다.
- 패스 스냅샷과 현재 자격을 분리한다. 패스가 기기에 남아 있어도 검증 서버가 부적격 또는 폐기로 판단하면 무효다.
- Apple의 `sharingProhibited`는 보조 방어로만 사용하며 캡처·공유 방지 보장으로 취급하지 않는다.
- 공개 검증 응답은 `no-store`, `noindex`를 사용하고 token 열거를 어렵게 한다.
- Apple device library identifier와 APNs push token은 공개 회원 데이터와 분리해 저장한다. Device identifier hash는 다른 애플리케이션 인증 secret과 결합하지 않고, Wallet master key에서 HMAC으로 용도 분리한 subkey를 파생해 만든다. push token은 별도 암호화 subkey로 앱 수준 암호화한 뒤 저장하고 원문을 로그에 남기지 않는다.

## 시스템 경계

- `WalletPassRepository`: credential, revision, 폐기, device registration 영속화. mock과 Supabase가 같은 계약을 제공한다.
- `WalletPassService`: 현재 회원 자격, snapshot, 상태 전이, idempotency를 담당한다.
- `AppleWalletPassAdapter`: pass payload, asset, manifest, 서명, `.pkpass` 패키징만 담당한다.
- Apple web service route: device 등록·해제, 변경 serial 조회, 최신 pass 다운로드를 Apple 규격으로 제공한다.
- 공개 verify route: QR token을 검증하고 현재 회원 상태를 다시 조회한다.

## 상태 모델

- credential: `active | revoked`
- installation: `pending | installed | removed`
- sync: `pending | synced | failed`

설치 여부는 device registration의 관찰 결과이며 회원 자격과 섞지 않는다. 폐기 후 재발급은 같은 회원의 새 credential과 새 QR public ID를 만들고 이전 QR은 영구 무효로 남긴다.

## UI 계약

- `/certification`의 기존 인증 카드가 먼저 보인다.
- Apple Wallet 카드는 인증 카드 아래, 계정 관리 액션 위에 배치한다.
- 정상 상태에서는 `미발급`, `발급됨`, `재동의 필요`, `회수됨`, `오류`와 다음 행동 하나를 보여준다.
- 저장된 표시 snapshot이 현재 회원 정보와 달라지면 `다시 받기`로 새 revision을 발급하고 기기 갱신을 요청한다.
- 선행 조건 미충족 시 발급 CTA 대신 원인에 맞는 `설정하러 가기`를 보여준다.
- 360px에서는 한 열과 전체 너비 CTA, 820px 이상에서는 설명과 액션을 두 영역으로 배치한다.
- 상태는 색만으로 표현하지 않고 텍스트 badge와 설명을 함께 제공한다.

## 운영과 복구

- pass 인증서는 `notBefore` 이전이면 발급·웹서비스를 즉시 막고, `notAfter` 이후면 설정 오류로 간주한다.
- pass 인증서 만료가 30일 이내로 들어오면 health/config 경계에서 경고를 노출해 교체 일정을 앞당긴다.
- Apple의 device unregister는 유효한 PassKit 인증을 통과했지만 서버에 패스가 이미 없는 경우에도 `200` no-op으로 처리한다. malformed serial, 잘못된 PassKit authorization, 잘못된 pass type은 계속 거절한다.
- Preview sync는 Production Wallet 테이블을 가져오지 않고, Preview-local Wallet 테이블만 트랜잭션 안에서 백업·복원한다. Preview schema에 Wallet 테이블이 빠져 있으면 sync를 중단하고 migration 적용을 먼저 요구한다.
- register, unregister, sync 관측성은 집계용 outcome과 reasonCode만 남기고 serial, device identifier, push token, authorization token, member ID는 로그·분석 속성에 남기지 않는다.
- 발급 실패는 안전한 코드만 저장하고 provider 원문 오류나 키 정보를 저장하지 않는다.
- Apple update push가 지연되더라도 QR 검증은 항상 현재 상태를 반환해야 한다.
- 설치된 active pass는 일일 조정 작업에서 현재 자격·동의·표시 snapshot을 재검사한다. 자격과 동의가 유효한 정보 변경은 새 revision으로 원자적으로 반영하고, 자격 또는 동의가 무효해진 credential은 폐기한다. 두 경우 모두 APNs update를 보내며 다음 조정에서는 같은 변경을 반복하지 않는다.
- APNs 전달이 일시적으로 실패하면 active·revoked 여부와 관계없이 실패한 설치 건을 다음 조정에서 다시 시도하고, 성공한 revoked pass는 조정 대상에서 제외한다.
- 일일 조정 사이에도 QR 검증은 즉시 현재 상태와 snapshot 일치 여부를 확인하므로, Wallet 화면 자체는 보조 표시이고 QR 실시간 결과가 인증의 기준이다.
- 긴급 시 `APPLE_WALLET_ENABLED=false`로 신규 발급을 중단하되 기존 QR 검증과 회원의 폐기 기능은 유지한다.
- 실제 기기 파일럿은 iPhone에서 추가, 삭제, 재추가, 정보 변경, 폐기 후 스캔을 확인한다.

### Wallet master key 회전

`APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64`는 설치 수명 동안 불변으로 운용한다. 이 키를 바꾸면 저장된 APNs token 암호문, device identifier hash, QR 서명, Apple `authenticationToken`이 모두 달라진다. 따라서 단순 환경 변수 교체로 회전하지 않는다.

회전이 필요하면 저장 APNs token 재암호화, device identifier hash 재생성 또는 기기 재등록, 기존 패스 폐기와 새 credential 재발급, QR 교체를 포함한 별도 migration을 설계하고 실제 기기에서 전환을 검증한다. master key와 파생 token 원문은 어떤 단계에서도 로그, 오류, 분석 이벤트에 기록하지 않는다.

## 외부 준비 상태

### Apple

- Apple 개발자 포털은 로그인 후 Apple Developer Program 상태를 확인해야 한다.
- Pass Type ID, Pass Type ID certificate, certificate private key, Apple WWDR certificate가 필요하다.
- 웹 출시 전 계정 소유자가 Apple Wallet Marketing Artwork License에 동의하고 Apple이 제공하는 한국어 SVG 배지를 내려받아 발급 CTA에 적용한다. 임의로 배지를 재현하지 않는다.
- 인증서가 준비되기 전에도 mock과 서명 전 계약 테스트는 가능하지만 실제 `.pkpass` 설치 검증은 할 수 없다.

### Samsung

- Wallet Partners Portal 로그인 후 Business Account 생성과 약관 동의, 회사 정보 제출이 필요하다.
- 회사당 하나의 계정만 허용되므로 계정 소유자를 먼저 정해야 한다.
- CSR은 신청 때 등록하거나 `None (Upload later)`로 미룰 수 있지만 실제 연동 전에는 필요하다.
- 계정 정보, 회사 정보, 약관 동의, CAPTCHA는 계정 소유자가 직접 완료한다.
