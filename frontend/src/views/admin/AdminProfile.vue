<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonModal,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  personCircleOutline,
  personOutline,
  mailOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  calendarOutline,
  refreshOutline,
  fingerPrintOutline,
  lockClosedOutline,
  informationCircleOutline,
  businessOutline,
  createOutline,
  saveOutline,
  closeOutline,
  keyOutline,
  shieldOutline,
  arrowForwardOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

type AdminAccount = {
  id: string | number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  status?: string | null;
  created_at?: string | null;
};

type ProfileResponse = {
  success?: boolean;
  user?: AdminAccount;
  message?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const account = ref<AdminAccount | null>(null);
const loading = ref(true);
const refreshing = ref(false);
const saving = ref(false);
const liveDetails = ref(false);
const editing = ref(false);
const confirmEmailChange = ref(false);
const notice = ref('');
const error = ref('');
const success = ref('');

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
});

function getStoredAccount(): AdminAccount | null {
  try {
    const raw = sessionStorage.getItem('inzone_user');
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const user = value as Record<string, unknown>;

    if (
      (typeof user.id !== 'string' && typeof user.id !== 'number') ||
      String(user.role || '').toUpperCase() !== 'ADMIN'
    ) {
      return null;
    }

    return {
      id: user.id,
      first_name: typeof user.first_name === 'string' ? user.first_name : null,
      last_name: typeof user.last_name === 'string' ? user.last_name : null,
      email: typeof user.email === 'string' ? user.email : null,
      role: 'ADMIN',
      status: typeof user.status === 'string' ? user.status : null,
      created_at: typeof user.created_at === 'string' ? user.created_at : null,
    };
  } catch {
    return null;
  }
}

