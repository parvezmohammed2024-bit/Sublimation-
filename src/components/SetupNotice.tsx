import { getTranslations } from "next-intl/server";

export async function SetupNotice() {
  const t = await getTranslations("setup");
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("body")}</p>
    </main>
  );
}
