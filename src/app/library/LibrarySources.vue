<script setup lang="ts">
/** Sans bibliothèque : le choix entre un dossier de l'ordinateur et pCloud, ce que permet chacun. */
import { PCLOUD_FOLDER } from "./pcloud.ts";
import { available } from "./sources.ts";
import { Button } from "../ui/button";

const emit = defineEmits<{ folder: []; pcloud: [] }>();
</script>

<template>
  <div class="text-dim leading-[1.5] grid gap-5">
    <p class="m-0">
      La bibliothèque montre toutes vos partitions (.prisma et MusicXML) d'un dossier, sous-dossiers compris. Les fichiers restent où ils
      sont : Prisma les lit et les réécrit en place.
    </p>
    <section v-if="available.disk" class="grid gap-2 justify-items-start">
      <h2 class="m-0 text-ink text-[16px]">Un dossier de cet ordinateur</h2>
      <p class="m-0">Le dossier de votre choix, sur cet ordinateur seulement.</p>
      <Button @click="emit('folder')">Choisir un dossier</Button>
    </section>
    <section v-if="available.pcloud" class="grid gap-2 justify-items-start">
      <h2 class="m-0 text-ink text-[16px]">pCloud</h2>
      <p class="m-0">
        Vos partitions depuis tous vos appareils, tablette comprise. Prisma n'a accès qu'à un dossier de votre pCloud, «
        {{ PCLOUD_FOLDER }} » : c'est là que vos partitions doivent être. Si vous avez pCloud Drive sur cet ordinateur, ce même dossier peut
        aussi servir de bibliothèque ici.
      </p>
      <Button :variant="available.disk ? 'outline' : 'default'" @click="emit('pcloud')">Se connecter à pCloud</Button>
    </section>
  </div>
</template>
