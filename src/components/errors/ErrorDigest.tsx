/**
 * Shows the Next.js server error digest so an operator can match a user's
 * report to the `[request-error]` line in the container log. The digest is an
 * opaque hash; the original error message is never rendered.
 */
export default function ErrorDigest({ digest }: { digest?: string }) {
  if (!digest) {
    return null;
  }
  return (
    <div className="rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        오류 코드
      </p>
      <p className="mt-1 break-all font-mono text-xs text-foreground">{digest}</p>
    </div>
  );
}
