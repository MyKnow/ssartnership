import { permanentRedirect } from "next/navigation";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `관리자 진입 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default function AdminLoginPage() {
  permanentRedirect("/auth/login?returnTo=%2Fadmin");
}
