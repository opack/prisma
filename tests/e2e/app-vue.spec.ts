/** L'application en Vue, en construction : elle s'ouvre sur /app-vue/ et grave le morceau en cours. */
import { expect, test } from "@playwright/test";
import { CLAIR_SECTIONS } from "../support/app.ts";

test("l'application Vue grave le morceau en cours", async ({ page }) => {
  await page.addInitScript((text) => localStorage.setItem("prisma:source", text), CLAIR_SECTIONS);
  await page.goto("/app-vue/");
  const score = page.getByRole("main", { name: "Partition" });
  await expect(score.locator("svg.page")).toHaveCount(1);
  await expect(score).toContainText("Au clair de la lune");
});
