"use client";

import { useId, useMemo, useState } from "react";
import type { AdminGrantableMember } from "@/lib/admin-accounts";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type AdminMemberUsernameComboboxProps = {
  members: AdminGrantableMember[];
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export default function AdminMemberUsernameCombobox({
  members,
}: AdminMemberUsernameComboboxProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    const candidates = normalizedQuery
      ? members.filter((member) =>
          [
            member.username,
            member.displayName,
            member.permissionId ?? "",
          ].some((value) =>
            normalizeSearchValue(value).includes(normalizedQuery),
          ),
        )
      : members;

    return candidates.slice(0, 8);
  }, [members, query]);
  const open = focused && filteredMembers.length > 0;
  const activeMember = filteredMembers[activeIndex] ?? null;

  return (
    <div className="relative">
      <Input
        name="memberUsername"
        required
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeMember ? `${listboxId}-${activeMember.id}` : undefined
        }
        value={query}
        placeholder="이름 또는 username 검색"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (!open) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) =>
              Math.min(current + 1, filteredMembers.length - 1),
            );
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && activeMember) {
            event.preventDefault();
            setQuery(activeMember.username);
            setFocused(false);
          }
          if (event.key === "Escape") {
            setFocused(false);
          }
        }}
      />
      {focused ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface-elevated p-1 shadow-lg"
        >
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => (
              <button
                key={member.id}
                id={`${listboxId}-${member.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "grid w-full gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-surface-muted focus:bg-surface-muted focus:outline-none",
                  index === activeIndex ? "bg-surface-muted" : "",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(member.username);
                  setFocused(false);
                }}
              >
                <span className="font-medium text-foreground">
                  {member.displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  @{member.username}
                  {member.permissionId ? ` · ${member.permissionId}` : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
