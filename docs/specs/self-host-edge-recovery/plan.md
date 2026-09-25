---
title: 자체 호스팅 공개 edge 복구 기술 계획
type: implementation-plan
status: active
authority: normative
---

# 공개 edge 복구 기술 계획

## 설계

- `ssartnership-edge-caddy-1`의 Compose `restart: unless-stopped`만으로는 이번 부팅 뒤 재시작을 보장하지 못했다. root systemd timer가 Docker 이후 주기적으로 기존 Compose project/service label을 확인하고 Caddy의 시작 상태를 조정한다.
- root Node 24 watchdog은 Production·Preview domain을 SNI로 사용해 `127.0.0.1:443`의 TLS handshake와 인증서 hostname 검증만 수행한다. HTTP 요청 처리와 앱/API 응답은 별도 synthetic/telemetry probe가 맡으며 watchdog 복구 판단에는 넣지 않는다.
- 정지 컨테이너는 복구 cooldown을 확인한 뒤 시작한다. 실행 중 handshake 실패는 상태 파일에 누적하고 연속 실패 기준을 넘었을 때만 Caddy를 재시작한다. 최소 복구 간격을 둬 재시작 loop를 제한한다.
- systemd service/timer는 저장소의 고정 unit template을 설치하는 root 전용 installer로 관리한다. `systemd-analyze verify`를 거쳐 활성화하며 기존 설치 파일을 무검토 덮어쓰지 않는다.
- 상태 파일은 oneshot 호출 사이에 보존되는 root 전용 `/run` 아래 원자적으로 쓴다. stdout/journal에는 대상 도메인, 상태, 복구 시도만 남기고 설정·비밀·인증서 내용을 남기지 않는다.

## 변경 경계

- 구현: `scripts/self-host-operations/`, `deploy/self-host-operations/systemd/`
- 배포: root 전용 unit installer, 기존 public edge Caddy 구성
- 문서: 이 spec 세 파일과 자체 호스팅 runbook
- runtime 동작: Caddy 한 개만 시작/재시작. app/API health와 DB/Storage/backup은 관찰 대상이며 제어 대상이 아니다.

## 롤아웃과 복구

1. dev 기반 브랜치에서 script, unit template, 설치 가드, 문서를 검토한다.
2. systemd unit 정적 검증과 시뮬레이션 시나리오를 확인한다. 서버 재부팅은 코드 게이트로 대체하지 않는다.
3. Preview host에 unit을 설치해 Caddy 정지·TLS probe 회복·upstream 오류 분리 동작을 확인한다.
4. Preview 승인 뒤 main 승격과 운영 설치를 별도 진행한다. 실제 재부팅 창에서 Caddy, 앱, DB, Storage, 백업을 각각 관찰한다.
5. 실패 시 watchdog timer를 비활성화하고 기존 Docker/Caddy Compose 구성을 그대로 유지한다. 데이터 서비스나 방화벽을 변경하지 않는다.

## 검증

- 성공 handshake, container stopped, TLS timeout, 연속 실패, cooldown, upstream HTTP failure를 분리한다.
- Docker inspect 결과가 기대한 project/service label과 포트 바인딩에 맞지 않으면 제어를 거부한다.
- systemd unit/timer의 의존 순서와 설치 소유권·mode를 확인한다.
- 재부팅 뒤 공개 URL을 실제 외부 회선에서 별도 확인하며 loopback/hairpin 결과를 외부 도달 증거로 사용하지 않는다.
