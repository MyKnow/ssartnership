---
title: 자체 호스팅 공개 edge 복구 작업 목록
type: task-list
status: active
authority: descriptive
---

# 공개 edge 복구 작업 목록

Issue [#478](https://github.com/MyKnow/ssartnership/issues/478), related [#453](https://github.com/MyKnow/ssartnership/issues/453).

- [x] Docker metadata를 검증하고 기존 Caddy만 시작·재시작하는 watchdog 구현
- [x] SNI TLS probe, 연속 실패 임계값, cooldown, root 전용 상태 저장 구현
- [x] systemd service/timer와 root 전용 installer 추가
- [x] Compose healthcheck의 config 검증과 host runtime probe 책임을 문서화
- [x] self-hosting runbook에 설치, 관찰, 비활성화, 복구 절차 기록
- [x] Caddy TLS listener/upstream 상태 분리와 edge-only recovery 검증 (집중 테스트 11개, high/quick 변경 게이트 통과)
- [ ] Preview 적용 후 외부 회선 HTTPS 확인
- [ ] Production 승격 후 재부팅 복구와 데이터 서비스 불변 확인

로컬 증거: Node 24.18.1의 `npm run verify:change` high/quick 통과, Docker Compose 정적 설정 통과. macOS 호스트에는 `systemd-analyze`가 없어 systemd 자체 검증과 Preview/Production 서버 적용은 별도 남아 있다.
