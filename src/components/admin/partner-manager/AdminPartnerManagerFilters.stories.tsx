import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CategoryKey } from "@/lib/types";
import type { PartnerSortOption } from "@/components/PartnerFilters";
import type { VisibilityFilter } from "@/components/admin/partner-manager/types";
import AdminPartnerManagerFilters from "./AdminPartnerManagerFilters";

function AdminPartnerManagerFiltersStory() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

  return (
    <AdminPartnerManagerFilters
      categoryOptions={[
        { key: "food", label: "식음료", description: "점심, 카페, 야식" },
        { key: "study", label: "학습", description: "스터디룸, 문구, 프린트" },
        { key: "life", label: "생활", description: "세탁, 병원, 편의" },
      ]}
      partnersCount={42}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      sortValue={sortValue}
      setSortValue={setSortValue}
      visibilityFilter={visibilityFilter}
      setVisibilityFilter={setVisibilityFilter}
    />
  );
}

const meta = {
  title: "Domains/Admin/PartnerManager/AdminPartnerManagerFilters",
  component: AdminPartnerManagerFiltersStory,
} satisfies Meta<typeof AdminPartnerManagerFiltersStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
