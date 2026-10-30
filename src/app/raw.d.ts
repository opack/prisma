/** Les réglages de la construction, dans .env : l'identifiant de l'app chez pCloud. */
interface ImportMetaEnv {
  readonly VITE_PCLOUD_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** L'heure de la construction de l'application (vite.config.ts). */
declare const __BUILD__: string;

/** Fichiers importés comme texte brut par Vite (« ?raw ») : la référence. */
declare module "*?raw" {
  const text: string;
  export default text;
}

/** Fichiers servis tels quels par Vite (« ?url ») : le son du métronome. */
declare module "*?url" {
  const url: string;
  export default url;
}
