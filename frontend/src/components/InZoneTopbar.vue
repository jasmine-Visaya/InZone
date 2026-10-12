
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';

import {
  locationOutline,
  logOutOutline,
} from 'ionicons/icons';

type UserRole = 'STUDENT' | 'ADMIN' | 'SUPERVISOR';

const props = defineProps<{
  role: UserRole;
}>();

const router = useRouter();

const portalLabel = computed(() => {
  switch (props.role) {
    case 'ADMIN':
      return 'ADMIN PORTAL';

    case 'SUPERVISOR':
      return 'SUPERVISOR PORTAL';

    case 'STUDENT':
    default:
      return 'STUDENT PORTAL';
  }
});

function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');

  void router.replace('/');
}
</script>

<template>
  <!-- SHARED INZONE TOPBAR -->
  <header class="topbar">

    <!-- BRAND -->
    <div class="brand">
      <span class="logo">
        <IonIcon :icon="locationOutline" />
      </span>

      <span class="brand-name">
        InZone<span>.</span>
      </span>

      <span class="portal-label">
        {{ portalLabel }}
      </span>
    </div>

    <!-- LOGOUT -->
    <button
      type="button"
      class="logout"
      aria-label="Log out"
      @click="logout"
    >
      <IonIcon :icon="logOutOutline" />
      Log out
    </button>

  </header>
</template>

<style scoped>
/* =====================================
   INZONE TOPBAR
   Based on AdminDashboard.vue
===================================== */

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  padding: 18px clamp(18px, 5vw, 65px);

  background: #fff;
  border-bottom: 1px solid #dcebe2;
}

/* =====================================
   BRAND
===================================== */

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.logo {
  display: grid;
  place-items: center;

  width: 44px;
  height: 44px;
  flex-shrink: 0;

  border-radius: 13px;
  background: #087858;
  color: #fff;
  font-size: 25px;
}

.brand-name {
  color: #154638;
  font-size: 24px;
  font-weight: 850;
  letter-spacing: -0.7px;
  white-space: nowrap;
}

.brand-name span {
  color: #20b47e;
}

/* =====================================
   PORTAL BADGE
===================================== */

.portal-label {
  color: #0a8060;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1px;

  background: #e7f7ed;

  border-radius: 100px;
  padding: 8px 10px;

  white-space: nowrap;
}

/* =====================================
   LOGOUT BUTTON
===================================== */

.logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  flex-shrink: 0;
  padding: 12px 15px;

  background: #eaf6ef;
  color: #086e54;

  border: 0;
  border-radius: 11px;

  font-family: inherit;
  font-size: 13px;
  font-weight: 800;

  cursor: pointer;

  transition: background 0.2s ease;
}

.logout ion-icon {
  font-size: 17px;
}

.logout:hover {
  background: #dceee4;
}

.logout:focus-visible {
  outline: 2px solid #087858;
  outline-offset: 3px;
}

/* =====================================
   MOBILE
===================================== */

@media (max-width: 650px) {
  .topbar {
    padding: 15px 17px;
  }

  .portal-label {
    display: none;
  }

  .logout {
    padding: 10px;
    font-size: 12px;
  }
}

@media (max-width: 360px) {
  .brand-name {
    font-size: 21px;
  }

  .logo {
    width: 40px;
    height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .logout {
    transition: none;
  }
}
</style>
