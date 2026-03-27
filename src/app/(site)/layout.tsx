import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import { getUserSession } from "@/lib/user-auth";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserSession();
  if (session?.mustChangePassword) {
    redirect("/auth/change-password");
  }
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
