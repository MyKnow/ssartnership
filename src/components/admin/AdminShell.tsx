import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { logout } from "@/app/admin/(protected)/actions";

export default function AdminShell({
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <Container className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {SITE_NAME}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {backHref && backLabel ? (
              <Button variant="ghost" href={backHref}>
                {backLabel}
              </Button>
            ) : null}
            <Button variant="ghost" href="/">
              사용자 화면
            </Button>
            <ThemeToggle />
            <AdminLogoutButton action={logout} />
          </div>
        </Container>
      </header>

      <main>
        <Container className="pb-16 pt-10">{children}</Container>
      </main>
    </div>
  );
}
