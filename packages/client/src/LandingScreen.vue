<script setup lang="ts">
import PublicShell from "./PublicShell.vue";
import Icon from "@cord/ui/CordIcon.vue";
import CordLogo from "@cord/ui/CordLogo.vue";
import { usePreferences } from "./preferences";
const { t } = usePreferences();
</script>
<template>
  <PublicShell>
    <main>
      <section class="hero">
        <div class="hero-copy">
          <div class="public-eyebrow"><i class="public-dot"></i>{{ t("heroEyebrow") }}</div>
          <h1>
            {{ t("heroFirst") }}<br /><span>{{ t("heroSecond") }}</span
            ><span class="hero-cursor">_</span>
          </h1>
          <p>{{ t("heroDescription") }}</p>
          <div class="hero-actions">
            <RouterLink to="/register" class="public-button"
              >{{ t("joinCord") }} <Icon name="arrow" :size="17" /></RouterLink
            ><RouterLink to="/dashboard" class="hero-text-link"
              >{{ t("openDashboard") }} <span>↗</span></RouterLink
            >
          </div>
          <p class="hero-note">{{ t("previewNote") }}</p>
        </div>
        <div class="hero-visual">
          <div class="visual-orbit" aria-hidden="true"></div>
          <span class="visual-coordinate" aria-hidden="true">SIGNAL FOUND / 01</span>
          <div class="community-preview" :aria-label="t('previewWindow')">
            <div class="window-bar">
              <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span
              ><span>{{ t("previewWindow") }}</span
              ><Icon name="leaf" :size="14" />
            </div>
            <div class="preview-body">
              <div class="preview-rail" aria-hidden="true">
                <CordLogo /><span><Icon name="leaf" /></span><span class="amber-icon">&gt;_</span
                ><span>+</span>
              </div>
              <div class="preview-channels">
                <strong>{{ t("forest") }} <Icon name="down" :size="12" /></strong
                ><span class="channel-caption">{{ t("textChannels") }}</span>
                <div class="channel active">
                  # <span>{{ t("generalChannel") }}</span>
                </div>
                <div class="channel">
                  # <span>{{ t("nightChannel") }}</span>
                </div>
                <div class="channel">
                  # <span>{{ t("designChannel") }}</span>
                </div>
                <span class="channel-caption">{{ t("voiceChannels") }}</span>
                <div class="channel">
                  <Icon name="headset" :size="14" /><span>{{ t("campfire") }}</span>
                </div>
                <div class="tiny-presence"><i class="public-dot"></i> deniz & nova</div>
                <div class="preview-rail-footer">{{ t("stayAWhile") }}</div>
              </div>
              <div class="preview-chat">
                <div class="preview-chat-title">
                  # <strong>{{ t("generalChannel") }}</strong
                  ><Icon name="people" :size="15" />
                </div>
                <div class="preview-conversation">
                  <div class="preview-welcome">
                    <Icon name="hash" :size="22" /><strong
                      >{{ t("allQuiet") }}<span>_</span></strong
                    >
                  </div>
                  <div
                    v-for="(name, index) in ['deniz', 'nova', 'ada']"
                    :key="name"
                    class="preview-message"
                  >
                    <span class="preview-avatar" :class="`person-${index}`">{{
                      name.slice(0, 1)
                    }}</span>
                    <div>
                      <strong
                        >{{ name }}<small>21:0{{ index + 1 }}</small></strong
                      >
                      <p>
                        {{
                          t(
                            index === 0
                              ? "previewMessageOne"
                              : index === 1
                                ? "previewMessageTwo"
                                : "previewMessageThree",
                          )
                        }}
                      </p>
                    </div>
                  </div>
                  <span class="preview-typing">••• &nbsp; {{ t("previewTyping") }}</span>
                </div>
                <div class="preview-input">{{ t("previewInput") }}<span>+</span></div>
              </div>
            </div>
          </div>
          <div class="floating-signal">
            <span class="public-dot"></span>{{ t("quietSignal") }} <Icon name="leaf" :size="15" />
          </div>
        </div>
      </section>
      <div class="signal-strip">
        <span>01 / {{ t("aboutCord") }}</span
        ><span class="strip-line"></span><span>{{ t("lessButBetter") }}</span>
      </div>
      <section id="about" class="about-section">
        <div class="about-heading">
          <div class="public-eyebrow">{{ t("featureEyebrow") }}</div>
          <h2>{{ t("featureTitle") }}</h2>
          <p>{{ t("featureIntro") }}</p>
        </div>
        <div class="feature-grid">
          <article v-for="(icon, index) in ['chat', 'sun', 'leaf']" :key="icon">
            <div class="feature-number">0{{ index + 1 }} <Icon :name="icon" :size="23" /></div>
            <h3>
              {{
                t(
                  index === 0
                    ? "featureOneTitle"
                    : index === 1
                      ? "featureTwoTitle"
                      : "featureThreeTitle",
                )
              }}
            </h3>
            <p>
              {{
                t(
                  index === 0
                    ? "featureOneBody"
                    : index === 1
                      ? "featureTwoBody"
                      : "featureThreeBody",
                )
              }}
            </p>
          </article>
        </div>
      </section>
      <section class="closing">
        <CordLogo mark-only />
        <div>
          <h2>{{ t("closingTitle") }}</h2>
          <p>{{ t("closingBody") }}</p>
        </div>
        <RouterLink to="/register" class="public-button"
          >{{ t("joinCord") }} <Icon name="arrow" :size="17"
        /></RouterLink>
      </section>
    </main>
  </PublicShell>
