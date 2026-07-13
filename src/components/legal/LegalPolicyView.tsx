import BackButton from "@/components/ui/BackButton";
import Container from "@/components/ui/Container";
import PolicyDocumentVersionSelect from "@/components/legal/PolicyDocumentVersionSelect";
import PolicyDocumentView from "@/components/legal/PolicyDocumentView";
import {
  getPolicyDescription,
  type PolicyDocument,
  type PolicyKind,
} from "@/lib/policy-documents";

export default function LegalPolicyView({
  kind,
  policies,
  policy,
}: {
  kind: PolicyKind;
  policies: PolicyDocument[];
  policy: PolicyDocument;
}) {
  return (
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
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              LEGAL
            </p>
            <h1 className="text-ko-title text-3xl font-semibold text-foreground">
              {policy.title}
            </h1>
            <p className="text-ko-pretty text-sm text-muted-foreground">
              {getPolicyDescription(kind)}
            </p>
          </div>
          <PolicyDocumentView policy={policy} />
        </div>
      </Container>
    </main>
  );
}
