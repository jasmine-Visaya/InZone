<script setup lang="ts">
// =====================================
// SUPERVISOR: ACCOUNT
// API: GET /api/supervisor/profile
// =====================================
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  alertCircleOutline,
  mailOutline,
  businessOutline,
  calendarOutline,
  shieldCheckmarkOutline,
  logOutOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  type SupervisorProfile,
} from './supervisorApi';

const router = useRouter();

const profile = ref<SupervisorProfile | null>(null);
const loading = ref(false);
const error = ref('');
const confirmLogout = ref(false);

async function loadProfile() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const data = await supervisorRequest<{ profile: SupervisorProfile }>('/api/supervisor/profile');
    profile.value = data.profile;
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load your account.');
  } finally {
    loading.value = false;
  }
}

function memberSince(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  void router.replace('/');
}

onIonViewWillEnter(() => {
  confirmLogout.value = false;
  void loadProfile();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell narrow">
        <header class="sv-heading">
          <div>
            <h1>Account</h1>
            <p>Your supervisor account and the companies you handle.</p>
          </div>
        </header>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadProfile">Try again</button>
        </div>

        <div v-if="loading && !profile" class="sv-skeleton" style="height: 320px"></div>

        <template v-if="profile">
          <section class="sv-card identity">
            <span class="sv-avatar big">{{ initials(profile) }}</span>
            <div>
              <h2>{{ fullName(profile) }}</h2>
              <p>Company supervisor</p>
            </div>
          </section>

          <section class="sv-card">
            <ul class="facts">
              <li>
                <IonIcon :icon="mailOutline" />
                <span><small>Email</small>{{ profile.email || 'Not set' }}</span>
              </li>
              <li>
                <IonIcon :icon="shieldCheckmarkOutline" />
                <span>
                  <small>Account status</small>
                  {{ String(profile.status).toUpperCase() === 'APPROVED' ? 'Active' : profile.status }}
                </span>
              </li>
              <li>
                <IonIcon :icon="calendarOutline" />
                <span><small>Member since</small>{{ memberSince(profile.created_at) }}</span>
              </li>
            </ul>
          </section>

          <section class="sv-card">
            <div class="sv-section-head">
              <div>
                <h2>Students you handle</h2>
                <p>{{ profile.assigned_students }} {{ profile.assigned_students === 1 ? 'student' : 'students' }} assigned to you</p>
              </div>
              <button v-if="profile.assigned_students" type="button" class="sv-link" @click="router.push('/supervisor/students')">
                View students
              </button>
            </div>

            <ul v-if="profile.companies.length" class="companies">
              <li v-for="company in profile.companies" :key="company.company_name || 'none'">
                <IonIcon :icon="businessOutline" />
                <span>{{ company.company_name || 'No company name' }}</span>
                <em>{{ company.students }}</em>
              </li>
            </ul>
            <p v-else class="muted">No students are assigned to you yet.</p>
          </section>

          <p class="help">
            <IonIcon :icon="informationCircleOutline" />
            To change your name, email or assigned students, contact your OJT coordinator.
          </p>
        </template>

        <section class="logout-box">
          <button v-if="!confirmLogout" type="button" class="sv-btn danger-soft wide" @click="confirmLogout = true">
            <IonIcon :icon="logOutOutline" /> Log out
          </button>
          <div v-else class="confirm" role="alertdialog" aria-live="assertive">
            <p>Log out of InZone on this device?</p>
            <div class="confirm-actions">
              <button type="button" class="sv-btn ghost" @click="confirmLogout = false">Cancel</button>
              <button type="button" class="sv-btn danger" @click="logout">Log out</button>
            </div>
          </div>
        </section>
      </main>
    </IonContent>

    <SupervisorBottomNav />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
.narrow {
  max-width: 640px;
}

.sv-card + .sv-card {
  margin-top: 12px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sv-avatar.big {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  font-size: 21px;
}

.identity h2 {
  margin: 0;
  font-size: 21px;
  color: var(--sv-ink);
  overflow-wrap: anywhere;
}

.identity p {
  margin: 4px 0 0;
  color: var(--sv-muted);
  font-size: 13px;
}

.facts,
.companies {
  list-style: none;
  margin: 0;
  padding: 0;
}

.facts li {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 11px 0;
  border-bottom: 1px solid #edf3ef;
  color: var(--sv-ink);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.facts li:last-child {
  border-bottom: 0;
}

.facts ion-icon,
.companies ion-icon {
  flex-shrink: 0;
  color: var(--sv-primary);
  font-size: 19px;
}

.facts small {
  display: block;
  margin-bottom: 2px;
  color: var(--sv-muted);
  font-size: 12px;
}

.companies {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.companies li {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 13px;
  border-radius: 12px;
  background: #f5faf7;
  color: var(--sv-ink);
  font-size: 14px;
  font-weight: 700;
}

.companies span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.companies em {
  font-style: normal;
  min-width: 26px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--sv-primary-soft);
  color: var(--sv-primary);
  font-size: 12px;
  text-align: center;
}

.muted {
  margin: 0;
  color: var(--sv-muted);
  font-size: 13px;
}

.help {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 2px 0;
  color: var(--sv-muted);
  font-size: 12px;
  line-height: 1.6;
}

.help ion-icon {
  flex-shrink: 0;
  font-size: 17px;
}

.logout-box {
  margin-top: 22px;
}

.wide {
  width: 100%;
}

.confirm {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #f0cfc9;
  background: #fff;
}

.confirm p {
  margin: 0 0 12px;
  font-weight: 800;
  color: var(--sv-ink);
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-actions .sv-btn {
  flex: 1;
}
</style>
