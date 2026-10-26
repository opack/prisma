/**
 * La guitare et la basse : comment les noter en Prisma, et ce que Prisma apporte à la tablature.
 * La page s'ouvre sur le même passage écrit deux fois, en tablature puis en Prisma : la
 * différence se voit avant de se lire.
 */
import { useMemo } from "react";
import { TICKS_PER_BEAT, fretOf, parsePrisma, pitchClass } from "../core/index.ts";
import { Example } from "./Example.tsx";
import { APP, Footer, Header } from "./Frame.tsx";
import { BASS, DROP_D, GREENSLEEVES, GREENSLEEVES_CHORDS, PENTATONIC, RING, TECHNIQUES } from "./pieces.ts";
import { referenceLink } from "./referenceLinks.ts";
import { Actions } from "./Actions.tsx";
import { OnThisPage } from "./OnThisPage.tsx";
import { ButtonLink } from "./ButtonLink.tsx";
import { Caption } from "./Caption.tsx";
import { Idea } from "./Idea.tsx";
import { IdeaText } from "./IdeaText.tsx";
import { Lead } from "./Lead.tsx";
import { SourceText } from "./SourceText.tsx";

/**
 * Une partie de cordes en tablature de texte, comme on en trouve en ligne : les cases, dans l'ordre,
 * à intervalles égaux, et les barres de mesure. Rien ne dit combien dure une note.
 */
function asciiTab(text: string): string {
  const score = parsePrisma(text);
  const strs = score.parts[0].strings!;
  const notes = score.notes.filter((n) => n.staff === 0);
  const starts = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);
  const bar = (t: number) => score.beats[Math.floor(t / TICKS_PER_BEAT)].barIndex;
  // la corde la plus aiguë s'écrit en minuscule quand elle a le nom de la plus grave
  const names = strs.open.map((m) => pitchClass(((m + strs.capo) % 12) + 1, "english"));
  const labels = names.map((n, k) => (k === 0 && n === names[names.length - 1] ? n.toLowerCase() : n));
  const width = Math.max(...labels.map((l) => l.length));
  const lines = labels.map((l) => l.padEnd(width) + "|");
  starts.forEach((t, i) => {
    if (i > 0 && bar(t) !== bar(starts[i - 1])) lines.forEach((_, k) => (lines[k] += "-|"));
    const here = notes.filter((n) => n.start === t);
    const cells = lines.map((_, k) => {
      const n = here.find((x) => x.string === k + 1);
      return n ? String(fretOf(strs, k + 1, n.midi)) : "";
    });
    const w = Math.max(1, ...cells.map((c) => c.length));
    lines.forEach((_, k) => (lines[k] += "-" + cells[k].padEnd(w, "-") + "-"));
  });
  return lines.map((l) => l + "-|").join("\n");
}

/** Une idée de la page : son texte, et son exemple à côté. */
function Topic({ id, title, children, text, label, options }: { id: string; title: string; children: React.ReactNode; text: string; label: string; options?: Parameters<typeof Example>[0]["options"] }) {
  return (
    <Idea id={id}>
      <IdeaText>
        <h2>{title}</h2>
        {children}
      </IdeaText>
      <Example text={text} label={label} scale={1.3} options={options} />
    </Idea>
  );
}

/** Les parties de la page, pour « Sur cette page ». */
const PARTS = {
  tab: { id: "tablature", label: "La tablature et Prisma" },
  strings: { id: "cordes", label: "Cordes et cases" },
  ring: { id: "tenue", label: "La tenue" },
  tuning: { id: "accordage", label: "Accordage et capo" },
  chords: { id: "accords", label: "Accords et grilles" },
  techniques: { id: "techniques", label: "Les techniques" },
  convert: { id: "partition", label: "D'une partition à la guitare" },
  bass: { id: "basse", label: "La basse" },
  limits: { id: "ce-qui-change", label: "Ce qui change" },
};

