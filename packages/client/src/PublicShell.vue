<script setup lang="ts">
import CordLogo from "@cord/ui/CordLogo.vue";
import AppearanceControls from "./AppearanceControls.vue";
import { usePreferences } from "./preferences";
import "./public.css";
const { t } = usePreferences();
</script>
<template>
  <div class="public-page">
    <header class="public-header">
      <RouterLink to="/" class="public-brand" :aria-label="t('homeLabel')"
        ><CordLogo /><span>cord<span class="public-accent">_</span></span></RouterLink
      >
      <nav class="public-nav" :aria-label="t('navigation')">
        <RouterLink to="/dashboard">{{ t("lookInside") }} <span>↗</span></RouterLink>
      </nav>
      <div class="public-header-actions">
        <AppearanceControls /><RouterLink to="/login" class="public-login"
          >{{ t("login") }} <span>↗</span></RouterLink
        >
      </div>
    </header>
    <slot />
    <footer class="public-footer">
      <RouterLink to="/" class="public-wordmark">cord_</RouterLink><span>{{ t("footerTag") }}</span
      ><span class="public-footer-meta"
        >© 2026 CORD <span class="public-accent">·</span> {{ t("localPreview") }}</span
      >
    </footer>
  </div>
</template>
