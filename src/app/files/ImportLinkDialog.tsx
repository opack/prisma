/**
 * Fichier › Importer un lien : le lien d'une partition partagée, collé ; lu, il montre la partition
 * reçue, à ouvrir ou à enregistrer dans la bibliothèque. Un lien qui ne se lit pas le dit, ici.
 */
import { useId, useState } from "react";
import { Dialog } from "../ui/dialog/Dialog.tsx";

type Props = { onImport: (link: string) => Promise<string | null>; onClose: () => void };

export function ImportLinkDialog({ onImport, onClose }: Props) {
  const [link, setLink] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();
  return (
    <Dialog title="Importer un lien" intro="Collez le lien d'une partition partagée (Fichier › Partager par un lien), ou ce qui suit son « #p= »." submit="Importer" onSubmit={async () => setProblem(await onImport(link))} onClose={onClose} focusField>
      <label className="grid gap-1" htmlFor={id}>
        Lien
        <textarea
          id={id}
          className="min-h-[4.5em] px-2.5 py-[7px] bg-white border border-line rounded font-mono text-[12px] break-all resize-y"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setProblem(null);
          }}
          placeholder="https://prisma.valdera.fr/app/#p=…"
          aria-invalid={!!problem}
          aria-describedby={problem ? `${id}-problem` : undefined}
        />
      </label>
      {problem && (
        <p className="m-0 text-accent" id={`${id}-problem`} role="alert">
          {problem}
        </p>
      )}
    </Dialog>
  );
}
