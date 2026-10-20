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
