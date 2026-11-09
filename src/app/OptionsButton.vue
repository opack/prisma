<script setup lang="ts">
/** Le bouton des options : il ouvre ou ferme leur panneau (le clic passe au bouton). */
import { Button } from "./ui/button";

defineProps<{ open: boolean }>();
</script>

<template>
  <Button variant="ghost" size="icon" :pressed="open" aria-controls="options" title="Options" aria-label="Options">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M6.7 1h2.6l.4 1.9 1 .5 1.7-1 1.8 1.8-1 1.7.5 1 1.9.4v2.6l-1.9.4-.5 1 1 1.7-1.8 1.8-1.7-1-1 .5-.4 1.9H6.7l-.4-1.9-1-.5-1.7 1-1.8-1.8 1-1.7-.5-1L.4 9.3V6.7l1.9-.4.5-1-1-1.7 1.8-1.8 1.7 1 1-.5zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
      />
    </svg>
  </Button>
</template>
