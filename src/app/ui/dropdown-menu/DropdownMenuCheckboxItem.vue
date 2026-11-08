<script setup lang="ts">
/** Une ligne de menu qui se coche : elle se dit cochée (menuitemcheckbox) ; ce qui le montre est dans le slot. */
import type { DropdownMenuCheckboxItemEmits, DropdownMenuCheckboxItemProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "cn";
import { DropdownMenuCheckboxItem, useForwardPropsEmits } from "reka-ui";

const props = defineProps<DropdownMenuCheckboxItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<DropdownMenuCheckboxItemEmits>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwarded"
    :class="
      cn(
        'focus:bg-panel focus:text-ink gap-2 rounded-sm py-1.5 px-2 text-sm relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuCheckboxItem>
</template>
