import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import LegalPolicyView from "@/components/legal/LegalPolicyView";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import {
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
      <LegalPolicyView kind={kind} policies={policies} policy={policy} />
      <Footer />
    </div>
  );
}
