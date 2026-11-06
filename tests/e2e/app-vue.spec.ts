/** L'application en Vue, en construction : elle s'ouvre sur /app-vue/, et ses composants répondent. */
import { expect, test } from "@playwright/test";

test("l'application Vue s'ouvre et répond", async ({ page }) => {
  await page.goto("/app-vue/");
  await expect(page.getByText(/^Prisma \d+\.\d+\.\d+, bientôt en Vue\.$/)).toBeVisible();
  await page.getByRole("button", { name: "Saluer" }).click();
  await expect(page.getByRole("button", { name: "Bonjour !" })).toBeVisible();
});
