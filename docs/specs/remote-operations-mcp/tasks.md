---
title: 원격 운영 MCP 작업 기록
type: task-list
status: active
authority: descriptive
---

# 원격 운영 MCP 작업 기록

[#602](https://github.com/MyKnow/ssartnership/issues/602), 기준 `origin/dev@e3215e0c07a137ea90a14029cd842437dc440115`, branch `feat/602-remote-mcp`.

- [x] 사용자 선택: 여러 AI 클라이언트 공용 원격 MCP.
- [x] 기존 admin permission/scope/cache, 공개 제휴처·쇼케이스 소유자 Repository 경계 조사.
- [x] [명세](./spec.md), [설계](./plan.md), typed worktree 분리.
- [x] 조회 서비스 3개: 검색, 공개 제휴처 상세, 본인 익명 리뷰. Repository dependency injection.
- [x] 테스트 먼저 추가한 뒤 구현: 12개 집중 Node 테스트 통과, 실패 0/skip 0. 계정 상태·권한 버전·scope·입력 상한·DTO·익명성·페이지를 확인.
- [x] 서버 adapter에서 기존 uncached 계정 조회와 Repository 연결, 실제 mock 검색/상세 및 소유권·숨김 회귀 검증. 실제 Supabase adapter의 Preview HTTPS 검증은 배포 후 수행한다.
- [x] 공식 SDK v2 stable 2.3.1과 설치된 Web handler API 검증, lifecycle 비활성 trusted install 및 canonical lock 확인.
- [x] OAuth 등록·동의·철회 UI, hash-only durable/mock Repository, 원자 code 교환·refresh 회전·재사용 철회.
- [x] metadata와 HTTP route, pinned resource·Bearer·Origin·16KiB·원자 quota·scoped tool list.
- [x] 기존 리뷰 Repository/업무 RPC 재사용, 5분 검토·사람 승인·본문/상태 binding·원자 실행/audit/receipt.
- [x] 격리 PostgreSQL에서 새 migration과 실제 service_role/anon ACL·atomic RPC 검증: SQL91, 동시성6, clone-only guard1 통과. 만료 quota 수거 회귀를 먼저 실패시킨 뒤 보강했다.
- [x] 실제 Codex CLI 0.153.4: OAuth·도구 목록·직접 조회·철회 후 거부. 임시 설정, 모델 추론 없음.
- [x] 실제 Claude Code 2.1.261: OAuth·직접 검색 1회·철회 후 인증 필요. 기존 로그인·설정 파일을 변경하지 않은 임시 프로젝트/고유 MCP 이름으로 확인하고 새 QA 자격증명만 정리했다.
- [x] 서로 다른 실제 클라이언트 두 종류의 OAuth·도구 호출·철회 수용. 로컬 mock 검증이며 Preview와 구분한다.
- [x] 최종 소스 Quick: Node2841 통과/기존skip9, unit396 통과. 이어 두 production build와 E2E120/120 통과, 실패·skip·flaky·retry·reporter error0. 캐시 없음 안내1 외 runtime/colour/deprecation 진단0.
- [ ] PR/dev 통합 및 fresh paired backup 복구 후 Preview 스키마·앱·격리 계정 HTTPS 검증.

집중 Node/HTTP 26개와 fixture 경계 8개가 통과했다. legacy stateless와 공식 v2 Client 협상·조회, PKCE·refresh·철회·CSRF·권한 회수·중복 실행을 확인했다. 실제 앱 mock 브라우저 E2E는 외부 loopback callback 도착, scoped 6도구, 소유 리뷰 body-only, 사람 승인 전 거부, executed/replayed, 철회401을 retries0으로 통과했다. 관리·동의·검토 360/820/1366px 캡처와 console0을 확인했다. CSP form-action 차단을 독립 재현하고 전역 정책 변경 없이 교정했다. 브라우저 거절 흐름과 native form 제출 후 안전한 continuation·callback·교환·철회도 확인했다. 호스트 Next 앱 전체의 script-free 지원은 이 범위에 포함하지 않는다. 기존 full Release 첫 시도는 두 빌드 성공 후 script-disabled 새 context에서 버튼을 찾는 추가 시나리오가 시간 초과했다. 원본 trace를 보존하고 실제 native form endpoint 경계로 검증을 교정했으며 최종 전체 재검증은 별도다. 위 증거는 격리 fixture/실제 CLI/격리 DB로 구분하며, Preview 배포 완료를 뜻하지 않는다.
