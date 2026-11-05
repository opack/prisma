/**
 * Deux projets Playwright, sur le même serveur de développement :
 *
 * - e2e (tests/e2e) : le comportement, vérifié par ce que l'application montre (rôles, noms, état) ;
 *   `pnpm e2e`.
 * - visual (tests/visual) : le banc de captures, chaque écran comparé pixel à pixel à sa référence.
 *   Pour une refonte qui ne doit rien changer à l'œil :
 *
 *     git worktree add ../prisma-reference HEAD        (le code de départ, à côté)
 *     VISUAL_ROOT=../prisma-reference pnpm visual:reference
 *     pnpm visual                                   (le code modifié, comparé aux références)
 *
 * Les références et les écarts restent hors du dépôt (tests/visual/captures, test-results).
 */
import { defineConfig } from "@playwright/test";

const root = process.env.VISUAL_ROOT ?? ".";
const port = 5399;

export default defineConfig({
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/report" }]],
  outputDir: "test-results/runs",
  use: { baseURL: `http://localhost:${port}`, reducedMotion: "reduce", deviceScaleFactor: 1 },
  projects: [
    // le comportement : ce que fait l'application, vérifié par ce qu'elle montre (rôles, textes, état)
    { name: "e2e", testDir: "tests/e2e", testMatch: "*.spec.ts" },
    // l'apparence : chaque capture comparée pixel à pixel à sa référence
    {
      name: "visual",
      testDir: "tests/visual",
      testMatch: "*.pw.ts",
      snapshotPathTemplate: "tests/visual/captures/{arg}{ext}",
      expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0 } },
    },
  ],
  // un identifiant pCloud de banc : la bibliothèque propose pCloud, dont les appels sont simulés (page.route) ;
  // un commit fixe, pour la fenêtre À propos
  webServer: { command: `pnpm exec vite --port ${port} --strictPort`, cwd: root, url: `http://localhost:${port}/app/`, reuseExistingServer: false, timeout: 60_000, env: { VITE_PCLOUD_CLIENT_ID: "banc", COMMIT_REF: "0000000" } },
});
