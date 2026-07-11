import Select from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  CAMPUS_DIRECTORY,
  type CampusSlug,
} from "@/lib/campuses";
import {
  PARTNER_AUDIENCE_FILTER_OPTIONS,
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";
import {
  partnerSortOptions,
  type PartnerSortOption,
} from "@/components/partner-filters/options";

export default function PartnerAdvancedFilterFields({
  campusFilter,
  onCampusFilterChange,
  appliesToFilter,
  onAppliesToFilterChange,
  sortValue,
  onSortChange,
  layout = "toolbar",
  testIdSuffix = "",
}: {
  campusFilter: CampusSlug | "all";
  onCampusFilterChange: (value: CampusSlug | "all") => void;
  appliesToFilter: PartnerAudienceFilter;
  onAppliesToFilterChange: (value: PartnerAudienceFilter) => void;
  sortValue: PartnerSortOption;
  onSortChange: (value: PartnerSortOption) => void;
  layout?: "toolbar" | "sidebar";
  testIdSuffix?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-3",
        layout === "toolbar" ? "sm:grid-cols-3" : "grid-cols-1",
      )}
    >
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="ui-caption">캠퍼스</span>
        <Select
          value={campusFilter}
          onChange={(event) =>
            onCampusFilterChange(event.target.value as CampusSlug | "all")
          }
          data-testid={`partner-campus-filter${testIdSuffix}`}
        >
          <option value="all">전체 캠퍼스</option>
          {CAMPUS_DIRECTORY.map((campus) => (
            <option key={campus.slug} value={campus.slug}>
              {campus.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="ui-caption">적용 대상</span>
        <Select
          value={appliesToFilter}
          onChange={(event) =>
            onAppliesToFilterChange(
              event.target.value as PartnerAudienceFilter,
            )
          }
          data-testid={`partner-audience-filter${testIdSuffix}`}
        >
          {PARTNER_AUDIENCE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="ui-caption">정렬</span>
        <Select
          value={sortValue}
          onChange={(event) =>
            onSortChange(event.target.value as PartnerSortOption)
          }
          data-testid={`partner-sort-select${testIdSuffix}`}
        >
          {partnerSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
