---
title: 2026-10 비 Wallet 회귀 감사와 단계별 보완
type: exec-plan
status: active
authority: normative
last_verified: 2026-10-06
---

# 비 Wallet 회귀 감사와 단계별 보완

상위 작업은 [#530](https://github.com/MyKnow/ssartnership/issues/530)이며, 기존 결정은 [리팩터링 프로그램](./refactor-program-2026-10.md)을 따른다. 사용자가 요청한 재점검을 기존 구현의 완료 주장과 구분한다. Wallet #301, #302, #319는 제외한다.

## 기준과 전달 경계

시작 기준은 dev `f10aefc66d06fe27b4e44f315fc173860914a090`이다. 열린 32개 이슈 중 비 Wallet 29개를 대조한다. 원본 checkout의 미커밋 변경과 RF 작업 폴더 24개를 보존하고, 동일 기준의 독립 워크트리에서 병렬 구현한다. 원격 변경과 통합 담당은 하나다.

전달 대상은 dev와 자체 호스팅 Preview다. Production 앱·DDL 승격, 제공자 계정 변경, 물리 복구 매체와 서비스 종료 결정은 별도 경계다. Durumari 조회가 접근 거절 상태여서 사용자가 승인한 이번 작업의 Context 확인 예외를 적용한다.

## 확인된 수정 단위

아래 15개 계약은 추가 감사에서 확인한 변경 이유와 소스 수용 범위다. SEC·IF·OBS·REC·CON·TX는 아래 전달 영수증의 그룹 이름이며 구현 상태를 뜻하지 않는다. 집중 테스트, 격리 SQL, 합성 브라우저 결과를 원격 CI·실제 Preview 결과와 합산하지 않는다.

| 단위 | 이슈 | 변경 이유와 수정 계약 | 확인 근거와 남은 경계 |
| --- | --- | --- | --- |
| 비밀번호 | #536 | FE가 거부한 공백·개행 입력을 BE가 trim 후 저장하던 차이: 공용 규칙으로 새 비밀번호 원문을 검증하고 거부 시 저장·세션 발급 금지 | SEC: 실제 route의 원문·JSON 타입·유효 입력 회귀. 현재 비밀번호 호환 유지; 원격·Preview 결과는 그룹 영수증으로 판정 |
| 이미지 프록시 | #532, #546 | DNS 대기와 거부 응답 drain이 시간·바이트 상한 밖에 있던 경로: DNS부터 본문까지 단일 마감, 거부 응답 즉시 종료 | SEC: 지연 DNS·본문·초과·종료·타이머 회귀. OS DNS 작업 자체의 취소를 보장하지 않으며 늦은 결과를 안전하게 소비 |
| 파트너 설정 | #540 | 조회 뒤 관리자 비활성화를 완료 쓰기가 되돌리던 경합: active·인증 버전·수정 시각·토큰·만료 CAS | SEC: 중간 상태 변경 fixture에서 쓰기 거부. 관리자 변경을 되돌리거나 유효 기간을 연장하지 않음 |
| 홈 즐겨찾기 | #542, #551 | 필터 재등장·실패 rollback·늦은 hydration이 상태와 집계를 덮던 경로: 상위 상태와 pending snapshot으로 확인된 값·미조회 여부까지 복원 | IF: reducer 회귀와 360/820/1366px 합성 E2E. 실제 외부 쓰기를 검증한 결과가 아님 |
| 요청과 복구 안내 | #545, #551 | 본문 읽기 취소와 네트워크 오류가 일반 오류·안내 tone으로 바뀌던 경로: AbortError 보존, 안전한 메시지와 error/alert 표시 | IF: fetch/본문 취소·HTTP 오류와 복구 화면 회귀. 기존 실패 artifact를 보존하고 수정한 선택자의 재실행 결과를 구분 |
| 기수 파싱 | #547 | 소수·지수·숫자 접두사 문자열을 부분 정수로 수용하던 경로: 전체 십진 정수 표현을 검증 | IF: 공용 파서와 회원·푸시 소비자 회귀. 기존 숫자·앞뒤 공백·앞자리 0 및 도메인별 범위 유지 |
| 오프라인 갱신 | #549 | 새 fallback 확보 실패 뒤 이전 정상 cache를 삭제하던 경로: 새 정상 페이지 확인 뒤 이전 cache 정리 | IF: 실패·복구·후속 갱신의 격리 Chrome 실행과 SW 회귀. API·관리자 데이터 cache 금지 유지; 실제 설치 기기 수용은 별도 |
| 홈페이지 로그 | #543 | 복구 가능한 홈 오류가 공용 정제 규칙을 우회하던 경로: 단일 JSON logger와 기존 자격증명 대입문 정제 공유 | OBS: 오류/cause 정제 회귀, #566 dev 전달 및 Preview 정상 확인. 실제 사용자 오류를 발생시켜 보존·경보를 검증한 것은 아님 |
| Vitals 검증 | #543 | 실제 fetch keepalive를 ping만으로 판정하고 일부 오류를 수신 증거 전에 무시하던 검증기: native 옵션·3개 지표·실제 collector 증가와 관측된 응답의 정상 여부를 확인한 뒤에만 종료 취소 인정 | OBS: 실제 브라우저 관찰 및 합성 fixture, #566 전달. 원래 CLS 1건 누락은 해결로 표시하지 않음 |
| 복구 키 | #554 | 실제 age 키 검증과 실행 별칭이 실제 작업 없이 성공할 수 있던 경로: 실제 형식·합성 복호화, canonical/별칭 진입·stdin import 구분 | REC: 합성 identity·CLI·오류 경로 검증. 실키·실백업·매체·custody·새 장치 복구를 검증한 것이 아님 |
| 제휴 전환 | #539 | 생성 성공 뒤 알림 실패로 재개방되거나 불명 쓰기·정리 실패를 재시도하던 경로: 성공 유지, 확정 실패만 보상, 불확실한 상태는 조정까지 재시도 차단 | CON: 실제 SDK 응답 실패 주입 59건과 action 10건. 외부 provider 및 운영 데이터 조정은 별도 |
| 마케팅 동의 | #534 | 오래된 전체 행 쓰기와 정책 증거 없는 opt-in이 설정·이력을 덮던 경로: 원자 patch와 명시적으로 검토한 정책 ID/버전 확인 | TX: 실제 SQL·route·서비스·구독 writer 회귀. false/생략은 과거 동의 증거를 보존하며 구 RPC의 증거 없는 true는 거부 |
| 프로필 활성화 | #536, #559 | 이전 사진 해제·새 승인·회원 갱신의 부분 실패와 승인/반려 lock 역순: member→image 순서의 원자 전이·rollback | TX: 실제 PostgreSQL 실패 주입·동시 승인/반려·권한·재실행 검증. admin 이후 최신 MM 자동 활성화라는 기존 우선순위 유지 |
| 당첨 안내 | #541 | 결과 기록 실패·중복 요청·불명 provider 응답을 재발송 또는 성공으로 판정하던 경로: 안정 campaign identity·provider claim/CAS·실제 수신/쓰기 증거 | TX: 실제 SDK 응답과 SQL 경합 검증. timeout·불명/레거시 결과는 조정 전 재발송 금지; 실제 외부 발송 수용과 과거 원장 재구성은 별도 |
| 리뷰 이미지 | #536, #542 | 부분 실패·중복·불명 저장 결과의 정리가 성공 요청 파일을 지우던 경로: 최종 파일 즉시 삭제 중단, reference/cleanup lock·정확 claim ack·회전 tombstone | TX: 리뷰/가입/프로필 참조·같은 요청 재시도·늦은 Storage 쓰기·익명화 호환의 실제 SQL/SDK 회귀. Storage 정리는 eventual이며 적체·무한 지연에 절대 삭제 SLA 없음 |

DB 단계는 공유 마이그레이션 소유자를 지정하고 호환성·권한·실제 SQL 테스트를 먼저 확정한다. 적용 파일은 수정하지 않는다. 이번 회귀에서 확인한 동의·사진 활성화·외부 알림 전달·리뷰 이미지 경합은 기존 두 마이그레이션 이후에 발견한 결함이다. D9의 기존 두 파일에 추가로 통합 forward migration 한 파일을 허용한다. 여러 워크트리가 SQL 조각을 제안해도 실제 파일·스냅샷·생성 타입은 소유자 하나가 통합한다. 이전 DB와 새 앱은 안전하게 실패해야 하며 Preview 복사·리허설·스키마 승인 후 앱을 배포한다. 새 동의 함수는 검토한 정책 ID/버전을 요구하고 구 함수의 명시적 true는 증거 없이 새 동의를 만들 수 없도록 거부한다.

## DB 단계의 통합 단위

동의·프로필 활성화·당첨 안내·업로드 수명주기는 같은 forward migration의 함수·트리거 계약에 의존하므로 하나의 검토 가능한 PR로 묶는다. 원래 후보 워크트리는 보존하고 최신 dev에서 별도 통합 워크트리를 만든다. [211개 이력 Preview 갱신 순서](../../operations/runbooks/self-host-environments.md#211개-이력-대상-preview-갱신-순서)에 따라 dev 병합 전에 receiver를 지속 차단하고, 최종 source의 첫 CI 이후 새로운 Production 208개 복사본을 sanitize해 격리 Preview 후보에서 먼저 211개 이력까지 리허설한다. 라이브 전환 직전에는 기존 210개 writer를 재부팅 이후에도 차단하고 전체 복구 쌍을 검증한다. 기존 라이브는 forward DDL 후 검증된 후보 데이터를 가져오며 구 앱 fallback 없이 통합된 새 앱만 기동한다. 정확한 receiver 상태와 실제 수용 검증 이후 원래 작업 상태를 복구한다. 운영 Production 앱·DDL은 이 단계에서 변경하지 않는다.

## 이슈별 대조 범위

| 그룹 | 이슈 | 추가 수용 기준 |
| --- | --- | --- |
| 운영/전달 | #531, #537, #538, #553, #554, #555 | 복구 실행 결함, 정본 문서 갱신, 실제 무참조가 증명된 코드 정리 |
| 보안 | #532, #533, #535, #536, #540, #546 | 위 경계/프로필 결함과 실제 Preview 인증 회귀 |
| 도메인 | #534, #539, #541, #542, #552, #557, #559 | 정합성 결함, Preview 사용자 흐름, 오래된 요구 문구 정리 |
| 성능/관측 | #543, #548, #564 | 로그/검증 결함, exact-SHA 수집/대시보드 확인, CLS 증거 한계 유지 |
| 화면 | #544, #545, #547, #549, #550, #551 | 상태/요청 결함, 키보드·반응형·오프라인 갱신 확인 |

#542의 동의 스냅샷은 현재 정책 종류·버전 조회까지 없애는 계약이 아니다. 요청 내 현재 버전을 확인한 뒤 동의 행과 정책 본문 재조회를 줄이는 경계를 유지한다. #552의 과거 CLS 중단 문구는 현재 LCP/INP/CLS 계약과 맞춘다. 존재하지 않는 funnel 모듈을 새로 구현했다고 기록하지 않는다.

## CLS 증거 경계

앞선 유효 관측과 최초 호출 15건/집계 14건의 원본을 함께 보존한다. 원래 sampled context는 collector 조회까지 살아 있었고 auth→privacy 이동으로 문서가 교체됐으므로, 누락을 조기 profile 종료로 단정할 수 없다. 추가 진단의 edge 도착 29건은 모두 집계됐고, 문서를 유지한 두 번의 숨김 전환에서 6개 지표의 호출과 204를 직접 확인했다. 보존된 edge 순서·시각·길이와 대조한 기존 attempt 28(2026-10-05 13:24:56 UTC 부근)은 조건부 누락 후보이며 확정된 요청이나 원인이 아니다. 개별 요청 대응 증거가 없어 최초 누락 1건의 정확한 취소 원인은 미확정이다. [#543의 정정된 진단 경계](https://github.com/MyKnow/ssartnership/issues/543)와 같은 판정이며, 보존 자료의 설명 정정이지 새 관측이나 원인 해결은 아니다.

종료의 ERR_ABORTED는 이미 204를 확인한 요청에도 있어 그 표시만으로 손실을 계산하지 않는다. fetch 전송을 ping만 허용하는 테스트 판정은 독립적인 검증 결함이다. 판정 수정이나 후속 성공을 원래 실패의 해결 증거로 대체하지 않는다. 표본 확률·익명 세 필드·재시도 없음 계약을 유지한다.

## 단계와 검증

1. 감사: 후보별 위치·실행 경로·테스트 공백·최소 수정·소유 범위를 기록한다. 재현되지 않은 우려는 결함과 구분한다.
2. 독립 구현: 실패 재현 후 집중 테스트, 변경 파일 lint, 타입/문서 검사와 기능 정본 갱신을 수행한다.
3. 데이터 정합성: 실제 SQL의 실패 주입·동시성·권한·호환성을 검사한다. Production 데이터를 비밀번호 제거 후 Preview에 복사하고 테이블/Storage 확인 뒤 마이그레이션을 리허설한다.
4. 순차 통합: 작업별 PR을 dev로 병합한다. verify:change, 필요한 전체 verify:release, exact-SHA 첫 CI/로그, 병합 이미지와 실제 receiver/앱을 별도로 확인한다.
5. 화면 회귀: 360/820/1366px, 위험한 모바일은 320/390px도 확인한다. 실패/대기/취소/복구·키보드·실제 오프라인을 검증한다. QA 캡처는 추적하지 않는 임시 폴더에 둔다.
6. 전달: 수정·PR·테스트·Preview 증거를 기록하며 남은 Production/운영자 경계를 명시한다.

## 검증 계층과 전달 영수증

2026-10-06 KST의 병합 기준 dev는 `662d26d6c435e70f29eeb1b97ac95fa758350200`다. #566~#572는 각 전달 시점의 CI와 실제 Preview readback을 확인했다. #574 보안 수정은 02:05:17 UTC에 병합했고 03:05:44 UTC에 실제 Preview 반영을 별도로 확인했다. #570 첫 Public의 runner 장애·제품 검증 미실행·불완전 canonical 감사는 별도 복구 attempt2 성공과 구분해 보존한다. 최신 dev 기반 TX 후보의 첫 전체 Release와 누적115 E2E는 독립 감사까지 통과했다. TX PR/dev 통합·실제 DB 운영과 최종 문서/이슈 전달은 미완료다. 아래 검증 수는 각 실행의 범위다.

| 그룹 | 로컬·독립 검토 근거 | PR·head 및 첫 원격 CI | dev·Preview 전달 |
| --- | --- | --- | --- |
| OBS: 홈페이지 로그·Vitals 검증 | 집중 47/47, 실제 native fetch 관찰, 최종 로컬 release. 정본은 [관측 runbook](../../operations/runbooks/self-host-observability.md)과 [Vitals 기록](../../performance/measurements/web-vitals.md) | [#566](https://github.com/MyKnow/ssartnership/pull/566), head `e7544f7b`; [첫 PR CI](https://github.com/MyKnow/ssartnership/actions/runs/37342338875/attempts/1)는 standard/Quick 통과이며 원격 E2E 실행은 없음 | dev `5497a962250625f5fcb9ea66c1cfd434c26134ea`. [Public](https://github.com/MyKnow/ssartnership/actions/runs/37344871717/attempts/1)·[image](https://github.com/MyKnow/ssartnership/actions/runs/37344871753/attempts/1) 첫 실행 통과, image gate E2E97. immutable digest `sha256:1646783a84281bc6180e07807f66f3ecf54d42ad2bd08fba1f2cce60a21f575b`, receiver/runtime/DB identity·210 ledger 일치, health/login200 |
| SEC: 비밀번호·프록시·설정 CAS | 실제 route/전송/상태 fixture와 통합 release. OS DNS 작업의 늦은 완료 경계 유지 | [#567](https://github.com/MyKnow/ssartnership/pull/567), head `0a0773d5dbc4dca118526006af0b59078d7f32e6`; [첫 PR CI](https://github.com/MyKnow/ssartnership/actions/runs/37347935575/attempts/1) high release, E2E97 통과 | dev `f866059c0e31186df6360a6ee2f5215d78f35235`. [Public](https://github.com/MyKnow/ssartnership/actions/runs/37350572998/attempts/1)·[image](https://github.com/MyKnow/ssartnership/actions/runs/37350572672/attempts/1) 첫 실행 통과. immutable digest `sha256:862521fd65ba9560c3f5ab8a4bd8b0b5a78fb2e76b08f88bf671f28d860e69df`, receiver/runtime/DB identity·210 ledger 및 health/login200 확인 |
| IF: 즐겨찾기·요청·기수·오프라인 | 집중 72/72, 정정 E2E9·격리 Chrome cache 실패/복구. 최초 중복 alert 선택자 실패6 보존 | [#568](https://github.com/MyKnow/ssartnership/pull/568), head `231a839d9c8e997b9e19566b59873e77c5f21513`; [첫 PR CI](https://github.com/MyKnow/ssartnership/actions/runs/37353702191/attempts/1) Node2655/기존skip8, unit183, E2E106(retry0), 새360/820/1366px9건 통과 | dev `64574c162a7f3da42693a419d2fbd864188927cb`, [첫 Public CI](https://github.com/MyKnow/ssartnership/actions/runs/37355535012/attempts/1) Quick 통과. Public push의 Release/E2E 단계는 정책상 미실행이다. 별도 [첫 image CI](https://github.com/MyKnow/ssartnership/actions/runs/37355534980/attempts/1)의 E2E106(retry0)·발행 manifest와 source hash를 확인했다. app digest `sha256:7ab834a2a029fbfd5ffa5bc0082e61dbe9de7bba6d9bf6a29255551ae1beb61c`. 2026-10-05 18:44:25 UTC에 exact SHA·registry platform digest·receiver/runtime·DB identity/210 checksum·health/login200을 확인했다. 합성 E2E 화면 증거와 실제 Preview 상태 readback을 구분한다 |
| REC: age 및 CLI 진입 | 실제 age 합성 증명, CLI 직접/별칭·오류 경로 검증 및 로컬 canonical Quick. 실키 custody·실복구와 분리 | [#570](https://github.com/MyKnow/ssartnership/pull/570), head `8d69ea86e5889d329c6878c6defb9671eb948b04`. [첫 Public](https://github.com/MyKnow/ssartnership/actions/runs/37363871201/attempts/1)의 runner 장애 실패와 [첫 Cross](https://github.com/MyKnow/ssartnership/actions/runs/37363870927/attempts/1) Windows/macOS 각36/36을 보존. [복구 Public attempt2](https://github.com/MyKnow/ssartnership/actions/runs/37363871201/attempts/2)는 Node2760/기존skip8·unit203·E2E106(retry0), 전체 감사 clean | dev `98c36169cac8b6ddc33794cfec33d9ecb947f403`. [첫 dev Public](https://github.com/MyKnow/ssartnership/actions/runs/37385927724/attempts/1) Quick·[첫 image](https://github.com/MyKnow/ssartnership/actions/runs/37385927713/attempts/1) E2E106(retry0) 통과. 23:18:51 UTC에 digest `sha256:0ac725e8ac4ddd392fbe93e7969b1c5aca5bac1074fac056272b556d44fd85eb`, exact SHA·registry platform digest·receiver/runtime·DB identity/210 checksum·health/login200 확인. 실제 키 custody와 fresh211 실행 증거는 아님 |
| CON: 제휴 전환 | SDK 실패 주입·action 회귀와 최종 로컬 Quick. 성공 보존·불명 저장·cleanup 실패의 재시도 차단 독립 검토 | [#569](https://github.com/MyKnow/ssartnership/pull/569), head `a31c8ca18a7c4478eac69f68d6edcbbe5b58064b`; [첫 PR CI](https://github.com/MyKnow/ssartnership/actions/runs/37358850451/attempts/1) Node2749/기존skip8, unit203, E2E106(retry0) 통과 | dev `a5591821e09d5e4990cc4d2781394f3e74a28231`. [첫 Public](https://github.com/MyKnow/ssartnership/actions/runs/37360593461/attempts/1) Quick·[첫 image](https://github.com/MyKnow/ssartnership/actions/runs/37360593424/attempts/1) E2E106 통과. 19:26:28 UTC에 digest `sha256:c0d506908ab3c5b79e29c42a69646ee9e7031d82b75d6d4ba0d6581e6281a812`, exact SHA·receiver/runtime·DB identity/210 checksum·health/login200 확인. 실제 제공자 실패/운영 데이터 조정 증거와 분리 |
| TX: 동의·사진·당첨·업로드 | migration211 격리 replay, 공식 타입112테이블/1398컬럼2회 일치, 실제 SQL38/38. SDK 빈 응답·정확 ID·중복/불명 저장 회귀와 독립 검토. 아래 보존 실패 및 운영 입력 경계 적용 | dev `662d26d6` 기반 별도 후보의 첫 전체 Release: 2026-10-06 02:10:23–02:13:34 UTC, Node2793/기존skip9·unit269/42파일·lint오류0/기존경고49·두 build·E2E115/115(retry0, flaky0, skip0), 독립 감사 통과. 전체 로그 SHA256 `3d9f0aa55016c3d38b324df66c56235659fea4cbe7ad791f22b994a3cfb1853d`, 검증된72파일 manifest `72b80fd2f4677859935ab8d7d2d20e8882dacf54fd7e0b555eec75faa8e9bd7e`. 앞선 실패와 준비 오류는 별도 보존한다. 로컬 mock 검증이며 실제 DB/Preview 수용을 대신하지 않는다 | fresh source208 복사·211 리허설·live210→211·새 앱/화면 수용 미실행. 아래 실제 운영 입력·순서·수용 증거를 갖춘 뒤에만 진행 |
| RET: 폐기 공급자 참조 검증 | 최초8후보에서 빠진 D3 추가 배정. 파일 전체 예외·미사용 VERCEL 항목 제거, 최소 deployment stop 정합. 외부 계정·키 삭제와 분리 | [#572](https://github.com/MyKnow/ssartnership/pull/572), head `1f81ace20030d14443f7f80a82e79b615c0911e9`. [첫 Public](https://github.com/MyKnow/ssartnership/actions/runs/37392127141/attempts/1) Node2759/기존skip8·unit203·E2E106(retry0), [첫 Cross](https://github.com/MyKnow/ssartnership/actions/runs/37392126830/attempts/1) Windows/macOS 각36/36. 전체 감사 clean | 2026-10-06 00:20:04 UTC dev `e30a0f153e629666e3a22b4ee4fd5a1d7eefd16e` 병합. [첫 dev Public](https://github.com/MyKnow/ssartnership/actions/runs/37393449838/attempts/1) 감사 clean. [첫 image](https://github.com/MyKnow/ssartnership/actions/runs/37393452292/attempts/1) E2E106(retry0)·전체 감사 clean. 2026-10-06 01:18:44 UTC에 digest `sha256:953f66217bef28d6c8a3f3f06b0ee707416cc9188098bdf9028de08d7c71975e`, exact SHA·registry platform·receiver/runtime·DB identity/210 checksum·health/login200 확인 |
| DEAD: 무참조 provisioning 정리 | 호출 없는 두 파일/전용 테스트 제거, 활성 import 계약 유지. bucket의 도메인 소유와 재개 조건 기록 | [#571](https://github.com/MyKnow/ssartnership/pull/571), head `56ca20ca8d15d563127be4413ddf9b49154d78f3`. [첫 PR Public](https://github.com/MyKnow/ssartnership/actions/runs/37388555196/attempts/1) Node2759/기존skip8·unit203·E2E106(retry0), 전체 감사 clean | dev `ad7632dd6bc0a0d7170fa3513031af72f4612ff2`. [첫 dev Public](https://github.com/MyKnow/ssartnership/actions/runs/37389832247/attempts/1) Quick·[첫 image](https://github.com/MyKnow/ssartnership/actions/runs/37389832021/attempts/1) E2E106(retry0) 통과. 23:59:24 UTC에 digest `sha256:b530dff8c0f092a5e9c42fdf002beb2923c9e10c42e3691da1403dd1ab67fccc`, exact SHA·registry platform digest·receiver/runtime·DB identity/210 checksum·health/login200 확인 |
| DOC: 전체 작업 기록 | 비 Wallet29개 수용 대조, 15개 추가 계약과 기존 RF 기록 통합. 초기 누락 배정·첫 실패·CLS 정확 원인 한계 보존 | #542 두 문구·#552 네 문구 정정은 2026-10-06 00:08 UTC 원격 반영/readback 완료, 두 Issue는 open. #543 CLS 설명도 정정됨 | 네 정본문서는 최신 dev 기반 TX 후보에 적용했고 최종 delivery 절은 미적용이다. 이미 반영한 여섯 static 교체를 반복하지 않음. 최종 기록/이슈 동기화: `{{FINAL_DOC_ISSUE_SYNC_EVIDENCE}}` |

OBS 라이브 readback은 2026-10-05 17:15:41 UTC, SEC는 18:02:34 UTC, IF는 18:44:25 UTC, CON은 19:26:28 UTC, REC는 23:18:51 UTC, DEAD는 23:59:24 UTC, RET는 2026-10-06 01:18:44 UTC의 시점 증거다. 이후 dev와 다른 후보의 배포를 증명하지 않는다. TX의 최종 PR/첫 CI/merge SHA/immutable image/receiver/Preview 수용은 `{{REMAINING_DEV_PREVIEW_DELIVERY_EVIDENCE}}`에 묶음별로 기록한다. 원격·라이브 단계가 없는 문서 전용 변경은 실제 정책 분류를 적는다. 새 화면은 해당 변경과 viewport 증거를 연결하고, 기존 캡처를 재사용할 때에는 대상 코드의 불변 근거를 남긴다.

### 첫 실패와 정정의 이력

- #572 dev image 감시 CLI는 exit1이었지만 exact attempt1 API와 전체 로그·annotation은 성공이었다. stderr 내용을 보존하지 않아 CLI 종료의 직접 원인은 미확정이다. 후속 조회의 자동 승인 검토 시간 초과는 실행 전 실패였으며 허용된 한 번의 조회 재시도로 상태를 확인했다. workflow를 재실행하지 않았다. 관측 도구 실패와 실제 CI 실패를 구분한다.

- #570의 첫 Public 실패는 hosted runner를 903초 동안 배정받지 못한 classify job에서 시작했다. API conclusion은 `cancelled`, 실제 policy 입력은 `abandoned`였고 기존 non-success 조건이 `classification_failed`로 안전하게 거부했다. attempt1의 Node/unit/lint/build/E2E는 미실행이다. 원래 canonical audit는 aggregate run log 미확보로 `auditComplete=false`를 유지하며, 실행된 policy job 전체220줄과 terminal annotation의 보충 검토를 별도 기록한다. 후속 Public attempt2는 같은 head에서 전체 실행·로그 감사 clean을 확인했고, 병합 dev의 첫 Public/image와 실제 Preview까지 별도로 확인했다. 이 성공으로 attempt1을 완전한 canonical audit나 제품 검증 성공으로 바꾸지 않는다.
- IF의 최초 E2E는 중복 alert 선택자6건에서 실패했다. 선택자 정정 뒤9건, 이후 #568 PR의 전체106건을 확인했다. 첫 실패 artifact를 삭제하거나 처음부터 성공했다고 기록하지 않는다.
- TX 첫 전체 Release는 Node2674 pass/2 fail/9 skip에서 멈췄다. 오래된 profile 직접쓰기 단언과 새 schema section 표제의 delimiter를 정정했으며 SQL 본문·생성 타입은 바꾸지 않았다. 두 번째 전체 Release는 Node2676/기존skip9, unit222와 두 build 통과 후 E2E97 pass/9 setup401로 실패했다. 호스트 불일치 정정 후 실제 production fixture의 집중9/9(retry0)를 확인했다. 당시 최종 누적115건은 별도 실행·로그 검토가 남아 있었으며, 이후 통과 결과는 위 TX 영수증에 기록한다.
- 추가 full-schema probe의 첫 경합 실패는 오래된 `pg_stat_activity` 관찰에서 실제 B backend PID/`pg_blocking_pids`로 검증을 고쳐 재실행했다. 원래 실패와 corrected 합성 성공을 모두 남겼으며 fresh 운영 복사 결과로 바꾸지 않는다.
- #566의 high/Release 예상은 실제 standard/Quick 정책과 달라 정정했다. #567의 unit/worker 출력 형식과 #568의 test-root 경로 차이에 대한 로컬 감사 parser 보완도 원본 부족 증거를 보존한다. 이들은 원격 CI 재시도나 제품 실패가 아니며 실제 TX/IF 실패와 구분한다.

## 데이터 적용과 남은 운영 경계

TX의 추가 파일은 `20261006010931_fence_consent_profile_delivery_and_upload_transitions.sql` 한 개다. 격리 replay·schema tail·공식 생성 타입 검증은 실제 Preview 적용 결과가 아니다. 적용 순서는 위 DB 통합 단위와 [211개 이력 Preview 갱신 순서](../../operations/runbooks/self-host-environments.md#211개-이력-대상-preview-갱신-순서)가 정본이다. 구 writer drain·지속 fence, live forward DDL 후 검증 데이터/Storage import, 구 앱 fallback 금지와 원래 작업 복원·receiver 마지막 순서를 유지한다. 외부 알림 결과가 불확실하면 provider의 긍정 증거와 원장을 대조한 뒤 운영자가 조정하며 자동 재발송으로 복구하지 않는다.

### 211 운영 준비와 데이터 출처

기존 격리211 전체 replay·SQL38건과 후속 full-schema 합성 probe의49개 명시적 assertion 지점·9개 경합은 실행된 로컬 근거다. assertion 지점 수는 반복 실행되는 ACL 검사까지 합친 총 assertion 수가 아니다. 독립 검토는 clone guard·QA 전용 쓰기·rollback·권한·실패 보존을 확인했지만 실제 fresh Production 복사가 있었다는 의미는 아니다.

운영 준비안은 source208의 승인된 online backup과 선택된 Storage를 quarantine clone에서 검증하고 회원 비밀번호 hash·salt와 legacy avatar 자료를 제거한 뒤, 새 Preview 전용 candidate211에서 리허설하고 기존 live210에 forward211와 public/선택 Storage를 적용하는 순서다. 이름·사진 등 개인정보는 보존되므로 사본도 개인정보 보호 대상이다. source manifest·sanitizer·dump/Storage hash·import·copied-data probe를 같은 실제 자료 계보로 연결해야 한다. 합성 seed의 성공을 이 단계에 재사용하지 않는다. 기존 live Preview의 identity·키·network를 candidate 것으로 덮어쓰지 않는다.

첫 operator 동결본의 독립 검토는 사전 receiver 중지가 미래211 archive에 의존하는 순환, psql 출력 구분자와 exposure parser 불일치, 재부팅/구 이미지 rollback 뒤 구210 writer가 재개할 수 있는 P1 세 건을 실행 전에 확인했다. v2는 current210 사전 fence와 final211 source pin을 분리하고 실제 TAB parser·지속 조건·원래 상태 복구를 연결했다. 순수48건과 독립 운영/보안 검토가 통과했으며 원본 결함·red 증거를 보존한다. 실제 재부팅·복사·DB 적용을 검증한 결과는 아니다.

별도 runner-v2는 fsync 실패 뒤 성공처럼 보이는 finish가 남거나 게시 중 reader가 성공을 읽던 P2를 보완했다. private staging의 file fsync·exclusive 게시·directory fsync와 reader lock을 함께 검증했고, 독립23건 및 실제 함수 failure injection·transfer 소비 검토를 통과했다. 두 template의 초기 stale script pin도 보존 후 정정했다. 소비 순서는 `runner read: succeeded → 완료 finish/source manifest의 새 hash 확인 → transfer`이며 동시 transfer나 미리 추정한 hash는 허용하지 않는다. unlink가 동작하는 관측된 fsync 실패 범위이며 급작스러운 종료·저장장치 오류는 별도 상태 대조가 필요하다.

2026-10-05 19:57:50 UTC 비공개 installation receipt는 검토한 operator-v2/runner-v2/transfer의 코드 파일 배치만 확인한다. operator phase 실행0·DB 변경0·service 변경0이다. 실행 승인 입력과 실제 source/host/config pin, premerge fence, fresh 복사·probe는 이 파일 배치로 완료되지 않는다. 20:09:56 UTC에는 Preview에 fresh-probe 코드11개를 추가 배치하고 기존48개 파일 hash 보존을 확인했다. 이 영수증도 operator phase0·DB0·service0이며 fresh 복사나 probe 실행 결과는 아니다. 23:54:40 UTC에는 정적으로 검토한 읽기 전용 binding collector 코드3개를 Preview에 추가 배치하고 기존59개 hash를 보존해 총62개가 됐다. 당시 collector 실행은 false이고 operator phase·DB·service 변경은 모두0이다. 이 배치는 binding 수집 결과, 완전한 writer 목록, credential 확인, 실행 승인이나 지속 fence 증거가 아니다. 후속 v2는 실제 data mount 부모의 env 경로를 요구하도록 수정해 원래 경로 거부/다른 부모 허용 회귀를 재현하고 순수7건 및 독립 보안 검토를 통과했다. 원본62개 파일을 유지하며 v2 코드4개를 추가 배치했고, 이후 현재 e30/210 binding 초안 수집은 성공했다. 승인·writer 검토 플래그는 false이며 credential 검증·지속 fence·operator phase·DB/서비스 변경은 여전히 미실행이다.

fresh 복사·candidate 리허설·copied-data 단일/경합 probe·원래210 recovery pair 검증·live 적용·schema approval·새 앱·최종 사용자 흐름은 `{{TX_FRESH_COPY_REHEARSAL_AND_LIVE_EVIDENCE}}`가 남아 있다. Production은 승인된 online backup 원본으로만 읽으며 앱·DDL 승격을 포함하지 않는다. 실패 시 영속 fence를 유지하고,211 승인 뒤 구210 앱을 자동 재가동하지 않는다.


- Production 앱·DDL·privacy v4·main 승격은 이번 전달 범위 밖이다. 과거 17명 이름 정리의 당시 증거를 현재 상태로 확대하지 않으며, Production의 옛 동기화 코드와 관련된 재오염 가능성은 승격 시 재확인한다.
- #537의 저장소 참조 정리와 외부 Vercel/Supabase 프로젝트·GitHub secret·Cloud key 폐기는 별도다. 현재 main의 참조와 계정 권한 확인 전 외부 삭제를 완료로 기록하지 않는다. `vercel.json`의 최소 `git.deploymentEnabled=false`는 자동 배포 중지 장치로 유지한다.
- #554의 실제 암호화 매체·recipient·custody 결정과 봉인·인계·새 장치 DB/Storage 복구는 미완료다. 합성 키 테스트를 실키 보관이나 실제 백업 복구로 대체하지 않는다. 공개 기록에는 키·보관 위치·내부 주소를 남기지 않는다.
- 공용 관측 적용과 실제 51개 Grafana 패널·반응형 검증은 기존 #564/#565 증거다. 독립 장애 영역 HTTPS 감시 계정·실패/회복 통지 시험은 별도이며 증거 전 `configured=true`로 선언하지 않는다. 1주 별칭 관찰·2주 임계값 평가·15기 종료/보존 결정은 기간 또는 운영자 결정이 필요하다.
- 업로드 정리는 Storage와 PostgreSQL을 한 transaction으로 만들지 않는다. provider 작업이 끝나고 성공한 sweep가 tombstone을 다시 방문해야 정리가 수렴한다. 적체가 재방문을 늦출 수 있고 원장이 유지되는 동안 정리 작업이 계속된다. 리뷰의 원래 2시간 업로드 만료와 attached non-review 보존은 유지한다.
- 최초 Vitals 15/14, 후속 edge/collector 29/29, 유지된 두 문서의 hidden 전송 6/6은 각각 다른 관측이다. 최초 CLS 단건의 정확한 취소 원인은 당시 추적 부재로 미확정이며 검증기 수정·후속 성공으로 해결 처리하지 않는다. 익명 세 필드·표본 확률·재시도 없음·best-effort 계약을 유지한다.

Wallet #301/#302/#319는 계속 제외한다. Issue 종료는 dev·Preview 확인과 Production 승격 또는 명시적 Preview-only 수락 기준을 따르며, 이번 dev 전달만으로 일괄 종료하지 않는다. 현재 계획은 위 미완료 영수증이 남아 있어 active로 유지한다.

## 의존성 보안 후속 #573

2026-10-06 통합 후보의 첫 Release 검사는 `source-map-js@1.2.1`의 높은 심각도 권고 [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)로 중단됐다. Node 2,792건과 unit 269건은 통과했고, 기존 macOS skip 9건이 있었으며 build와 E2E는 시작되지 않았다. 이전 성공과 동일한 lockfile에서도 새 권고가 검증을 차단할 수 있으므로 기존 결과로 현재 dependency audit를 대신하지 않는다. 이 결과는 실제 서비스가 공격받았다는 증거가 아니다.

[#573](https://github.com/MyKnow/ssartnership/issues/573)은 공식 수정 버전 1.2.2의 보안 경계와 lockfile을 별도 PR로 dev에 먼저 반영한다. 원래 통합 후보 72개 파일과 실패 기록을 보존하고 격리된 trusted install, 정책 회귀, 전체 Release, 첫 CI와 실제 Preview를 검증한다. 보안 감사 예외는 추가하지 않으며 transaction·마이그레이션 작업은 별도 PR로 유지한다. 해당 교정의 검증·전달이 끝나기 전 새 DB 적용과 배포를 진행하지 않는다.

제한적 소스 검토에서 외부 앱 입력을 해당 Consumer에 직접 전달하는 경로는 확인하지 못했다. `magicast`의 배포 번들에는 이전 Consumer 코드가 내장돼 있으며 최상위 override로 그 바이트까지 교체되지는 않는다. 확인된 사용은 Vitest coverage의 로컬 설정 처리 경로다. 이 검토는 전체 비노출 보장이나 감사 예외의 근거가 아니며, 수정의 수용 범위는 잠금 의존성의 공식 패치와 실제 빌드·검증 결과다.

교정 후보의 첫 전체 Release는 로컬에서 통과했다: Node 2,759건과 기존 skip 9건, unit 203건, 두 Production 방식 빌드, E2E 106건 각각 1회 성공·재시도 0. 집중 정책 6건과 격리 trusted install·canonical lockfile·보안 감사도 통과했다. 전체 로그 독립 검토와 문서 124개·루트 지식 7개 검사를 마쳤으며, 원격 첫 CI와 실제 Preview 수용은 이후 별도 증거로 확정한다.

보안 수정 PR [#574](https://github.com/MyKnow/ssartnership/pull/574)의 첫 Public/Cross 검사가 모두 통과해 2026-10-06 02:05:17 UTC에 dev `662d26d6c435e70f29eeb1b97ac95fa758350200`으로 병합됐다. dev 후속 Public `37402424956`과 Images `37402425006`의 첫 실행이 통과했고 artifact/source/세 이미지 무결성을 확인했다. optional post-job 캐시 경쟁1건은 기존 비차단 템플릿·stage/count와 일치해 원장에 기록했다. 2026-10-06 03:05:44 UTC 실제 Preview에서 SHA `662d26d6`, run `37402425006` attempt1, app digest `sha256:0a46345f80c8b916bb07a682a32180f4c557f8648795176b49ca201ab10a6ae7`, receiver manifest/source·건강 상태·기존 DB identity·전체210 ledger checksum·root approval·health/login200을 확인했다. 이 dev와 검토한 PR의 트리 동일성을 확인한 후 원본 72개 통합 후보를 별도 로컬 경로로 옮겼다. 두 문서 기록을 모두 보존했고 나머지 70개 파일과 마이그레이션·스키마·타입·E2E 명세의 해시는 그대로다. 로컬 통합 검증과 실제 DB 적용은 구분한다.
