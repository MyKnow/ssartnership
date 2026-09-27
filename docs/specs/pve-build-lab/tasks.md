---
title: PVE 빌드 실험 작업 상태
type: task-list
status: current
authority: normative
---

# 작업 상태

Issue [#497](https://github.com/MyKnow/ssartnership/issues/497), 브랜치 `ci/497-pve-build-lab`의 격리 실험이다. 운영 전환 및 dev/main 병합은 승인 범위에 포함하지 않는다.

## 완료된 검증

- 전용 VM 4970과 합성 Preview VM 4971, private network, 운영 접근 및 외부 부작용 차단.
- CPU 18회, RAM 12회, 같은 후보 SHA의 캐시 on/off 12회, GitHub 기준 6회. 모든 조건 n=3. 초기 audit wrapper 한계는 결과에 별도 명시한다.
- 수정된 strict audit 이후 실제 push 12회: 실행 중/정지 상태 × cold/warm × 각 3회. 모든 성공 표본은 E2E 83개, 실패/오류/skip/retry 0, OOM 없음, image/source SHA 및 실제 HTTP 표식 일치.
- Linux Node 검사는 1944개 중 1936개 통과, 기존 구성 skip 8개다. unit 133개 통과. E2E의 zero-skip 계약과 구분한다.
- 합성 DB·Storage와 5개 internal container, 공개 Docker 포트 없음, 운영 데이터 복사 없음. 초기화 재실행 차단과 데이터 유지 확인.
- Preview guest 재부팅 후 DB·Storage·이미지·컨테이너 복구, 실제 브라우저 확인. PVE 호스트 재부팅은 수행하지 않았다.
- 기존 production·preview 컨테이너 ID, 이미지, 시작 시각을 전후 비교하고 health HTTP 200 확인.

## 전체 경로 비교 및 복구

같은 환경의 최적화 미적용 warm 3회 대조군도 완료했다. gate 중앙값은 365.162→296.795초, push→준비 완료는 661.583→604.037초로 줄었다. 대조군 cold 준비 실행은 비교 통계에서 제외한다.

이전 앱 이미지 f794e471로 rollback한 뒤 최신 d417cedb로 복원했다. 핵심 합성 DB 내용 해시, Storage 파일 해시, 비앱 container identity와 volume, health·상세 응답 및 최신 표식을 확인했다.

## 최종 게시 검증의 정본

문서 게시 자체도 실험 빌드를 유발하므로 게시 이후의 최종 SHA 검증은 [Issue #497](https://github.com/MyKnow/ssartnership/issues/497)의 최종 기록에 남긴다. 확인 항목은 실제 대기열 처리, 정확한 최종 SHA·이미지·HTTP·브라우저, 배포 완료 후 900초 유휴 자동 종료와 Preview 유지, 운영 컨테이너 전후 비교다. 이 기록이 없거나 필수 항목이 실패하면 전체 작업은 완료된 것으로 판단하지 않는다. 문서와 위 측정 CSV는 게시 전 완료된 측정 및 복구의 증거다.

## 결과와 운영 전환 경계

권장 출발점은 빌더 4 vCPU/6144 MiB VM/5120 MiB container, 동시 실행 1개다. 같은 후보 SHA의 warm gate 중앙값은 359.106초에서 292.786초로 약 18.5% 줄었다. cold 차이는 작았다. NIC 제한을 유지한 실험에서는 이미지 전달 약 246초가 전체 체감 시간의 큰 부분이다. 소비전력은 측정하지 않았다.

성공 표본만으로 설치 신뢰성을 주장하지 않는다. cold 설치 실패 3건(a8f63471, 0d64ab38, 9fc1d6a8)과 배포 전에 거부한 audit 오류 준비 실행(5065fe30)은 원본 증거를 보존하며 성공 통계에서 제외한다. 연결 reset의 원인은 미확정이다.

[측정 결과](../../performance/measurements/pve-build-lab-2026-09-27.md) · [운영 및 복구](../../operations/runbooks/pve-build-lab.md) · [요구사항](./spec.md) · [구현 계획](./plan.md)
