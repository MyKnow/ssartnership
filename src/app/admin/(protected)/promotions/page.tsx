import { permanentRedirect } from "next/navigation";

export default function AdminPromotionsRedirectPage() {
  permanentRedirect("/admin/advertisement");
}
