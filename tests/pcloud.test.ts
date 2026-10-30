import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un faux pCloud : le dossier de l'app en mémoire (des chemins et leurs textes), et l'API qui le
 * sert, comme la vraie (listfolder, stat, getfilelink, uploadfile, deletefile), jeton compris.
 */
function fakePcloud(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial).map(([p, t], i) => [p, { text: t, id: i + 1, modified: Date.UTC(2026, 9, 1 + i) }]));
  let nextId = 100;
  const calls: string[] = [];
  const meta = (path: string, f: { id: number; modified: number }) => ({ name: path.split("/").pop(), isfolder: false, fileid: f.id, modified: new Date(f.modified).toUTCString() });
  const folderOf = (path: string): Record<string, unknown> => {
    const prefix = path === "/" ? "/" : `${path}/`;
    const names = new Set<string>();
    const contents: unknown[] = [];
    for (const [p, f] of files) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (!rest.includes("/")) contents.push(meta(p, f));
      else names.add(rest.split("/")[0]);
    }
    for (const n of names) contents.push(folderOf(prefix + n));
    return { name: path === "/" ? "Prisma" : path.split("/").pop(), isfolder: true, folderid: 0, modified: "", contents };
  };
  const answer = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
  const fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    // le relais du site : il fait ce que fera la fonction (src/server/pcloudFile.ts), sur ce faux pCloud
    if (input.startsWith("/api/pcloud-file")) {
      calls.push("relais");
      const { pcloudFile } = await import("../src/server/pcloudFile.ts");
      vi.stubGlobal("fetch", fetch);
      return pcloudFile(new Request(`https://prisma.test${input}`, { headers: init?.headers }));
    }
    const url = new URL(input);
    if (url.host === "dl.pcloud.test") return new Response([...files.values()].find((f) => `/dl/${f.id}` === url.pathname)!.text);
    const method = url.pathname.slice(1);
    calls.push(method);
    if (url.searchParams.get("access_token") !== "jeton") return answer({ result: 2094, error: "Invalid 'access_token' provided." });
    const path = url.searchParams.get("path") ?? "";
    switch (method) {
      case "listfolder":
        return answer({ result: 0, metadata: folderOf(path) });
      case "stat": {
        const f = files.get(path);
        return f ? answer({ result: 0, metadata: meta(path, f) }) : answer({ result: 2009, error: "File not found." });
      }
      case "getfilelink": {
        const id = Number(url.searchParams.get("fileid"));
        return answer({ result: 0, hosts: ["dl.pcloud.test"], path: `/dl/${id}` });
      }
      case "uploadfile": {
        const name = url.searchParams.get("filename")!;
        const full = `${path === "/" ? "" : path}/${name}`;
        const text = await ((init!.body as FormData).get("file") as Blob).text();
        const f = { text, id: files.get(full)?.id ?? nextId++, modified: Date.UTC(2026, 9, 28) };
        files.set(full, f);
        return answer({ result: 0, metadata: [meta(full, f)] });
      }
      case "deletefile":
        return files.delete(path) ? answer({ result: 0 }) : answer({ result: 2009, error: "File not found." });
    }
    throw new Error(`appel inattendu : ${method}`);
  };
  return { files, calls, fetch };
}

const store = new Map<string, string>();
beforeEach(() => {
  // des modules neufs : les textes gardés par un essai ne servent pas au suivant
  vi.resetModules();
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  store.set("prisma:pcloud", JSON.stringify({ token: "jeton", host: "eapi.pcloud.com" }));
});
afterEach(() => vi.unstubAllGlobals());

const CLAIR = "---\nformat: 1\ntitle: Au clair de la lune\n---\n\nm1 |1  ||\n0  |1  ||\n";

