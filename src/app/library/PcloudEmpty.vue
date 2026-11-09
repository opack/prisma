<script setup lang="ts">
/** Le dossier de Prisma sur pCloud, vide : comment y mettre ses partitions. */
import { PCLOUD_FOLDER } from "./pcloud.ts";
</script>

<template>
  <div class="text-dim leading-[1.5]">
    <p class="mt-0 mb-2">Aucune partition pour l'instant dans le dossier « {{ PCLOUD_FOLDER }} » de votre pCloud. Pour en ajouter :</p>
    <ul class="m-0 pl-5 grid gap-1 list-disc">
      <li>déplacez-y vos fichiers .prisma et MusicXML, depuis pCloud (le site, l'application) ou pCloud Drive sur votre ordinateur ;</li>
      <li>ou ouvrez un morceau (Fichier › Ouvrir), puis Fichier › Enregistrer dans la bibliothèque.</li>
    </ul>
    <p class="mt-2 mb-0">Puis actualisez la bibliothèque.</p>
  </div>
</template>
