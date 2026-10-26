/**
 * L'accueil du site : la notation en quelques idées, chacune montrée par la vraie gravure, pour qui
 * commence ou recommence la musique, illustrée au piano. La comparaison détaillée avec la partition classique a sa page.
 */
import { useState } from "react";
import type { OctaveColors } from "../app/colors.ts";
import { Engraving, Example, Source } from "./Example.tsx";
import { HeroKeyboard } from "./HeroKeyboard.tsx";
import { CLAIR, CLAIR_SECTIONS, LANES, RULER, SCALE } from "./pieces.ts";
import { APP, Footer, Header } from "./Frame.tsx";
import { Actions } from "./Actions.tsx";
import { ButtonLink } from "./ButtonLink.tsx";
import { Caption } from "./Caption.tsx";
import { Idea } from "./Idea.tsx";
import { IdeaText } from "./IdeaText.tsx";
import { Lead } from "./Lead.tsx";

const PALETTES: { value: OctaveColors; label: string }[] = [
  { value: "rainbow", label: "Arc-en-ciel" },
  { value: "muted", label: "Feutré" },
  { value: "none", label: "Blanc et gris" },
];

/** Le nom d'un réglage à essayer, sur sa ligne. */
const TRY_LABEL = "w-full text-[0.95rem] text-muted mt-1.5";

