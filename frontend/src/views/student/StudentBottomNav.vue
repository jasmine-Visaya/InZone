
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';

import {
  home,
  homeOutline,
  calendar,
  calendarOutline,
  navigate,
  navigateOutline,
  documentText,
  documentTextOutline,
  person,
  personOutline,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

// Student navigation pages
const navItems = [
  {
    name: 'Home',
    path: '/student/dashboard',
    icon: homeOutline,
    activeIcon: home,
    center: false,
  },
  {
    name: 'Attendance',
    path: '/student/attendance',
    icon: calendarOutline,
    activeIcon: calendar,
    center: false,
  },
  {
    name: 'Track',
    path: '/student/track',
    icon: navigateOutline,
    activeIcon: navigate,
    center: true,
  },
  {
    name: 'Reports',
    path: '/student/reports',
    icon: documentTextOutline,
    activeIcon: documentText,
    center: false,
  },
  {
    name: 'Account',
    path: '/student/profile',
    icon: personOutline,
    activeIcon: person,
    center: false,
  },
];

// Current route
const currentPath = computed(() => {
  return route.path.replace(/\/+$/, '') || '/';
});

// Check active navigation
function isActive(path: string): boolean {
  return (
    currentPath.value === path ||
    currentPath.value.startsWith(`${path}/`)
  );
}

// Navigate between student pages
function goTo(path: string): void {
  if (!isActive(path)) {
    void router.push(path);
  }
}
</script>

<template>
  <nav
    class="student-bottom-nav"
    aria-label="Student navigation"
  >
    <button
      v-for="item in navItems"
      :key="item.name"
      type="button"
      class="bottom-nav-item"
      :class="{
        'is-active': isActive(item.path),
        'is-center': item.center
      }"
      :aria-label="item.name"
      :aria-current="isActive(item.path) ? 'page' : undefined"
      @click="goTo(item.path)"
    >
      <!-- Navigation Icon -->
      <span class="bottom-nav-icon">
        <IonIcon
          :icon="
            isActive(item.path)
              ? item.activeIcon
              : item.icon
          "
        />
      </span>

      <!-- Navigation Label -->
      <span class="bottom-nav-label">
        {{ item.name }}
      </span>
    </button>
  </nav>
</template>

<style scoped>

/* =========================================
   FLOATING BOTTOM NAVIGATION
========================================= */

.student-bottom-nav {
  position: fixed;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;

  width: min(calc(100% - 28px), 480px);
  height: 76px;

  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;

  padding: 5px 8px;

  border-radius: 25px;

  background: rgba(255, 255, 255, 0.97);
  border: 1px solid #dcebe3;

  box-shadow:
    0 12px 35px rgba(9, 89, 62, 0.15),
    0 3px 10px rgba(0, 0, 0, 0.04);

  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* =========================================
   NAVIGATION BUTTONS
========================================= */

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

  transition:
    color 0.25s ease,
    transform 0.25s ease;
}

/* =========================================
   NAVIGATION ICONS
========================================= */

.bottom-nav-icon {
  width: 43px;
  height: 37px;

  display: flex;
  justify-content: center;
  align-items: center;

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

  transition: color 0.25s ease;
}

/* =========================================
   ACTIVE NAVIGATION
========================================= */

.bottom-nav-item.is-active {
  color: #0b775b;
}

.bottom-nav-item.is-active:not(.is-center)
.bottom-nav-icon {
  background: #e5f6ed;
  color: #087b5c;
}

/* Hover Effect */
@media (hover: hover) {
  .bottom-nav-item:not(.is-center):hover
  .bottom-nav-icon {
    background: #eff8f3;
    color: #0b775b;
    transform: translateY(-2px);
  }
}

/* =========================================
   FLOATING CENTER TRACK BUTTON
========================================= */

.bottom-nav-item.is-center {
  justify-content: flex-end;
  padding-bottom: 8px;
}

.bottom-nav-item.is-center .bottom-nav-icon {
  position: absolute;

  top: -31px;

  width: 64px;
  height: 64px;

  display: flex;
  justify-content: center;
  align-items: center;

  border-radius: 50%;

  color: #ffffff;
  font-size: 28px;

  background: linear-gradient(
    145deg,
    #18af84,
    #08684f
  );

  border: 4px solid #ffffff;

  box-shadow:
    0 6px 20px rgba(11, 119, 91, 0.30),
    0 3px 8px rgba(0, 0, 0, 0.07);

  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    background 0.25s ease;
}

/* Active Track */
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

/* Track Hover */
@media (hover: hover) {
  .bottom-nav-item.is-center:hover
  .bottom-nav-icon {
    transform: translateY(-3px);

    box-shadow:
      0 9px 24px rgba(11, 119, 91, 0.38);
  }
}

/* Click Animation */
.bottom-nav-item.is-center:active
.bottom-nav-icon {
  transform: scale(0.94);
}

/* =========================================
   ACCESSIBILITY
========================================= */

.bottom-nav-item:focus-visible {
  outline: 2px solid #0b775b;
  outline-offset: 2px;
  border-radius: 10px;
}

/* =========================================
   TABLET
========================================= */

@media (min-width: 768px) {
  .student-bottom-nav {
    width: 480px;
    height: 78px;
  }

  .bottom-nav-label {
    font-size: 11px;
  }
}

/* =========================================
   MOBILE
========================================= */

@media (max-width: 480px) {
  .student-bottom-nav {
    bottom: calc(9px + env(safe-area-inset-bottom, 0px));

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
}

/* =========================================
   SMALL MOBILE
========================================= */

@media (max-width: 360px) {
  .student-bottom-nav {
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

  .bottom-nav-item.is-center
  .bottom-nav-icon {
    width: 55px;
    height: 55px;
    top: -26px;
  }
}

/* =========================================
   REDUCED MOTION
========================================= */

@media (prefers-reduced-motion: reduce) {
  .bottom-nav-item,
  .bottom-nav-icon,
  .bottom-nav-label {
    transition: none;
  }
}

</style>
