import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type {
  AdminCategory,
  AdminPartner,
} from "@/components/admin/partner-manager/types";
import AdminPartnerManagerList from "./AdminPartnerManagerList";

const categories: AdminCategory[] = [
  { id: "category-food", key: "food", label: "식음료", description: "점심, 카페, 야식", color: "#2563eb" },
  { id: "category-study", key: "study", label: "학습", description: "스터디룸, 문구, 프린트", color: "#0f766e" },
];

const partners: AdminPartner[] = [
  {
    id: "partner-1",
    categoryId: "category-food",
    companyId: "company-1",
    name: "역삼 분식랩",
    location: "서울 강남구 테헤란로 212",
    managedCampusSlugs: ["seoul"],
    mapUrl: null,
    benefits: ["전 메뉴 10% 할인", "점심 세트 음료 무료 업그레이드"],
    conditions: ["학생증 또는 SSAFY 인증 화면 제시"],
    appliesTo: [],
    visibility: "public",
    periodStart: "2026-04-01",
    periodEnd: "2026-12-31",
    tags: ["점심", "혼밥"],
    company: {
      id: "company-1",
      name: "분식랩",
      slug: "bunsik-lab",
    },
  },
  {
    id: "partner-2",
    categoryId: "category-study",
    companyId: "company-2",
    name: "루프 스터디카페",
    location: "서울 강남구 논현로 100",
    managedCampusSlugs: ["seoul"],
    mapUrl: null,
    benefits: ["2시간 이상 결제 시 1시간 추가"],
    conditions: ["오후 6시 이전 입실"],
    appliesTo: [],
    visibility: "private",
    periodStart: "2026-04-10",
    periodEnd: "2026-11-30",
    tags: ["예약필수"],
    company: {
      id: "company-2",
      name: "루프 스터디",
      slug: "loop-study",
    },
  },
];

const meta = {
  title: "Domains/Admin/PartnerManager/AdminPartnerManagerList",
  component: AdminPartnerManagerList,
  args: {
    partners,
    categories,
  },
} satisfies Meta<typeof AdminPartnerManagerList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    partners: [],
  },
};

export const NoPartners: Story = {
  args: {
    partners: [],
  },
};
