/**
 * Un morceau reçu par un lien : son titre, son compositeur, ses notes et son nom de fichier ; on
 * l'ouvre tel quel, ou on l'enregistre d'abord dans la bibliothèque, quand il y en a une.
 */
import { parseFrontmatter } from "../../core/index.ts";
import type { Meta } from "../../core/index.ts";
import { Button } from "../ui/button/Button.tsx";
import { Dialog } from "../ui/dialog/Dialog.tsx";
import type { Shared } from "./share.ts";

type Props = { shared: Shared; library?: string; onOpen: (save: boolean) => void; onClose: () => void };

export function ReceivedDialog({ shared, library, onOpen, onClose }: Props) {
  // l'en-tête seul : un morceau à l'écriture fautive se reçoit aussi, son erreur se verra à l'ouverture
  let meta: Meta = {};
  try {
    meta = parseFrontmatter(shared.text.split(/\r?\n/)).meta;
  } catch {
    /* un en-tête illisible : le nom du fichier suffit */
  }
  const title = meta.title || shared.name.replace(/\.prisma$/i, "");
  return (
    <Dialog
      title="Partition reçue"
      submit="Ouvrir"
      cancel="Ignorer"
      focusSubmit
      onSubmit={() => onOpen(false)}
      onClose={onClose}
      actions={library && <Button onClick={() => onOpen(true)} title={`Enregistrer ${shared.name} dans la bibliothèque (${library}), puis l'ouvrir`}>Enregistrer dans la bibliothèque</Button>}
    >
      <div className="grid gap-1">
        <p className="m-0 font-semibold text-[1.05rem]">{title}</p>
        {meta.composer && <p className="m-0 text-muted">{meta.composer}</p>}
        <p className="m-0 text-muted text-[12px]">{shared.name}</p>
      </div>
      {meta.notes && <p className="m-0 px-3 py-2 bg-white border border-line rounded whitespace-pre-line">{meta.notes}</p>}
      {library && <p className="m-0 text-muted text-[13px] leading-[1.4]">Enregistré dans la bibliothèque ({library}), il s'y retrouve et s'y réécrit ; ouvert tel quel, il s'enregistre où vous le choisirez.</p>}
    </Dialog>
  );
}
