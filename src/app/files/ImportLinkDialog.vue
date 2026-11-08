<script setup lang="ts">
/**
 * Fichier › Importer un lien : le lien d'une partition partagée, collé ; lu, il montre la partition
 * reçue, à ouvrir ou à enregistrer dans la bibliothèque. Un lien qui ne se lit pas le dit, ici.
 */
import { ref, useId, watch } from "vue";
import FormDialog from "../ui/dialog/FormDialog.vue";

const { importLink } = defineProps<{ importLink: (link: string) => Promise<string | null> }>();
const emit = defineEmits<{ close: [] }>();

const id = useId();
const link = ref("");
const problem = ref<string | null>(null);
watch(link, () => (problem.value = null));

async function submit() {
  problem.value = await importLink(link.value);
}
</script>

<template>
  <FormDialog
    title="Importer un lien"
    intro="Collez le lien d'une partition partagée (Fichier › Partager par un lien), ou ce qui suit son « #p= »."
    submit="Importer"
    focus-field
    @submit="submit"
    @close="emit('close')"
  >
    <label class="grid gap-1" :for="id">
      Lien
      <textarea
        :id="id"
        v-model="link"
        class="min-h-[4.5em] px-2.5 py-[7px] bg-white border border-line rounded font-mono text-[12px] break-all resize-y"
        placeholder="https://prisma.valdera.fr/app/#p=…"
        :aria-invalid="!!problem"
        :aria-describedby="problem ? `${id}-problem` : undefined"
      />
    </label>
    <p v-if="problem" :id="`${id}-problem`" class="m-0 text-accent" role="alert">{{ problem }}</p>
  </FormDialog>
</template>
