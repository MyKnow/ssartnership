import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type {
  AdminReviewCompanyOption,
  AdminReviewFilters as AdminReviewFiltersValue,
  AdminReviewPartnerOption,
} from "@/lib/admin-reviews";
import AdminReviewFilters from "./AdminReviewFilters";

const filters: AdminReviewFiltersValue = {
  sort: "latest",
  status: "all",
  companyId: "",
  partnerId: "",
  rating: "all",
  imagesOnly: false,
  memberQuery: "ssafy",
};

const companies: AdminReviewCompanyOption[] = [
  { id: "company-1", name: "분식랩", slug: "bunsik-lab" },
  { id: "company-2", name: "카페 루프", slug: "cafe-loop" },
];

const partners: AdminReviewPartnerOption[] = [
  {
    id: "partner-1",
    name: "역삼 분식랩",
    companyId: "company-1",
    companyName: "분식랩",
    companySlug: "bunsik-lab",
  },
  {
    id: "partner-2",
    name: "카페 루프 역삼점",
    companyId: "company-2",
    companyName: "카페 루프",
    companySlug: "cafe-loop",
  },
];

const meta = {
  title: "Domains/Admin/ReviewManager/AdminReviewFilters",
  component: AdminReviewFilters,
  args: {
    filters,
    companies,
    partners,
  },
} satisfies Meta<typeof AdminReviewFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ImagesOnly: Story = {
  args: {
    filters: {
      ...filters,
      imagesOnly: true,
      status: "hidden",
      rating: "5",
    },
  },
};
