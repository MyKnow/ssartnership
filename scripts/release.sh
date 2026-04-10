#!/usr/bin/env bash
set -euo pipefail

CURRENT_BRANCH=""
CURRENT_VERSION=""
NEXT_VERSION=""
RELEASE_TYPE=""
RUN_LIGHTHOUSE="no"
COMMIT_MESSAGE_MODE=""
COMMIT_MESSAGE=""
CREATE_TAG="no"
TAG_NAME=""
MARKDOWN_MESSAGE_FILE=""

trim_trailing_newlines() {
  local value="$1"
  while [[ "$value" == *$'\n' ]]; do
    value="${value%$'\n'}"
  done
  printf '%s' "$value"
}

trim_whitespace() {
  local value="$1"
  if [[ -z "$value" ]]; then
    printf '%s' "$value"
    return
  fi

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

run_editor() {
  local editor_command="$1"
  local file_path="$2"

  sh -c "$editor_command \"\$1\"" sh "$file_path"
}

prompt_lighthouse_check() {
  while true; do
    echo "Lighthouse 검사를 실행할까요?"
    echo "1) 실행"
    echo "2) 건너뛴다"
    read -r -p "> " lighthouse_choice

    case "$lighthouse_choice" in
      1|y|Y|yes|YES|run)
        RUN_LIGHTHOUSE="yes"
        return
        ;;
      2|n|N|no|NO|skip)
        RUN_LIGHTHOUSE="no"
        return
        ;;
      *)
        echo "1 또는 2를 선택하세요."
        ;;
    esac
  done
}

prompt_release_type() {
  while true; do
    echo "버전 업데이트 방식을 선택하세요."
    echo "1) patch"
    echo "2) minor"
    echo "3) major"
    echo "4) no update"
    read -r -p "> " release_choice

    case "$release_choice" in
      1|patch|PATCH)
        RELEASE_TYPE="patch"
        return
        ;;
      2|minor|MINOR)
        RELEASE_TYPE="minor"
        return
        ;;
      3|major|MAJOR)
        RELEASE_TYPE="major"
        return
        ;;
      4|none|NONE|no\ update|no-update|skip|SKIP)
        RELEASE_TYPE="none"
        return
        ;;
      *)
        echo "patch, minor, major, no update 중 하나를 선택하세요."
        ;;
    esac
  done
}

prompt_commit_message_mode() {
  while true; do
    echo "커밋 메시지 입력 방식을 선택하세요."
    echo "1) simple"
    echo "2) markdown"
    read -r -p "> " mode_choice

    case "$mode_choice" in
      1|simple|SIMPLE)
        COMMIT_MESSAGE_MODE="simple"
        return
        ;;
      2|markdown|MARKDOWN|md|MD)
        COMMIT_MESSAGE_MODE="markdown"
        return
        ;;
      *)
        echo "simple 또는 markdown을 선택하세요."
        ;;
    esac
  done
}

prompt_simple_commit_message() {
  while true; do
    read -r -p "커밋 메시지: " raw_message
    COMMIT_MESSAGE="$(trim_whitespace "$raw_message")"
    if [[ -n "$COMMIT_MESSAGE" ]]; then
      return
    fi
    echo "커밋 메시지는 비워둘 수 없습니다."
  done
}

read_markdown_commit_message() {
  local file_path="$1"
  local -a lines=()
  local line=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    lines+=("$line")
  done < "$file_path"

  local start=0
  local end=$(( ${#lines[@]} - 1 ))

  while (( start <= end )) && [[ "${lines[start]}" =~ ^[[:space:]]*$ ]]; do
    ((start++))
  done

  while (( end >= start )) && [[ "${lines[end]}" =~ ^[[:space:]]*$ ]]; do
    ((end--))
  done

  if (( start > end )); then
    return 1
  fi

  local -a normalized=()
  local index=0
  for ((index = start; index <= end; index += 1)); do
    normalized+=("${lines[index]}")
  done

  printf '%s\n' "${normalized[@]}"
}

prompt_markdown_commit_message() {
  local editor

  MARKDOWN_MESSAGE_FILE="$(mktemp "${TMPDIR:-/tmp}/ssartnership-release-message.XXXXXX.md")"
  trap 'rm -f "$MARKDOWN_MESSAGE_FILE"' EXIT

  editor="${VISUAL:-${EDITOR:-vi}}"

  cat > "$MARKDOWN_MESSAGE_FILE" <<'EOF'
# 커밋 메시지를 작성하세요.
# - 첫 줄은 subject입니다.
# - 아래에 본문을 여러 줄로 작성할 수 있습니다.
# - '#'로 시작하는 줄은 무시됩니다.
#
# 예:
# feat: release flow interactive prompts
#
# release.sh에 Lighthouse/버전/태그/커밋 메시지 흐름을 추가한다.
EOF

  while true; do
    echo "Markdown 파일을 편집한 뒤 저장하고 종료하세요."
    echo "파일: $MARKDOWN_MESSAGE_FILE"
    if ! run_editor "$editor" "$MARKDOWN_MESSAGE_FILE"; then
      if [[ "$editor" != "vi" ]]; then
        editor="vi"
        if ! run_editor "$editor" "$MARKDOWN_MESSAGE_FILE"; then
          echo "편집기를 실행할 수 없습니다."
          exit 1
        fi
      else
        echo "편집기를 실행할 수 없습니다."
        exit 1
      fi
    fi

    if COMMIT_MESSAGE="$(read_markdown_commit_message "$MARKDOWN_MESSAGE_FILE")"; then
      COMMIT_MESSAGE="$(trim_trailing_newlines "$COMMIT_MESSAGE")"
      if [[ -n "$COMMIT_MESSAGE" ]]; then
        return
      fi
    fi

    echo "커밋 메시지가 비어 있습니다. 다시 편집하세요."
  done
}

prompt_tag_choice() {
  while true; do
    echo "태그를 붙일까요?"
    echo "1) 붙인다"
    echo "2) 붙이지 않는다"
    read -r -p "> " tag_choice

    case "$tag_choice" in
      1|y|Y|yes|YES|tag)
        CREATE_TAG="yes"
        return
        ;;
      2|n|N|no|NO|skip)
        CREATE_TAG="no"
        return
        ;;
      *)
        echo "1 또는 2를 선택하세요."
        ;;
    esac
  done
}

