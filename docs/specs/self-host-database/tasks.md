---
title: 자체 호스팅 데이터와 운영 복구 작업 목록
type: task-list
status: active
authority: normative
---

# 데이터와 운영 복구 작업 목록

상위 작업은 [Issue #435](https://github.com/MyKnow/ssartnership/issues/435)와 [마이그레이션 작업 목록](../self-hosting/tasks.md)이다. 코드 준비와 실제 실행 완료를 구분한다.

## 로컬 선행 작업

- [x] 최신 `dev` 기준 DB·Storage·Cloud 운영 기능 사용처 확인과 [계약](./spec.md) 작성.
- [x] 공식 PostgreSQL/Storage에서 199개 기존 migration 사전 재생 확인. 순서상 Storage 초기화가 app migration보다 먼저 필요하다.
- [x] 데이터 Compose, 난수 비밀 생성, checksum migration ledger, schema-first Preview CLI 구현과 집중 테스트 7개 통과.
- [x] 공개 URL/내부 SDK transport 10개 및 fail-closed runtime·앱 전용 비밀·컨테이너 구조 13개 집중 테스트 통과.
- [x] pgBackRest/WAL·Restic·paired manifest·상태·격리 복구 도구 구현과 집중 테스트 15개 통과. DB 7개·Cron 7개를 합쳐 자체 호스팅 집중 테스트 총 52개다.
- [x] 실제 worktree에서 빈 볼륨 초기화, migration 재실행·checksum drift 거절, RPC·권한·Storage 파일·DB 재생성 후 지속성 확인.
- [x] 전체/증분 백업과 새 대상 named/time PITR 복원, 전후 marker와 복원 파일 hash 검증. 실패/노후 상태·현재 archive 설정·부분 stop·보존 정책은 집중 테스트로 확인.
- [x] 앱과 DB의 통합 Docker 실행, 이미지·서명 URL, 저장소 Release gate 검증.
- [x] 별도 `ssartnership-preview`에 199개 migration과 smoke 적용 후 종료; `ssartnership-local` 앱 health 200 유지.

2026-09-06 Docker Desktop의 synthetic 실행 증거: 전체 backup `20260906-091109F`, 증분 backup `20260906-091109F_20260906-092131I`, 짝지은 Restic snapshot `fd4ae51b4ac65f64c53724e04704cb1cda7e20e214dc5359c43ec9808af33a9d`. named 복구와 앞선 증분의 `2026-09-06 09:13:11+00:00` 시간 복구를 새 no-network 볼륨에서 검증했다. 복원 DB에는 before marker만 존재하고 after marker는 없으며 복원 Storage hash가 일치했다. 전체/증분 백업·복구 audit는 로컬의 Git 제외 `operations-state/backup-manifest.jsonl`에 남긴다. 원본 회원 데이터는 반입하지 않았다.

첫 시간 복구의 ISO `T...Z` 설정 오류를 PostgreSQL 설정용 UTC 형식으로 고쳤고 실패 기록도 보존했다. 현재 실제 `status`는 archive 설정·최근 백업·검사·복구 모두 정상으로 보고했다. 이는 실행 당시의 로컬 상태이며 운영 서비스 보장이 아니다.

## 2026-09-07 추가 구현과 관측 증거

- [x] 기반 56개 파일을 `b95c894b`에 커밋. 원본 worktree의 별도 인증 작업은 보존했다.
- [x] operations 잠금을 async 작업 종료까지 유지하도록 수정하고 경쟁 실행 거절 회귀 테스트 추가.
- [x] TLS·인증·append-only REST 백업 수신 fixture, 별도 암호화 외부 사본, 전체 읽기 검사와 새 볼륨 복구 구현. 인증 거절·신뢰되지 않은 CA·삭제 거절·용량 초과를 실제 Docker로 시험했다.
- [x] 외부 사본 `f6ba89b6075798b69e10614508a7d570cb0c7eba4772e4523ef34919bcd21dc7`에서 DB/Storage 저장소를 새 볼륨으로 되살리고 격리 PITR/파일 hash 재검증. 같은 Docker 장치의 fixture이며 독립 장애 영역의 백업 증거는 아니다.
- [x] Prometheus·Alertmanager·Grafana와 5개 scrape target, pg_monitor 최소 권한 계정, 운영 textfile 지표·12개 알림 규칙 구현. Grafana 익명 API 401, provisioned dashboard 10개 panel 확인. TLS 알림 fixture에서 firing/resolved 수신 확인; 실제 외부 운영자 수신은 미완료.
- [x] 자체 Web Vitals의 origin·크기·빈도·유한 route 분류·DNT·샘플링 및 식별자 없는 histogram 구현. 실제 Docker 앱의 360/820/1366px 로그인 화면에서 LCP/INP/CLS 수신, 콘솔 오류 0, 가로 넘침 없음 확인. Next prefetch 취소 4/4/3건과 수신 입증 후 종료 beacon 취소 각 2건은 별도 계수했다.
- [x] standalone의 내부 origin 때문에 기존 제품 이벤트가 403이 된 문제를 고정 공개 origin 검증으로 수정. 전달된 Host/forwarded header를 신뢰하지 않는 회귀 테스트 포함.
- [x] 추가 코드의 로컬 Release 실행 종료 코드 0, E2E 103/103·retry 0. 출력 일부가 도구에서 잘려 전체 로그 감사 증거로 사용하지 않는다. 기존 between-test Fast Refresh 외 시작 시 1회 추가 신호를 보존하고 다음 CI 검증에서 재관찰한다.
- [x] 서버 접근 창과 rootless CI 제약을 읽기 확인하고 프로젝트 전용 Node 24.18.1 바이너리만 설치. 아직 서버 앱 배포 증거는 없다.

추가 집중 검증은 `tests/self-host-*.test.mts` 53/53 및 Web Vitals route 단위 4/4다. 기존 provider transport의 별도 테스트는 이 glob 개수에 포함하지 않는다. 빈 DB 초기 seed가 가리키는 기존 banner SVG 2개가 현재 저장소에 없어 홈페이지의 해당 이미지는 별도 해결/데이터 전환 게이트다. 적용된 migration을 수정하거나 운영 데이터를 반입하여 숨기지 않았다.

## 남은 전환 게이트

- [ ] 운영 DB 크기·확장·권한·Storage 객체 수와 hash 목록 조사, 운영 데이터 반입 범위 확정.
- [ ] 독립 장애 영역의 암호화 백업 저장소 연결, 보관·삭제 정책·잔여 용량 및 쓰기 실패 검증.
- [ ] 서버 밖의 복구 키 보관과 새 장치에서 키를 가져오는 복구 실습.
- [ ] scheduler 설치, 백업 실패/나이/WAL 지연·디스크/서비스 장애 알림의 외부 수신 확인.
- [ ] Vercel Analytics·SpeedInsights 대체: 자체 RUM/Web Vitals·요청 지연·오류·가용성 수집과 대시보드/외부 알림 검증. 기존 내부 제품 이벤트/SQL 지표와 backup-status만으로 완료하지 않는다.
- [ ] 8GB 서버의 runtime·빌드·백업·복원 자원 측정과 동시 실행 제한; RPO/RTO 확정.
- [ ] 별도 rootless CI, 검증된 image archive/digest 승격·rollback, Preview lifecycle와 배포 권한 연결. 상시 registry는 현재 기본 구성에서 제외한다.
- [ ] 운영 데이터와 파일을 새 환경에 복원하고 회원/관리자/파트너 인증·업로드·실제 연동 검증.
- [ ] DNS/HTTPS·신뢰 proxy·Cron 단일 소유권을 전환하고 되돌리기 기준 확인.

홈 서버 접근과 프로젝트 Node 설치는 확인했지만 운영 provider·도메인·데이터 전환 및 외부 운영자 알림은 실행하지 않았다. 전환 게이트가 남아 있는 동안 자체 운영 마이그레이션 완료로 표시하지 않는다.