export function Guitar() {
  const tab = useMemo(() => asciiTab(GREENSLEEVES), []);
  return (
    <>
      <Header current="guitare" />
      <main>
        <section>
          <h1>La guitare et la basse</h1>
          <Lead>
            Une tablature dit où poser les doigts, pas quand. Prisma garde la tablature telle que les guitaristes la lisent, une ligne par corde et la case en nombre, et la pose
            sur la règle du temps : on y lit le rythme, et l'on voit ce qui sonne encore.
          </Lead>
          <Actions>
            <ButtonLink primary href={APP}>
              Ouvrir l'application
            </ButtonLink>
            <ButtonLink href={referenceLink("strings")}>
              Tout sur les cordes dans la référence
            </ButtonLink>
          </Actions>
          <OnThisPage parts={Object.values(PARTS)} />
        </section>

        <Idea kind="wide" id={PARTS.tab.id}>
          <IdeaText>
            <h2>Ce que la tablature ne dit pas</h2>
            <p>
              Les quatre premières mesures de <i>Greensleeves</i>. La tablature donne les bonnes cases, dans le bon ordre, et rien d'autre. Combien de temps dure le premier{" "}
              <i>do</i> ? Le <i>mi</i> et le <i>fa</i> de la deuxième mesure sont-ils égaux ? La basse tient-elle sous la mélodie, ou s'arrête-t-elle ? Il faut avoir entendu le
              morceau pour le savoir.
            </p>
            <p>
              En Prisma, les mêmes cases sont posées sur la règle de comptage : le <i>do</i> tient deux temps, le <i>fa</i> ne dure qu'un demi-temps, et chaque basse tient sa
              mesure entière, sous la mélodie.
            </p>
          </IdeaText>
          <div className="grid grid-cols-[minmax(0,1fr)] justify-items-start gap-5">
            <div className="grid min-w-0 max-w-full">
              <Caption className="mb-1.5">La tablature, telle qu'on la trouve en ligne</Caption>
              <SourceText tab label="Greensleeves en tablature de texte">
                {tab}
              </SourceText>
            </div>
            <div className="grid min-w-0 max-w-full">
              <Caption className="mb-1.5">Le même passage en Prisma</Caption>
              <Example text={GREENSLEEVES} label="Greensleeves en Prisma, à la guitare" scale={1.3} />
            </div>
          </div>
        </Idea>

        <Topic id={PARTS.strings.id} title="Une ligne par corde, un nombre par case" text={PENTATONIC} label="La gamme pentatonique de mi mineur, en première position">
          <p>
            Chaque ligne est une corde, numérotée de <code>1</code>, la plus aiguë, en haut, à <code>6</code>, la plus grave : l'ordre de toute tablature. La marge rappelle sa
            note à vide. Le nombre est la case où appuyer, de <code>0</code> (la corde à vide) à <code>24</code>.
          </p>
          <p>
            C'est le principe de Prisma au piano : le couloir dit où placer la main, le nombre où appuyer. On lit et l'on joue, sans rien calculer. Le rythme est celui de toute
            partition Prisma : une case par temps, ou par moitié de temps, sous la règle.
          </p>
          <p>Ici, la gamme pentatonique de <i>mi</i> mineur, en première position : deux cases par corde, du grave à l'aigu.</p>
        </Topic>

        <Topic id={PARTS.ring.id} title="La tenue : ce qui sonne encore" text={RING} label="Un arpège de la mineur laissé sonner, puis un arpège de mi où seule la basse tient">
          <p>
            Le trait <code>-</code> prolonge une note : la corde sonne jusqu'au bout du trait, puis la main l'étouffe. La tablature, elle, laisse ce choix à l'oreille de qui
            connaît déjà le morceau.
          </p>
          <p>
            Dans la première mesure, chaque corde de l'arpège de <i>la</i> mineur sonne jusqu'à la fin : l'accord se construit note à note. Dans la seconde, seule la basse de{" "}
            <i>mi</i> tient ; les autres notes s'éteignent aussitôt jouées.
          </p>
        </Topic>

        <Topic id={PARTS.tuning.id} title="L'accordage et le capo" text={DROP_D} label="Des accords de puissance en accordage drop-d">
          <p>
            L'accordage et le capo s'écrivent après le nom de la partie, en tête du morceau : <code>parts: Guitare (drop-d, capo 2)</code>. Les accordages courants y sont, de{" "}
            <code>standard</code> à <code>dadgad</code> ou <code>open-g</code>. La marge de chaque corde donne alors sa note, et l'écoute suit.
          </p>
          <p>
            Avec un capo, les cases se comptent depuis lui, comme en tablature : <code>0</code> est la corde jouée au capo.
          </p>
          <p>Ici, en drop-d, la 6ᵉ corde baissée en <i>ré</i> : un doigt couché sur les trois cordes graves joue l'accord de puissance.</p>
        </Topic>

        <Topic id={PARTS.chords.id} title="Les accords et leurs grilles" text={GREENSLEEVES_CHORDS} label="Greensleeves avec ses accords et leurs grilles" options={{ chords: "grid" }}>
          <p>
            Les accords à gratter s'écrivent sur la ligne <code>@c</code>, au-dessus de la règle, par leur nom Prisma (<code>10:m</code> pour <i>la</i> mineur) ou anglais (
            <i>Am</i>). La partition dessine leur grille : l'application prend la forme la plus simple sur la guitare du morceau, son accordage et son capo compris.
          </p>
          <p>
            Pour une autre forme, on l'écrit après le nom, de la corde la plus grave à la plus aiguë, comme tout guitariste : <code>10:m=x02210</code>. Et pour garder la
            partition légère, les grilles peuvent se regrouper une fois en tête du morceau, comme dans un recueil de chansons.
          </p>
        </Topic>

        <Topic id={PARTS.techniques.id} title="Les techniques" text={TECHNIQUES} label="Les techniques des cordes : harmonique, note étouffée, bend, glissé, liaisons, médiator, étouffé, vibrato">
          <p>Dans la case, les signes de toutes les tablatures :</p>
          <ul>
            <li>
              <code>x</code> la note étouffée, <code>&lt;12&gt;</code> l'harmonique naturelle ;
            </li>
            <li>
              <code>7/</code> le glissé vers la note suivante de la corde (<code>9\</code> vers le grave), <code>7\\</code> vers rien, <code>//7</code> depuis rien ;
            </li>
            <li>
              <code>7b9</code> le bend, tiré jusqu'à la case 9, et <code>7b9r</code> relâché.
            </li>
          </ul>
          <p>
            Une liaison entre deux notes d'une corde est un hammer-on ou un pull-off, gravé <code>H</code> ou <code>P</code>. Sur la ligne <code>@</code> : le sens du médiator (
            <code>d</code> et <code>u</code>, gravés ⊓ et V), l'étouffé de la paume (<code>P.M.---</code>) et le vibrato (<code>~~~~</code>). L'écoute les joue.{" "}
            <a href={referenceLink("techniques")}>Le détail est dans la référence.</a>
          </p>
        </Topic>

        <Idea kind="wide" id={PARTS.convert.id}>
          <IdeaText>
            <h2>D'une partition à la guitare</h2>
            <ul>
              <li>
                <b>Une tablature existante</b> : exportez-la en MusicXML depuis MuseScore ou Guitar Pro, et ouvrez-la dans l'application (Fichier › Ouvrir…). L'accordage, le
                capo et la corde de chaque note sont repris tels quels.
              </li>
              <li>
                <b>Une partition pour un autre instrument</b> : un piano, une mélodie. Partition › Convertir pour la guitare ou la basse… propose un doigté. Il ramène dans
                l'instrument les notes trop graves ou trop aiguës et allège les accords trop chargés, en gardant la mélodie et la basse. Il choisit les cordes qui demandent le
                moins de déplacements sur tout le morceau, puis dit ce qu'il a changé.
              </li>
              <li>
                <b>Retoucher</b> : un double-clic sur une note de la partition propose ses cases, et les autres cordes où elle se joue.
              </li>
              <li>
                <b>Repartir vers la partition classique</b> : l'export MusicXML garde la corde et la case de chaque note ; MuseScore l'ouvre en tablature.
              </li>
            </ul>
          </IdeaText>
        </Idea>

        <Topic id={PARTS.bass.id} title="La basse" text={BASS} label="À la basse, la fondamentale et la quinte">
          <p>
            Tout ce qui précède vaut pour la basse, sur quatre cordes : <code>parts: Basse électrique</code>. Ici, la fondamentale et la quinte, de <i>la</i> puis de <i>do</i>.
          </p>
        </Topic>

        <Idea kind="wide" id={PARTS.limits.id}>
          <IdeaText>
            <h2>Ce qui change</h2>
            <p>
              Au piano, transposer un morceau en Prisma est simple : on ajoute le même nombre à chaque note. À la guitare, un arrangement est un doigté ; le transposer, c'est le
              refaire, sauf à déplacer le capo. C'est vrai de toute tablature, et Prisma n'y échappe pas.
            </p>
            <p>
              Et la tablature reste ce qu'elle est : un dessin du manche, pas des notes. Pour savoir quelle note sonne, l'éditeur l'écrit dans sa barre de statut, pour la case
              sous le curseur, et l'écoute la fait entendre.
            </p>
          </IdeaText>
        </Idea>

        <section className="text-center">
          <h2>Essayez avec un morceau que vous jouez.</h2>
          <ButtonLink primary href={APP}>
            Ouvrir l'application
          </ButtonLink>
          <Caption className="mt-3.5">
            Pour apprendre Prisma depuis le début, <a href="apprendre.html">suivez les étapes</a> ; pour chaque signe, <a href="reference.html">consultez la référence</a>.
          </Caption>
        </section>
      </main>
      <Footer current="guitare" />
    </>
  );
}
