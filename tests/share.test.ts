import { describe, expect, it } from "vitest";
import { LONG_LINK, decodeShare, encodeShare, shareLink, shareName, sharedIn, sharedInLink } from "../src/app/files/share.ts";
import { CLAIR_SECTIONS, GREENSLEEVES_CHORDS } from "../src/site/examples/pieces.ts";

describe("partage par un lien", () => {
  it("le morceau, son nom et ses réglages reviennent tels qu'ils sont partis", async () => {
    const sent = { name: "Au clair de la lune.prisma", text: CLAIR_SECTIONS, settings: { tempo: 72, options: { fingerings: false } } };
    const link = shareLink(await encodeShare(sent), "https://prisma-music.netlify.app/app/");
    expect(link.startsWith("https://prisma-music.netlify.app/app/#p=")).toBe(true);
    const data = sharedIn(new URL(link).hash);
    expect(data).not.toBeNull();
    expect(await decodeShare(data!)).toEqual(sent);
  });

  it("un morceau courant tient dans un lien court", async () => {
    const link = shareLink(await encodeShare({ name: "g.prisma", text: GREENSLEEVES_CHORDS, settings: {} }), "https://prisma-music.netlify.app/app/");
    expect(link.length).toBeLessThan(LONG_LINK / 4);
  });

  it("un lien collé se lit, entier ou réduit à son fragment, même coupé de retours à la ligne", () => {
    expect(sharedInLink("https://prisma-music.netlify.app/app/#p=AbC-_1")).toBe("AbC-_1");
    expect(sharedInLink("  #p=AbC\n-_1 ")).toBe("AbC-_1");
    expect(sharedInLink("https://prisma-music.netlify.app/app/")).toBeNull();
    expect(sharedInLink("Regarde ça : https://prisma-music.netlify.app/app/#p=AbC")).toBe("AbC");
    expect(sharedInLink("p=AbC")).toBe("AbC");
    // ce qui suit « #p= », seul
    expect(sharedInLink("7V1Jkts2FL0KShuP7CJIkaK0cn")).toBe("7V1Jkts2FL0KShuP7CJIkaK0cn");
    expect(sharedInLink("bonjour")).toBeNull();
  });

  it("le seul contenu du fragment se lit comme le lien", async () => {
    const data = await encodeShare({ name: "a.prisma", text: CLAIR_SECTIONS, settings: {} });
    expect((await decodeShare(sharedInLink(data)!))!.text).toBe(CLAIR_SECTIONS);
  });

  it("un lien coupé, ou d'une autre version, ne se lit pas", async () => {
    const data = await encodeShare({ name: "a.prisma", text: CLAIR_SECTIONS, settings: {} });
    expect(await decodeShare(data.slice(0, data.length / 2))).toBeNull();
    expect(await decodeShare("abc")).toBeNull();
    expect(sharedIn("#intro")).toBeNull();
  });

  it("le nom reçu reste un nom de fichier .prisma, sans dossier", async () => {
    const back = async (name: string) => (await decodeShare(await encodeShare({ name, text: "", settings: {} })))!.name;
    expect(await back("../../secret/Gymnopédie.prisma")).toBe("Gymnopédie.prisma");
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
