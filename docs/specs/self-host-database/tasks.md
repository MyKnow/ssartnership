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

## 서버 접근 후 전환 게이트

- [ ] 운영 DB 크기·확장·권한·Storage 객체 수와 hash 목록 조사, 운영 데이터 반입 범위 확정.
- [ ] 독립 장애 영역의 암호화 백업 저장소 연결, 보관·삭제 정책·잔여 용량 및 쓰기 실패 검증.
- [ ] 서버 밖의 복구 키 보관과 새 장치에서 키를 가져오는 복구 실습.
- [ ] scheduler 설치, 백업 실패/나이/WAL 지연·디스크/서비스 장애 알림의 외부 수신 확인.
- [ ] Vercel Analytics·SpeedInsights 대체: 자체 RUM/Web Vitals·요청 지연·오류·가용성 수집과 대시보드/외부 알림 검증. 기존 내부 제품 이벤트/SQL 지표와 backup-status만으로 완료하지 않는다.
- [ ] 8GB 서버의 runtime·빌드·백업·복원 자원 측정과 동시 실행 제한; RPO/RTO 확정.
- [ ] 별도 CI runner, image registry, digest 승격/rollback, Preview lifecycle와 배포 권한 연결.
- [ ] 운영 데이터와 파일을 새 환경에 복원하고 회원/관리자/파트너 인증·업로드·실제 연동 검증.
- [ ] DNS/HTTPS·신뢰 proxy·Cron 단일 소유권을 전환하고 되돌리기 기준 확인.

실제 홈 서버·운영 provider·외부 알림은 현재 접근하지 않았다. 전환 게이트가 남아 있는 동안 자체 운영 마이그레이션 완료로 표시하지 않는다.
