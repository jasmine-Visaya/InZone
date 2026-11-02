
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';

import {
  home,
  homeOutline,
  people,
  peopleOutline,
  documentText,
  documentTextOutline,
  time,
  timeOutline,
  person,
  personOutline,
  clipboardOutline,
  chevronForwardOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';


const router = useRouter();
const route = useRoute();

// =====================================
// NAVIGATION STATE
// =====================================

const reportsOpen = ref(false);

const currentPath = computed(() => {
  return route.path.replace(/\/+$/, '') || '/';
});

// =====================================
// NAVIGATION ITEMS
// =====================================

const navItems = [
  {
    name: 'Home',
    path: '/supervisor/dashboard',
    icon: homeOutline,
    activeIcon: home,
    center: false,
  },
  {
    name: 'Students',
    path: '/supervisor/students',
    icon: peopleOutline,
    activeIcon: people,
    center: false,
  },
  {
    name: 'Reports',
    path: '/supervisor/reports',
    icon: documentTextOutline,
    activeIcon: documentText,
    center: true,
  },
  {
    name: 'Attendance',
    path: '/supervisor/attendance',
    icon: timeOutline,
    activeIcon: time,
    center: false,
  },
  {
    name: 'Account',
    path: '/supervisor/profile',
    icon: personOutline,
    activeIcon: person,
    center: false,
  },
] as const;

// =====================================
// ROUTE CHECKING
// =====================================

function pathMatches(path: string): boolean {
  return (
    currentPath.value === path ||
    currentPath.value.startsWith(`${path}/`)
  );
}

const isReportsPage = computed(() => {
  return (
    pathMatches('/supervisor/reports') ||
    pathMatches('/supervisor/daily-accomplishments')
  );
});

function isActive(
  item: (typeof navItems)[number]
): boolean {
  if (item.center) {
    return isReportsPage.value;
  }

  return pathMatches(item.path);
}

// =====================================
// NAVIGATION FUNCTIONS
// =====================================

function closeReportsMenu(): void {
  reportsOpen.value = false;
}

function toggleReportsMenu(): void {
  reportsOpen.value = !reportsOpen.value;
}

function navigateTo(path: string): void {
  closeReportsMenu();

  if (currentPath.value !== path) {
    void router.push(path);
  }
}

function handleNavClick(
  item: (typeof navItems)[number]
): void {
  if (item.center) {
    toggleReportsMenu();
    return;
  }

  navigateTo(item.path);
}

// Automatically close popup after navigation.
watch(
  () => route.fullPath,
  () => {
    closeReportsMenu();
  }
);
</script>

<template>
  <!-- OUTSIDE-CLICK BACKDROP -->
  <button
    v-if="reportsOpen"
    type="button"
    class="reports-backdrop"
    aria-label="Close reports menu"
    @click="closeReportsMenu"
  />

  <!-- FLOATING SUPERVISOR NAVBAR -->
  <nav
    class="supervisor-bottom-nav"
    aria-label="Supervisor navigation"
    @keydown.esc="closeReportsMenu"
  >
    <!-- REPORTS POPUP -->
    <Transition name="report-menu">
      <div
        v-if="reportsOpen"
        id="supervisor-reports-popup"
        class="reports-popup"
      >
        <div class="popup-header">
          <span class="popup-eyebrow">
            SUPERVISOR PORTAL
          </span>

          <h3>Student Reports</h3>

          <p>
            Choose the report you want to view.
          </p>
        </div>

        <div class="popup-options">
          <!-- WEEKLY REPORTS -->
          <button
            type="button"
            class="popup-option"
            :class="{
              'option-active':
                pathMatches('/supervisor/reports')
            }"
            @click="navigateTo('/supervisor/reports')"
          >
            <span class="option-icon weekly">
              <IonIcon :icon="documentTextOutline" />
            </span>

            <span class="option-content">
              <strong>Weekly Reports</strong>
              <small>
                Review weekly student submissions
              </small>
            </span>

            <IonIcon
              class="option-arrow"
              :icon="
                pathMatches('/supervisor/reports')
                  ? checkmarkCircleOutline
                  : chevronForwardOutline
              "
            />
          </button>

          <!-- DAILY ACCOMPLISHMENTS -->
          <button
            type="button"
            class="popup-option"
            :class="{
              'option-active':
                pathMatches(
                  '/supervisor/daily-accomplishments'
                )
            }"
            @click="
              navigateTo(
                '/supervisor/daily-accomplishments'
              )
            "
          >
            <span class="option-icon daily">
              <IonIcon :icon="clipboardOutline" />
            </span>

            <span class="option-content">
              <strong>Daily Accomplishments</strong>
              <small>
                Attendance and accomplishment photos
              </small>
            </span>

            <IonIcon
              class="option-arrow"
              :icon="
                pathMatches(
                  '/supervisor/daily-accomplishments'
                )
                  ? checkmarkCircleOutline
                  : chevronForwardOutline
              "
            />
          </button>
        </div>
      </div>
    </Transition>

    <!-- MAIN NAV ITEMS -->
    <button
      v-for="item in navItems"
      :key="item.name"
      type="button"
      class="bottom-nav-item"
      :class="{
        'is-active': isActive(item),
        'is-center': item.center,
        'menu-open': item.center && reportsOpen
      }"
      :aria-label="item.name"
      :aria-current="
        isActive(item) ? 'page' : undefined
      "
      :aria-expanded="
        item.center ? reportsOpen : undefined
      "
      :aria-controls="
        item.center
          ? 'supervisor-reports-popup'
          : undefined
      "
      @click="handleNavClick(item)"
    >
      <span class="bottom-nav-icon">
        <IonIcon
          :icon="
            isActive(item)
              ? item.activeIcon
              : item.icon
          "
        />
      </span>

      <span class="bottom-nav-label">
        {{ item.name }}
      </span>
    </button>
  </nav>