</template>
<style scoped>
.hero {
  max-width: 1240px;
  margin: 0 auto;
  padding: 80px 36px 110px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 52px;
  align-items: center;
}
.hero h1 {
  font-size: clamp(36px, 4.5vw, 62px);
  line-height: 1.13;
  letter-spacing: -2.8px;
  font-weight: 550;
  margin: 27px 0 24px;
}
.hero h1 > span:first-of-type {
  color: var(--green);
}
.hero-cursor {
  color: var(--muted);
  font-weight: 350;
}
.hero-copy > p {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.95;
  max-width: 440px;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 23px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.hero-text-link {
  font-size: 11px;
  display: inline-flex;
  gap: 12px;
  align-items: center;
}
.hero-text-link:hover {
  color: var(--green);
}
.hero-copy > .hero-note {
  font: 9px/1.9 var(--mono);
  margin: 19px 0 0;
}
.hero-visual {
  position: relative;
  min-width: 0;
  padding: 30px 0;
}
.visual-orbit {
  position: absolute;
  width: 95%;
  aspect-ratio: 1;
  border: 1px solid var(--line);
  border-radius: 50%;
  left: 6%;
  top: -4%;
  opacity: 0.65;
}
.visual-orbit::after {
  content: "";
  position: absolute;
  inset: 25px -25px;
  border: 1px dashed var(--line);
  border-radius: 50%;
  transform: rotate(25deg);
}
.visual-coordinate {
  position: absolute;
  right: 0;
  top: 0;
  color: var(--muted);
  font: 8px var(--mono);
  letter-spacing: 1.4px;
}
.community-preview {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  overflow: hidden;
  transform: rotate(-2deg);
  box-shadow: 0 28px 65px var(--shadow);
}
.window-bar {
  height: 37px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font: 7px var(--mono);
  color: var(--muted);
  letter-spacing: 0.5px;
}
.window-dots {
  display: flex;
  gap: 4px;
}
.window-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--line);
}
.window-dots i:first-child {
  background: var(--green);
}
.preview-body {
  display: flex;
  min-height: 318px;
}
.preview-rail {
  width: 45px;
  background: var(--rail);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 14px;
  flex-shrink: 0;
}
.preview-rail > svg {
  width: 28px;
  height: 28px;
}
.preview-rail > span {
  width: 27px;
  height: 27px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--green);
  background: var(--surface);
  font: 13px var(--mono);
}
.preview-rail .amber-icon {
  color: var(--amber);
}
.preview-channels {
  position: relative;
  width: 128px;
  background: var(--sidebar);
  border-right: 1px solid var(--line);
  padding: 18px 10px;
  flex-shrink: 0;
}
.preview-channels > strong {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.channel-caption {
  display: block;
  color: var(--muted);
  font: 6px var(--mono);
  letter-spacing: 1px;
  margin: 25px 0 9px;
}
.channel {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  padding: 7px 5px;
  border-radius: 4px;
}
.channel span {
  font-size: 8px;
}
.channel.active {
  background: var(--active);
  color: var(--green);
}
.tiny-presence {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 7px;
  color: var(--muted);
  padding: 8px 5px;
}
.tiny-presence .public-dot {
  width: 4px;
  height: 4px;
}
.preview-rail-footer {
  position: absolute;
  bottom: 15px;
  font: 6px var(--mono);
  letter-spacing: 1px;
  color: var(--muted);
}
.preview-chat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.preview-chat-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px;
  font-size: 15px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.preview-chat-title strong {
  font-size: 10px;
  font-weight: 500;
  color: var(--text);
}
.preview-chat-title svg {
  margin-left: auto;
}
.preview-conversation {
  padding: 17px 13px 12px;
  flex: 1;
}
.preview-welcome {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 22px;
  color: var(--green);
}
.preview-welcome strong {
  font-size: 12px;
  font-weight: 450;
  color: var(--text);
}
.preview-welcome strong span {
  color: var(--green);
}
.preview-message {
  display: flex;
  gap: 8px;
  margin: 15px 0;
}
.preview-avatar {
  width: 25px;
  height: 25px;
  border-radius: 8px;
  background: var(--sage-bg);
  color: var(--sage-text);
  display: grid;
  place-items: center;
  font: 11px var(--mono);
  flex-shrink: 0;
}
.person-1 {
  background: var(--amber-bg);
  color: var(--amber-text);
}
.person-2 {
  background: var(--rose-bg);
  color: var(--rose-text);
}
.preview-message strong {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 9px;
  font-weight: 500;
}
.preview-message small {
  font: 6px var(--mono);
  color: var(--muted);
}
.preview-message p {
  color: var(--muted);
  font-size: 8px;
  line-height: 1.8;
  margin: 4px 0 0;
}
.preview-typing {
  color: var(--muted);
  font-size: 7px;
  margin-left: 33px;
}
.preview-input {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 10px;
  margin: 0 12px 12px;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
  font-size: 8px;
}
.floating-signal {
  position: relative;
  margin: 8px -12px -22px 50px;
  border: 1px solid var(--line);
  background: var(--sidebar);
  padding: 16px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 9px;
  font: 7px var(--mono);
  letter-spacing: 0.6px;
  box-shadow: 0 8px 20px var(--card-shadow);
}
.floating-signal svg {
  margin-left: auto;
}
.signal-strip {
  max-width: 1168px;
  margin: 0 auto;
  display: flex;
  gap: 20px;
  align-items: center;
  color: var(--muted);
  font: 8px var(--mono);
  letter-spacing: 1px;
}
.strip-line {
  flex: 1;
  height: 1px;
  background: var(--line);
}
.about-section {
  max-width: 1240px;
  margin: 0 auto;
  padding: 75px 36px;
}
.about-heading {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 80px;
}
.about-heading .public-eyebrow {
  grid-column: 1 / -1;
}
.about-heading h2 {
  font-size: 35px;
  font-weight: 500;
  letter-spacing: -1.5px;
  margin: 17px 0;
}
.about-heading > p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.95;
  max-width: 450px;
  margin: 17px 0;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 36px;
  margin-top: 40px;
}
.feature-grid article {
  border-top: 1px solid var(--line);
  padding-top: 23px;
}
.feature-number {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--green);
  font: 10px var(--mono);
}
.feature-grid h3 {
  font-size: 17px;
  font-weight: 500;
  margin: 27px 0 13px;
  letter-spacing: -0.3px;
}
.feature-grid p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}
.closing {
  max-width: 1168px;
  margin: 12px auto 75px;
  padding: 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 9px;
}
.closing > svg {
  width: 62px;
  height: 62px;
  color: var(--green);
}
.closing h2 {
  font-weight: 500;
  font-size: 24px;
  letter-spacing: -0.6px;
  margin: 0 0 8px;
}
.closing p {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.closing .public-button {
  margin-left: auto;
}
@media (max-width: 1050px) {
  .hero {
    gap: 30px;
    padding-top: 55px;
  }
  .hero h1 {
    font-size: 44px;
  }
  .hero-actions {
    gap: 18px;
  }
  .preview-channels {
    width: 100px;
  }
  .signal-strip {
    margin: 0 36px;
  }
  .closing {
    margin-left: 36px;
    margin-right: 36px;
  }
  .floating-signal {
    font-size: 6px;
  }
}
@media (max-width: 800px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 45px 28px 75px;
    gap: 44px;
  }
  .hero-copy {
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }
  .hero h1 {
    font-size: clamp(37px, 7vw, 57px);
    letter-spacing: -1.8px;
  }
  .hero-visual {
    max-width: 520px;
    width: 100%;
    margin: 0 auto;
  }
  .preview-channels {
    width: 128px;
  }
  .about-heading {
    grid-template-columns: 1fr;
  }
  .feature-grid {
    gap: 22px;
  }
  .closing {
    padding: 25px;
  }
  .closing > svg {
    display: none;
  }
  .closing h2 {
    font-size: 20px;
  }
}
@media (max-width: 550px) {
  .hero {
    padding: 35px 20px 62px;
  }
  .hero h1 {
    font-size: 38px;
  }
  .hero-copy > p {
    font-size: 13px;
  }
  .hero-actions {
    align-items: flex-start;
    flex-direction: column;
  }
  .hero-visual {
    padding: 25px 2px;
  }
  .preview-channels {
    width: 93px;
    padding: 16px 7px;
  }
  .preview-rail {
    width: 37px;
  }
  .preview-conversation {
    padding: 16px 9px;
  }
  .preview-chat-title {
    padding: 14px 9px;
  }
  .preview-message p {
    font-size: 8px;
  }
  .floating-signal {
    margin-left: 22px;
    margin-right: -2px;
    font-size: 6px;
    letter-spacing: 0;
  }
  .signal-strip {
    margin: 0 20px;
    font-size: 7px;
    gap: 10px;
  }
  .about-section {
    padding: 50px 20px;
  }
  .about-heading h2 {
    font-size: 29px;
  }
  .feature-grid {
    grid-template-columns: 1fr;
    margin-top: 20px;
    gap: 25px;
  }
  .feature-grid h3 {
    margin-top: 17px;
  }
  .feature-grid p {
    max-width: 420px;
  }
  .closing {
    margin: 0 20px 50px;
    flex-direction: column;
    align-items: flex-start;
    gap: 22px;
  }
  .closing .public-button {
    margin-left: 0;
  }
  .visual-orbit {
    width: 85%;
    left: 8%;
    top: 0;
  }
}
</style>
