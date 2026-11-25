import { createClient } from "@supabase/supabase-js";

// Vite injeta essas variáveis durante o build. Removemos espaços acidentais
// para evitar que uma quebra de linha no painel da hospedagem invalide a URL.
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabaseUrl = rawSupabaseUrl?.trim().replace(/\/+$/, "");
const supabaseAnonKey = rawSupabaseAnonKey?.trim();

const isValidSupabaseUrl = (() => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
})();

export const isSupabaseConfigured = isValidSupabaseUrl && Boolean(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
