---
title: 격리 PVE 빌드 최적화 측정 결과
type: measurement
status: completed
authority: evidence
---

# 격리 PVE 빌드 최적화 측정 결과

Issue [#497](https://github.com/MyKnow/ssartnership/issues/497)의 완료된 측정 결과다. 문서 게시 이후 최종 SHA의 대기열·응답·유휴 종료 검증은 이슈의 최종 기록에 별도로 남기며, 해당 확인 전에는 전체 작업 완료로 판단하지 않는다.

## 결론과 적용 범위

수정된 검사 이후 같은 환경의 실제 warm push 대조군은 gate 365.162→296.795초(18.72%), push→준비 완료 661.583→604.037초(8.70%)였다. 약 58초 단축이며, 아래 동일 SHA 비교와 구분한다.

권장 시작점은 빌더 4 vCPU, VM 6144 MiB, 빌드 컨테이너 5120 MiB, 동시 실행 1개다. 같은 후보 코드에서 캐시 최적화는 warm 전체 gate 중앙값을 359.106초에서 292.786초로 66.320초(18.47%) 줄였다. cold는 386.184초와 386.629초로 차이가 작았다. 모든 조건은 3회다. CPU 8개가 더 빠르지만 4→8의 개선은 약 6~7%였고 RAM 추가의 개선은 1% 미만이었다. 소비전력은 측정하지 않았으므로 전력 효율의 최적점이라는 뜻은 아니다.

기존 production·preview 서버, dev·main, 운영 receiver, 도메인·공유기, 운영 DB 및 비밀값은 전환 대상에 포함하지 않았다. 실험 브랜치와 전용 VM, 합성 데이터만 사용했다. 운영 전환과 병합은 별도 승인 대상이다.

## 비교 기준

- 기준 코드: `308281074ed752b6cccce693d27755da13dd675f`.
- 코드 최적화 비교: `30e0ed839979f79026cea477a1db168346dd1017`의 동일 코드에서 stable lab cache 설정만 비교했다.
- 정식 push 측정: `c3a905e75d99a19fd738cbcf7fb0066e29127cd4`의 fail-closed 보안 검사 수정 이후다. public 실험 표식의 작은 변경으로 source SHA를 바꾸며 기존 성공 캐시의 재사용을 검증했다. 문서·실패 기록 외 실행 코드는 고정했다. 전체 gate는 매번 실행하지만 변경 자체는 정적 public 파일이므로 애플리케이션 모듈을 수정할 때의 캐시 무효화 비용까지 대표하지 않는다. 실제 기능 PR의 전체 소요 시간을 같은 수치로 보장하지 않는다.
- cold는 npm/Next cache를 재사용하지 않는 조건이다. gate image는 미리 준비됐고 호스트 page cache를 비우지는 않았다. warm에서도 node_modules와 최종 결과물은 새로 생성한다.
- Ryzen 5700X3D의 기존 powersave/balance_power 및 boost 비활성 설정을 유지했다. 빌더 NIC 8 MB/s, 실험 Preview NIC 2 MB/s의 전체 전송 제한도 고정했다.
- CPU 비교는 VM 2/4/8 vCPU, RAM 비교는 VM/container 6144/5120 대 8192/6144 MiB다. RAM 결과는 VM 메모리만 단독 변경한 효과가 아니다.
- cgroup peak는 page cache를 포함할 수 있어 앱 RSS와 다르다. guest 사용량과 구분해 기록한다.

## 자원·캐시·GitHub 기준 수치

각 cold/warm 셀은 n=3이며 중앙값과 범위를 초 단위로 표시한다. 초기 48회 audit 한계는 아래 정확성 절을 함께 읽는다.

| Profile | CPU / VM MiB / container MiB / stable cache | cold | warm |
| --- | --- | ---: | ---: |
| cpu | 2 / 6144 / 5120 / False | 475.833 (474.723–476.279) | 450.771 (447.966–451.214) |
| cpu | 4 / 6144 / 5120 / False | 387.796 (387.521–387.862) | 360.576 (359.782–363.005) |
| cpu | 8 / 6144 / 5120 / False | 364.294 (363.548–365.951) | 336.516 (336.305–337.021) |
| ram | 4 / 6144 / 5120 / False | 387.365 (386.731–388.662) | 359.895 (358.880–361.188) |
| ram | 4 / 8192 / 6144 / False | 385.733 (384.282–386.700) | 358.050 (357.799–360.081) |
| optimization | 4 / 6144 / 5120 / False | 386.184 (385.773–387.350) | 359.106 (358.826–360.828) |
| optimization | 4 / 6144 / 5120 / True | 386.629 (386.578–387.062) | 292.786 (292.227–294.248) |
| github | 2 / host managed / 5120 / False | 368.101 (365.341–369.996) | 382.513 (379.660–387.391) |

## 최적화 적용 전체 경로: 조건별 3회

| 시작 상태 | 캐시 | n | push→ready 중앙값 (범위), 초 | gate 중앙값, 초 |
| --- | --- | ---: | ---: | ---: |
| running | cold | 3 | 714.7 (695.2–717.4) | 391.8 |
| running | warm | 3 | 604.0 (601.7–618.5) | 296.8 |
| stopped | cold | 3 | 731.9 (727.8–732.2) | 388.2 |
| stopped | warm | 3 | 648.5 (639.1–649.9) | 293.2 |

## 단계와 메모리

부팅 상태를 합친 같은 캐시 조건 6회의 중앙값이다. 각 구간 중앙값의 합은 전체 중앙값과 같지 않을 수 있다.

| 구간 | cold, 초 | warm, 초 |
| --- | ---: | ---: |
| 설치 | 46.1 | 16.5 |
| 검사 | 113.1 | 113.4 |
| 실제 앱·fixture 두 빌드 | 157.5 | 92.2 |
| E2E | 70.5 | 69.8 |
| 이미지 묶기 | 7.2 | 7.1 |
| 전송 | 246.4 | 246.3 |
| 배포 | 3.9 | 3.9 |

메모리 최대 관측값은 아래와 같다. cgroup 값은 page cache를 포함하며 RSS 또는 VM 전체 사용량과 같은 지표가 아니다. cold의 cgroup peak가 5 GiB 제한에 도달했지만 OOM은 없었다.

| 캐시 | guest 최대 사용량, MiB | container cgroup peak, MiB |
| --- | ---: | ---: |
| cold | 4042 | 5120 |
| warm | 3448 | 4619 |

## 같은 환경의 전체 경로 대조군

4 vCPU/6 GiB 및 동일 전송 제한, 실행 중 warm 상태, 각 3회다. 작은 실험용 정적 파일 변경을 사용했다. cold 준비 실행은 제외한다.

| 지표 | 미적용 중앙값, 초 | 적용 중앙값, 초 | 단축, 초 (%) |
| --- | ---: | ---: | ---: |
| 검사·빌드 gate | 365.2 | 296.8 | 68.4 (18.7%) |
| push→서버 준비 | 661.6 | 604.0 | 57.5 (8.7%) |
| push→Mac 응답 관측 | 670.2 | 611.9 | 58.2 (8.7%) |

Mac 응답 관측은 polling 지연이 포함된 별도 지표다. 서로 다른 커밋의 public 표식과 실험 기록만 바뀌었고 gate 실행 코드는 고정했다. 동일 SHA on/off gate 비교와 구분하며, 기존 GitHub 운영 배포 전체의 개선율이라는 뜻은 아니다.

## 정확성과 실패 이력

모든 성공 gate는 E2E 83개, 실패·오류·skip·retry 0, OOM 없음 및 source/artifact SHA 일치를 확인했다. Linux Node 검사에는 기존 구성에 따른 skip 8개가 있으므로 전체 테스트가 전부 skip 0이라고 해석하면 안 된다. 정식 경로는 Node 1944개 중 1936개 통과·8개 skip, unit 133개 및 E2E 83개를 확인한다.

초기 48회 자원·캐시·GitHub 비교는 당시 wrapper가 npm audit 오류 JSON을 빈 결과로 오인할 수 있었다는 한계가 있다. 이 수치는 시간과 E2E 관측 결과로 보존하지만 audit transport 성공을 보장한 표본이라고 주장하지 않는다. 이후 준비 실행 `5065fe30`에서 실제 HTTP 503을 발견해 배포 전에 거부했으며 통계에서 제외했다. 수정은 잘못된 envelope·불완전한 report·프로세스 중단을 실패로 처리한다. 회귀 검사와 전체 Release를 통과한 c3 이후에 정식 측정을 시작했다.

정식 running/cold 첫 시도 `a8f63471`는 npm 다운로드 ECONNRESET으로 43.865초 후 실패했고 배포되지 않았다. 실패 로그와 원래 요청을 보존했으며 자동 재시도하지 않았다. 동일 잠금 패키지의 후속 읽기 전용 확인에서 HTTP 200 및 SHA-512 일치를 관측한 뒤 새 SHA의 별도 cold 표본으로 진행했다. 연결을 끊은 원인은 확정하지 않았다. 실패 횟수는 성공 중앙값과 별도로 보고한다.

## 최종 체감 시간의 해석

push 시작은 실제 git push 호출 직전의 Mac 시각이며 로컬 pre-push 검사 시간은 별도다. 서버 ready는 이미지 revision 및 실제 image ID를 확인한 뒤 health HTTP 200 시각이다. 이어서 Mac에서 새 public 표식이 정확한 Git blob과 일치하는지 확인한다. 응답 관측에는 20초 주기의 관측 지연이 포함된다. 첫 두 표본의 관측 시각은 receipt 생성 시각을 사용한 상한이며 이후 표본은 HTTP 확인 시각을 직접 기록한다. 머신 간 시계 비교는 초 미만 수준으로 확인했으나 밀리초 정밀도를 주장하지 않는다.

부팅은 boot 요청부터 dispatch까지와 guest agent 활성 추정 시각을 구분한다. 제어기의 30초 주기가 포함된 dispatch 시간을 순수 OS 부팅 시간이라고 부르지 않는다. 단계 marker는 subprocess 출력 시점 기반이며, 설치·검사·두 Next 빌드·E2E·packaging·전송·배포 경계를 기록한다.

현재 전송 제한은 private VM 간 전송에도 적용된다. 약 343 MB 이미지의 PVE 경유 전달에 약 246초가 걸리는 것이 관측됐다. 이번 고정 조건 안에서는 최적화하지 않았으며 압축이나 private 경로의 별도 제한은 후속 비교 후보다.

## GitHub 비교의 한계

[GitHub 기준 실행](https://github.com/MyKnow/ssartnership/actions/runs/36269916621)은 같은 기준 gate의 cold 중앙값 368.101초, warm 382.513초로 각각 3회다. 컨테이너는 2 CPU/5120 MiB이며 호스트 하드웨어·전력·네트워크는 다르다. 최적화된 후보를 GitHub에서 다시 비교하지 않았으므로 VM이 언제나 더 빠르다고 결론 내리지 않는다.

이전 dev workflow 36247463568의 전체 809초(빌드 563초, publish 238초)는 단일 과거 참고치다. n=3 push-to-ready 기준선이 아니고 기존 Preview의 실제 준비 시각도 같은 방식으로 측정하지 않았다. 전체 workflow와 VM gate만을 직접 비교해 개선율을 계산하지 않는다.

## 증거 자료

- [자원·최적화·GitHub 48회 CSV](./pve-build-lab-2026-09-27/benchmark-measurements.csv)
- [정식 push 12회 CSV](./pve-build-lab-2026-09-27/formal-measurements.csv) · [요약](./pve-build-lab-2026-09-27/formal-summary.json)
- [warm 대조군 3회 CSV](./pve-build-lab-2026-09-27/control-measurements.csv) · [요약](./pve-build-lab-2026-09-27/control-summary.json) · [비교](./pve-build-lab-2026-09-27/matched-comparison.json)
- [설치 실패](./pve-build-lab-2026-09-27/installation-failure-summary.json) · [audit 준비 실행 거부](./pve-build-lab-2026-09-27/audit-preparation-rejection.json)
- [합성 Preview 격리·재부팅](./pve-build-lab-2026-09-27/preview-validation.json) · [실제 rollback/restore](./pve-build-lab-2026-09-27/rollback-validation.json)
- [운영·전환·복구](../../operations/runbooks/pve-build-lab.md) · [작업 상태](../../specs/pve-build-lab/tasks.md)

## 실패 및 진단 보충

추가 실패: running/cold replicate 3의 원래 SHA `0d64ab38`도 43.711초에 같은 Next 설치 전송 오류로 실패했고 배포되지 않았다. 원본 결과·시각·로그는 별도 보존했다. 독립적인 동시 전송 3개에서 HTTP 200 및 잠금 해시는 일치했지만 npm 설치와 동등한 검증은 아니므로 근본 원인은 미확정이다. 성공 중앙값과 별도로 실패 2건을 보고하고 운영 도입 시 cold 설치의 신뢰성 한계를 검토한다.

대조군 cold 준비 `9fc1d6a8`도 48.579초에 ECONNRESET으로 중단됐다. 이번 미완료 설치 대상은 exceljs이며 실패 결과, 원본 push 시각 및 로그를 보존했다. 따라서 전체 추가 push 실험의 설치 실패는 최적화 적용 2건과 대조군 준비 1건이다. 후속 개별 tarball의 HTTP 200·SHA-512 일치는 npm 전체 설치의 안정성이나 근본 원인 해결을 입증하지 않는다. 실패 표본은 성공 시간 중앙값에 섞지 않는다.

## 단계 구간의 경계

설치 구간은 trusted install marker부터 docs 검사 시작까지, 검사 구간은 docs 검사 시작부터 실제 앱 build 시작까지다. 실제 앱·fixture 두 빌드 구간은 build 시작부터 E2E 통계의 startTime까지라 테스트 서버 준비 경계도 포함한다. 이미지 전달 구간은 controller의 transferStartedAt부터 transferFinishedAt까지이며, PVE 경유 복사와 해당 전달 절차의 준비가 포함된다. 이 값을 순수 링크 throughput 측정으로 해석하지 않는다. 각 구간 중앙값의 합은 전체 중앙값과 같지 않을 수 있다.

## 합성 Preview와 실제 복구

합성 members 0·company 1·partner 1을 사용하고 운영 데이터는 복사하지 않았다. 앱·DB·Storage 등 5개 container의 네트워크는 internal이며 공개 Docker 포트는 없다. 앱과 Storage의 인터넷·SMTP·PVE·운영 서버 연결은 차단되고 내부 API 연결은 허용됨을 확인했다. 초기화 재실행은 거부됐고 데이터가 유지됐다.

Preview guest 재부팅 후 DB·Storage·이미지·컨테이너 복원을 검증했다. 첫 loopback proxy 복구 문제는 서비스 활성화 때 현재 container IP를 조회하도록 수정한 뒤 실제 재부팅으로 재검증했다. PVE 호스트 자체의 재부팅은 수행하지 않았다.

이전 앱 이미지 f794e471로 rollback한 뒤 d417cedb로 복원했다. 핵심 합성 DB 내용 해시, Storage 파일 해시, 비앱 container identity·volume이 유지됐으며 두 이미지의 health·상세 응답은 HTTP 200, 최신 표식도 일치했다. migration 또는 seed는 실행하지 않았다.

문서 게시 이후 최종 브랜치 SHA의 실제 대기열 처리·브라우저 응답·900초 유휴 종료 및 운영 컨테이너 전후 재확인 결과는 [Issue #497](https://github.com/MyKnow/ssartnership/issues/497)의 최종 검증 기록을 확인한다. 운영 전환과 dev/main 병합은 하지 않는다.
