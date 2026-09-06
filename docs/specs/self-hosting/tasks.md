---
title: 자체 호스팅 작업과 검증 증거
type: task-list
status: active
authority: descriptive
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 작업과 검증 증거

기준은 Issue #435의 `dev` → `feat/self-host-compose-foundation-20260906` → `dev` 흐름이다. 서버 접근이 불가능하여 로컬에서 수행 가능한 앱·데이터 선행 작업과 실제 서버 전환을 구분한다.

## 앱 선행 작업

- [x] trusted install 기반 production standalone Docker 이미지 정의
- [x] loopback mock smoke Compose와 실제 공급자 실행 설정
- [x] 환경 검증, liveness와 비밀 제외 경계
- [x] `vercel.json` 일정 기반 Cron 목록·단발 호출 도구
- [x] 집중 테스트와 문서 검증
- [x] 실제 브랜치 Release gate 및 Docker Desktop smoke 증거

2026-09-06 기준 `origin/dev`의 `2074e22d915769c255764a4fc9afba3e36ab0545`에서 별도 작업 worktree를 만들었다. 기존 루트의 인증 관련 사용자 변경은 보존했다. Node 24.18.1/npm 11.16.0으로 `verify:change`, `verify:release`를 통과했고 브라우저 E2E는 103/103이었다. 환경·Cron·DB·운영·transport 집중 테스트와 91개 Markdown 검증을 실제 worktree에서 실행했다. 기존 11개 UTC Cron 목록만 확인했으며 실제 Cron·외부 발송은 실행하지 않았다.

Docker Desktop Linux arm64에서 mock/real production standalone 이미지 빌드, uid 1001, liveness·SSR·정적 자산·재시작·설정 누락 거절을 확인했다. real 앱은 로컬 DB와 연결해 공개 이미지 프록시의 실제 PNG 바이트 일치, 비공개 경로 거절, HTML의 서버 비밀 미노출을 확인했다. Linux amd64는 dependency stage만 빌드했으며 전체 이미지·홈 서버 실행 증거는 아직 없다. UI 구현은 변경하지 않았고 E2E의 렌더링 회귀 검사와 실제 HTTP 검증을 구분한다.

## 데이터 서비스와 서버 전환

- [x] 자체 호스팅 데이터 서비스 선정·Compose 기동
- [x] 빈 DB의 199개 schema migration·대표 RPC/RLS 재생 검증; 실제 운영 데이터 호환성은 아래 전환 게이트
- [x] synthetic Storage 공개·비공개 정책·파일 checksum·복원 검증
- [ ] 앱을 자체 호스팅 API에 연결하여 로그인·공개 조회·권한 검증
- [x] 실제 cloud 기능 사용처 inventory와 운영상 필수 기능 확인
- [x] 로컬 관리형 백업/PITR 대체와 named/time 복원 지점 리허설
- [x] Preview branching 대체: 독립 환경 생성·초기화·종료; 볼륨은 보존
- [x] Management API 사용 여부 검증과 초기 자체 운영 CLI 구현
- [ ] 홈 서버 ingress·관리 경로·외부 백업/복원·자원 부하 검증
- [ ] 실제 메일·Mattermost·Push·Wallet 연동 확인
- [ ] 단일 writer·단일 scheduler 전환과 앱/데이터 복구 리허설

작업 체크는 해당 증거가 생길 때 갱신한다. 로컬 mock smoke는 데이터 이전 또는 운영 인증 검증을 대체하지 않는다.

데이터·복구의 상세 증거와 운영 서비스 구현 순서는 [데이터 작업 목록](../self-host-database/tasks.md), [기술 계획](../self-host-database/plan.md)이 정본이다. Git 커밋·push·PR·merge·배포는 이번 로컬 검증과 별개이며 수행하지 않았다.
