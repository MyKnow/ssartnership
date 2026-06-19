import { redirect } from "next/navigation";

export const metadata = {
  title: "관리자 초기설정 종료",
  robots: {
    index: false,
    follow: true,
  },
};

export default function AdminSetupPage() {
  redirect("/admin");
}
