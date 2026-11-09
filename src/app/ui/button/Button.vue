<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { ButtonVariants } from ".";
import { cn } from "cn";
import { Primitive } from "reka-ui";
import { buttonVariants } from ".";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
  /** un bouton à bascule : allumé, il le dit (aria-pressed) et prend l'allure pleine (default) */
  pressed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  pressed: undefined,
});
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :aria-pressed="pressed"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant: pressed ? 'default' : variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
