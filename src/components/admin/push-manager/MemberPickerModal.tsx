import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { getSafeAdminResponseMessage } from "@/lib/admin-safe-messages";
import type { AdminPushManagerProps } from "./types";
import {
  filterAndSortRecipientOptions,
  formatRecipientMeta,
  type MemberSortOption,
} from "./recipient-members";

export function MemberPickerModal({
  open,
  members,
  selectedMemberIds,
  getMemberLabel,
  onToggleMember,
  onSelectAllFiltered,
  onRecipientOptionsLoaded,
  onClose,
}: {
  open: boolean;
  members: AdminPushManagerProps["members"];
  selectedMemberIds: string[];
  getMemberLabel: (member: AdminPushManagerProps["members"][number]) => string;
  onToggleMember: (memberId: string) => void;
  onSelectAllFiltered: (memberIds: string[]) => void;
  onRecipientOptionsLoaded?: (members: AdminPushManagerProps["members"]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<MemberSortOption>("name");
  const [searchResults, setSearchResults] = useState(members);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !onRecipientOptionsLoaded) {
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchPending(true);
        setSearchError(null);
        try {
          const params = new URLSearchParams({ limit: "30" });
          if (query.trim()) {
            params.set("query", query.trim());
          }
          const response = await fetch(`/api/admin/push/recipients?${params.toString()}`, {
            signal: abortController.signal,
          });
          const data = (await response.json().catch(() => null)) as {
            message?: string;
            recipients?: AdminPushManagerProps["members"];
          } | null;
          if (abortController.signal.aborted) {
            return;
          }
          if (!response.ok || !Array.isArray(data?.recipients)) {
            setSearchError(
              getSafeAdminResponseMessage(
                data?.message,
                "개인 발송 대상을 불러오지 못했습니다.",
              ),
            );
            return;
          }
          setSearchResults(data.recipients);
          onRecipientOptionsLoaded?.(data.recipients);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setSearchError("개인 발송 대상을 불러오지 못했습니다.");
        } finally {
          if (!abortController.signal.aborted) {
            setSearchPending(false);
          }
        }
      })();
    }, query.trim() ? 150 : 0);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [onRecipientOptionsLoaded, open, query]);

  const filteredMembers = useMemo(() => {
    return filterAndSortRecipientOptions(searchResults, query, sortBy, getMemberLabel);
  }, [getMemberLabel, query, searchResults, sortBy]);

  const selectedMembers = members.filter((member) => selectedMemberIds.includes(member.id));
  const selectedSummary =
    selectedMembers.length === 0
      ? "없음"
      : selectedMembers.length === 1
        ? getMemberLabel(selectedMembers[0])
        : `${getMemberLabel(selectedMembers[0])} 외 ${selectedMembers.length - 1}명`;

  return (
    <Modal
      open={open}
      title="개인 대상 선택"
      description="이름, Mattermost 아이디, 기수, 캠퍼스로 검색해 여러 명을 선택합니다."
      onClose={onClose}
      panelClassName="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-4xl sm:h-auto sm:max-h-[min(78vh,calc(100vh-2rem))]"
      bodyClassName="flex min-h-0 flex-col gap-3 overflow-hidden"
    >
      <div className="shrink-0 space-y-3">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          대상자 검색
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, Mattermost 아이디, 기수, 캠퍼스"
            className="h-10 sm:h-11"
          />
        </label>

        {searchError ? <InlineMessage tone="danger" description={searchError} /> : null}

        <div className="grid gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 grid gap-0.5 text-sm text-muted-foreground">
              <p className="truncate" role="status" aria-live="polite">
                {searchPending ? "대상자 검색 중" : `검색 결과 ${filteredMembers.length}명`}
              </p>
              <p className="truncate">현재 선택 {selectedMembers.length}명</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => onSelectAllFiltered(filteredMembers.map((member) => member.id))}
            >
              현재 결과 전체 선택
            </Button>
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm text-muted-foreground">정렬</span>
            <div className="grid grid-cols-3 gap-1 rounded-[1rem] border border-border bg-surface-control p-1">
              <Button
                type="button"
                size="sm"
                variant={sortBy === "name" ? "primary" : "secondary"}
                className="min-w-0 rounded-[0.85rem] px-2"
                onClick={() => setSortBy("name")}
              >
                이름순
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sortBy === "year" ? "primary" : "secondary"}
                className="min-w-0 rounded-[0.85rem] px-2"
                onClick={() => setSortBy("year")}
              >
                기수순
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sortBy === "campus" ? "primary" : "secondary"}
                className="min-w-0 rounded-[0.85rem] px-2"
                onClick={() => setSortBy("campus")}
              >
                캠퍼스순
              </Button>
            </div>
          </div>

          <p className="whitespace-normal break-words text-sm text-muted-foreground" title={selectedSummary}>
            선택된 인원 {selectedSummary}
          </p>
          <p className="text-xs text-muted-foreground">검색 결과는 한 번에 최대 30명까지 표시합니다.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface-inset">
        <div className="h-full overflow-y-auto">
          {filteredMembers.length > 0 ? (
            <div className="divide-y divide-border/70">
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className="grid min-h-11 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-2 text-left hover:bg-surface-muted focus-within:bg-surface-muted"
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleMember(member.id)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 grid gap-0.5">
                      <p className="min-w-0 break-words text-sm font-semibold text-foreground" title={getMemberLabel(member)}>
                        {member.display_name?.trim() || member.mm_username}
                        <span className="ml-2 font-normal text-muted-foreground">
                          @{member.mm_username}
                        </span>
                      </p>
                      <p className="min-w-0 break-words text-sm text-muted-foreground" title={member.year === null ? (member.campus ?? "캠퍼스 미지정") : formatRecipientMeta(member.year, member.campus)}>
                        {member.year === null ? (member.campus ?? "캠퍼스 미지정") : formatRecipientMeta(member.year, member.campus)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              검색 조건에 맞는 대상자가 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 grid gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-3 sm:flex sm:flex-row sm:justify-end">
        {selectedMembers.length > 0 ? (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => onSelectAllFiltered([])}>
            선택 해제
          </Button>
        ) : null}
        <Button variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
          취소
        </Button>
        <Button className="w-full sm:w-auto" onClick={onClose}>
          완료
        </Button>
      </div>
    </Modal>
  );
}
