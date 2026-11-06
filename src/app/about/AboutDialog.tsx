/**
 * À propos de Prisma : son nom, sa version (et le commit construit, pour signaler un problème), puis
 * les nouveautés de chaque version (CHANGELOG.md), la plus récente en haut, qui défilent.
 */
import { useMemo } from "react";
import changelog from "../../../CHANGELOG.md?raw";
import { Dialog } from "../ui/dialog/Dialog.tsx";
import { releases } from "./changelog.ts";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const list = useMemo(() => releases(changelog), []);
  return (
    <Dialog
      title="À propos de Prisma"
      intro="Lire, écrire et jouer la musique en Prisma, une notation chromatique."
      submit="Fermer"
      cancel={null}
      focusSubmit
      onSubmit={onClose}
      onClose={onClose}
    >
      <p className="m-0 flex items-baseline gap-2">
        <span className="font-semibold">Version {__VERSION__}</span>
        {__COMMIT__ && (
          <span className="font-mono text-[12px] text-muted" title="Le commit construit, à donner pour signaler un problème">
            {__COMMIT__}
          </span>
        )}
      </p>
      <section
        className="grid gap-3 max-h-[min(50vh,420px)] overflow-auto px-3 py-2.5 bg-white border border-line rounded"
        aria-label="Nouveautés"
      >
        {list.map((release) => (
          <article key={release.version} className="text-[14px] leading-[1.4]">
            <h3 className="m-0 text-[14px]">
              {release.version} <span className="font-normal text-muted">· {release.date}</span>
            </h3>
            <div dangerouslySetInnerHTML={{ __html: release.html }} />
          </article>
        ))}
      </section>
    </Dialog>
  );
}
