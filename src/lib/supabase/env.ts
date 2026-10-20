export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until .env.local is filled in; lets the app show a setup page instead of crashing. */
export const isSupabaseConfigured = () =>
  supabaseUrl.startsWith("http") && supabaseAnonKey.length > 10;