const fullName = computed(() =>
  [account.value?.first_name, account.value?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Administrator'
);

const initials = computed(() => {
  const a = account.value?.first_name?.trim().charAt(0) || '';
  const b = account.value?.last_name?.trim().charAt(0) || '';
  return (a + b).toUpperCase() || 'AD';
});

const accountStatus = computed(() =>
  String(account.value?.status || 'UNKNOWN').toUpperCase()
);

const isEmailChanged = computed(() =>
  form.email.trim().toLowerCase() !==
  String(account.value?.email || '').trim().toLowerCase()
);

const hasChanges = computed(() => {
  const old = account.value;
  if (!old) return false;
  return (
    form.first_name.trim() !== (old.first_name || '').trim() ||
    form.last_name.trim() !== (old.last_name || '').trim() ||
    isEmailChanged.value
  );
});

const canEdit = computed(() =>
  Boolean(account.value && liveDetails.value && !refreshing.value && !saving.value)
);

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function fillForm(user: AdminAccount): void {
  form.first_name = user.first_name || '';
  form.last_name = user.last_name || '';
  form.email = user.email || '';
}

function isSameAdmin(user: AdminAccount, expected: AdminAccount): boolean {
  return (
    String(user.id) === String(expected.id) &&
    String(user.role).toUpperCase() === 'ADMIN'
  );
}

async function loadAdminProfile(): Promise<void> {
  if (refreshing.value || saving.value || editing.value) return;

  error.value = '';
  notice.value = '';
  liveDetails.value = false;

  const saved = getStoredAccount();
  account.value = saved;
  const token = sessionStorage.getItem('inzone_token');

  if (!saved || !token) {
    notice.value = 'Admin session is unavailable. Please sign in again.';
    loading.value = false;
    return;
  }

  refreshing.value = true;
  try {
    const response = await fetch(
      `${API_URL}/api/admin/users/${encodeURIComponent(String(saved.id))}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );

    const data = (await response.json().catch(() => ({}))) as ProfileResponse;
    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.message || `Unable to load account (HTTP ${response.status}).`);
    }
    if (!isSameAdmin(data.user, saved)) {
      throw new Error('The server returned a different account.');
    }

    account.value = { ...saved, ...data.user, id: saved.id, role: 'ADMIN' };
    liveDetails.value = true;
  } catch {
    notice.value =
      'Showing saved session details. Editing is unavailable until the server connection is restored.';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function beginEdit(): void {
  if (!canEdit.value || !account.value) return;
  fillForm(account.value);
  error.value = '';
  success.value = '';
  editing.value = true;
}

function cancelEdit(): void {
  if (saving.value) return;
  editing.value = false;
  confirmEmailChange.value = false;
  error.value = '';
  if (account.value) fillForm(account.value);
}

function validateForm(): string {
  const firstName = form.first_name.trim();
  const lastName = form.last_name.trim();
  const emailAddress = form.email.trim().toLowerCase();

  if (!firstName || !lastName || !emailAddress) {
    return 'First name, last name, and email address are required.';
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return 'First and last name must not exceed 100 characters.';
  }
  if (emailAddress.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    return 'Please enter a valid email address.';
  }
  return '';
}

function requestSave(): void {
  if (!editing.value || saving.value || !hasChanges.value) return;
  error.value = '';
  const validationError = validateForm();
  if (validationError) {
    error.value = validationError;
    return;
  }

  // Changing the sign-in email needs an extra confirmation.
  if (isEmailChanged.value) {
    confirmEmailChange.value = true;
  } else {
    void saveChanges();
  }
}

async function saveChanges(): Promise<void> {
  if (!editing.value || saving.value || !account.value || !liveDetails.value) return;
  const validationError = validateForm();
  if (validationError) {
    confirmEmailChange.value = false;
    error.value = validationError;
    return;
  }

  const original = account.value;
  const token = sessionStorage.getItem('inzone_token');
  if (!token) {
    error.value = 'Your session has expired. Please sign in again.';
    confirmEmailChange.value = false;
    return;
  }

  saving.value = true;
  error.value = '';
  try {
    const response = await fetch(
      `${API_URL}/api/admin/users/${encodeURIComponent(String(original.id))}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
        }),
      }
    );

    const data = (await response.json().catch(() => ({}))) as ProfileResponse;
    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.message || `Could not save changes (HTTP ${response.status}).`);
    }
    if (!isSameAdmin(data.user, original)) {
      throw new Error('The server returned unexpected account information.');
    }

    const updated: AdminAccount = {
      ...original,
      ...data.user,
      id: original.id,
      role: 'ADMIN',
    };
    account.value = updated;
    fillForm(updated);

    // Keep the shared InZone login session in sync with the database.
    try {
      const sessionRaw = sessionStorage.getItem('inzone_user');
      const sessionUser = sessionRaw ? JSON.parse(sessionRaw) : {};
      sessionStorage.setItem('inzone_user', JSON.stringify({
        ...sessionUser,
        first_name: updated.first_name,
        last_name: updated.last_name,
        email: updated.email,
      }));
    } catch {
      sessionStorage.setItem('inzone_user', JSON.stringify(updated));
    }

    editing.value = false;
    success.value = 'Your account information was updated successfully.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save changes.';
  } finally {
    saving.value = false;
    confirmEmailChange.value = false;
  }
}

