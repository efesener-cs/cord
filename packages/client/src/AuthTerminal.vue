<script setup lang="ts">
import CordLogo from "@cord/ui/CordLogo.vue";
</script>
<template>
  <div class="auth-terminal" aria-hidden="true">
    <div class="terminal-title">
      <span class="terminal-dots"><i></i><i></i><i></i></span><span>cord@local: ~</span
      ><span>TTY / 01</span>
    </div>
    <div class="terminal-body">
      <div class="terminal-command"><span>❯</span> ./cord connect --local</div>
      <div class="terminal-stage">
        <div class="matrix-columns">
          01 コ 10 リ 01<br />リ 01 0 ド 10<br />10 ノ 01 コ 0<br />コ 10 リ 01 1<br />01 ド 10 ノ 0
        </div>
        <div class="terminal-coordinate">0x01<br />0x02<br />0x03<br />0x04</div>
        <CordLogo mark-only />
        <div class="terminal-output">
          <span>[ok] client.ready</span><span>[ok] signal.found</span><span>[ok] people.nearby</span
          ><span class="terminal-prompt">❯ <i></i></span>
        </div>
      </div>
      <div class="terminal-status">
        <span><i></i> LOCAL SESSION</span><span>HUMAN CONNECTION ↵</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.auth-terminal {
  max-width: 365px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  overflow: hidden;
  transform: perspective(900px) rotateY(4deg);
  box-shadow: 0 18px 40px var(--card-shadow);
}
.terminal-title {
  height: 33px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 13px;
  background: var(--sidebar);
  border-bottom: 1px solid var(--line);
  font: 7px var(--mono);
  color: var(--muted);
}
.terminal-title > span:last-child {
  font-size: 6px;
  letter-spacing: 1px;
}
.terminal-dots {
  display: flex;
  gap: 4px;
}
.terminal-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--line);
}
.terminal-dots i:first-child {
  background: var(--green);
}
.terminal-body {
  padding: 16px 17px 12px;
  background: repeating-linear-gradient(0deg, transparent 0 3px, var(--art-scan) 3px 4px);
}
.terminal-command {
  font: 9px var(--mono);
  color: var(--muted);
}
.terminal-command > span {
  color: var(--green);
  padding-right: 7px;
}
.terminal-stage {
  display: flex;
  align-items: center;
  height: 134px;
  position: relative;
  overflow: hidden;
}
.terminal-coordinate {
  color: var(--muted);
  font: 6px/23px var(--mono);
  opacity: 0.65;
  position: relative;
  z-index: 1;
}
.terminal-stage > svg {
  width: 100px;
  height: 100px;
  color: var(--green);
  opacity: 0.85;
  margin: 0 5px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 12px var(--art-glow));
}
.matrix-columns {
  position: absolute;
  right: -20px;
  top: -14px;
  color: var(--art-ink);
  opacity: 0.12;
  font: 12px/28px var(--mono);
  letter-spacing: 8px;
  transform: rotate(-8deg);
}
.terminal-output {
  display: grid;
  gap: 12px;
  color: var(--green);
  font: 8px var(--mono);
  z-index: 1;
}
.terminal-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
}
.terminal-prompt > i {
  display: inline-block;
  width: 6px;
  height: 10px;
  background: var(--green);
  opacity: 0.85;
}
.terminal-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  font: 6px var(--mono);
  letter-spacing: 0.7px;
  color: var(--muted);
}
.terminal-status > span:first-child {
  display: flex;
  align-items: center;
  gap: 5px;
}
.terminal-status i {
  display: inline-block;
  width: 4px;
  height: 4px;
  background: var(--green);
  border-radius: 50%;
}
</style>
