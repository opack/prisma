<script setup lang="ts">
/**
 * Un morceau reçu par un lien : son titre, son compositeur, ses notes et son nom de fichier ; on
 * l'ouvre tel quel, ou on l'enregistre d'abord dans la bibliothèque, quand il y en a une.
 */
import { computed } from "vue";
import { parseFrontmatter } from "../../core/index.ts";
import type { Meta } from "../../core/index.ts";
import type { Shared } from "../../app/files/share.ts";
import { Button } from "../ui/button";
import FormDialog from "../ui/dialog/FormDialog.vue";

const { shared, library } = defineProps<{ shared: Shared; library?: string }>();
const emit = defineEmits<{ open: [save: boolean]; close: [] }>();

// l'en-tête seul : un morceau à l'écriture fautive se reçoit aussi, son erreur se verra à l'ouverture
const meta = computed((): Meta => {
  try {
    return parseFrontmatter(shared.text.split(/\r?\n/)).meta;
  } catch {
    return {}; // un en-tête illisible : le nom du fichier suffit
  }
});
const title = computed(() => meta.value.title || shared.name.replace(/\.prisma$/i, ""));
</script>

<template>
  <FormDialog title="Partition reçue" submit="Ouvrir" cancel="Ignorer" focus-submit @submit="emit('open', false)" @close="emit('close')">
    <div class="grid gap-1">
      <p class="m-0 font-semibold text-[1.05rem]">{{ title }}</p>
      <p v-if="meta.composer" class="m-0 text-muted">{{ meta.composer }}</p>
      <p class="m-0 text-muted text-[12px]">{{ shared.name }}</p>
    </div>
    <p v-if="meta.notes" class="m-0 px-3 py-2 bg-white border border-line rounded whitespace-pre-line">{{ meta.notes }}</p>
    <p v-if="library" class="m-0 text-muted text-[13px] leading-[1.4]">
      Enregistré dans la bibliothèque ({{ library }}), il s'y retrouve et s'y réécrit ; ouvert tel quel, il s'enregistre où vous le
      choisirez.
    </p>
    <template v-if="library" #actions>
      <Button :title="`Enregistrer ${shared.name} dans la bibliothèque (${library}), puis l'ouvrir`" @click="emit('open', true)">
        Enregistrer dans la bibliothèque
      </Button>
    </template>
  </FormDialog>
</template>
