<script setup lang="ts">
withDefaults(defineProps<{ markOnly?: boolean }>(), { markOnly: false });
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 46 46"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect v-if="!markOnly" width="46" height="46" rx="15" fill="var(--green, #a8bd8b)" />
    <path
      d="M19.578 33.371Q15.014 33.371 12.527 30.653Q10.041 27.935 10.041 23.073Q10.041 18.101 12.546 15.327Q15.051 12.553 19.652 12.553Q23.196 12.553 25.516 14.334Q27.835 16.115 28.429 19.251L23.178 19.511Q22.955 17.971 22.064 17.052Q21.174 16.134 19.541 16.134Q15.515 16.134 15.515 22.869Q15.515 29.809 19.615 29.809Q21.1 29.809 22.102 28.872Q23.104 27.935 23.345 26.079L28.577 26.32Q28.299 28.38 27.102 29.994Q25.905 31.608 23.957 32.49Q22.009 33.371 19.578 33.371Z"
      :fill="markOnly ? 'currentColor' : 'var(--on-accent, #151b12)'"
    />
    <rect
      x="32"
      y="28"
      width="5"
      height="5"
      rx="0.5"
      :fill="markOnly ? 'currentColor' : 'var(--brand-dot, #4f653d)'"
    />
  </svg>
</template>
