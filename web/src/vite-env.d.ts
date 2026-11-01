/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "production" hides the preview banner. Anything else (or unset) shows it. */
  readonly VITE_APP_ENV?: string;
  /** Override for the API base path. Defaults to "/api". */
  readonly VITE_API_BASE?: string;
}