describe("la bibliothèque sur pCloud", () => {
  it("lit le dossier de l'app en un appel, sous-dossiers compris, et les réglages sans appel de plus", async () => {
    const cloud = fakePcloud({
      "/Au clair.prisma": CLAIR,
      "/Au clair.prisma.json": JSON.stringify({ format: 1, options: { fingerings: false } }),
      "/Satie/Gymnopedie.musicxml": "<work-title>Gymnopédie</work-title>",
      "/notes.txt": "pas une partition",
    });
    vi.stubGlobal("fetch", cloud.fetch);
    const { pcloudLibrary } = await import("../src/app/library/pcloudLibrary.ts");
    const { scan } = await import("../src/app/library/library.ts");
    const entries = await scan(pcloudLibrary());
    expect(entries.map((e) => [e.path, e.folder, e.kind, e.title])).toEqual([
      ["Au clair.prisma", "", "prisma", "Au clair de la lune"],
      ["Satie/Gymnopedie.musicxml", "Satie", "musicxml", "Gymnopédie"],
    ]);
    expect(entries[0].own).toEqual({ fingerings: false });
    // une liste, puis un lien de téléchargement par fichier lu (les deux morceaux, les réglages)
    expect(cloud.calls.filter((c) => c === "listfolder")).toHaveLength(1);
    expect(cloud.calls).not.toContain("stat");
  });

  it("réécrit un morceau en place, et ne le retélécharge pas pour le relire", async () => {
    const cloud = fakePcloud({ "/Satie/Gnossienne.prisma": CLAIR });
    vi.stubGlobal("fetch", cloud.fetch);
    const { pcloudLibrary } = await import("../src/app/library/pcloudLibrary.ts");
    const [f] = await pcloudLibrary().files();
    await f.file.write(CLAIR + "\n");
    expect(cloud.files.get("/Satie/Gnossienne.prisma")!.text).toBe(CLAIR + "\n");
    const before = cloud.calls.length;
    expect(await f.file.text()).toBe(CLAIR + "\n");
    expect(cloud.calls.length).toBe(before);
  });

  it("à la racine : un fichier absent n'existe pas, puis s'y crée, et s'y retire", async () => {
    const cloud = fakePcloud({});
    vi.stubGlobal("fetch", cloud.fetch);
    const { pcloudLibrary } = await import("../src/app/library/pcloudLibrary.ts");
    const { root } = pcloudLibrary();
    expect(await root.file("Reçu.prisma")).toBeNull();
    await (await root.create("Reçu.prisma")).write(CLAIR);
    expect(cloud.files.get("/Reçu.prisma")!.text).toBe(CLAIR);
    expect(await (await root.file("Reçu.prisma"))!.text()).toBe(CLAIR);
    await root.remove("Reçu.prisma");
    expect(cloud.files.has("/Reçu.prisma")).toBe(false);
    await root.remove("Reçu.prisma"); // déjà retiré : sans erreur
  });

  it("la lecture d'un fichier passe par le relais du site, qui la demande à pCloud", async () => {
    const cloud = fakePcloud({ "/Au clair.prisma": CLAIR });
    vi.stubGlobal("fetch", cloud.fetch);
    const { pcloudLibrary } = await import("../src/app/library/pcloudLibrary.ts");
    const [f] = await pcloudLibrary().files();
    expect(await f.file.text()).toBe(CLAIR);
    expect(cloud.calls).toEqual(["listfolder", "relais", "getfilelink"]);
  });

  it("le relais ne joint que pCloud, et rend ses erreurs telles quelles", async () => {
    const { pcloudFile } = await import("../src/server/pcloudFile.ts");
    const asked = (q: string, token = "jeton") => pcloudFile(new Request(`https://prisma.test/api/pcloud-file?${q}`, { headers: { "x-pcloud-token": token } }));
    expect((await asked("host=evil.example&fileid=1")).status).toBe(400);
    expect((await asked("host=eapi.pcloud.com&fileid=../1")).status).toBe(400);
    expect((await asked("host=eapi.pcloud.com&fileid=1", "")).status).toBe(400);
    vi.stubGlobal("fetch", fakePcloud({}).fetch);
    const refused = await asked("host=eapi.pcloud.com&fileid=1", "périmé");
    expect(await refused.json()).toEqual({ result: 2094, error: "Invalid 'access_token' provided." });
  });

  it("une connexion qui ne vaut plus le dit, et s'oublie", async () => {
    vi.stubGlobal("fetch", fakePcloud({}).fetch);
    store.set("prisma:pcloud", JSON.stringify({ token: "périmé", host: "eapi.pcloud.com" }));
    const { pcloudLibrary } = await import("../src/app/library/pcloudLibrary.ts");
    const { PcloudAuthError } = await import("../src/app/library/pcloud.ts");
    const source = pcloudLibrary();
    expect(await source.access()).toBe(true);
    await expect(source.files()).rejects.toBeInstanceOf(PcloudAuthError);
    expect(store.has("prisma:pcloud")).toBe(false);
    expect(await source.access()).toBe(false);
  });

  it("le retour de la connexion : le jeton et le serveur de l'utilisateur gardés, l'adresse nettoyée", async () => {
    store.clear();
    const replaced: string[] = [];
    vi.stubGlobal("location", { hash: "#access_token=abc&token_type=bearer&locationid=2&hostname=eapi.pcloud.com", pathname: "/app/", search: "" });
    vi.stubGlobal("history", { replaceState: (_: unknown, __: string, url: string) => replaced.push(url) });
    const { pcloudReturned, session } = await import("../src/app/library/pcloud.ts");
    expect(pcloudReturned()).toBe(true);
    expect(session()).toEqual({ token: "abc", host: "eapi.pcloud.com" });
    expect(replaced).toEqual(["/app/"]);
  });
});
