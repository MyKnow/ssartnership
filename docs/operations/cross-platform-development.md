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

공식 local/GitHub 환경은 npm `11.16.0`을 사용한다. Vercel은 provider가 제공하는 검토된 npm `11.12.1` 이상 `11.x`를 허용하지만, 동일한 `install:trusted` 정책과 lockfile identity 검사를 통과해야 한다. npm 12는 별도 검토 전까지 거부한다.

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
3. `.env`가 없으면 gitignored `.env`에 local mock profile 생성
4. `package-lock.json` 기반 dependency 설치
5. container/local DB/code generation 필요 여부 판정
6. doctor 전체 진단 실행

dependency 설치는 `.npmrc` 정책과 lockfile registry identity를 먼저 검증하는 `install:trusted` 경계를 사용한다. 모든 lifecycle script를 비활성화하고 optional native package를 포함한 뒤, 현재 플랫폼의 고정된 esbuild binary 무결성과 버전을 직접 확인한다. 같은 명령을 반복해도 기존 tracked 파일이나 환경 파일을 덮어쓰지 않는다. 기존 `.env`가 있으면 bootstrap은 내용을 변경하지 않는다. 프로젝트 루트의 실제 환경 파일은 `.env` 하나만 허용하고, `.env.example`은 실제 비밀값이 없는 공유용 변수 계약으로만 유지한다.

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

bootstrap이 만드는 `.env` local mock profile은 외부 cloud, container, local DB 없이 화면과 테스트를 시작하기 위한 값만 포함한다. Secret은 machine에서 무작위로 생성하고 출력하지 않는다. Production credential을 local mock profile에 복사하지 않는다. `.env.local`, `.env.development`, `.env.development.local` 같은 추가 파일은 우선순위를 숨기므로 doctor와 bootstrap이 거부한다.

Supabase 또는 Production profile을 선택하면 doctor는 필요한 cloud 변수, HTTPS URL, secret 길이, placeholder, Production/mock 충돌을 fail-closed로 검증한다. `.env` 처리는 shell의 `export`, `set`, `$VAR`, `%VAR%` 문법을 사용하지 않는다.

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
