---
title: 백업 잠금·사본 확인과 Preview 정기 수신 복구
type: exec-plan
status: active
authority: normative
---

# 백업 잠금·사본 확인과 Preview 정기 수신 복구

[Issue #614](https://github.com/MyKnow/ssartnership/issues/614)의 사용자 요청은 확인된 백업 잠금 충돌 수정, Preview 정기 배포 확인 정상화, Mac 사본 확인 정보 후퇴의 재현과 수정이다. 기준은 `origin/dev`의 `133ae485813517ab2bf2840545807c5fb86ea46b`이며 원본 작업 폴더의 변경은 보존한다.

## 범위와 불변조건

- 백업은 기존 공유 exclusive heavy 잠금 안에서만 실행한다. 짧은 경합에 최대 300초 기다리며 시간 초과는 실패로 유지한다. 기존 전체 실행 시간·자원 한도와 6시간 주기는 유지한다.
- Mac은 전체 검증을 마친 뒤 최신 사본만 ACK한다. 서버는 동시 ACK를 직렬화하고 최신 복구 지점을 후퇴시키지 않는다. 같은 최신 사본의 재확인은 수신 heartbeat를 갱신한다.
- 기존 SSH 전용 계정·허용 명령·source 제한·호스트 핀과 Mac/PVE 채널 분리를 유지한다. 비밀이나 원문 오류를 로그에 추가하지 않는다.
- Preview 정기 확인 재개는 현재 head의 artifact·실제 앱·schema 이력과 승인 일치 및 fence 해제를 먼저 확인한다. 기존 안전장치나 승인 파일을 우회하지 않는다.
- Production 앱·DB·데이터·스키마·DNS는 변경하지 않는다. 운영 ACK에 오래된 사본을 고의로 주입하지 않고 격리 파일로 결함을 재현한다.

## 구현과 전달

1. 잠금 경합과 최신 ACK 후퇴의 실패하는 회귀를 먼저 기록한다.
2. 백업 unit과 online drop-in의 제한된 대기, ACK helper·서버 handler·Mac client를 수정한다.
3. 집중 테스트와 독립 정합성 검토 뒤 root 소유 버전 경로에 설치한다. 이전 파일·단위·forced command 경로를 보관하고 hash로 설치 바이트를 대조한다.
4. Preview timer를 재개하고 필요한 초기 수동 확인과 서로 다른 자연 예약 실행 두 번을 구분한다.
5. 실제 온라인 백업·PVE 수신·Mac 수신과 최신 확인 정보, 공개 health와 경보 해소를 각각 확인한다.

소스 변경은 typed `fix/*`에서 검증하고, 원격 발행 시 독립 검토 가능한 잠금 정책과 ACK 계약을 구분한다. `dev` 통합·Preview 검증과 `main` 승격은 저장소의 정상 브랜치 절차를 따른다. 버전 경로의 운영 설정 적용과 Git 원격 발행을 같은 증거로 보고하지 않는다. Issue는 요구된 병합·승격 조건 전에 닫지 않는다.

## 검증 상태

- [x] Issue 및 범위·복귀 계획 등록
- [x] 백업 경합 즉시 실패와 ACK 후퇴 red → green 재현
- [x] 백업 unit 구문, Linux 격리 잠금 대기·단일 실행·시간 초과 검증
- [x] ACK 동시성·오래된 요청·같은 사본 heartbeat·손상·symlink·강제 종료 회귀
- [x] Linux 실제 handler와 전용 계정의 격리 회귀
- [x] Mac 및 서버 설치 바이트·실제 수신 확인
- [x] Preview 초기 확인과 자연 예약 실행 두 번, 경보 해소
- [x] 실제 예약 백업 성공·PVE 수신·Mac 사본 확인
- [x] 집중 검사·문서 검사·변경 위험 등급 게이트 및 최종 diff 검토

## 적용 및 검증 기록

2026-10-18 KST 기준 Production unit에 300초 잠금 대기를 적용했다. `systemd-analyze verify`와 격리한 Linux 실제 `flock`의 대기 후 단일 실행·시간 초과 75를 확인했다. 전체 실행 시간 30분, 공유 잠금 경로와 기존 capture 경로는 유지했다.

Linux UID 999의 실제 handler 격리 시험에서 기존 handler는 최신 → 과거 ACK 순서에 최신 정보를 후퇴시켰고, 수정본은 최신 정보를 유지했다. 같은 사본 heartbeat 갱신, PVE 채널 독립, 잘못된 hash 거부도 확인했다. Production ACK에 시험 데이터를 쓰지 않았다. Linux의 백업 집중 테스트도 28건 모두 통과했으며 skip은 없었다.

14:52 서버의 버전 경로 `/opt/ssartnership/ops-614-20261018/`에 검증한 파일을 설치했다. SSH forced command의 handler 경로만 바꾸고 전체 설정 검사 후 reload했다. 기존 접근 제한을 바이트 비교로 확인했으며 복귀 파일은 root 전용 경로에 보관했다. Mac은 이전 설치 파일을 private 경로에 보관한 뒤 helper·공용 계약·client를 설치했다. 기존 Mac 계약은 이전 버전이어서 새 helper가 요구하는 공용 함수를 함께 설치했다. 키·호스트 핀·LaunchAgent는 유지했다.

설치 바이트의 SHA-256 앞 12자리는 helper `f040d58d70c5`, server `39de425b30a6`, client `c9dfc0864bf7`, 공용 계약 `55fc8649fe10`이다. Mac의 14:53 실제 재검증은 `healthy=true`, 보관 사본 30개, 최신 복구 시점 09:00을 보고했고 서버 Mac ACK도 같은 ID·hash로 확인됐다.

Preview는 기존 schema 승인·fence 조건과 현재 artifact를 확인한 뒤 timer를 enabled로 복구했다. 14:47 초기 수동 확인과 14:52:41·14:58:10의 서로 다른 자연 예약 확인은 모두 `unchanged`, exit 0이었다. 성공 지표가 실제 실행 시각으로 갱신됐으며 중앙 Prometheus의 firing·pending 경보는 0건이었다.

실제 15시 예약 백업은 15:00:47 시작, 15:01:29 성공 종료했다. 새 사본 `7a130537-0dae-41b0-bf15-71bfa4224e0b`의 크기는 82,011,896 bytes, SHA-256은 `7ca695d3be1957c23706460545fb0b9feb4f5d0d59fbbecf3a693e3670954219`다. 15:02 PVE·Mac 모두 같은 암호문을 수신해 직접 재해시했고 서버의 양쪽 ACK가 같은 ID·hash·생성 시각으로 갱신됐다. PVE의 15시 자연 확인은 이전 사본 heartbeat를 정상 갱신했으며, 백업 완료 뒤 추가 수신 한 번으로 새 사본까지 검증했다. 앱·DB의 컨테이너 ID·시작 시각과 healthy 상태가 백업 전후 동일했고 공개 상태 확인·로그인 페이지도 HTTP 200이었다. 다음 백업 예약은 21시로 유지된다.

독립 소스 검토에서 차단 결함이 없었다. Node 24의 `verify:change`는 타입 검사·lint·문서 검사·Node 2,862건 및 unit 396건·의존성 감사를 통과했다. Node의 기존 환경 조건 skip 9건과 변경 밖 lint warning 48건은 유지된다. 최초 운영 검증은 UI·앱 빌드 경계를 변경하지 않아 화면 검증과 Next.js build를 포함하지 않았다. 운영 적용은 완료된 소스 바이트 기준이며 Git commit·push·PR·병합은 별도 전달 경계다.

후속 사용자 요청은 같은 수정의 commit·push와 live 전달까지 포함한다. Git 소스는 `fix/ops-backup-reliability`에서 canonical release로 발행하고 `dev` PR의 위험 등급별 검사·첫 실행 및 Preview 수신을 확인한다. 이 수정의 live 배포 대상은 서버 unit·SSH handler와 Mac 수신 파일이다. 앱 이미지 수신기는 이 파일들을 설치하지 않으므로 운영 파일의 커밋 바이트 일치·실제 명령·상태를 별도로 검증한다. 2026-10-18 확인한 `dev`는 `main`보다 400 commits ahead / 13 behind여서, 관계없는 변경 전체를 Production 앱으로 승격하지 않는다. Git/CI 전달 결과는 해당 Issue·PR과 프로젝트 Context를 정본으로 기록한다.

임시 시험 로그와 운영 적용 receipt는 ignored `.tmp/ops-614/`에 둔다. 완료 시 실제 결과와 남은 Git 전달 경계를 이 문서에 갱신하고, 운영 절차는 [관측·백업 운영](../../operations/runbooks/self-host-observability.md)과 [배포·유지보수](../../operations/runbooks/self-host-ci-maintenance.md)를 정본으로 유지한다.

Git 발행 전 추가 로컬 Release 후반부는 두 Production 빌드와 현재 reporter 기준 브라우저 121건을 모두 통과했다. 각 케이스는 단일 성공 결과이며 retry·skip·flaky·reporter error는 0이다. fixture cold-cache notice 1건만 기존 baseline과 같았고 full-reload·transport·browser/server error는 없었다. 과거 120건을 기대한 보조 집계 assertion의 실패는 별도 보존하고 현재 reporter·선언 테스트·list 요약으로 교정했으며 게이트를 재실행하지 않았다.
