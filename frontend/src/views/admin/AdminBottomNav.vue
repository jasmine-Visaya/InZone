<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import {
  home,
  homeOutline,
  people,
  peopleOutline,
  shieldCheckmark,
  shieldCheckmarkOutline,
  documentText,
  documentTextOutline,
  person,
  personOutline,
  schoolOutline,
  peopleCircleOutline,
  chevronForwardOutline,
  closeOutline,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const peopleOpen = ref(false);

const navItems = [
  { name: 'Home', path: '/admin/dashboard', icon: homeOutline, activeIcon: home, center: false },
  { name: 'People', path: '/admin/students', icon: peopleOutline, activeIcon: people, center: false },
  { name: 'Approvals', path: '/admin/ojt-approvals', icon: shieldCheckmarkOutline, activeIcon: shieldCheckmark, center: true },
  { name: 'Reports', path: '/admin/reports', icon: documentTextOutline, activeIcon: documentText, center: false },
  { name: 'Account', path: '/admin/profile', icon: personOutline, activeIcon: person, center: false },
] as const;

const peopleOptions = [
  { name: 'Students', description: 'OJT profiles and approvals', path: '/admin/students', icon: schoolOutline },
  { name: 'Users', description: 'Accounts and access', path: '/admin/users', icon: peopleCircleOutline },
] as const;

const currentPath = computed(() => route.path.replace(/\/+$/, '') || '/');

function isActive(path: string): boolean {
  return currentPath.value === path || currentPath.value.startsWith(`${path}/`);
}

function isItemActive(item: (typeof navItems)[number]): boolean {
  if (item.name === 'People') {
    return isActive('/admin/students') || isActive('/admin/users');
  }
  return isActive(item.path);
}

function routeExists(path: string): boolean {
  return router.resolve(path).matched.length > 0;
}

function navigateTo(path: string): void {
  if (!routeExists(path)) return;
  peopleOpen.value = false;
  if (!isActive(path)) void router.push(path);
}

function onNavClick(item: (typeof navItems)[number]): void {
  if (item.name === 'People') {
    peopleOpen.value = !peopleOpen.value;
    return;
  }
  navigateTo(item.path);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') peopleOpen.value = false;
}

watch(() => route.fullPath, () => { peopleOpen.value = false; });
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <!-- Tap outside the small People menu to dismiss it. -->
  <div
    v-if="peopleOpen"
    class="people-scrim"
    aria-hidden="true"
    @click="peopleOpen = false"
  ></div>

  <nav class="admin-bottom-nav" aria-label="Admin navigation">
    <!-- Compact popup directly above the floating bottom nav. -->
    <section
      v-if="peopleOpen"
      id="people-menu"
      class="people-popup"
      role="dialog"
      aria-modal="false"
      aria-label="People menu"
    >
      <div class="people-popup-header">
        <div>
          <span class="people-eyebrow">ADMIN WORKSPACE</span>
          <h3>People Management</h3>
          <p>Choose where you want to go.</p>
        </div>
        <button
          type="button"
          class="people-close"
          aria-label="Close People menu"
          @click="peopleOpen = false"
        >
          <IonIcon :icon="closeOutline" />
        </button>
      </div>

      <div class="people-menu-options">
        <button
          v-for="option in peopleOptions"
          :key="option.path"
          type="button"
          class="people-option"
          :class="{ 'is-selected': isActive(option.path) }"
          :disabled="!routeExists(option.path)"
          @click="navigateTo(option.path)"
        >
          <span class="people-option-icon"><IonIcon :icon="option.icon" /></span>
          <span class="people-option-copy">
            <strong>{{ option.name }}</strong>
            <small>{{ option.description }}</small>
          </span>
          <IonIcon class="people-option-arrow" :icon="chevronForwardOutline" />
        </button>
      </div>
    </section>

    <button
      v-for="item in navItems"
      :key="item.name"
      type="button"
      class="bottom-nav-item"
      :class="{
        'is-active': isItemActive(item),
        'is-center': item.center,
        'is-unavailable': item.name !== 'People' && !routeExists(item.path),
      }"
      :disabled="item.name !== 'People' && !routeExists(item.path)"
      :aria-label="item.name"
      :aria-haspopup="item.name === 'People' ? 'dialog' : undefined"
      :aria-controls="item.name === 'People' ? 'people-menu' : undefined"
      :aria-expanded="item.name === 'People' ? peopleOpen : undefined"
      :aria-current="item.name !== 'People' && isItemActive(item) ? 'page' : undefined"
      :title="item.name === 'People' ? 'Open People menu' : item.name"
      @click="onNavClick(item)"
    >
      <span class="bottom-nav-icon">
        <IonIcon :icon="isItemActive(item) ? item.activeIcon : item.icon" />
      </span>
      <span class="bottom-nav-label">{{ item.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.people-scrim {
  position: fixed;
  inset: 0;
  z-index: 3999;
  background: rgba(16, 52, 37, 0.12);
}

.admin-bottom-nav {
  position: fixed;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 4000;
  width: min(calc(100% - 28px), 480px);
  height: 76px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  padding: 5px 8px;
  border-radius: 25px;
  background: rgba(255,255,255,.97);
  border: 1px solid #dcebe3;
  box-shadow: 0 12px 35px rgba(9,89,62,.15), 0 3px 10px rgba(0,0,0,.04);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.bottom-nav-item {
  position: relative;
  width: 100%;
  min-width: 0;
  height: 65px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: #84968c;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color .25s ease, transform .25s ease;
}

.bottom-nav-icon {
  width: 43px;
  height: 37px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 23px;
  border-radius: 13px;
  transition: background .25s ease, color .25s ease, transform .25s ease;
}
.bottom-nav-label {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  transition: color .25s ease;
}
.bottom-nav-item.is-active { color: #0b775b; }
.bottom-nav-item.is-active:not(.is-center) .bottom-nav-icon {
  background: #e5f6ed;
  color: #087b5c;
}
@media (hover: hover) {
  .bottom-nav-item:not(.is-center):not(:disabled):hover .bottom-nav-icon {
    background: #eff8f3;
    color: #0b775b;
    transform: translateY(-2px);
  }
}

.bottom-nav-item.is-center { justify-content: flex-end; padding-bottom: 8px; }
.bottom-nav-item.is-center .bottom-nav-icon {
  position: absolute;
  top: -31px;
  width: 64px;
  height: 64px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  color: #fff;
  font-size: 28px;
  background: linear-gradient(145deg, #18af84, #08684f);
  border: 4px solid #fff;
  box-shadow: 0 6px 20px rgba(11,119,91,.30), 0 3px 8px rgba(0,0,0,.07);
  transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
}
.bottom-nav-item.is-center.is-active .bottom-nav-icon {
  background: linear-gradient(145deg, #20c997, #087456);
  box-shadow: 0 0 0 3px #b8ead6, 0 8px 22px rgba(11,119,91,.35);
}
@media (hover: hover) {
  .bottom-nav-item.is-center:not(:disabled):hover .bottom-nav-icon {
    transform: translateY(-3px);
    box-shadow: 0 9px 24px rgba(11,119,91,.38);
  }
}
.bottom-nav-item.is-center:active .bottom-nav-icon { transform: scale(.94); }
.bottom-nav-item.is-unavailable { opacity: .42; cursor: not-allowed; }
.bottom-nav-item:focus-visible, .people-option:focus-visible, .people-close:focus-visible {
  outline: 2px solid #0b775b;
  outline-offset: 2px;
}

/* People popup: short floating card, NOT a sidebar/full-screen modal. */
.people-popup {
  position: absolute;
  bottom: calc(100% + 15px);
  left: 50%;
  transform: translateX(-50%);
  width: min(320px, calc(100vw - 36px));
  max-height: min(54vh, 350px);
  overflow-y: auto;
  padding: 15px;
  border-radius: 21px;
  border: 1px solid #d9ebe0;
  background: #fff;
  box-shadow: 0 16px 46px rgba(9,63,41,.22);
  color: #153f2e;
  animation: people-in .18s ease-out;
}
.people-popup-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
.people-eyebrow { font-size: 9px; letter-spacing: 1.15px; font-weight: 850; color: #0a9568; }
.people-popup-header h3 { margin: 5px 0 3px; font-size: 17px; font-weight: 850; color: #17432f; }
.people-popup-header p { margin: 0; font-size: 11px; color: #80968a; }
.people-close { display: grid; place-items: center; border: 0; border-radius: 9px; width: 30px; height: 30px; background: #f0f7f2; color: #50735f; cursor: pointer; font-size: 19px; }
.people-menu-options { display: flex; flex-direction: column; gap: 8px; }
.people-option { display: flex; width: 100%; align-items: center; gap: 11px; min-height: 67px; text-align: left; padding: 10px; background: #f7fbf8; border: 1px solid #e4eee7; border-radius: 13px; cursor: pointer; }
.people-option.is-selected, .people-option:hover:not(:disabled) { background: #ebf8ef; border-color: #bde6cc; }
.people-option:disabled { opacity: .45; cursor: not-allowed; }
.people-option-icon { width: 40px; height: 40px; flex-shrink: 0; border-radius: 11px; display: grid; place-items: center; color: #0a8860; background: #e1f4e7; font-size: 21px; }
.people-option-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.people-option-copy strong { color: #183f2e; font-size: 13px; font-weight: 800; }
.people-option-copy small { color: #799384; font-size: 10px; line-height: 1.45; }
.people-option-arrow { color: #789e88; font-size: 16px; flex-shrink: 0; }
@keyframes people-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

@media (min-width: 768px) {
  .admin-bottom-nav { width: 480px; height: 78px; }
  .bottom-nav-label { font-size: 11px; }
}
@media (max-width: 480px) {
  .admin-bottom-nav { bottom: calc(9px + env(safe-area-inset-bottom, 0px)); width: calc(100% - 22px); height: 72px; padding: 4px 5px; border-radius: 23px; }
  .bottom-nav-item { height: 63px; gap: 4px; }
  .bottom-nav-icon { width: 39px; height: 35px; font-size: 22px; }
  .bottom-nav-label { font-size: 9px; }
  .bottom-nav-item.is-center .bottom-nav-icon { top: -29px; width: 60px; height: 60px; font-size: 26px; }
  .people-popup { width: min(305px, calc(100vw - 32px)); }
}
@media (max-width: 360px) {
  .admin-bottom-nav { width: calc(100% - 14px); padding: 4px 2px; }
  .bottom-nav-label { font-size: 8px; }
  .bottom-nav-icon { width: 34px; font-size: 20px; }
  .bottom-nav-item.is-center .bottom-nav-icon { width: 55px; height: 55px; top: -26px; }
}
@media (prefers-reduced-motion: reduce) {
  .bottom-nav-item, .bottom-nav-icon, .bottom-nav-label { transition: none; }
  .people-popup { animation: none; }
}
</style>
