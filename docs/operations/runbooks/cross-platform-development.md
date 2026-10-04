---
title: Windows / macOS 교차 플랫폼 개발환경
type: runbook
status: current
authority: normative
---

# Windows / macOS 교차 플랫폼 개발환경

## 1. 목적과 지원 범위

이 문서는 같은 Repository와 commit에서 개발자 OS가 바뀌어도 동일한 명령으로 환경을 복구하고 검증하는 계약이다.

공식 개발 환경은 다음과 같다.

| 운영체제 | Architecture | 지원 수준 | CI runner |
| --- | --- | --- | --- |
| Windows | x64 | 공식 | `windows-2025` |
| macOS | arm64 | 공식 | `macos-26` |
| Linux | x64 | CI 전용 | 기존 Public Readiness runner |
| 그 외 | 모든 Architecture | 미지원 | 지원 결정 전 사용 금지 |

macOS x64, Windows arm64, Linux arm64는 현재 공식 개발환경이 아니다. 새 조합을 지원하려면 native dependency lockfile, bootstrap/doctor 진단, clean-room, CI matrix를 함께 추가한다.

## 2. Development Environment SoT

개발환경의 기준은 사용자 Home, global package, IDE 설정 또는 OS registry가 아니라 다음 Repository 파일이다.

- `.node-version`: Node.js `24.18.1`
- `package.json#packageManager`: npm `11.16.0`
- `package-lock.json`: JavaScript와 native optional dependency 원장
- `.env.example`: 운영 환경변수 이름과 형식 예시
- `.gitattributes`: line ending 정책
- `scripts/lib/development-environment.mjs`: 지원 플랫폼과 환경 진단 규칙
- `.github/workflows/cross-platform-development.yml`: Windows/macOS 재현 게이트

OS 수준 prerequisite는 Git과 Repository에 고정된 Node.js runtime뿐이다. Docker, local database, Supabase CLI, Vercel CLI의 global 설치는 기본 mock 개발환경의 필수 조건이 아니다.

