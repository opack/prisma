// @vitest-environment happy-dom
/**
 * La gravure en Vue dessine exactement la page de React : le même SVG, élément par élément et
 * attribut par attribut, sur un corpus (les exemples du site et de la référence, la Gymnopédie) et
 * à plusieurs réglages. Ce test vit le temps de la migration : il part avec l'application React.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createApp, createSSRApp } from "vue";
import type { Component } from "vue";
import { renderToString } from "vue/server-renderer";
import { DEFAULT_OPTIONS } from "../../../app/options/options.ts";
import type { RenderOptions } from "../../../app/options/options.ts";
import { FocusView as ReactFocusView } from "../../../app/score/FocusView.tsx";
import { Excerpt as ReactExcerpt, PageView as ReactPageView } from "../../../app/score/PageView.tsx";
import { engraveOptions, engravePages, scoreOf } from "../../../app/score/render.ts";
import { importMusicXml, writePrisma } from "../../../core/index.ts";
import * as sitePieces from "../../../site/examples/pieces.ts";
import Excerpt from "../Excerpt.vue";
import FocusView from "../FocusView.vue";
import PageView from "../PageView.vue";

/** Les exemples ```prisma de la référence (dans une liste, ils sont indentés). */
function referenceExamples(): string[] {
  const markdown = readFileSync("REFERENCE.md", "utf8");
  return [...markdown.matchAll(/^( *)```prisma\n([\s\S]*?)^\1```/gm)].map(([, indent, body]) =>
    body
      .split("\n")
      .map((line) => line.slice(indent.length))
      .join("\n"),
  );
}

const gymnopedie = writePrisma(importMusicXml(readFileSync("tests/fixtures/gymnopedie1.musicxml", "utf8")));
const pieces: [string, string][] = Object.entries(sitePieces).filter(([, value]) => typeof value === "string");

/** Des réglages qui changent le dessin, un par un. */
const VARIANTS: Record<string, Partial<RenderOptions>> = {
  "par défaut": {},
  "octaves en flèches, au centre": { octaveStyle: "arrow", octavePosition: "center" },
  "octaves en signes, sans couleur": { octaveStyle: "sign", octaveColors: "none" },
  "notes centrées, teintes feutrées": { notePosition: "center", octaveColors: "muted" },
  "une ligne par note, sections à la suite": { notePosition: "pitch", sections: "inline" },
  "accords en grilles, récapitulées": { chords: "grid", chordChart: true },
  "accords en notes, noms anglais": { chords: "notes", chordNames: "english", noteNames: "english" },
  "accords nommés, sans noms de notes": { chords: "name", noteNames: "none" },
  "compact, sans rappels ni doigtés": { density: "compact", holdReminders: false, fingerings: false },
  "noms à chaque système, règle détaillée": { namesEverySystem: true, rulerDetail: "subdivision" },
  "pédales simile atténuées": { simile: "faded" },
  "simile en mention seule": { simile: "text" },
};

/**
 * Le SVG sous une forme comparable, un élément par ligne : les attributs triés, le style sans
 * espaces, les classes sans espaces en trop, sans les commentaires que posent React (entre deux textes) et Vue (fragments, v-if).
 */
function canonical(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  const lines: string[] = [];
  const walk = (node: Node, depth: number) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const attributes = [...element.attributes]
        .map(
          ({ name, value }) =>
            `${name}="${name === "style" ? value.replace(/\s|;$/g, "") : name === "class" ? value.trim().replace(/\s+/g, " ") : value}"`,
        )
        .sort()
        .join(" ");
      lines.push(`${"  ".repeat(depth)}<${element.tagName.toLowerCase()} ${attributes}>`);
      let text = "";
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (text) lines.push(`${"  ".repeat(depth + 1)}« ${text} »`);
          text = "";
          walk(child, depth + 1);
        }
      }
      if (text) lines.push(`${"  ".repeat(depth + 1)}« ${text} »`);
    }
  };
  container.childNodes.forEach((child) => walk(child, 0));
  return lines.join("\n");
}

const vueMarkup = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp(component, props));

/** Rendus dans le navigateur, pour ce qui suit le lecteur (React ne le rend pas sur le serveur). */
function reactDom<Props extends object>(component: (props: Props) => unknown, props: Props): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(component as never, props)));
  const html = host.innerHTML;
  root.unmount();
  return html;
}
function vueDom(component: Component, props: Record<string, unknown>): string {
  const host = document.createElement("div");
  const app = createApp(component, props);
  app.mount(host);
  const html = host.innerHTML;
  app.unmount();
  return html;
}

function engraved(text: string, variant: Partial<RenderOptions>) {
  const options = { ...DEFAULT_OPTIONS, ...variant };
  const score = scoreOf(text, "prisma", "");
  return { options, meta: score.meta, pages: engravePages(score, engraveOptions(options)) };
}

describe("la page gravée en Vue est celle de React", () => {
  const corpus: [string, string][] = [["Gymnopédie", gymnopedie], ...pieces];
  for (const [variantName, variant] of Object.entries(VARIANTS))
    it.each(corpus)(`${variantName} : %s`, async (_, text) => {
      const { options, meta, pages } = engraved(text, variant);
      for (const page of pages) {
        const props = { page, total: pages.length, meta, options, still: true };
        const react = renderToStaticMarkup(createElement(ReactPageView, props));
        expect(canonical(await vueMarkup(PageView, props))).toBe(canonical(react));
      }
    });

  it.each(corpus)("lecture focalisée : %s", (_, text) => {
    const { options, pages } = engraved(text, {});
    const props = { pages, options };
    expect(canonical(vueDom(FocusView, props))).toBe(canonical(reactDom(ReactFocusView, props)));
  });

  // vivante, à l'arrêt (rendue dans le navigateur : React ne la rend pas sur le serveur) : les zones
  // où cliquer pour écouter, l'ordre de jeu où choisir sa section
  it.each(corpus)("vivante : %s", (_, text) => {
    const { options, meta, pages } = engraved(text, {});
    for (const page of pages) {
      const props = { page, total: pages.length, meta, options };
      expect(canonical(vueDom(PageView, props))).toBe(canonical(reactDom(ReactPageView, props)));
    }
  });
});

describe("l'extrait gravé en Vue est celui de React", () => {
  it.each(referenceExamples().map((text, index) => [index + 1, text]))("exemple %i de la référence", async (_, text) => {
    const { options, pages } = engraved(text as string, {});
    const props = { pages, options, scale: 1.4 };
    expect(canonical(await vueMarkup(Excerpt, props))).toBe(canonical(renderToStaticMarkup(createElement(ReactExcerpt, props))));
  });
});
