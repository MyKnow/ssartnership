"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Select from "@/components/ui/Select";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";

type AdminCycleGenerationSelectorProps = {
  generations: readonly number[];
  selectedGeneration: number;
};

export default function AdminCycleGenerationSelector({
  generations,
  selectedGeneration,
}: AdminCycleGenerationSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(window.location.search);
    const generation = event.currentTarget.value;

    params.set("generation", generation);
    params.delete("status");
    params.delete("error");

    const query = params.toString();
    const targetPath = pathname ?? "/admin/cycle";
    router.push(
      targetPath +
        (query ? "?" + query : "") +
        "#cycle-generation-" +
        generation,
    );
  }

  return (
    <label className="grid min-w-48 gap-2 text-sm font-medium text-foreground">
      표시할 기수
      <Select
        aria-label="표시할 기수"
        value={String(selectedGeneration)}
        onChange={handleChange}
      >
        {generations.map((generation) => (
          <option key={generation} value={generation}>
            {formatSsafyYearLabel(generation)}
          </option>
        ))}
      </Select>
    </label>
  );
}
