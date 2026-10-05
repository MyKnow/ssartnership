---
title: 자체 호스팅 Web Vitals·Lighthouse 측정
type: measurement
status: current
authority: evidence
---

# 자체 호스팅 Web Vitals·Lighthouse 측정

Vercel Speed Insights·Analytics는 RF-04(#537)에서 제거했다. 브라우저 성능은 아래 두 경로로만 확인한다. 과거 Speed Insights 수치는 [2026-04-03 기준선](../baselines/2026-04-03-speed-insights.md)과 이 문서의 기록 표에 시점 증거로만 남긴다.

| 경로 | 무엇을 보여 주는가 | 한계 |
| --- | --- | --- |
| 실사용자 Web Vitals(`/api/web-vitals` → telemetry histogram) | 실제 방문의 LCP·INP·CLS p75와 표본 수 | 샘플링(기본 10%), DNT 제외, 위조 가능한 익명 수치 |
| Lighthouse 실험실 측정(`npm run perf:lighthouse`) | 공개 정적 경로의 performance 점수와 LCP·TBT·CLS | 단일 장비·단일 회선, 실사용자 분포가 아님 |

## 1. 실사용자 Web Vitals

수집 계약은 [관측 운영 runbook](../../operations/runbooks/self-host-observability.md)의 Web Vitals 절이 정본이다. 요약하면 다음과 같다.

- `src/app/layout.tsx`는 `NEXT_PUBLIC_DATA_SOURCE=supabase` 빌드에서만 `SelfHostedWebVitals`를 탑재한다. mock 빌드(E2E·Storybook·로컬 데모)는 수집기를 탑재하지 않는다.
- 서버는 `SELF_HOST_MODE=real`이고 `SELF_HOST_VITALS_ENABLED=1`일 때만 `/api/web-vitals` POST를 받는다. `GET /api/web-vitals`는 활성 여부와 샘플링 비율만 돌려준다.
- 표본은 telemetry 컨테이너의 `ssartnership_web_vital` histogram으로만 집계된다. 원본 이벤트 저장소는 없다.

배포 후 확인 순서:

1. 배포한 환경에서 `GET /api/web-vitals` 응답의 `enabled`가 `true`이고 `sampleRate`가 의도한 값인지 확인한다.
2. 실제 트래픽이 쌓일 때까지 기다린다. 환경별 최근 15분 표본이 5개 미만이면 공용 대시보드가 p75를 표시하지 않는다.
3. 공용 Grafana `SSARTNERSHIP Operations` 대시보드(정본: `deploy/pve/grafana`)의 `LCP p75`·`INP p75`·`CLS p75`와 `최근 표본 수` 패널을 기록 표에 옮긴다.
4. 검증 환경에서 전체 표본이 필요하면 `SELF_HOST_VITALS_SAMPLE_RATE=1`을 해당 환경에만 일시 적용하고, 측정 후 기본값으로 되돌린다.

## 2. Lighthouse 실험실 측정

`scripts/lighthouse-check.mjs`가 로컬 Production 빌드를 띄우고 sitemap의 공개 정적 경로를 Lighthouse performance 범주로 측정한다.

```bash
npm run perf:lighthouse
# 이미 빌드했다면
npm run perf:lighthouse:run
```

- 기본 대상은 `http://127.0.0.1:3333/`, 기본 form factor는 desktop, 기본 통과 기준은 85점(`LIGHTHOUSE_MIN_SCORE=0.85`)이다.
- `LIGHTHOUSE_FORM_FACTOR=mobile`, `LIGHTHOUSE_MIN_SCORE`(0~1 비율, 예: `0.9`)로 기기·기준을 바꾼다. 이 스크립트는 항상 로컬 `npm run start` 서버를 띄우므로 운영 주소 측정용이 아니다.
- 운영 공개 주소의 spot check는 저장소에 고정된 Lighthouse로 한 경로씩 수동 실행한다. 관리자·API·인증 필요 경로는 측정하지 않는다.

```bash
npx lighthouse https://ssartnership.myknow.xyz/ --only-categories=performance --preset=desktop --output=json --output-path=.tmp/lighthouse-home.json
```

## 기록

| 날짜 | 경로 | 측정 | LCP | INP/TBT | CLS | 비고 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 2026-04-03 | 전체 | Vercel Speed Insights(RES 66) | 2.8s | INP 872ms | 0 | 최적화 전 기준선 |
| 2026-07-05 | `/` | Lighthouse desktop 83 | 2.6s | TBT 0ms | 0 | 공개 셸 중 가장 느린 경로 |
| 2026-07-05 | `/auth/login` | Lighthouse desktop 100 | 0.6s | TBT 0ms | 0 | 당시 SSAFY Verify 우선 로그인 |
| 2026-07-05 | `/auth/signup` | Lighthouse desktop 100 | 0.6s | TBT 0ms | 0 | 당시 SSAFY Verify 가입 진입 |

새 측정은 위 표에 한 줄씩 추가하고, 측정 경로(실사용자/실험실)와 무엇이 달라졌는지 한 줄로 적는다. 실험실 수치를 실사용자 p75로 바꿔 적지 않는다.
