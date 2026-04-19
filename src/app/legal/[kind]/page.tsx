import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import BackButton from "@/components/ui/BackButton";
import PolicyDocumentVersionSelect from "@/components/legal/PolicyDocumentVersionSelect";
import PolicyDocumentView from "@/components/legal/PolicyDocumentView";
import { getHeaderSession } from "@/lib/header-session";
import {
  getPolicyDescription,
  getPolicyDocumentsByKind,
  getPolicyKindLabel,
  isPolicyKind,
} from "@/lib/policy-documents";
import { SITE_NAME } from "@/lib/site";

type PageProps = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
};

function parseVersion(value?: string | string[]) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isVersionInList(version: number | null, list: number[]) {
  return typeof version === "number" && list.includes(version);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  if (!isPolicyKind(resolved.kind)) {
    return {
      title: `약관 | ${SITE_NAME}`,
    };
  }

  return {
    title: `${getPolicyKindLabel(resolved.kind)} | ${SITE_NAME}`,
  };
}

export default async function LegalPolicyPage({
  params,
  searchParams,
}: PageProps) {
  const [{ kind }, { version }] = await Promise.all([params, searchParams]);
  if (!isPolicyKind(kind)) {
    notFound();
  }

  const policies = await getPolicyDocumentsByKind(kind);
  const requestedVersion = parseVersion(version);
  if (policies.length === 0) {
    notFound();
  }

  const policy =
    isVersionInList(requestedVersion, policies.map((entry) => entry.version))
      ? policies.find((entry) => entry.version === requestedVersion) ?? null
      : policies[0] ?? null;
  if (!policy) {
    notFound();
  }

  const headerSession = await getHeaderSession();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BackButton />
              <PolicyDocumentVersionSelect
                kind={kind}
                policies={policies}
                currentVersion={policy.version}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                LEGAL
              </p>
              <h1 className="text-3xl font-semibold text-foreground">
                {policy.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {getPolicyDescription(kind)}
              </p>
            </div>
            <PolicyDocumentView policy={policy} />
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
