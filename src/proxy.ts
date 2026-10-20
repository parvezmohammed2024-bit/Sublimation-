import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./lib/supabase/env";

const intl = createIntlMiddleware(routing);

/** Paths (after the locale prefix) that do not need a staff session. */
const PUBLIC = [/^\/login$/, /^\/track(\/|$)/];

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  if (!isSupabaseConfigured()) return response;

  // Refresh the Supabase session cookie on every request.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname.replace(/^\/(ms|en)(?=\/|$)/, "") || "/";
  const locale = request.nextUrl.pathname.match(/^\/(ms|en)(?=\/|$)/)?.[1] ?? routing.defaultLocale;
  if (!data.user && !PUBLIC.some((re) => re.test(path))) {
    // Remember where they were going (e.g. a job QR code) so login can send them back.
    const login = new URL(`/${locale}/login`, request.url);
    if (path !== "/") login.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
