/**
 * Glisser-déposer un fichier sur la fenêtre pour l'ouvrir : tant qu'un fichier la survole, elle le
 * dit. Le compteur suit les entrées et sorties successives au-dessus des éléments de la page.
 */
import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { droppedFile } from "./files.ts";

export function DropZone({ onFile, className = "", children }: { onFile: (dropped: { file: File; handle: FileSystemFileHandle | null }) => void; className?: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hasFile = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  return (
    <div
      className={className}
      onDragEnter={(e) => {
        if (!hasFile(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!hasFile(e)) return;
        if (--depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDragOver={(e) => {
        if (!hasFile(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={async (e) => {
        if (!hasFile(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const dropped = await droppedFile(e.dataTransfer);
        if (dropped) onFile(dropped);
      }}
    >
      {over && (
        <div className="absolute inset-0 z-20 grid place-content-center text-center gap-1 bg-[rgba(43,93,110,.12)] border-3 border-dashed border-accent pointer-events-none" aria-hidden>
          <p className="text-[22px] font-bold text-accent">Déposer pour ouvrir</p>
          <span className="text-muted">.prisma ou .musicxml</span>
        </div>
      )}
      {children}
    </div>
  );
}
