"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";

const tabOptions = [
  {
    value: "immediate",
    label: "즉시 반영",
    description: "저장 즉시 서비스에 반영되는 정책",
  },
  {
    value: "approval",
    label: "승인 요청",
    description: "관리자 승인 후 반영되는 정책",
  },
] as const;

export default function AdminStyleGuideTabsDemo() {
  const [value, setValue] = useState<(typeof tabOptions)[number]["value"]>("immediate");

  return <Tabs value={value} onChange={setValue} options={tabOptions} />;
}
