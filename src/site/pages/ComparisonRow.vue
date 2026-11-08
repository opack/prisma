<script setup lang="ts">
/**
 * Une ligne du tableau de la comparaison : ce qui s'apprend, la partition classique, Prisma. Sur un
 * téléphone, une fiche : chaque case dit sa colonne au-dessus d'elle.
 */
defineProps<{ what: string }>();
defineSlots<{ classic(): unknown; prisma(): unknown }>();
</script>

<template>
  <tr class="phone:block phone:py-3 phone:border-b phone:border-line">
    <th
      scope="row"
      class="w-[16%] px-4 py-3.5 text-left align-top font-bold border-b border-line phone:block phone:w-auto phone:border-0 phone:px-0 phone:py-1"
    >
      {{ what }}
    </th>
    <td
      class="px-4 py-3.5 align-top border-b border-line phone:block phone:border-0 phone:px-0 phone:py-1 phone:before:block phone:before:text-[0.85rem] phone:before:text-dim phone:before:content-['Partition_classique']"
    >
      <slot name="classic" />
    </td>
    <td
      class="px-4 py-3.5 align-top border-b border-line bg-brand-5 phone:block phone:border-0 phone:px-2.5 phone:py-2 phone:rounded-md phone:before:block phone:before:text-[0.85rem] phone:before:text-dim phone:before:content-['Prisma']"
    >
      <slot name="prisma" />
    </td>
  </tr>
</template>