prompt_confirm() {
  while true; do
    read -r -p "위 설정으로 진행할까요? (y/n): " confirm
    case "$confirm" in
      y|Y|yes|YES)
        return 0
        ;;
      n|N|no|NO)
        return 1
        ;;
      *)
        echo "y 또는 n으로 입력하세요."
        ;;
    esac
  done
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git 저장소에서 실행해야 합니다."
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "현재 브랜치를 확인할 수 없습니다. detached HEAD 상태인지 확인하세요."
  exit 1
fi

if git diff --quiet && git diff --cached --quiet; then
  echo "커밋할 변경사항이 없습니다."
  exit 1
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"

prompt_lighthouse_check
prompt_release_type
prompt_commit_message_mode

case "$COMMIT_MESSAGE_MODE" in
  simple)
    prompt_simple_commit_message
    ;;
  markdown)
    prompt_markdown_commit_message
    ;;
  *)
    echo "커밋 메시지 입력 방식을 확인할 수 없습니다."
    exit 1
    ;;
esac

prompt_tag_choice

LIGHTHOUSE_LABEL="건너뜀"
if [[ "$RUN_LIGHTHOUSE" == "yes" ]]; then
  LIGHTHOUSE_LABEL="실행"
fi

RELEASE_TYPE_LABEL="$RELEASE_TYPE"
if [[ "$RELEASE_TYPE_LABEL" == "none" ]]; then
  RELEASE_TYPE_LABEL="no update"
fi

TAG_LABEL="생략"
if [[ "$CREATE_TAG" == "yes" ]]; then
  TAG_LABEL="생성"
fi

echo
echo "현재 브랜치: $CURRENT_BRANCH"
echo "현재 버전: $CURRENT_VERSION"
echo "Lighthouse: $LIGHTHOUSE_LABEL"
echo "버전 업데이트: $RELEASE_TYPE_LABEL"
echo "커밋 메시지 형식: $COMMIT_MESSAGE_MODE"
echo "태그: $TAG_LABEL"
if [[ "$RELEASE_TYPE" == "none" && "$CREATE_TAG" == "yes" ]]; then
  echo "안내: 현재 버전 v$CURRENT_VERSION 기준으로 태그를 생성합니다."
fi
echo "커밋 메시지:"
printf '%s\n' "$COMMIT_MESSAGE"
echo

if ! prompt_confirm; then
  echo "작업을 취소했습니다."
  exit 0
fi

if [[ "$RUN_LIGHTHOUSE" == "yes" ]]; then
  npm run perf:lighthouse
else
  echo "Lighthouse 검사를 건너뜁니다."
fi

NEXT_VERSION="$CURRENT_VERSION"
if [[ "$RELEASE_TYPE" != "none" ]]; then
  npm version "$RELEASE_TYPE" --no-git-tag-version >/dev/null
  NEXT_VERSION="$(node -p "require('./package.json').version")"
fi

if [[ "$CREATE_TAG" == "yes" ]]; then
  TAG_NAME="v$NEXT_VERSION"
  if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "이미 존재하는 태그입니다: $TAG_NAME"
    exit 1
  fi
fi

git add -A
git commit -m "$COMMIT_MESSAGE"

if [[ "$CREATE_TAG" == "yes" ]]; then
  git tag -a "$TAG_NAME" -m "$TAG_NAME"
fi

git push --no-verify origin "$CURRENT_BRANCH"

if [[ "$CREATE_TAG" == "yes" ]]; then
  git push --no-verify origin "$TAG_NAME"
fi

echo
echo "릴리즈 완료"
echo "버전: $CURRENT_VERSION -> $NEXT_VERSION"
if [[ "$CREATE_TAG" == "yes" ]]; then
  echo "태그: $TAG_NAME"
else
  echo "태그: 없음"
fi
