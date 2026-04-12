import Card from "@/components/ui/Card";
import type { ComponentPropsWithoutRef } from "react";

type SurfaceProps = ComponentPropsWithoutRef<typeof Card>;

export default function Surface(props: SurfaceProps) {
  return <Card {...props} />;
}
