import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ms", "en"],
  defaultLocale: "ms",
});

export type Locale = (typeof routing.locales)[number];
