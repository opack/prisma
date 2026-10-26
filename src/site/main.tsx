import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./Home.tsx";
import { Comparison } from "./Comparison.tsx";
import { Guitar } from "./Guitar.tsx";
import { Learn } from "./Learn.tsx";
import { Reference } from "./Reference.tsx";
import "../tailwind.css";
import "./site.css";

const root = document.getElementById("root")!;
const PAGES = { comparaison: Comparison, apprendre: Learn, reference: Reference, guitare: Guitar } as const;
const Page = PAGES[root.dataset.page as keyof typeof PAGES] ?? Home;
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