</template>

<style scoped>
/* =====================================
   FLOATING NAVBAR
===================================== */

.supervisor-bottom-nav {
  position: fixed;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);

  z-index: 5001;

  width: min(calc(100% - 28px), 480px);
  height: 76px;

  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;

  padding: 5px 8px;
  box-sizing: border-box;

  border-radius: 25px;
  border: 1px solid #dcebe3;

  background: rgba(255, 255, 255, 0.97);

  box-shadow:
    0 12px 35px rgba(9, 89, 62, 0.15),
    0 3px 10px rgba(0, 0, 0, 0.04);

  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* =====================================
   MAIN NAV BUTTONS
===================================== */

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

  transition: color 0.25s ease;
}

.bottom-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 43px;
  height: 37px;

  font-size: 23px;
  border-radius: 13px;

  transition:
    background 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

.bottom-nav-label {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

/* =====================================
   ACTIVE STATES
===================================== */

.bottom-nav-item.is-active {
  color: #0b775b;
}

.bottom-nav-item.is-active:not(.is-center)
.bottom-nav-icon {
  background: #e5f6ed;
  color: #087b5c;
}

@media (hover: hover) {
  .bottom-nav-item:not(.is-center):hover
  .bottom-nav-icon {
    background: #eff8f3;
    color: #0b775b;
  }
}

/* =====================================
   CENTER REPORTS BUTTON
===================================== */

.bottom-nav-item.is-center {
  justify-content: flex-end;
  padding-bottom: 8px;
}

.bottom-nav-item.is-center
.bottom-nav-icon {
  position: absolute;
  top: -31px;

  width: 64px;
  height: 64px;

  border-radius: 50%;

  color: #fff;
  font-size: 28px;

  background: linear-gradient(
    145deg,
    #18af84,
    #08684f
  );

  border: 4px solid #fff;

  box-shadow:
    0 6px 20px rgba(11, 119, 91, 0.3),
    0 3px 8px rgba(0, 0, 0, 0.07);
}

.bottom-nav-item.is-center.is-active
.bottom-nav-icon {
  background: linear-gradient(
    145deg,
    #20c997,
    #087456
  );

  box-shadow:
    0 0 0 3px #b8ead6,
    0 8px 22px rgba(11, 119, 91, 0.35);
}

.bottom-nav-item.is-center.menu-open
.bottom-nav-icon {
  transform: translateY(-3px);
  box-shadow:
    0 0 0 4px #c7f2df,
    0 10px 25px rgba(11, 119, 91, 0.35);
}

.bottom-nav-item.is-center:active
.bottom-nav-icon {
  transform: scale(0.94);
}

/* =====================================
   MENU BACKDROP
===================================== */

.reports-backdrop {
  position: fixed;
  inset: 0;

  z-index: 5000;

  display: block;
  width: 100%;
  height: 100%;

  padding: 0;
  border: none;

  background: rgba(11, 42, 29, 0.12);
  cursor: default;
}

/* =====================================
   REPORTS POPUP
===================================== */

.reports-popup {
  position: absolute;
  bottom: calc(100% + 16px);
  left: 50%;

  transform: translateX(-50%);

  width: min(330px, calc(100vw - 40px));
  padding: 12px;

  box-sizing: border-box;

  border-radius: 22px;
  border: 1px solid #dcebe3;

  background: #fff;

  box-shadow:
    0 16px 50px rgba(10, 61, 40, 0.18),
    0 4px 15px rgba(0, 0, 0, 0.04);
}

.reports-popup::after {
  content: '';

  position: absolute;
  bottom: -8px;
  left: 50%;

  width: 15px;
  height: 15px;

  transform: translateX(-50%) rotate(45deg);

  background: #fff;

  border-right: 1px solid #dcebe3;
  border-bottom: 1px solid #dcebe3;
}

/* =====================================
   POPUP HEADER
===================================== */

.popup-header {
  padding: 11px 12px 15px;
  border-bottom: 1px solid #edf3ee;
  margin-bottom: 8px;
}

.popup-eyebrow {
  font-size: 9px;
  font-weight: 850;
  color: #0a9970;
  letter-spacing: 1.3px;
}

.popup-header h3 {
  margin: 7px 0 5px;
  font-size: 17px;
  font-weight: 850;
  color: #153e30;
}

.popup-header p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #8b9e91;
}

