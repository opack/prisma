<script setup lang="ts">
/** La page d'une adresse qui n'existe pas (404.html, que Netlify sert pour toute adresse inconnue) : le chemin du retour. */
import Actions from "../layout/Actions.vue";
import ButtonLink from "../layout/ButtonLink.vue";
import Lead from "../layout/Lead.vue";
import Page from "../layout/Page.vue";
import Section from "../layout/Section.vue";
import SiteFooter from "../layout/SiteFooter.vue";
import SiteHeader from "../layout/SiteHeader.vue";
import { APP } from "../layout/pages.ts";
</script>

<template>
  <SiteHeader />
  <Page>
    <Section>
      <h1>Cette page n'existe pas</h1>
      <Lead>L'adresse est peut-être mal écrite, ou la page a changé de place. Tout le site part de l'accueil.</Lead>
      <Actions>
        <ButtonLink primary href="index.html">Revenir à l'accueil</ButtonLink>
        <ButtonLink :href="APP">Ouvrir l'application</ButtonLink>
      </Actions>
    </Section>
  </Page>
  <SiteFooter />
</template>