export function Home() {
  const [colors, setColors] = useState<OctaveColors>("rainbow");
  const [pitch, setPitch] = useState(false);
  const [inline, setInline] = useState(false);
  return (
    <>
      <Header />
      <main>
        <section className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 items-center pt-10 narrow:grid-cols-[minmax(0,1fr)] narrow:gap-6">
          <div>
            <h1>Une note, un nombre.</h1>
            <Lead>
              Prisma écrit la musique avec les douze notes de l'octave, numérotées de 1 à 12. Le nombre dit quelle note jouer, la ligne où il est écrit dit dans quelle octave, et
              le nombre de cases qu'il occupe dit combien de temps. Ni clés, ni dièses, ni bémols.
            </Lead>
            <Actions>
              <ButtonLink primary href={APP}>
                Ouvrir l'application
              </ButtonLink>
              <ButtonLink href="#principe">
                Voir comment ça marche
              </ButtonLink>
            </Actions>
          </div>
          <div>
            <HeroKeyboard />
            <Caption className="mt-2.5">Sur un clavier, ça se voit : survolez ou touchez une touche, d'une octave à l'autre le même nombre tombe sous le même doigt.</Caption>
          </div>
        </section>

        <Idea id="principe">
          <IdeaText>
            <h2>Le nombre, c'est la note</h2>
            <p>
              Les douze notes de l'octave, du <i>do</i> au <i>si</i>, demi-ton par demi-ton, sont numérotées de <code>1</code> à <code>12</code>. La gamme de <i>do</i> s'écrit <code>1 3 5 6 8 10 12</code> : au piano, les touches
              blanches ; les noires sont entre deux, <code>2 4 7 9 11</code>. Il n'y a rien d'autre à apprendre pour trouver une note.
            </p>
            <p>Le <i>fa dièse</i> et le <i>sol bémol</i>, deux noms pour une même note, sont ici un seul nombre : <code>7</code>.</p>
          </IdeaText>
          <Example text={SCALE} label="La gamme de do, de 1 à 12, puis le 1 de l'octave du dessus" />
        </Idea>

        <Idea>
          <IdeaText>
            <h2>L'octave, c'est la ligne</h2>
            <p>
              Chaque ligne de notes porte le numéro de son octave, compté depuis celle du <i>do</i> central : <code>0</code>, puis <code>+1</code> au-dessus, <code>-1</code> au-dessous. Sur la partition,
              chaque octave a son couloir, toujours de la même couleur.
            </p>
            <p>Ici, le même <code>5</code> (le <i>mi</i>) dans quatre octaves, du grave à l'aigu.</p>
          </IdeaText>
          <Example text={LANES} label="Le même 5 dans les octaves -2, -1, 0 et +1" />
        </Idea>

        <Idea>
          <IdeaText>
            <h2>Le temps se lit comme une règle</h2>
            <p>
              Au-dessus des notes, la règle de comptage donne les temps de la mesure. Une note commence sur sa case et dure tant qu'un trait la prolonge. Un temps peut se couper en
              deux cases pour des notes plus rapides.
            </p>
            <p>Pas de rondes, de croches, de points ou de liaisons de durée à déchiffrer et à calculer : la durée se voit à sa place.</p>
          </IdeaText>
          <Example text={RULER} label="Une note de deux temps, deux notes d'un demi-temps, une note d'un temps" />
        </Idea>

        <Idea kind="wide">
          <IdeaText>
            <h2>Un premier morceau</h2>
            <p>
              <i>Au clair de la lune</i>, sur deux portées : au piano, une par main. En haut, le texte tel qu'on le tape ; en dessous, la partition que l'application en tire. Les
              deux disent exactement la même chose.
            </p>
          </IdeaText>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <Source text={CLAIR} header={false} />
            <Engraving text={CLAIR} scale={1.25} label="Au clair de la lune, gravé" />
          </div>
          <IdeaText>
            <p>
              Pas besoin d'être un as de la mise en forme : une barre <code>|</code> entre les cases, une ligne par octave, trois tirets <code>---</code> entre deux portées.
              L'éditeur s'occupe du reste : il prolonge la règle et ouvre les lignes de notes, barres comprises, en gardant les colonnes alignées. Et le texte se lit déjà comme la
              partition : chaque colonne est un temps.
            </p>
          </IdeaText>
        </Idea>

        <Idea kind="wide">
          <IdeaText>
            <h2>Une partition qui s'adapte à vous</h2>
            <p>
              Le texte dit ce qu'on joue ; la façon de le montrer, elle, se règle. La même partition peut s'afficher de plusieurs façons sans que rien ne change à ce qu'elle dit.
              Quelques-uns des réglages de l'application :
            </p>
            <ul>
              <li>Les couleurs des octaves : vives, douces, ou en blanc et gris pour l'impression.</li>
              <li>Une ligne par note : chaque note prend sa propre ligne, la plus aiguë au-dessus, et la mélodie monte et descend sous vos yeux.</li>
              <li>
                Les sections à la ligne : un morceau découpé en parties (A, B…) se lit comme une chanson. Chaque partie est écrite une fois et commence sa propre ligne ; l'ordre
                de jeu, ici <code>A A B A</code>, est écrit en tête. Ou bien à la suite, pour une partition plus courte.
              </li>
              <li>
                Les accords d'accompagnement par leur nom Prisma (<code>10:m</code> pour <i>la</i> mineur), leurs notes (<code>10 1 5</code>), ou les deux ; ou par leur nom
                anglais (<i>Am</i>), pour qui le connaît.
              </li>
              <li>Une portée à la fois : coupez le son de celle que vous jouez (une main au piano, votre voix dans le chœur), l'application joue les autres.</li>
              <li>L'écoute au tempo de votre choix, avec un métronome, et la partition qui suit le curseur.</li>
              <li>
                La lecture focalisée : l'écran ne montre que deux lignes de la partition, celle qu'on joue et la suivante, toujours aux mêmes places. Quand on finit l'une, l'autre
                est déjà là, et la ligne jouée laisse place à celle d'après, reprises comprises : ni page à tourner, ni défilement.
              </li>
              <li>Et quand la lecture devient facile : doigtés masqués, couleurs neutres, espacement compact.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Essayer trois réglages">
              <span className={TRY_LABEL}>Couleurs</span>
              {PALETTES.map((p) => (
                <button key={p.value} className={`text-[0.95rem] px-3 py-[5px] border rounded-md cursor-pointer ${colors === p.value ? "border-accent text-accent bg-accent-10 font-bold" : "border-line bg-white text-ink"}`} aria-pressed={colors === p.value} onClick={() => setColors(p.value)}>
                  {p.label}
                </button>
              ))}
              <span className={TRY_LABEL}>Place des notes</span>
              <button className={`text-[0.95rem] px-3 py-[5px] border rounded-md cursor-pointer ${!pitch ? "border-accent text-accent bg-accent-10 font-bold" : "border-line bg-white text-ink"}`} aria-pressed={!pitch} onClick={() => setPitch(false)}>
                En haut
              </button>
              <button className={`text-[0.95rem] px-3 py-[5px] border rounded-md cursor-pointer ${pitch ? "border-accent text-accent bg-accent-10 font-bold" : "border-line bg-white text-ink"}`} aria-pressed={pitch} onClick={() => setPitch(true)}>
                Une ligne par note
              </button>
              <span className={TRY_LABEL}>Sections</span>
              <button className={`text-[0.95rem] px-3 py-[5px] border rounded-md cursor-pointer ${!inline ? "border-accent text-accent bg-accent-10 font-bold" : "border-line bg-white text-ink"}`} aria-pressed={!inline} onClick={() => setInline(false)}>
                À la ligne
              </button>
              <button className={`text-[0.95rem] px-3 py-[5px] border rounded-md cursor-pointer ${inline ? "border-accent text-accent bg-accent-10 font-bold" : "border-line bg-white text-ink"}`} aria-pressed={inline} onClick={() => setInline(true)}>
                À la suite
              </button>
            </div>
          </IdeaText>
          <Example
            text={CLAIR_SECTIONS}
            scale={1.25}
            options={{ octaveColors: colors, notePosition: pitch ? "pitch" : "top", sections: inline ? "inline" : "newLine" }}
            label="Au clair de la lune en entier, avec les réglages choisis"
          />
        </Idea>

        <Idea>
          <IdeaText>
            <h2>Vos morceaux</h2>
            <p>
              Importez un fichier MusicXML, exporté de MuseScore par exemple : l'application l'écrit en Prisma. Ou tapez le vôtre : l'éditeur complète ce que vous écrivez, souligne
              les erreurs, et un double-clic sur la partition retouche une note. Et dans l'autre sens, un morceau s'exporte en MusicXML, pour l'ouvrir en partition classique.
            </p>
            <p>
              Vous connaissez déjà la partition classique ? <a href="comparaison.html">Voyez ce que Prisma garde, ce qu'il retire, et ce qu'il perd.</a>
            </p>
            <p>
              Vous jouez de la guitare ou de la basse ? Prisma les écrit comme une tablature, posée sur la règle du temps : <a href="guitare.html">voyez ce qu'elle y gagne</a>.
            </p>
          </IdeaText>
        </Idea>

        <section className="text-center">
          <h2>Essayez avec un morceau que vous aimez.</h2>
          <ButtonLink primary href={APP}>
            Ouvrir l'application
          </ButtonLink>
          <Caption className="mt-3.5">
            Pour commencer, <a href="apprendre.html">apprenez pas à pas</a> ; pour tout savoir, <a href="reference.html">consultez la référence</a>.
          </Caption>
        </section>
      </main>
      <Footer />
    </>
  );
}
