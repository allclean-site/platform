/** Typed Vite build-time env vars used by the app (all optional — features degrade gracefully). */
interface ImportMetaEnv {
  /** Vite also exposes any other VITE_* var the build was given. */
  readonly [key: string]: string | boolean | undefined;
  /** True only under `vite dev` — used to keep demo accounts out of every shipped build. */
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_MEDIA_BUCKET?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** `?raw` imports the file's SOURCE TEXT (unminified, even in a production build). Used to inject the
 *  shared render core into the editor's in-iframe runtime, which cannot import modules. */
declare module "*?raw" {
  const src: string;
  export default src;
}
