/**
 * Le QR code d'un lien de partage : ses modules, en un tracé SVG (sur la page gravée, dans la
 * fenêtre de partage), ou en image PNG à télécharger. La correction d'erreur la plus basse (L) : le
 * code le moins dense, pour un lien qui porte tout le morceau.
 */
import QRCode from "qrcode";

const OPTIONS = { errorCorrectionLevel: "L" } as const;

/** Un QR code : son côté, en modules, et le tracé de ses modules noirs, un module par unité. */
export type QrCode = { size: number; path: string };

/** Le QR code de ce texte ; null s'il est trop long pour tenir dans un QR code. */
export function qrCode(text: string): QrCode | null {
  let modules: { size: number; data: Uint8Array };
  try {
    modules = QRCode.create(text, OPTIONS).modules;
  } catch {
    return null; // trop long (ou vide)
  }
  const { size, data } = modules;
  const dark = (row: number, column: number) => data[row * size + column] === 1;
  // chaque suite de modules noirs d'une ligne : un rectangle, plutôt qu'un carré par module
  let path = "";
  for (let row = 0; row < size; row++) {
    let column = 0;
    while (column < size) {
      if (!dark(row, column)) {
        column++;
        continue;
      }
      const start = column;
      while (column < size && dark(row, column)) column++;
      path += `M${start} ${row}h${column - start}v1h${start - column}z`;
    }
  }
  return { size, path };
}

/** L'image PNG du QR code, avec sa marge blanche, pour l'imprimer ou l'envoyer. */
export async function qrImage(text: string): Promise<Blob> {
  const url = await QRCode.toDataURL(text, { ...OPTIONS, margin: 4, scale: 8 });
  return (await fetch(url)).blob();
}
