/** La référence, telle que dans l'application : la référence complète du format, ses exemples gravés. */
import { ReferenceView } from "../../app/reference/ReferenceView.tsx";
import { DEFAULT_OPTIONS } from "../../app/options/options.ts";
import { Example } from "../examples/Example.tsx";
import { Footer, Header } from "../layout/Frame.tsx";
import { Page } from "../layout/Page.tsx";

export function Reference() {
  return (
    <>
      <Header current="reference" />
      {/* la référence de l'application, un peu plus grande ; ses tableaux défilent de côté s'ils sont trop larges */}
      <Page className="[&_.guide]:text-[17px] [&_.guide_table]:block [&_.guide_table]:max-w-full [&_.guide_table]:overflow-x-auto phone:[&_.guide]:pt-2 phone:[&_.guide]:px-0 phone:[&_.guide]:pb-8">
        <ReferenceView site="" options={DEFAULT_OPTIONS} example={(text) => <Example text={text} scale={1.4} label="Un exemple de la référence" guide />} />
      </Page>
      <Footer current="reference" />
    </>
  );
}
