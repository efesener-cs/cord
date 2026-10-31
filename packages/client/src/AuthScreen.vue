<script setup lang="ts">
import { ApiError } from "@cord/sdk";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AuthTerminal from "./AuthTerminal.vue";
import Icon from "@cord/ui/CordIcon.vue";
import PublicShell from "./PublicShell.vue";
import { usePreferences } from "./preferences";
import { useSessionStore } from "./session";
const props = defineProps<{ mode: "login" | "register" }>();
const { t } = usePreferences();
const session = useSessionStore();
const router = useRouter();
const username = ref("");
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const pending = ref(false);
const errorMessage = ref("");
const registered = computed(() => router.currentRoute.value.query.registered === "1");
const isRegister = computed(() => props.mode === "register");
watch(
  () => props.mode,
  () => {
    username.value = "";
    email.value = "";
    password.value = "";
    showPassword.value = false;
    errorMessage.value = "";
  },
);
async function submit() {
  if (pending.value) return;
  pending.value = true;
  errorMessage.value = "";
  try {
    if (isRegister.value) {
      await session.register({
        username: username.value,
        email: email.value,
        password: password.value,
      });
      password.value = "";
      await router.push({ path: "/login", query: { registered: "1" } });
    } else {
      await session.login({ username: username.value, password: password.value });
      password.value = "";
      await router.push("/dashboard");
    }
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
    errorMessage.value = t(
      code === "VALIDATION_ERROR"
        ? "authValidation"
        : code === "ACCOUNT_EXISTS"
          ? "authDuplicate"
          : code === "INVALID_CREDENTIALS" || code === "UNAUTHORIZED"
            ? "authInvalid"
            : code === "RATE_LIMITED"
              ? "authRateLimit"
              : code === "NETWORK_ERROR"
                ? "authNetwork"
                : "authFailure",
    );
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <PublicShell>
    <main class="auth-main">
      <section class="auth-story">
        <div class="public-eyebrow"><span class="public-dot"></span>{{ t("authEyebrow") }}</div>
        <h1>
          {{ t("authHeadline") }}<br /><span>{{ t("authHeadlineEnd") }}</span
          ><span class="auth-cursor">_</span>
        </h1>
        <p>{{ t("authSideDescription") }}</p>
        <AuthTerminal class="auth-emblem" />
        <div class="story-note"><Icon name="leaf" :size="16" />{{ t("lessNoise") }}</div>
      </section>
      <section class="auth-card" aria-labelledby="auth-heading">
        <div class="card-topline">
          <span>CORD / {{ isRegister ? "01" : "02" }}</span
          ><span class="public-dot"></span>
        </div>
        <h2 id="auth-heading">{{ t(isRegister ? "registerTitle" : "loginTitle") }}</h2>
        <p class="auth-description">
          {{ t(isRegister ? "registerDescription" : "loginDescription") }}
        </p>
        <p
          v-if="router.currentRoute.value.query.logoutFailed === '1'"
          class="auth-feedback"
          role="alert"
        >
          {{ t("logoutFailed") }}
        </p>
        <p v-if="registered && !isRegister" class="auth-feedback" role="status">
          {{ t("registrationReceived") }}
        </p>
        <p v-if="errorMessage" class="auth-feedback" role="alert">{{ errorMessage }}</p>
        <form :aria-busy="pending" @submit.prevent="submit">
          <div class="field">
            <label for="username">{{ t("username") }}</label
            ><input
              id="username"
              v-model="username"
              name="username"
              type="text"
              autocomplete="username"
              aria-describedby="username-hint"
              :placeholder="t('usernamePlaceholder')"
              maxlength="32"
              minlength="3"
              pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
              :disabled="pending"
              required
            />
          </div>
          <p id="username-hint" class="field-hint">{{ t("usernameHint") }}</p>
          <div v-if="isRegister" class="field">
            <label for="email">{{ t("email") }}</label
            ><input
              id="email"
              v-model="email"
              name="email"
              type="email"
              maxlength="254"
              :disabled="pending"
              autocomplete="email"
              :placeholder="t('emailPlaceholder')"
              required
            />
          </div>
          <div class="field">
            <label for="password">{{ t("password") }}</label>
            <div class="password-field">
              <input
                id="password"
                v-model="password"
                name="password"
                :minlength="isRegister ? 12 : 1"
                maxlength="128"
                :disabled="pending"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="isRegister ? 'new-password' : 'current-password'"
                :placeholder="t('passwordPlaceholder')"
                required
              /><button
                type="button"
                :aria-label="t(showPassword ? 'hidePassword' : 'showPassword')"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <Icon :name="showPassword ? 'eyeOff' : 'eye'" :size="18" />
              </button>
            </div>
          </div>
          <button type="submit" class="public-button auth-submit" :disabled="pending">
            {{ t(pending ? "authPending" : isRegister ? "createAccount" : "login")
            }}<Icon name="arrow" :size="18" />
          </button>
        </form>
        <div class="auth-alternate">
          {{ t(isRegister ? "haveAccount" : "needAccount") }}
          <RouterLink :to="isRegister ? '/login' : '/register'"
            >{{ t(isRegister ? "login" : "register") }} ↗</RouterLink
          >
        </div>
        <p class="auth-demo">
          <Icon name="leaf" :size="14" /><span>{{
            t(isRegister ? "registerDemo" : "loginDemo")
          }}</span>
        </p>
      </section>
    </main>
    <div class="auth-back">
      <RouterLink to="/">← {{ t("backToSite") }}</RouterLink
      ><span>{{ t("demoBadge") }}</span>
    </div>
  </PublicShell>
</template>
<style scoped>
.auth-main {
  max-width: 1100px;
  padding: 60px 36px 45px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 410px;
  align-items: center;
  gap: 100px;
  min-height: calc(100dvh - 240px);
}
.auth-story h1 {
  font-size: clamp(32px, 3.5vw, 47px);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -1.8px;
  margin: 23px 0 20px;
}
.auth-story h1 > span:first-of-type {
  color: var(--green);
}
.auth-cursor {
  color: var(--muted);
}
.auth-story > p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
  max-width: 330px;
}
.auth-emblem {
  margin: 27px 0 24px;
}
.story-note {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 10px;
}
.story-note svg {
  color: var(--green);
}
.auth-card {
  background: var(--panel);
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 18px 50px var(--card-shadow);
}
.card-topline {
  font: 8px var(--mono);
  letter-spacing: 1.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.auth-card h2 {
  margin: 29px 0 10px;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.8px;
}
.auth-description {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
  margin: 0 0 29px;
}
.field {
  margin-top: 20px;
}
.field label {
  display: block;
  font-size: 11px;
  margin-bottom: 9px;
}
.field input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  background: var(--bg);
  padding: 13px;
  color: var(--text);
  font-size: 12px;
  border-radius: 5px;
}
.field input::placeholder {
  color: var(--muted);
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 44px;
}
.password-field button {
  position: absolute;
  top: 0;
  right: 3px;
  bottom: 0;
  width: 38px;
  background: none;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.auth-submit {
  display: flex;
  width: 100%;
  justify-content: space-between;
  margin-top: 27px;
  padding: 13px 17px;
}
.auth-alternate {
  font-size: 11px;
  color: var(--muted);
  margin-top: 22px;
  line-height: 1.9;
}
.auth-alternate a {
  color: var(--green);
  margin-left: 3px;
}
.auth-alternate a:hover {
  text-decoration: underline;
}
.auth-demo {
  border-top: 1px solid var(--line);
  margin: 24px 0 0;
  padding-top: 17px;
  font: 9px/1.8 var(--mono);
  color: var(--muted);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.auth-demo svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--green);
}
.auth-back {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 36px 35px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--muted);
  font-size: 10px;
}
.auth-back > span {
  font: 7px var(--mono);
  letter-spacing: 1px;
}
.auth-back a:hover {
  color: var(--green);
}
@media (max-width: 1050px) {
  .auth-main {
    gap: 50px;
    grid-template-columns: 1fr 380px;
  }
  .auth-story h1 {
    font-size: 36px;
  }
  .auth-card {
    padding: 28px;
  }
}
@media (max-width: 800px) {
  .auth-main {
    grid-template-columns: 1fr;
    max-width: 490px;
    padding: 30px 25px 35px;
    gap: 0;
    min-height: 0;
  }
  .auth-story {
    display: none;
  }
  .auth-card {
    width: 100%;
    padding: 30px;
  }
  .auth-back {
    max-width: 490px;
    padding: 0 25px 35px;
    gap: 15px;
  }
  .auth-back > span {
    font-size: 6px;
  }
}
@media (max-width: 420px) {
  .auth-main {
    padding: 20px 20px 30px;
  }
  .auth-card {
    padding: 25px 22px;
  }
  .auth-card h2 {
    font-size: 24px;
  }
  .auth-back {
    padding: 0 20px 30px;
  }
}

.field-hint {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
  margin: 7px 0 0;
}
.auth-feedback {
  color: var(--green);
  border: 1px solid var(--accent-line);
  background: var(--active);
  padding: 12px;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.7;
}
.auth-submit:disabled {
  opacity: 0.65;
  cursor: wait;
}
</style>
