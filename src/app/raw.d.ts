/** Les réglages de la construction, dans .env : l'identifiant de l'app chez pCloud. */
interface ImportMetaEnv {
  readonly VITE_PCLOUD_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** L'heure de la construction de l'application (vite.config.ts). */
declare const __BUILD__: string;
/** La version de l'application (semver, package.json) et son commit en court (vite.config.ts) ; le commit peut manquer. */
declare const __VERSION__: string;
declare const __COMMIT__: string;

/** Fichiers importés comme texte brut par Vite (« ?raw ») : la référence, les nouveautés. */
declare module "*?raw" {
  const text: string;
  export default text;
}

/** Fichiers servis tels quels par Vite (« ?url ») : le son du métronome. */
declare module "*?url" {
  const url: string;
  export default url;
}