onIonViewWillEnter(() => {
  void loadAdminProfile();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="account-content">
      <InZoneTopbar role="ADMIN" />

      <main class="account-container">
        <header class="page-header">
          <div>
            <span class="eyebrow">
              <IonIcon :icon="shieldCheckmarkOutline" />
              ADMIN · PERSONAL WORKSPACE
            </span>
            <h1>My Admin Account<span>.</span></h1>
            <p>Manage your personal information, account access, and security.</p>
          </div>
          <button
            class="refresh-button"
            type="button"
            :disabled="refreshing || saving || editing"
            @click="loadAdminProfile"
          >
            <IonIcon :icon="refreshOutline" :class="{ spinning: refreshing }" />
            {{ refreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </header>

        <div v-if="notice" class="notice" role="status">
          <IonIcon :icon="informationCircleOutline" />
          <span>{{ notice }}</span>
        </div>

        <div v-if="success" class="feedback success" role="status">
          <IonIcon :icon="checkmarkCircleOutline" />
          <span>{{ success }}</span>
          <button type="button" class="dismiss" aria-label="Dismiss success message" @click="success = ''">
            <IonIcon :icon="closeOutline" />
          </button>
        </div>

        <div v-if="error && !editing" class="feedback error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
        </div>

        <section v-if="!account && loading" class="loading-card" role="status">
          <IonIcon :icon="refreshOutline" class="spinning" /> Loading your account...
        </section>

        <section v-else-if="!account" class="loading-card" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          Account details unavailable. Please sign in again.
        </section>

        <template v-else>
          <section class="profile-hero">
            <div class="hero-profile">
              <div class="avatar">{{ initials }}</div>
              <div class="hero-copy">
                <span class="hero-kicker">CURRENT INZONE ADMINISTRATOR</span>
                <h2>{{ fullName }}</h2>
                <p>{{ account.email || 'Email not available' }}</p>
                <span class="role-chip">
                  <IonIcon :icon="shieldCheckmarkOutline" /> ADMINISTRATOR
                </span>
              </div>
            </div>
            <IonIcon class="hero-watermark" :icon="shieldCheckmarkOutline" aria-hidden="true" />
          </section>

          <div class="card-grid">
            <section class="info-card">
              <div class="card-title">
                <span class="card-icon"><IonIcon :icon="personOutline" /></span>
                <div class="title-copy">
                  <h3>Personal Information</h3>
                  <p>Your registered InZone account identity</p>
                </div>
                <button
                  v-if="!editing"
                  type="button"
                  class="edit-button"
                  :disabled="!canEdit"
                  @click="beginEdit"
                >
                  <IonIcon :icon="createOutline" /> Edit Profile
                </button>
              </div>

              <template v-if="!editing">
                <div class="detail-row">
                  <span><IonIcon :icon="personCircleOutline" /> First Name</span>
                  <strong>{{ account.first_name || 'Not available' }}</strong>
                </div>
                <div class="detail-row">
                  <span><IonIcon :icon="personCircleOutline" /> Last Name</span>
                  <strong>{{ account.last_name || 'Not available' }}</strong>
                </div>
                <div class="detail-row">
                  <span><IonIcon :icon="mailOutline" /> Email Address</span>
                  <strong class="wrap-text">{{ account.email || 'Not available' }}</strong>
                </div>
                <div class="detail-row">
                  <span><IonIcon :icon="fingerPrintOutline" /> Account ID</span>
                  <strong class="wrap-text">{{ account.id }}</strong>
                </div>
              </template>

              <form v-else class="edit-form" @submit.prevent="requestSave">
                <div class="field-grid">
                  <label class="field">
                    <span>First Name <b>*</b></span>
                    <input v-model="form.first_name" name="first_name" type="text" autocomplete="given-name" maxlength="100" required :disabled="saving" />
                  </label>
                  <label class="field">
                    <span>Last Name <b>*</b></span>
                    <input v-model="form.last_name" name="last_name" type="text" autocomplete="family-name" maxlength="100" required :disabled="saving" />
                  </label>
                </div>
                <label class="field">
                  <span>Email Address <b>*</b></span>
                  <input v-model="form.email" name="email" type="email" autocomplete="email" maxlength="254" required :disabled="saving" />
                  <small>Changing your email also changes the address you use to sign in.</small>
                </label>

                <p v-if="error" class="inline-error" role="alert">
                  <IonIcon :icon="alertCircleOutline" /> {{ error }}
                </p>

                <div class="edit-actions">
                  <button type="button" class="cancel-button" :disabled="saving" @click="cancelEdit">
                    Cancel
                  </button>
                  <button type="submit" class="save-button" :disabled="saving || !hasChanges">
                    <IonIcon :icon="saveOutline" />
                    {{ saving ? 'Saving...' : 'Save Changes' }}
                  </button>
                </div>
              </form>
            </section>

            <section class="info-card">
              <div class="card-title">
                <span class="card-icon blue"><IonIcon :icon="shieldCheckmarkOutline" /></span>
                <div class="title-copy">
                  <h3>Account & Access</h3>
                  <p>Your administrator permissions</p>
                </div>
              </div>
              <div class="detail-row">
                <span><IonIcon :icon="businessOutline" /> Account Role</span>
                <strong>Administrator</strong>
              </div>
              <div class="detail-row">
                <span><IonIcon :icon="checkmarkCircleOutline" /> Account Status</span>
                <strong class="status-pill" :class="{
                  approved: accountStatus === 'APPROVED',
                  pending: accountStatus === 'PENDING',
                  rejected: accountStatus === 'REJECTED',
                }">{{ accountStatus === 'UNKNOWN' ? 'Not available' : accountStatus }}</strong>
              </div>
              <div class="detail-row">
                <span><IonIcon :icon="calendarOutline" /> Date Registered</span>
                <strong>{{ formatDate(account.created_at) }}</strong>
              </div>
              <div class="detail-row">
                <span><IonIcon :icon="refreshOutline" /> Details Source</span>
                <strong>{{ liveDetails ? 'Live backend' : 'Login session' }}</strong>
              </div>
            </section>
          </div>

          <section class="security-card">
            <span class="security-icon"><IonIcon :icon="shieldOutline" /></span>
            <div class="security-body">
              <span class="security-eyebrow">ACCOUNT SECURITY</span>
              <h3>Keep your InZone account secure</h3>
              <p>
                Your email and personal information can now be updated using the secured Admin API.
                Your account role and approval status are managed separately to protect administrator access.
              </p>
              <div class="security-grid">
                <div class="security-item">
                  <IonIcon :icon="keyOutline" />
                  <div>
                    <strong>Password</strong>
                    <span>A secure change-password endpoint is needed before password editing can be enabled.</span>
                  </div>
                </div>
                <div class="security-item">
                  <IonIcon :icon="lockClosedOutline" />
                  <div>
                    <strong>Session & Sign Out</strong>
                    <span>Use Log out in the topbar. InZone will ask for confirmation first.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <p class="page-footer">InZone © 2026 · OJT Attendance & Monitoring</p>
        </template>
      </main>
    </IonContent>

    <AdminBottomNav />

    <!-- Confirmation only when the sign-in email address changes. -->
    <IonModal
      :is-open="confirmEmailChange"
      class="confirm-email-modal"
      :backdrop-dismiss="!saving"
      @didDismiss="confirmEmailChange = false"
    >
      <div class="confirm-content">
        <div class="confirm-icon"><IonIcon :icon="mailOutline" /></div>
        <h2>Update sign-in email?</h2>
        <p>Your InZone login email will change to:</p>
        <strong class="new-email">{{ form.email.trim().toLowerCase() }}</strong>
        <p class="confirm-helper">Make sure you can access this email address before continuing.</p>
        <div class="confirm-actions">
          <button type="button" class="cancel-button" :disabled="saving" @click="confirmEmailChange = false">Go Back</button>
          <button type="button" class="save-button" :disabled="saving" @click="saveChanges">
            <IonIcon :icon="arrowForwardOutline" />
            {{ saving ? 'Updating...' : 'Confirm Update' }}
          </button>
        </div>
      </div>
    </IonModal>
  </IonPage>
</template>

<style scoped>
.account-content { --background: #f1f8f4; --color: #173e31; }
.account-container { max-width: 1250px; margin: 0 auto; padding: 30px clamp(17px, 4vw, 48px) calc(145px + env(safe-area-inset-bottom, 0px)); }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 26px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 850; color: #098a65; letter-spacing: 1.2px; }
.eyebrow ion-icon { font-size: 16px; }
.page-header h1 { margin: 11px 0 6px; color: #143f31; font-size: clamp(29px, 4vw, 39px); font-weight: 850; letter-spacing: -1.2px; }
.page-header h1 span { color: #12a877; }
.page-header p { margin: 0; color: #7c9284; font-size: 13px; line-height: 1.6; }
.refresh-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; border: 0; border-radius: 12px; padding: 13px 16px; background: #e0f4e8; color: #0a7b55; font-size: 12px; font-weight: 800; cursor: pointer; }
.refresh-button:disabled { opacity: .5; cursor: not-allowed; }
.refresh-button ion-icon { font-size: 18px; }
.notice { display: flex; gap: 9px; align-items: flex-start; margin-bottom: 17px; padding: 13px 15px; background: #fff9e9; border: 1px solid #f1e1b7; color: #805e20; border-radius: 12px; font-size: 12px; line-height: 1.6; }
.notice ion-icon { flex-shrink: 0; font-size: 19px; }
.feedback { display: flex; align-items: flex-start; gap: 9px; padding: 13px 15px; border-radius: 13px; font-size: 12px; line-height: 1.5; margin-bottom: 16px; }
.feedback.success { background: #e4f7e9; color: #096e48; border: 1px solid #bde5ca; }
.feedback.error { background: #fff0ee; color: #a32925; border: 1px solid #f7d3ce; }
.feedback ion-icon { flex-shrink: 0; font-size: 18px; }
.dismiss { display: grid; place-items: center; margin-left: auto; background: transparent; border: 0; color: inherit; cursor: pointer; }
.loading-card { display: flex; gap: 11px; align-items: center; border: 1px solid #e0ebe3; background: white; padding: 29px; border-radius: 20px; color: #6c8977; font-size: 13px; }
.loading-card ion-icon { font-size: 23px; }
.profile-hero { position: relative; overflow: hidden; border-radius: 22px; padding: clamp(24px, 4vw, 37px); background: linear-gradient(115deg, #0c7a5a 0%, #065440 70%, #053e36 100%); box-shadow: 0 15px 38px #1556411b; color: white; }
.hero-profile { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; }
.avatar { display: grid; place-items: center; flex-shrink: 0; width: 88px; height: 88px; border: 2px solid #ffffff4a; border-radius: 24px; background: #ffffff27; color: white; font-size: 34px; font-weight: 850; letter-spacing: 1px; }
.hero-copy { min-width: 0; }
.hero-kicker { color: #a1ead0; font-size: 9px; letter-spacing: 1.5px; font-weight: 850; }
.hero-copy h2 { font-size: clamp(24px, 3.5vw, 34px); line-height: 1.15; letter-spacing: -.7px; margin: 11px 0 7px; overflow-wrap: anywhere; }
.hero-copy p { color: #ccebdd; font-size: 13px; margin: 0 0 15px; overflow-wrap: anywhere; }
.role-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 11px; border: 1px solid #ffffff48; border-radius: 50px; color: #e8fff2; background: #ffffff19; font-size: 10px; letter-spacing: .6px; font-weight: 850; }
.role-chip ion-icon { font-size: 16px; }
.hero-watermark { position: absolute; right: 52px; top: 50%; transform: translateY(-50%) rotate(-12deg); font-size: 160px; opacity: .1; }
.card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 22px; }
.info-card { min-width: 0; border: 1px solid #dcebe1; border-radius: 21px; padding: clamp(21px, 3vw, 28px); background: white; box-shadow: 0 8px 30px #14563d08; }
.card-title { display: flex; align-items: center; gap: 13px; margin-bottom: 20px; }
.card-icon { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; border-radius: 12px; color: #088058; background: #e1f5e8; font-size: 23px; }
.card-icon.blue { color: #3375b8; background: #e5f0fc; }
.title-copy { flex: 1; min-width: 0; }
.card-title h3 { margin: 0 0 5px; font-size: 16px; color: #193f31; }
.card-title p { margin: 0; color: #8a9e90; font-size: 11px; }
.edit-button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 12px; border: 1px solid #bee7ce; border-radius: 11px; background: #eaf8ee; color: #067552; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.edit-button:disabled { opacity: .45; cursor: not-allowed; }
.edit-button ion-icon { font-size: 15px; }
.detail-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 15px 0; border-bottom: 1px solid #ecf2ee; }
.detail-row:last-child { border-bottom: 0; }
.detail-row > span { display: inline-flex; align-items: center; gap: 8px; min-width: 135px; color: #829689; font-size: 12px; }
.detail-row > span ion-icon { flex-shrink: 0; color: #188c67; font-size: 17px; }
.detail-row strong { color: #224e37; font-size: 12px; text-align: right; font-weight: 800; }
.detail-row .wrap-text { overflow-wrap: anywhere; word-break: break-word; }
.status-pill { border-radius: 50px; padding: 6px 10px; color: #667d6f; background: #eff3f0; font-size: 10px !important; }
.status-pill.approved { color: #0b8157; background: #ddf5e6; }
.status-pill.pending { color: #9b6b20; background: #fff0ce; }
.status-pill.rejected { color: #b2473d; background: #fee9e4; }
.edit-form { display: flex; flex-direction: column; gap: 16px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.field > span { color: #4c6d59; font-size: 11px; font-weight: 750; }
.field b { color: #b74c3e; }
.field input { display: block; width: 100%; min-width: 0; min-height: 45px; padding: 12px 13px; border-radius: 11px; border: 1px solid #d6e6db; outline: none; background: #fbfefc; color: #214e39; font: inherit; font-size: 12px; }
.field input:focus { border-color: #0b9870; box-shadow: 0 0 0 3px #0b987017; }
.field input:disabled { opacity: .5; }
.field small { color: #829a89; font-size: 10px; line-height: 1.5; }
.inline-error { display: flex; align-items: flex-start; gap: 7px; margin: 0; color: #a43d35; font-size: 11px; line-height: 1.5; }
.inline-error ion-icon { font-size: 17px; flex-shrink: 0; }
.edit-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 5px; }
.cancel-button, .save-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 43px; border: 0; border-radius: 11px; padding: 10px 15px; font-family: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
.cancel-button { background: #eef4ef; color: #4d6858; }
.save-button { background: #087957; color: white; box-shadow: 0 5px 15px #08795720; }
.cancel-button:disabled, .save-button:disabled { opacity: .5; cursor: not-allowed; }
.security-card { display: flex; gap: 17px; margin-top: 21px; padding: 24px 26px; border: 1px solid #cfe8d9; border-radius: 19px; background: #e9f6ed; }
.security-icon { display: grid; place-items: center; flex-shrink: 0; width: 47px; height: 47px; border-radius: 13px; background: #d4efde; color: #0b805a; font-size: 23px; }
.security-body { flex: 1; min-width: 0; }
.security-eyebrow { color: #0d8b60; font-size: 10px; font-weight: 850; letter-spacing: 1px; }
.security-card h3 { margin: 8px 0; color: #22543a; font-size: 16px; }
.security-card p { margin: 0 0 15px; max-width: 850px; color: #627f6b; line-height: 1.7; font-size: 12px; }
.security-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.security-item { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid #d7e9dd; border-radius: 12px; background: #ffffff90; }
.security-item > ion-icon { color: #118a62; font-size: 20px; flex-shrink: 0; }
.security-item strong { display: block; color: #23503a; font-size: 12px; margin-bottom: 4px; }
.security-item span { display: block; color: #718c7b; font-size: 11px; line-height: 1.5; }
.page-footer { text-align: center; margin: 28px 0 0; font-size: 11px; color: #92a89a; }
.confirm-email-modal { --width: min(420px, calc(100% - 28px)); --height: auto; --max-height: 90vh; --background: #fff; --border-radius: 22px; --box-shadow: 0 24px 80px #143d3336; }
.confirm-email-modal::part(content) { overflow-y: auto; }
.confirm-content { padding: 30px 25px 25px; text-align: center; }
.confirm-icon { display: grid; place-items: center; width: 68px; height: 68px; margin: 0 auto 19px; border-radius: 20px; background: #e0f6e9; color: #087858; font-size: 34px; }
.confirm-content h2 { margin: 0 0 9px; color: #173f30; font-size: 24px; }
.confirm-content p { margin: 0 0 11px; color: #768e80; font-size: 12px; line-height: 1.7; }
.new-email { display: block; color: #0b7856; background: #f2faf5; border-radius: 10px; padding: 13px; font-size: 13px; overflow-wrap: anywhere; }
.confirm-content .confirm-helper { margin: 13px 0 20px; font-size: 11px; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@keyframes rotate { to { transform: rotate(360deg); } }
.spinning { animation: rotate 1s linear infinite; }
@media (max-width: 800px) { .card-grid, .security-grid { grid-template-columns: 1fr; } .hero-watermark { right: -15px; } }
@media (max-width: 480px) { .page-header { align-items: flex-start; flex-direction: column; } .hero-profile { align-items: flex-start; gap: 15px; } .avatar { width: 65px; height: 65px; border-radius: 19px; font-size: 26px; } .hero-copy h2 { font-size: 23px; } .detail-row { flex-direction: column; gap: 8px; } .detail-row strong { text-align: left; } .info-card { padding: 19px; } .field-grid { grid-template-columns: 1fr; } .card-title { flex-wrap: wrap; } .edit-button { margin-left: 0; } .security-card { padding: 18px; gap: 12px; } .security-icon { width: 39px; height: 39px; } }
@media (prefers-reduced-motion: reduce) { .spinning { animation: none; } }
</style>