공식 local/GitHub 환경은 npm `11.16.0`을 사용한다. 설치 정책(`scripts/check-install-scripts.mjs`)은 GitHub 밖(로컬, 자체 호스팅 이미지의 Node 기본 npm)에서 검토된 npm `11.12.1` 이상 `11.x`를 허용하지만, 동일한 `install:trusted` 정책과 lockfile identity 검사를 통과해야 한다. npm 12는 별도 검토 전까지 거부한다. 이 하한은 폐기된 Vercel 빌더(RF-04, #537)를 위해 넓혔던 값이며, 좁히는 것은 별도 검토 대상이다.

## 3. 표준 명령

새 PC의 유일한 표준 흐름은 다음과 같다.

```text
git clone <repository>
npm run bootstrap
npm run doctor
npm run dev
```

이미 구성된 PC에서는 다음만 사용한다.

```text
git pull --rebase
npm run doctor
npm run dev
```

lint, typecheck, test, build와 교차 플랫폼 정책도 양쪽 OS에서 동일하다.

```text
npm run check:cross-platform
npm run lint
npm run typecheck:ci
npm test
npm run build
```

`dev:windows`, `dev:mac` 같은 OS별 표준 명령을 만들지 않는다.

## 4. bootstrap 계약

`npm run bootstrap`은 Node.js 표준 API와 child process argument 배열만 사용한다. 실행 권한, shell 문법, path separator 문자열 조립에 의존하지 않는다.

처리 순서는 다음과 같다.

1. OS와 CPU Architecture 감지
2. Node.js 24.18.1과 npm 11.16.0 확인
3. `.env.preview`가 없으면 gitignored `.env.preview`에 local mock profile 생성
4. `package-lock.json` 기반 dependency 설치
5. container/local DB/code generation 필요 여부 판정
6. doctor 전체 진단 실행

dependency 설치는 `.npmrc` 정책과 lockfile registry identity를 먼저 검증하는 `install:trusted` 경계를 사용한다. 모든 lifecycle script를 비활성화하고 optional native package를 포함한 뒤, 현재 플랫폼의 고정된 esbuild binary 무결성과 버전을 직접 확인한다. 같은 명령을 반복해도 기존 tracked 파일이나 환경 파일을 덮어쓰지 않는다. 실제 앱 설정은 `.env.preview`와 `.env.production`으로 분리하고, `.env.example`은 비밀값이 없는 공유용 변수 계약으로 유지한다. 과거 `.env`는 지원하지 않으며 doctor와 bootstrap이 거부한다.

CI에서는 `npm run bootstrap -- --ci`를 사용한다. clean checkout에는 secret 값을 출력하지 않는 임시 local mock profile을 생성하고, 의존성 설치 child process에는 application 환경을 전달하지 않는다. CI mode는 port 점유 검사만 생략한다.

## 5. doctor 계약

`npm run doctor`는 검사 전용이며 개발환경을 수정하지 않는다. 모든 항목은 다음 상태 중 하나로 출력한다.

- `PASS`: 현재 상태로 진행 가능
- `WARN`: 기본 개발을 막지 않지만 선택한 profile 또는 후속 작업에서 확인 필요
- `FAIL`: 해결 행동을 수행하기 전에는 개발 시작 불가

검사 대상은 다음과 같다.

- OS와 CPU Architecture
- Git, Node.js, npm
- dependency 설치 여부
- 환경변수 존재, 빈 값, 대소문자, URL/boolean/port/secret 형식
- Production의 mock data source 오사용
- cloud authentication과 project linking 필요 여부
- container runtime과 local database 필요 여부
- 개발 port 3000
- Repository filesystem 읽기/쓰기 권한
- 현재 Architecture용 native dependency lockfile 항목

Secret 값은 진단 결과에 포함하지 않는다. 실패 결과는 변수 이름, 고정된 오류 코드, 해결 행동만 출력한다.

## 6. 환경변수와 로컬 profile

환경변수 이름은 OS와 관계없이 같은 대문자 이름을 사용한다. `PATH`, `Path`, `path`처럼 같은 의미의 이름을 혼용하지 않는다.

| 실행 | 선택하는 설정 |
| --- | --- |
| `npm run dev`, `doctor`, `bootstrap` | 브랜치와 무관하게 `.env.preview` |
| `npm run build`, `npm start` — `main` | `.env.production` |
| `npm run build`, `npm start` — `dev`, `feat/*` 등 다른 브랜치 | `.env.preview` |
| CI(`CI=1`)·자체 호스팅 빌드(`SELF_HOST_BUILD=1`)에서 두 data source를 명시적으로 주입 | 주입한 환경만 사용 |
| 두 data source가 명시적으로 `mock`인 검증 | 주입한 합성 환경만 사용 |

`scripts/lib/project-environment.mjs`가 선택 계약의 최종 근거다. `NODE_ENV=production`은 최적화 모드이며 데이터 환경을 결정하지 않는다. 로컬 build/start에서 detached HEAD나 Git 조회 실패는 중단한다. 선택한 파일이 없으면 반대 환경이나 과거 `.env`로 대체하지 않는다. bootstrap은 파일이 없는 새 개발환경에만 외부 연결 없는 mock `.env.preview`를 생성한다. 두 실제 파일은 Git과 Docker context에서 제외하고 소유자 전용 권한으로 보관한다.

로컬 빌드 성공 시 산출물에 프로필 이름과 공개 설정의 해시만 기록한다. `npm start`는 이 기록이 현재 선택과 다르면 재빌드를 요구한다. Preview에서 만든 클라이언트 번들과 Production 서버 설정이 섞이는 실행을 방지하며 비밀값은 기록하지 않는다.

Next의 기본 dotenv 로더는 빌드 시 `.env.production`을 추가로 읽으므로, 표준 명령은 선택한 값을 먼저 주입한 후 `scripts/lib/next-environment.cjs`를 Node preload로 적용한다. 이 어댑터는 Next의 `@next/env` 진입점에서 추가 파일 읽기를 차단하며 worker에도 상속된다. 강제 재로딩과 standalone 산출물에도 다른 환경 파일이 유입되지 않는 것을 프로세스 회귀 테스트로 검증한다. Next 업그레이드 때 이 테스트를 유지한다. **환경 파일이나 브랜치를 바꾼 뒤 서버를 재시작하고, 공개 설정이 바뀌면 다시 빌드한다.** `npx next` 직접 실행은 이 저장소의 환경 선택을 우회하므로 사용하지 않는다.

최신 설정은 현재 자체 호스팅 서버의 해당 환경 `app.env`에서 가져온다. 폐기된 managed Supabase/Vercel 설정을 최신 원본으로 취급하지 않는다. Mac에서 사용할 파일에는 Compose 내부 `SUPABASE_INTERNAL_URL`을 그대로 복사하지 말고 검증된 공개 API 주소를 사용한다. localhost에서는 Preview 데이터와 세션 설정을 사용하되 사이트 origin은 실제 로컬 주소로 지정한다. 비밀을 출력하지 않고 각 환경에서 카테고리/공개 캐시 버전의 읽기 전용 요청으로 연결을 확인한다.

bootstrap의 mock Secret은 machine에서 무작위로 생성하고 출력하지 않는다. Production credential을 mock profile에 복사하지 않는다. `.env`, `.env.local`, `.env.development`, `.env.development.local` 같은 추가 파일은 doctor와 bootstrap이 거부한다. 일회성 아바타 migration(`migrate:legacy-member-avatars`)도 명시적으로 `.env.preview`를 사용한다.

doctor는 Preview 설정의 필수 변수, URL과 secret 형식을 검사한다. Production 검증 helper는 별도로 mock 충돌과 운영 필수값을 검사한다. 환경 파일은 Node dotenv 파서로 읽으며 shell 명령이나 `$VAR` 확장을 실행하지 않는다. 명시적인 프로세스 환경변수는 선택 파일보다 우선한다.

## 7. 경로, 파일, shell 정책

- 내부 경로는 script URL, Repository root와 Node.js `path` API에서 계산한다.
- `/Users/...`, `/Applications/...`, `/opt/homebrew/...`, `C:\Users\...`를 코드나 자동화에 기록하지 않는다.
- PATH는 `path.delimiter`, 파일 경로는 `path.join`/`path.resolve`로 처리한다.
- bootstrap, doctor, dev, migration, validation, release 핵심 로직을 `.sh`, `.bash`, `.zsh`, `.bat`, `.cmd`에 두지 않는다.
- `package.json#scripts`에서 shell chaining, POSIX 환경변수 prefix, OS 전용 파일 명령을 사용하지 않는다.
- tracked symlink와 executable bit를 필수 개발 인터페이스로 사용하지 않는다.
- 파일명과 import 대소문자를 정확히 일치시킨다.
- 기본 line ending은 LF이며 `.bat`와 `.cmd`만 명시적으로 CRLF를 허용한다.

`npm run check:cross-platform`이 이 계약, native package matrix, filename case collision, import case, CRLF, symlink를 검사한다.

## 8. Native dependency와 container

현재 lockfile은 최소 다음 native package 조합을 포함해야 한다.

- `@esbuild/win32-x64`, `@img/sharp-win32-x64`
- `@esbuild/darwin-arm64`, `@img/sharp-darwin-arm64`, `@img/sharp-libvips-darwin-arm64`

기본 개발 흐름은 container에 의존하지 않는다. 향후 local infrastructure에 container를 도입하면 동일 compose/configuration과 `amd64`/`arm64` image 지원을 확인하고 doctor에 필수 검사를 추가한다.

## 9. CI와 회귀 조건

Cross-Platform Development Environment workflow는 Windows x64와 macOS arm64에서 각각 다음을 실행한다.

1. bootstrap
2. doctor
3. cross-platform policy
4. lint
5. typecheck
6. test
7. build

package scripts, bootstrap, doctor, dev, build/test, env/filesystem/database/container/native dependency/runtime 버전을 바꾸는 PR은 양쪽 job이 모두 성공하기 전에는 merge하지 않는다.

Production migration과 Preview sync처럼 Linux runner에 고정된 privileged workflow는 개발자 OS의 SoT가 아니다. 해당 작업의 공용 인터페이스는 Repository의 Node.js/npm 명령으로 유지하고, provider mutation은 별도 운영 게이트를 따른다.

## 10. Clean-room과 handoff 확인표

release 후보 commit마다 Windows와 macOS에서 각각 다음을 확인한다.

```text
빈 디렉터리
→ clone
→ npm run bootstrap
→ npm run doctor
→ npm run dev
→ 공개 홈 smoke test
```

양방향 handoff는 다음을 확인한다.

```text
macOS 수정 → commit/push → Windows pull → doctor/dev/smoke
Windows 수정 → commit/push → macOS pull → doctor/dev/smoke
```

GitHub-hosted Windows/macOS matrix는 매 PR의 clean dependency 설치와 build 재현을 보장한다. 실제 개발자 machine handoff에서 새 차이가 발견되면 완료로 처리하지 않고 Issue #365에 OS, Architecture, 고정 오류 코드와 해결 결과를 기록한다.
