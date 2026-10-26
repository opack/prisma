/**
 * Le banc de captures : l'application et le site, écran par écran, comparés pixel à pixel à des
 * captures de référence. Pour une refonte qui ne doit rien changer à l'œil (le passage à Tailwind,
 * par exemple) :
 *
 *   git worktree add ../prisma-reference HEAD        (le code de départ, à côté)
 *   VISUAL_ROOT=../prisma-reference npm run visual:reference
 *   npm run visual                                   (le code modifié, comparé aux références)
 *
 * Les références et les écarts restent hors du dépôt (tests/visual/captures, test-results).
 */
import { defineConfig } from "@playwright/test";

const root = process.env.VISUAL_ROOT ?? ".";
const port = 5399;

export default defineConfig({
  testDir: "tests/visual",
  testMatch: "*.pw.ts",
  snapshotPathTemplate: "tests/visual/captures/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/visual-report" }]],
  outputDir: "test-results/visual",
  use: { baseURL: `http://localhost:${port}`, reducedMotion: "reduce", deviceScaleFactor: 1 },
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0 } },
  webServer: { command: `npx vite --port ${port} --strictPort`, cwd: root, url: `http://localhost:${port}/app/`, reuseExistingServer: false, timeout: 60_000 },
});
