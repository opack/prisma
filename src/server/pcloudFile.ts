/**
 * Le relais de lecture pCloud : pCloud refuse de donner un fichier à une page web qui n'est pas la
 * sienne (getfilelink : « Invalid link referer »). Une requête de serveur n'a ni Origin ni Referer :
 * ce relais demande le lien et télécharge le fichier lui-même (le lien est lié à son adresse IP),
 * puis rend le texte. Il ne garde rien : ni jeton, ni fichier, ni journal. Le même code sert la
 * fonction Netlify (netlify/functions) et le serveur de développement (vite.config.ts).
 *
 * GET /api/pcloud-file?host=eapi.pcloud.com&fileid=123, le jeton dans l'en-tête X-Pcloud-Token ;
 * une erreur de pCloud revient telle quelle, en JSON ({ result, error }).
 */

/** Les seuls serveurs de pCloud qu'on accepte de joindre : le relais ne sert à rien d'autre. */
const HOSTS = new Set(["api.pcloud.com", "eapi.pcloud.com"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function pcloudFile(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = url.searchParams.get("host") ?? "";
  const fileid = url.searchParams.get("fileid") ?? "";
  const token = req.headers.get("x-pcloud-token") ?? "";
  if (req.method !== "GET" || !HOSTS.has(host) || !/^\d+$/.test(fileid) || !token) return json({ result: 400, error: "requête de relais invalide" }, 400);
  try {
    const q = new URLSearchParams({ fileid, access_token: token });
    const link = await (await fetch(`https://${host}/getfilelink?${q}`)).json();
    if (link.result !== 0) return json({ result: link.result, error: link.error });
    const file = await fetch(`https://${link.hosts[0]}${link.path}`);
    if (!file.ok) return json({ result: file.status, error: "téléchargement refusé" }, 502);
    return new Response(await file.text(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch {
    // pCloud injoignable depuis le relais
    return json({ result: 502, error: "pCloud injoignable" }, 502);
  }
}
