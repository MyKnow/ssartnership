import CertificationView from "@/components/certification/CertificationView";
import Card from "@/components/ui/Card";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";

export default function AdminAllCertificationCardMocks({ themes, member, initialTimestamp }: { themes: CohortCardTheme[]; member: { displayName: string; campus: string; profileImageUrl: string | null }; initialTimestamp: string }) {
  const generations = Array.from(new Set([0, ...themes.map((theme) => theme.cohortYear)])).sort((a, b) => b - a);
  return <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{generations.map((generation) => <Card key={generation} className="grid min-w-0 max-w-full gap-3 overflow-hidden p-4"><p className="min-w-0 truncate text-sm font-semibold text-foreground">{generation === 0 ? "운영진" : `${generation}기`} 인증 카드</p><CertificationView member={{ ...member, generation }} initialTimestamp={initialTimestamp} disableTracking cohortCardThemes={themes} /></Card>)}</div>;
}
