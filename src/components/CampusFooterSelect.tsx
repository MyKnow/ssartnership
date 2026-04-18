"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { CAMPUS_DIRECTORY, getCampusPageHref } from "@/lib/campuses";

function getSelectedCampus(pathname: string) {
  const match = pathname.match(/^\/campuses\/([^/]+)/);
  return match?.[1] ?? "all";
}

export default function CampusFooterSelect({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const selectedCampus = useMemo(() => {
    if (!pathname) {
      return "";
    }
    return getSelectedCampus(pathname);
  }, [pathname]);

  return (
    <Select
      aria-label="캠퍼스별 제휴 페이지 이동"
      className={cn("min-w-[11rem] bg-surface-muted/90", className)}
      disabled={isPending}
      value={selectedCampus}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!nextValue) {
          return;
        }
        if (nextValue === "all") {
          startTransition(() => {
            router.push("/");
          });
          return;
        }
        const campus = CAMPUS_DIRECTORY.find((item) => item.slug === nextValue);
        if (!campus) {
          return;
        }
        startTransition(() => {
          router.push(getCampusPageHref(campus.slug));
        });
      }}
    >
      <option value="all">전체 캠퍼스</option>
      {CAMPUS_DIRECTORY.map((campus) => (
        <option key={campus.slug} value={campus.slug}>
          {campus.fullLabel}
        </option>
      ))}
    </Select>
  );
}
