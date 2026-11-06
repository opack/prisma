<script setup lang="ts">
/** Le bouton de Prisma (voir index.ts) ; sa place (class) dépend de ce qui l'entoure, ses autres attributs passent au bouton. */
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "../utils.ts";
import type { ButtonVariants } from ".";
import { buttonVariants } from ".";

interface Props extends PrimitiveProps {
  kind?: ButtonVariants["kind"];
  size?: ButtonVariants["size"];
  pressed?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), { as: "button", pressed: undefined });
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :type="as === 'button' && !asChild ? 'button' : undefined"
    :aria-pressed="pressed"
    :class="cn(buttonVariants({ kind: pressed ? null : kind, size, pressed: !!pressed }), props.class)"
  >
    <slot />
  </Primitive>
</template>
