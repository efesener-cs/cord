<script setup lang="ts">
import Icon from "@cord/ui/CordIcon.vue";
import { usePreferences } from "./preferences";
const preferences = usePreferences();
const { t } = preferences;
</script>
<template>
  <div class="appearance-controls">
    <button
      class="locale-switch"
      :aria-label="t('changeLanguage')"
      :title="t('changeLanguage')"
      @click="preferences.toggleLocale"
    >
      <span :class="{ chosen: preferences.locale === 'tr' }">TR</span
      ><span class="locale-divider">/</span
      ><span :class="{ chosen: preferences.locale === 'en' }">EN</span>
    </button>
    <button
      class="theme-switch"
      :aria-label="preferences.theme === 'dark' ? t('useLight') : t('useDark')"
      :title="preferences.theme === 'dark' ? t('useLight') : t('useDark')"
      @click="preferences.toggleTheme"
    >
      <Icon :name="preferences.theme === 'dark' ? 'sun' : 'moon'" :size="18" />
    </button>
  </div>
</template>
<style scoped>
.appearance-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
button {
  color: var(--muted);
  background: none;
}
.locale-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 10px var(--mono);
  padding: 8px 4px;
}
.locale-switch .chosen {
  color: var(--text);
  font-weight: 700;
}
.locale-divider {
  opacity: 0.45;
}
.theme-switch {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--text);
}
.theme-switch:hover {
  background: var(--hover);
}
@media (max-width: 720px) {
  .appearance-controls {
    gap: 8px;
  }
}
</style>
