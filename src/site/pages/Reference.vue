<script setup lang="ts">
/** La référence, telle que dans l'application : la référence complète du format, ses exemples gravés. */
import { DEFAULT_OPTIONS } from "../../app/options/options.ts";
import ReferenceView from "../../app/reference/ReferenceView.vue";
import Example from "../examples/Example.vue";
import Page from "../layout/Page.vue";
import SiteFooter from "../layout/SiteFooter.vue";
import SiteHeader from "../layout/SiteHeader.vue";
</script>

<template>
  <SiteHeader current="reference" />
  <!-- la référence de l'application, un peu plus grande ; ses tableaux défilent de côté s'ils sont trop larges -->
  <Page
    class="[&_.guide]:text-[17px] [&_.guide_table]:block [&_.guide_table]:max-w-full [&_.guide_table]:overflow-x-auto phone:[&_.guide]:pt-2 phone:[&_.guide]:px-0 phone:[&_.guide]:pb-8"
  >
    <ReferenceView site="" :options="DEFAULT_OPTIONS">
      <template #example="{ text }">
        <Example :text="text" :scale="1.4" label="Un exemple de la référence" guide />
      </template>
    </ReferenceView>
  </Page>
  <SiteFooter current="reference" />
</template>
