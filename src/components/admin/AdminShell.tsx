import ThemeToggle from "@/components/ThemeToggle";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
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
      <header className="border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Container className="flex items-start justify-between gap-4 py-5 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {SITE_NAME}
            </p>
            <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
                {description}
              </p>
            ) : null}
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
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
          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <AdminMobileNav
              title={title}
              description={description}
              backHref={backHref}
              backLabel={backLabel}
              logoutAction={logout}
            />
          </div>
        </Container>
      </header>

      <main>
        <Container className="pb-16 pt-10">{children}</Container>
      </main>
    </div>
  );
}
