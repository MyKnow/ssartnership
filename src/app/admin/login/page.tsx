import { redirect } from "next/navigation";
import { setAdminSession, validateAdminCredentials } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

async function loginAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");

  if (validateAdminCredentials(id, password)) {
    await setAdminSession();
    redirect("/admin");
  }

  redirect("/admin/login?error=1");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              SSAFY 15기 Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              관리자 로그인
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <form className="mt-6 flex flex-col gap-4" action={loginAction}>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            ID
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              name="id"
              placeholder="운영진 ID"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              name="password"
              type="password"
              placeholder="비밀번호"
              required
            />
          </label>

          {hasError ? (
            <p className="text-xs font-semibold text-rose-500">
              로그인 정보가 일치하지 않습니다.
            </p>
          ) : null}

          <button
            className="mt-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white"
            type="submit"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
