import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminReviewImageGallery from "./AdminReviewImageGallery";

const demoImageA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
    <rect width="720" height="720" fill="#dbeafe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1d4ed8" font-size="44" font-family="sans-serif">Admin Review A</text>
  </svg>`,
)}`;

const demoImageB = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
    <rect width="720" height="720" fill="#e0f2fe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#0f766e" font-size="44" font-family="sans-serif">Admin Review B</text>
  </svg>`,
)}`;

const meta = {
  title: "Domains/Admin/ReviewManager/AdminReviewImageGallery",
  component: AdminReviewImageGallery,
  args: {
    images: [],
  },
} satisfies Meta<typeof AdminReviewImageGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithImages: Story = {
  args: {
    images: [demoImageA, demoImageB, demoImageA],
  },
};