/* =====================================
   POPUP OPTIONS
===================================== */

.popup-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.popup-option {
  display: flex;
  align-items: center;
  gap: 11px;

  width: 100%;
  padding: 12px 10px;

  border: 1px solid transparent;
  border-radius: 14px;

  background: transparent;
  text-align: left;

  cursor: pointer;

  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.popup-option:hover {
  background: #f2f8f4;
}

.popup-option.option-active {
  background: #ebf8ef;
  border-color: #ccebd9;
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  width: 44px;
  height: 44px;

  border-radius: 13px;
  font-size: 22px;
}

.option-icon.weekly {
  background: #e9f1ff;
  color: #517db8;
}

.option-icon.daily {
  background: #ddf5e7;
  color: #0b9568;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 5px;

  flex: 1;
  min-width: 0;
}

.option-content strong {
  font-size: 12px;
  font-weight: 850;
  color: #214937;
}

.option-content small {
  font-size: 10px;
  line-height: 1.5;
  color: #879c8e;
}

.option-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: #95ac9d;
}

.popup-option.option-active .option-arrow {
  color: #0b9568;
}

/* =====================================
   POPUP ANIMATION
===================================== */

.report-menu-enter-active,
.report-menu-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.report-menu-enter-from,
.report-menu-leave-to {
  opacity: 0;

  transform:
    translateX(-50%)
    translateY(10px)
    scale(0.96);
}

/* =====================================
   ACCESSIBILITY
===================================== */

.bottom-nav-item:focus-visible,
.popup-option:focus-visible {
  outline: 2px solid #0b775b;
  outline-offset: 2px;
}

/* =====================================
   TABLET / DESKTOP
===================================== */

@media (min-width: 768px) {
  .supervisor-bottom-nav {
    width: 480px;
    height: 78px;
  }

  .bottom-nav-label {
    font-size: 11px;
  }
}

/* =====================================
   MOBILE
===================================== */

@media (max-width: 480px) {
  .supervisor-bottom-nav {
    bottom: calc(
      9px + env(safe-area-inset-bottom, 0px)
    );

    width: calc(100% - 22px);
    height: 72px;

    padding: 4px 5px;
    border-radius: 23px;
  }

  .bottom-nav-item {
    height: 63px;
    gap: 4px;
  }

  .bottom-nav-icon {
    width: 39px;
    height: 35px;
    font-size: 22px;
  }

  .bottom-nav-label {
    font-size: 9px;
  }

  .bottom-nav-item.is-center
  .bottom-nav-icon {
    top: -29px;

    width: 60px;
    height: 60px;

    font-size: 26px;
  }

  .reports-popup {
    bottom: calc(100% + 15px);
  }
}

@media (max-width: 360px) {
  .supervisor-bottom-nav {
    width: calc(100% - 14px);
    padding: 4px 2px;
  }

  .bottom-nav-label {
    font-size: 8px;
  }

  .bottom-nav-icon {
    width: 34px;
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-nav-item,
  .bottom-nav-icon,
  .popup-option,
  .report-menu-enter-active,
  .report-menu-leave-active {
    transition: none;
  }
}
</style>
