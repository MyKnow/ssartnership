---
title: 자체 호스팅 공개 edge 복구 명세
type: feature-spec
status: active
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/478
---

# 자체 호스팅 공개 edge 복구

## 결과

홈 서버가 재부팅된 뒤 Production과 Preview 공개 사이트가 Caddy 수동 시작 없이 다시 연결된다. 호스트의 제한된 health check가 Caddy의 인증서 검증 TLS 수신 상태를 확인하고, edge만 제한적으로 복구한다.

## 범위

- Docker와 호스트 방화벽이 준비된 뒤 Caddy edge 컨테이너의 부팅 시작을 보장한다.
- Production과 Preview의 로컬 TLS handshake와 인증서 hostname 검증을 주기적으로 확인한다.
- 컨테이너가 정지했으면 시작하고, 연속 TLS probe 실패가 확인된 경우에만 Caddy를 재시작한다.
- 복구 재시도 간격을 제한하고 결과를 systemd journal에 기록한다.
- 기존 앱/API health probe는 upstream 상태의 독립 신호로 유지한다.

## 불변조건

- 자동 복구 대상은 Caddy edge 컨테이너 하나다. 앱, DB, Storage, 백업, Prometheus 데이터에는 재시작·수정·삭제를 수행하지 않는다.
- Docker socket은 다른 컨테이너에 마운트하지 않는다. 호스트 systemd 서비스만 root 권한으로 고정된 Caddy Compose label/name을 확인한 뒤 제어한다.
- 관리자 API는 계속 비활성화하고, 신규 공개 포트·DNS·방화벽 예외를 추가하지 않는다.
- Caddy TLS handshake와 앱/API HTTP health를 구분한다. 앱 upstream 오류만으로 Caddy를 재시작하지 않는다.
- 이 호스트 내부 검사는 정전, 전체 호스트 프리징, 공유기·ISP 장애를 감시하지 않는다. 외부 감시와 외부 회선 검증은 별도 운영 범위다.

## 수용 기준

1. 호스트 부팅 뒤 제한 시간 내 Caddy 컨테이너가 실행되고 Production/Preview TLS 연결을 수락한다.
2. 정지된 Caddy는 자동 시작되고, 실행 중 TLS probe가 연속 실패할 때만 5분 cooldown을 두고 복구를 재시도한다.
3. 앱/API upstream 장애 동안 Caddy가 불필요하게 반복 재시작되지 않는다.
4. 복구 실패와 cooldown 상태가 민감 정보를 노출하지 않고 journal에 남는다.
5. 앱·DB·Storage·백업 컨테이너 ID와 데이터는 복구 동작 전후에 보존된다.
6. 실제 서버 적용, 호스트 재부팅 시험, 외부 네트워크 접근 결과를 로컬 코드 검증과 분리해 보고한다.

HTTP 처리 정체 여부는 이 TLS listener probe의 판별 범위가 아니다. 외부 HTTP synthetic probe와 app/API upstream health를 별도로 유지하며, upstream health는 Caddy 복구의 입력으로 사용하지 않는다.

[기술 계획](./plan.md), [작업 목록](./tasks.md), [자체 호스팅 운영 runbook](../../operations/runbooks/self-hosting.md)을 함께 따른다.
