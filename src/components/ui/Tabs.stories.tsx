"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Tabs from "./Tabs";

function TabsDemo() {
  const [value, setValue] = useState<"overview" | "benefits">("overview");

  return (
    <div className="grid max-w-2xl gap-4">
      <Tabs
        value={value}
        onChange={setValue}
        options={[
          {
            value: "overview",
            label: "개요",
            description: "제휴처 핵심 정보",
          },
          {
            value: "benefits",
            label: "혜택",
            description: "학생/운영진 전용 혜택",
          },
        ]}
      />
      <div className="rounded-card border border-border bg-surface p-5 shadow-flat">
        <p className="text-sm text-muted-foreground">
          현재 선택: <span className="font-semibold text-foreground">{value}</span>
        </p>
      </div>
    </div>
  );
}

const meta = {
  title: "UI/Tabs",
  component: TabsDemo,
} satisfies Meta<typeof TabsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
