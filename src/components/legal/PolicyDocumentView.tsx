import Card from "@/components/ui/Card";
import type { PolicyDocument } from "@/lib/policy-documents";

function renderBlocks(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        return null;
      }

      if (lines[0]?.startsWith("## ")) {
        const title = lines[0].slice(3).trim();
        const rest = lines.slice(1);
        return (
          <section key={`${title}-${index}`} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {rest.length > 0 ? renderParagraphLike(rest, index) : null}
          </section>
        );
      }

      return (
        <section key={`block-${index}`} className="space-y-3">
          {renderParagraphLike(lines, index)}
        </section>
      );
    });
}

function renderParagraphLike(lines: string[], indexSeed: number) {
  if (lines.every((line) => line.startsWith("- "))) {
    return (
      <ul className="space-y-2 text-sm leading-7 text-foreground/90">
        {lines.map((line, index) => (
          <li key={`${indexSeed}-${index}`} className="flex gap-2">
            <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span>{line.slice(2).trim()}</span>
          </li>
        ))}
      </ul>
    );
  }

  return lines.map((line, index) => (
    <p key={`${indexSeed}-${index}`} className="text-sm leading-7 text-foreground/90">
      {line}
    </p>
  ));
}

export default function PolicyDocumentView({
  policy,
}: {
  policy: PolicyDocument;
}) {
  return (
    <Card tone="elevated" className="space-y-6">
      <div className="space-y-5">{renderBlocks(policy.content)}</div>
    </Card>
  );
}
