// @vitest-environment happy-dom
/**
 * Les pages du site en Vue disent ce que disent celles de React : les mêmes éléments, les mêmes
 * classes, le même texte, espaces comprises. Le texte est comparé à l'espace près (un mot collé à
 * un lien se voit) mais sans les espaces en tête et en fin d'élément, que le navigateur n'affiche
 * pas. Les attributs que posent les bibliothèques de menus (identifiants, états) sont laissés de
 * côté. Ce test vit le temps de la migration : il part avec le site React.
 */
import { createElement } from "react";
import type { FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createSSRApp } from "vue";
import type { Component } from "vue";
import { renderToString } from "vue/server-renderer";
import { Comparison as ReactComparison } from "../../site/pages/Comparison.tsx";
import { Guitar as ReactGuitar } from "../../site/pages/Guitar.tsx";
import { Home as ReactHome } from "../../site/pages/Home.tsx";
import { Learn as ReactLearn } from "../../site/pages/Learn.tsx";
import Comparison from "../pages/Comparison.vue";
import Guitar from "../pages/Guitar.vue";
import Home from "../pages/Home.vue";
import Learn from "../pages/Learn.vue";

/** Les attributs propres à une bibliothèque, sans effet sur ce qu'on voit. */
const IGNORED = /^(id|data-.*|aria-controls|aria-expanded|aria-haspopup|aria-labelledby|type|dir|tabindex)$/;

/** Une valeur d'attribut comparable : les classes triées (le focus du bouton, de React Aria au CSS), le style sans espaces. */
function attributeValue(name: string, value: string): string {
  if (name === "class") return value.replaceAll("data-focus-visible:", "focus-visible:").split(/\s+/).filter(Boolean).sort().join(" ");
  if (name === "style") return value.replace(/\s|;$/g, "");
  return value;
}

/** La page sous une forme comparable, un élément par ligne : attributs et classes triés, texte aux espaces réduites. */
function canonical(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  const lines: string[] = [];
  const walk = (element: Element, depth: number) => {
    const attributes = [...element.attributes]
      .filter(({ name }) => !IGNORED.test(name))
      .map(({ name, value }) => `${name}="${attributeValue(name, value)}"`)
      .sort()
      .join(" ");
    lines.push(`${"  ".repeat(depth)}<${element.tagName.toLowerCase()} ${attributes}>`);
    const preformatted = element.tagName === "PRE";
    const children = [...element.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE || child.nodeType === Node.ELEMENT_NODE);
    let text = "";
    const flush = (last: boolean) => {
      let shown = preformatted ? text : text.replace(/\s+/g, " ");
      if (!preformatted && last) shown = shown.trimEnd();
      if (shown) lines.push(`${"  ".repeat(depth + 1)}« ${shown} »`);
      text = "";
    };
    children.forEach((child, index) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
        if (index === 0 && !preformatted) text = text.trimStart();
      } else {
        flush(false);
        walk(child as Element, depth + 1);
      }
    });
    flush(true);
  };
  [...container.children].forEach((child) => walk(child, 0));
  return lines.join("\n");
}

const PAGES: [string, FunctionComponent, Component][] = [
  ["l'accueil", ReactHome, Home],
  ["apprendre", ReactLearn, Learn],
  ["la guitare", ReactGuitar, Guitar],
  ["la comparaison", ReactComparison, Comparison],
];

describe("les pages du site en Vue sont celles de React", () => {
  // React Aria prévient que ses effets ne tournent pas sur le serveur : sans effet sur le rendu
  beforeAll(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  it.each(PAGES)("%s", async (name, reactPage, vuePage) => {
    const react = renderToStaticMarkup(createElement(reactPage));
    const vue = await renderToString(createSSRApp(vuePage));
    expect(canonical(vue)).toBe(canonical(react));
  });
});
