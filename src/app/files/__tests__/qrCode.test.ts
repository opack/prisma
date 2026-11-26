import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrCode } from "../qrCode.ts";
import type { QrCode } from "../qrCode.ts";

const LINK = "https://prisma.valdera.fr/app/#p=";

/** Le code lu comme le lirait un téléphone : son tracé peint en pixels (avec sa marge blanche), puis décodé. */
function scan({ size, path }: QrCode) {
  const scale = 4;
  const margin = 4;
  const side = (size + 2 * margin) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [, column, row, width] of path.matchAll(/M(\d+) (\d+)h(\d+)/g))
    for (let y = 0; y < scale; y++)
      for (let x = 0; x < Number(width) * scale; x++) {
        const pixel = ((Number(row) + margin) * scale + y) * side + (Number(column) + margin) * scale + x;
        pixels.fill(0, pixel * 4, pixel * 4 + 3);
      }
  return jsQR(pixels, side, side)?.data;
}

describe("le QR code d'un lien de partage", () => {
  it("commence par le repère du coin en haut à gauche : une ligne de 7 modules noirs", () => {
    const code = qrCode(`${LINK}AbC-_1`)!;
    expect(code.path.startsWith("M0 0h7v1h-7z")).toBe(true);
  });

  it("se relit : scanné, il redonne le lien, même long", () => {
    for (const link of [`${LINK}AbC-_1`, `${LINK}${"7V1Jkts2FL0KShuP".repeat(90)}`]) expect(scan(qrCode(link)!)).toBe(link);
  });

  it("chaque module noir tient dans le carré du code", () => {
    const code = qrCode(`${LINK}AbC-_1`)!;
    for (const [, column, row, width] of code.path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      expect(Number(column) + Number(width)).toBeLessThanOrEqual(code.size);
      expect(Number(row)).toBeLessThan(code.size);
    }
  });

  it("grandit avec le lien : un long morceau donne un code plus dense", () => {
    const short = qrCode(`${LINK}${"a".repeat(100)}`)!;
    const long = qrCode(`${LINK}${"a".repeat(1500)}`)!;
    expect(long.size).toBeGreaterThan(short.size);
  });

  it("un lien trop long pour un QR code n'en donne pas", () => {
    expect(qrCode(`${LINK}${"a".repeat(3000)}`)).toBeNull();
  });
});
