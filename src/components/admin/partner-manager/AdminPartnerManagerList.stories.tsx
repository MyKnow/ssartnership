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
    category_id: "category-food",
    name: "역삼 분식랩",
    location: "서울 강남구 테헤란로 212",
    benefits: ["전 메뉴 10% 할인", "점심 세트 음료 무료 업그레이드"],
    conditions: ["학생증 또는 SSAFY 인증 화면 제시"],
    visibility: "public",
    period_start: "2026-04-01",
    period_end: "2026-12-31",
    tags: ["점심", "혼밥"],
    company: {
      id: "company-1",
      name: "분식랩",
      slug: "bunsik-lab",
      description: "점심 세트와 분식을 빠르게 제공하는 제휴처",
      is_active: true,
    },
  },
  {
    id: "partner-2",
    category_id: "category-study",
    name: "루프 스터디카페",
    location: "서울 강남구 논현로 100",
    benefits: ["2시간 이상 결제 시 1시간 추가"],
    conditions: ["오후 6시 이전 입실"],
    visibility: "private",
    period_start: "2026-04-10",
    period_end: "2026-11-30",
    tags: ["예약필수"],
    company: {
      id: "company-2",
      name: "루프 스터디",
      slug: "loop-study",
      description: "역삼역 인근 조용한 스터디 공간",
      is_active: true,
    },
  },
];

const meta = {
  title: "Domains/Admin/PartnerManager/AdminPartnerManagerList",
  component: AdminPartnerManagerList,
  args: {
    partners,
    filteredPartners: partners,
    categories,
  },
} satisfies Meta<typeof AdminPartnerManagerList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    filteredPartners: [],
  },
};

export const NoPartners: Story = {
  args: {
    partners: [],
    filteredPartners: [],
  },
};
