/**
 * pCloud, depuis le navigateur : la connexion (OAuth, le jeton rendu dans l'adresse de retour), le
 * jeton gardé dans ce navigateur, et les appels de l'API. L'app est déclarée chez pCloud avec un
 * accès à son seul dossier (Applications/Prisma) : sa racine « / » est ce dossier, rien d'autre
 * n'est visible. Le jeton passe en paramètre : pCloud refuse l'en-tête Authorization d'une page web.
 * pCloud réserve la lecture d'un fichier aux pages de pcloud.com : elle passe par le relais du site.
 */

/** L'identifiant de l'app chez pCloud (public : il dit qui demande, il n'ouvre aucun compte). */
const CLIENT_ID: string | undefined = import.meta.env.VITE_PCLOUD_CLIENT_ID;

/** L'app est-elle déclarée chez pCloud, pour cette version ? */
export const canUsePcloud = !!CLIENT_ID && typeof fetch === "function";

/** Le dossier que l'app voit, tel que pCloud le montre à l'utilisateur. */
export const PCLOUD_FOLDER = "Applications/Prisma";

const KEY = "prisma:pcloud";
type Session = { token: string; host: string };

export function session(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return typeof s?.token === "string" && typeof s?.host === "string" ? s : null;
  } catch {
    return null;
  }
}
function keep(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : la connexion durera le temps de la page */
  }
}
export const disconnect = () => keep(null);

/** L'adresse de retour de la connexion : l'application elle-même. */
const back = () => location.origin + location.pathname;

/** Va se connecter chez pCloud ; le retour se fait sur l'application (voir pcloudReturned). */
export function connect() {
  const q = new URLSearchParams({ client_id: CLIENT_ID ?? "", response_type: "token", redirect_uri: back() });
  location.assign(`https://my.pcloud.com/oauth2/authorize?${q}`);
}

/**
 * Le retour d'une connexion : le jeton et le serveur de l'utilisateur (Europe ou États-Unis) dans
 * le fragment de l'adresse, gardés, puis l'adresse sans eux. Vrai si l'on revient de pCloud.
 */
export function pcloudReturned(): boolean {
  if (typeof location === "undefined" || !location.hash.includes("access_token=")) return false;
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get("access_token");
  if (token) keep({ token, host: h.get("hostname") ?? (h.get("locationid") === "2" ? "eapi.pcloud.com" : "api.pcloud.com") });
  history.replaceState(null, "", location.pathname + location.search);
  return !!token;
}

/** La connexion n'est plus valable (jeton retiré chez pCloud, expiré) : il faut se reconnecter. */
export class PcloudAuthError extends Error {}

// les codes de pCloud pour une connexion qui ne vaut plus
const AUTH_ERRORS = new Set([1000, 2000, 2094, 2095]);
/** Un fichier ou un dossier qui n'existe pas. */
export const NOT_FOUND = new Set([2002, 2005, 2009]);

export class PcloudError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

/** L'adresse d'un appel de l'API, jeton compris. */
function address(method: string, params: Record<string, string | number>) {
  const s = session();
  if (!s) throw new PcloudAuthError("pas connecté à pCloud");
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  q.set("access_token", s.token);
  return `https://${s.host}/${method}?${q}`;
}

/** Ce que pCloud dit d'une erreur : son message et son code. */
const said = (json: { result: number; error?: string }) => `${json.error ? `${json.error.replace(/\.$/, "")}, ` : ""}code ${json.result}`;

/** Une réponse d'erreur de pCloud, en erreur à lever ; une connexion qui ne vaut plus, oubliée (forget). */
function failure(json: { result: number; error?: string }, forget = true) {
  if (AUTH_ERRORS.has(json.result) && forget) {
    disconnect();
    return new PcloudAuthError(`pCloud a refusé la connexion (${said(json)}) : reconnectez-vous`);
  }
  return new PcloudError(`pCloud : ${said(json)}`, json.result);
}

async function request<T>(method: string, params: Record<string, string | number>, body?: BodyInit): Promise<T> {
  const res = await fetch(address(method, params), body ? { method: "POST", body } : undefined);
  const json = await res.json();
  if (json.result === 0) return json as T;
  throw failure(json);
}

/** Un appel de l'API ; un corps (body) : en POST. */
export const call = <T = Record<string, unknown>>(method: string, params: Record<string, string | number>, body?: BodyInit) => request<T>(method, params, body);

/**
 * Le texte d'un fichier : pCloud le refuse à une page web (le lien, comme le texte) ; le relais du
 * site (/api/pcloud-file, src/server/pcloudFile.ts) le demande pour elle, et ne garde rien.
 */
export async function download(fileid: number): Promise<string> {
  const s = session();
  if (!s) throw new PcloudAuthError("pas connecté à pCloud");
  const res = await fetch(`/api/pcloud-file?${new URLSearchParams({ host: s.host, fileid: String(fileid) })}`, { headers: { "X-Pcloud-Token": s.token } });
  if ((res.headers.get("content-type") ?? "").includes("json")) throw failure(await res.json());
  if (!res.ok) throw new Error(`pCloud : lecture impossible (${res.status})`);
  return res.text();
}

/** Écrit un fichier (le remplace s'il existe), dans le dossier de ce chemin ; son identifiant. */
export async function upload(folder: string, name: string, text: string): Promise<{ fileid: number; modified: number }> {
  const body = new FormData();
  body.append("file", new Blob([text], { type: "text/plain;charset=utf-8" }), name);
  const r = await call<{ metadata: PcloudItem[] }>("uploadfile", { path: folder || "/", filename: name, nopartial: 1 }, body);
  return { fileid: r.metadata[0].fileid!, modified: Date.parse(r.metadata[0].modified) || Date.now() };
}

/** Un fichier ou un dossier, tel que pCloud le décrit. */
export type PcloudItem = { name: string; isfolder: boolean; fileid?: number; folderid?: number; modified: string; contents?: PcloudItem[] };
