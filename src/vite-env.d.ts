/** Typed Vite build-time env vars used by the app (all optional — features degrade gracefully). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_MEDIA_BUCKET?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
