import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { CustomerForm } from "../CustomerForm";

export default async function NewCustomerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const t = await getTranslations("customers");
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("new")}</h1>
      <CustomerForm canGrantCredit={profile.role === "super_admin"} />
    </section>
  );
}
