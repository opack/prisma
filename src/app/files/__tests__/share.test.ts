import { describe, expect, it } from "vitest";
import { LONG_LINK, decodeShare, encodeShare, shareLink, shareName, sharedIn, sharedInLink } from "../share.ts";
import { CLAIR_SECTIONS, GREENSLEEVES_CHORDS } from "../../../site/examples/pieces.ts";

/** Un fragment écrit à la main, comme l'écrirait une autre version de l'application. */
async function compressed(data: object) {
  const stream = new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("partage par un lien", () => {
  it("le morceau, son nom et les options de son rendu reviennent tels qu'ils sont partis", async () => {
    const sent = { name: "Au clair de la lune.prisma", text: CLAIR_SECTIONS, options: { fingerings: false } };
    const link = shareLink(await encodeShare(sent), "https://prisma.valdera.fr/app/");
    expect(link.startsWith("https://prisma.valdera.fr/app/#p=")).toBe(true);
    const data = sharedIn(new URL(link).hash);
    expect(data).not.toBeNull();
    expect(await decodeShare(data!)).toEqual(sent);
  });

  it("un lien de la version 1 se lit encore, sans les réglages de l'écoute", async () => {
    const first = {
      v: 1,
      n: "a.prisma",
      t: CLAIR_SECTIONS,
      s: { format: 1, tempo: 72, muted: [1], volumes: [-3, 0], options: { fingerings: false } },
    };
    expect(await decodeShare(await compressed(first))).toEqual({ name: "a.prisma", text: CLAIR_SECTIONS, options: { fingerings: false } });
  });

  it("une option inconnue, ou d'une valeur hors de ses choix, est laissée de côté", async () => {
    const sent = { v: 2, n: "a.prisma", t: CLAIR_SECTIONS, o: { fingerings: "oui", chordChart: true, inconnue: 1 } };
    expect((await decodeShare(await compressed(sent)))!.options).toEqual({ chordChart: true });
  });

  it("un morceau courant tient dans un lien court", async () => {
    const link = shareLink(
      await encodeShare({ name: "g.prisma", text: GREENSLEEVES_CHORDS, options: {} }),
      "https://prisma.valdera.fr/app/",
    );
    expect(link.length).toBeLessThan(LONG_LINK / 4);
  });

  it("un lien collé se lit, entier ou réduit à son fragment, même coupé de retours à la ligne", () => {
    expect(sharedInLink("https://prisma.valdera.fr/app/#p=AbC-_1")).toBe("AbC-_1");
    expect(sharedInLink("  #p=AbC\n-_1 ")).toBe("AbC-_1");
    expect(sharedInLink("https://prisma.valdera.fr/app/")).toBeNull();
    expect(sharedInLink("Regarde ça : https://prisma.valdera.fr/app/#p=AbC")).toBe("AbC");
    expect(sharedInLink("p=AbC")).toBe("AbC");
    // ce qui suit « #p= », seul
    expect(sharedInLink("7V1Jkts2FL0KShuP7CJIkaK0cn")).toBe("7V1Jkts2FL0KShuP7CJIkaK0cn");
    expect(sharedInLink("bonjour")).toBeNull();
  });

  it("le seul contenu du fragment se lit comme le lien", async () => {
    const data = await encodeShare({ name: "a.prisma", text: CLAIR_SECTIONS, options: {} });
    expect((await decodeShare(sharedInLink(data)!))!.text).toBe(CLAIR_SECTIONS);
  });

  it("un lien coupé, ou d'une autre version, ne se lit pas", async () => {
    const data = await encodeShare({ name: "a.prisma", text: CLAIR_SECTIONS, options: {} });
    expect(await decodeShare(data.slice(0, data.length / 2))).toBeNull();
    expect(await decodeShare("abc")).toBeNull();
    expect(await decodeShare(await compressed({ v: 3, n: "a.prisma", t: CLAIR_SECTIONS }))).toBeNull();
    expect(sharedIn("#intro")).toBeNull();
  });

  it("le nom reçu reste un nom de fichier .prisma, sans dossier", async () => {
    const back = async (name: string) => (await decodeShare(await encodeShare({ name, text: "", options: {} })))!.name;
    expect(await back("../../../../../secret/Gymnopédie.prisma")).toBe("Gymnopédie.prisma");
    expect(await back("Nocturne.musicxml")).toBe("Nocturne.prisma");
    expect(await back("")).toBe("morceau.prisma");
    expect(await back('Air: "doux"?')).toBe("Air doux.prisma");
  });

  it("un morceau jamais enregistré se partage sous son titre", () => {
    expect(shareName("morceau.prisma", "Au clair de la lune")).toBe("Au clair de la lune.prisma");
    expect(shareName("morceau.prisma")).toBe("morceau.prisma");
    expect(shareName("morceau.prisma", "Nocturne op. 9 n° 2")).toBe("Nocturne op. 9 n° 2.prisma");
    expect(shareName("Nocturne.prisma", "Nocturne op. 9")).toBe("Nocturne.prisma");
  });
});
