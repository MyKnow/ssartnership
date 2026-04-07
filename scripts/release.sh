#!/usr/bin/env bash
set -euo pipefail

RELEASE_TYPE="${1:-}"
COMMIT_MESSAGE="${*:2}"

normalize_release_type() {
  case "${1:-}" in
    1|patch|PATCH)
      echo "patch"
      ;;
    2|minor|MINOR)
      echo "minor"
      ;;
    3|major|MAJOR)
      echo "major"
      ;;
    *)
      return 1
      ;;
  esac
}

trim_trailing_newlines() {
  local value="$1"
  while [[ "$value" == *$'\n' ]]; do
    value="${value%$'\n'}"
  done
  printf '%s' "$value"
}

prompt_release_type() {
  if normalized_release_type="$(normalize_release_type "$RELEASE_TYPE")"; then
    RELEASE_TYPE="$normalized_release_type"
    return
  fi

  while true; do
    echo "릴리즈 타입을 선택하세요."
    echo "1) patch"
    echo "2) minor"
    echo "3) major"
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
      *)
        echo "patch, minor, major 중 하나를 선택하세요."
        ;;
    esac
  done
}

prompt_commit_message() {
  if [[ -n "${COMMIT_MESSAGE// }" ]]; then
    COMMIT_MESSAGE="$(trim_trailing_newlines "$COMMIT_MESSAGE")"
    return
  fi

  if [[ ! -t 0 ]]; then
    COMMIT_MESSAGE="$(trim_trailing_newlines "$(cat)")"
    if [[ -n "${COMMIT_MESSAGE// }" ]]; then
      return
    fi
  fi

  while true; do
    echo "커밋 메시지를 입력하세요."
    echo "- 여러 줄 붙여넣기를 지원합니다."
    echo "- 입력이 끝나면 빈 줄을 한 번 더 입력하세요."

    local line=""
    local lines=()

    while IFS= read -r line; do
      if [[ -z "$line" ]]; then
        if [[ ${#lines[@]} -eq 0 ]]; then
          echo "커밋 메시지는 비워둘 수 없습니다."
          continue
        fi
        break
      fi
      lines+=("$line")
    done

    COMMIT_MESSAGE="$(trim_trailing_newlines "$(printf '%s\n' "${lines[@]}")")"
    if [[ -n "${COMMIT_MESSAGE// }" ]]; then
      return
    fi
    echo "커밋 메시지는 비워둘 수 없습니다."
  done
}

prompt_confirm() {
  while true; do
    read -r -p "위 내용으로 commit, tag, push를 진행할까요? (y/n): " confirm
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

prompt_release_type
prompt_commit_message

echo
echo "현재 브랜치: $CURRENT_BRANCH"
echo "현재 버전: $CURRENT_VERSION"
echo "릴리즈 타입: $RELEASE_TYPE"
echo "커밋 메시지:"
printf '%s\n' "$COMMIT_MESSAGE"
echo

if ! prompt_confirm; then
  echo "작업을 취소했습니다."
  exit 0
fi

npm version "$RELEASE_TYPE" --no-git-tag-version >/dev/null
NEXT_VERSION="$(node -p "require('./package.json').version")"
TAG_NAME="v$NEXT_VERSION"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "이미 존재하는 태그입니다: $TAG_NAME"
  exit 1
fi

git add -A
git commit -m "$COMMIT_MESSAGE"
git tag -a "$TAG_NAME" -m "$TAG_NAME"
git push origin "$CURRENT_BRANCH"
git push origin "$TAG_NAME"

echo
echo "릴리즈 완료"
echo "버전: $CURRENT_VERSION -> $NEXT_VERSION"
echo "태그: $TAG_NAME"
