/** L'écoute : le tempo, le métronome, les parties jouées, la piste de lecture et la partition qui la suit. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APPS, CLAIR_SECTIONS, openApp } from "../support/app.ts";

const track = (page: Page) => page.getByRole("slider", { name: "Position dans le morceau" });
const scorePane = (page: Page) => page.locator("section[data-fit]");

/** Cinq systèmes de quatre mesures, une reprise ouverte (« ||: ») à la dernière mesure du premier. */
const REPEAT_OPENS = (() => {
  const system = (firstBar: number, opensRepeat = false) => {
    const barline = (index: number) => (opensRepeat && index === 3 ? "||:" : index ? "||" : "|");
    const row = (cells: string) => Array.from({ length: 4 }, (_, index) => barline(index) + cells).join("") + "||";
    return `${`m${firstBar}`.padEnd(3)}${row("1  |2  |3  |4  ")}\n0  ${row("1  |3  |5  |6  ")}`;
  };
  const systems = [system(1, true), ...[5, 9, 13, 17].map((firstBar) => system(firstBar))];
  return `---\nformat: 1\n---\n\n${systems.join("\n\n")}\n\nm21|1  |2  |3  |4  :||\n0  |8  |-  |-  |-  :||\n`;
})();

/** Au clair de la lune, sa première section jouée deux fois de suite, puis quatre autres. */
const SECTION_REPLAYED = (() => {
  const [head, sectionA, sectionB] = CLAIR_SECTIONS.replace(/^order:.*$/m, "order: A A B C D E").split("\n\n");
  return [head, sectionA, ...["B", "C", "D", "E"].map((label) => sectionB.replace("[B]", `[${label}]`))].join("\n\n");
})();

for (const { name: app, root } of APPS)
  test.describe(`l'écoute (${app})`, () => {
    test("le tempo : + l'avance de 1, un appui long de 5 en 5, ↺ revient à celui de la partition", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      const tempo = page.getByRole("spinbutton", { name: "Tempo de l'écoute" });
      const faster = page.getByRole("button", { name: "Plus rapide", exact: true });
      await expect(tempo).toHaveValue("100");
      await faster.click();
      await expect(tempo).toHaveValue("101");
      await faster.hover();
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await expect(tempo).toHaveValue("106");
      await page.getByRole("button", { name: "Plus lent", exact: true }).click();
      await expect(tempo).toHaveValue("105");
      await page.getByRole("button", { name: "Revenir au tempo de la partition" }).click();
      await expect(tempo).toHaveValue("100");
    });

    test("le métronome s'allume et se coupe, et choisit ce qu'il bat", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      const metronome = page.getByRole("button", { name: "Métronome", exact: true });
      const before = await metronome.getAttribute("aria-pressed");
      await metronome.click();
      await expect(metronome).not.toHaveAttribute("aria-pressed", before ?? "");
      await page.getByRole("button", { name: "Battre" }).click();
      await expect(page.getByRole("dialog", { name: "Battre" })).toBeVisible();
    });

    test("une portée se rend muette ; le bouton Musique coupe tout, puis rend le choix d'avant", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      const music = page.getByRole("button", { name: "Musique", exact: true });
      await expect(music).toHaveAttribute("title", "Musique : toutes les portées jouées");
      await page.getByRole("button", { name: "Parties et instruments" }).click();
      const staves = page.getByRole("dialog", { name: "Parties et instruments" }).getByRole("checkbox");
      await staves.first().uncheck();
      await expect(music).toHaveAttribute("title", /^Musique : 1 portée muette sur \d+$/);
      await page.keyboard.press("Escape");
      await music.click();
      await expect(music).toHaveAttribute("title", "Musique : coupée (le métronome seul)");
      await music.click();
      await expect(music).toHaveAttribute("title", /^Musique : 1 portée muette/);
    });

    test("un clic sur la piste place la lecture sur une mesure, et dit le temps où elle tombe", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS, editing: false });
      const box = (await track(page).boundingBox())!;
      await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
      await expect(track(page)).toHaveAttribute("aria-valuetext", "mesure 10 sur 16, section B");
      // 16 mesures de 4 temps à 100 : 38 secondes ; la 10e commence à 21
      await expect(page.getByText("0:21 / 0:38")).toBeVisible();
      // au survol, la bulle dit où l'on tomberait
      const moved = (await track(page).boundingBox())!;
      await page.mouse.move(moved.x + moved.width * 0.3, moved.y + moved.height / 2);
      await expect(page.getByText(/^mesure 5/)).toBeVisible();
    });

    test("la partition suit la piste : Fin la mène en bas, Début la ramène en haut", async ({ page }) => {
      const head = CLAIR_SECTIONS.slice(0, CLAIR_SECTIONS.indexOf("\n---\n", 4) + 5).replace(/^order:.*\n/m, "");
      const section = CLAIR_SECTIONS.split("\n\n")
        .find((block) => block.includes("[A]"))!
        .replace("[A]", "");
      await openApp(page, {
        root,
        source: head + Array(12).fill(section).join("\n\n"),
        editing: false,
        view: { fit: "width", zoom: 1, progress: true },
      });
      expect(await scorePane(page).evaluate((pane) => pane.scrollTop)).toBe(0);
      await track(page).focus();
      await page.keyboard.press("End");
      await expect.poll(() => scorePane(page).evaluate((pane) => pane.scrollTop)).toBeGreaterThan(500);
      await page.keyboard.press("Home");
      await expect.poll(() => scorePane(page).evaluate((pane) => pane.scrollTop)).toBeLessThan(300);
    });

    // revenue au début de plus loin, la place du bas montre la suite, pas une seconde fois le premier
    // système : même quand une reprise s'ouvre à sa dernière mesure, ou qu'il se rejoue aussitôt (« A A B… »)
    for (const [name, source] of [
      ["une reprise ouverte au premier système", REPEAT_OPENS],
      ["une section rejouée aussitôt", SECTION_REPLAYED],
    ] as const)
      test(`en lecture focalisée, revenir au début remontre les deux premiers systèmes : ${name}`, async ({ page }) => {
        await openApp(page, { root, source, editing: false, view: { fit: "focus", zoom: 1, progress: true } });
        const shown = () =>
          page.locator("div.animate-focus-in > svg").evaluateAll((systems) => systems.map((system) => system.textContent));
        const start = await shown();
        expect(start[0]).not.toBe(start[1]);
        await track(page).focus();
        for (const backToStart of [
          () => page.keyboard.press("Home"),
          () => page.getByRole("button", { name: "Revenir au début" }).click(),
        ]) {
          await page.keyboard.press("End");
          await expect.poll(async () => (await shown()).includes(start[0])).toBe(false);
          await backToStart();
          await expect.poll(shown).toEqual(start);
        }
      });
  });
