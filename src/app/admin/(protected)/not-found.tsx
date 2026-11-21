import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNotFoundRecovery } from "@/components/admin/admin-navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getForwardedRequestPath } from "@/lib/request-path";

/**
 * Catches `notFound()` from admin detail routes inside the protected layout, so
 * the admin shell stays mounted instead of falling back to the public 404.
 */
export default async function AdminNotFound() {
  const recovery = getAdminNotFoundRecovery(
    getForwardedRequestPath(await headers()),
  );
  const hasSectionRecovery = recovery.href !== "/admin";

  return (
    <AdminShell
      title="화면을 찾을 수 없음"
      backHref={recovery.href}
      backLabel={recovery.label}
    >
      <Card tone="elevated" className="mx-auto grid w-full max-w-xl gap-5">
        <div className="grid gap-2">
          <p className="ui-kicker">404</p>
          <h1 className="ui-section-title text-ko-title">
            요청한 관리 화면을 찾을 수 없습니다
          </h1>
          <p className="ui-body text-ko-pretty">
            삭제되었거나 주소가 잘못되었을 수 있습니다. 목록에서 다시 찾아 주세요.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {hasSectionRecovery ? (
            <Button href="/admin" variant="secondary" className="w-full sm:w-auto">
              관리 홈
            </Button>
          ) : null}
          <Button href={recovery.href} className="w-full sm:w-auto">
            {recovery.label}
          </Button>
        </div>
      </Card>
    </AdminShell>
  );
}
