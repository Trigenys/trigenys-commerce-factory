export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [
      !supabaseUrl ? "VITE_SUPABASE_URL" : null,
      !supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null
    ].filter((value): value is string => Boolean(value));

    throw new Error(
      `Missing public environment configuration: ${missing.join(", ")}. ` +
        "Use .env.example as the local template."
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey
  };
}
