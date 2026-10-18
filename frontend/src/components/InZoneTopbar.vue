
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  IonIcon,
  IonModal,
} from '@ionic/vue';

import {
  locationOutline,
  logOutOutline,
  closeOutline,
  shieldCheckmarkOutline,
  arrowBackOutline,
} from 'ionicons/icons';

// =====================================
// PROPS
// =====================================
type UserRole =
  | 'STUDENT'
  | 'ADMIN'
  | 'SUPERVISOR';

const props = defineProps<{
  role: UserRole;
}>();

const router = useRouter();

// =====================================
// PORTAL LABEL
// =====================================
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

// =====================================
// LOGOUT CONFIRMATION STATE
// =====================================
const showLogoutModal = ref(false);
const loggingOut = ref(false);

// =====================================
// OPEN LOGOUT CONFIRMATION
// =====================================
function openLogoutConfirmation() {
  if (loggingOut.value) return;

  showLogoutModal.value = true;
}

// =====================================
// CLOSE LOGOUT CONFIRMATION
// =====================================
function closeLogoutConfirmation() {
  if (loggingOut.value) return;

  showLogoutModal.value = false;
}

// =====================================
// CONFIRM LOGOUT
// =====================================
async function confirmLogout() {
  if (loggingOut.value) return;

  loggingOut.value = true;

  try {
    // Remove active InZone session
    sessionStorage.removeItem('inzone_token');
    sessionStorage.removeItem('inzone_user');

    // Close confirmation popup
    showLogoutModal.value = false;

    // Redirect to Welcome/Login page
    await router.replace('/');
  } catch (error) {
    console.error('Logout navigation error:', error);

    // Ensure the user can retry navigation
    window.location.assign('/');
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <!-- =====================================
       SHARED INZONE TOPBAR
  ====================================== -->
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

    <!-- LOGOUT BUTTON -->
    <button
      type="button"
      class="logout"
      aria-label="Log out of InZone"
      :disabled="loggingOut"
      @click="openLogoutConfirmation"
    >
      <IonIcon :icon="logOutOutline" />
      <span>Log out</span>
    </button>

  </header>

  <!-- =====================================
       LOGOUT CONFIRMATION MODAL
  ====================================== -->
  <IonModal
    :is-open="showLogoutModal"
    :backdrop-dismiss="!loggingOut"
    :keyboard-close="true"
    class="logout-confirm-modal"
    aria-label="Confirm logout"
    @didDismiss="closeLogoutConfirmation"
  >
    <div class="logout-modal-content">

      <!-- CLOSE BUTTON -->
      <button
        type="button"
        class="modal-close"
        aria-label="Close logout confirmation"
        :disabled="loggingOut"
        @click="closeLogoutConfirmation"
      >
        <IonIcon :icon="closeOutline" />
      </button>

      <!-- ICON -->
      <div class="modal-icon-area">
        <div class="modal-icon-ring">
          <div class="modal-icon">
            <IonIcon :icon="logOutOutline" />
          </div>
        </div>
      </div>

      <!-- HEADER -->
      <div class="modal-heading">
        <span class="modal-eyebrow">
          <IonIcon :icon="shieldCheckmarkOutline" />
          INZONE ACCOUNT SECURITY
        </span>

        <h2>Leaving InZone<span>?</span></h2>

        <p>
          Are you sure you want to log out?
          You'll need to sign in again to
          access your InZone account.
        </p>
      </div>

      <!-- SESSION INFO -->
      <div class="session-info">
        <div class="session-info-icon">
          <IonIcon :icon="shieldCheckmarkOutline" />
        </div>

        <div class="session-info-text">
          <strong>Your session will end</strong>
          <span>
            You can securely sign in again
            whenever you're ready.
          </span>
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="modal-actions">

        <button
          type="button"
          class="stay-button"
          :disabled="loggingOut"
          @click="closeLogoutConfirmation"
        >
          <IonIcon :icon="arrowBackOutline" />
          Stay Logged In
        </button>

        <button
          type="button"
          class="confirm-button"
          :disabled="loggingOut"
          @click="confirmLogout"
        >
          <IonIcon :icon="logOutOutline" />
          {{
            loggingOut
              ? 'Logging out...'
              : 'Yes, Log Out'
          }}
        </button>

      </div>

      <!-- BOTTOM NOTE -->
      <p class="modal-footer">
        <IonIcon :icon="locationOutline" />
        InZone · OJT Attendance & Monitoring
      </p>

    </div>
  </IonModal>
</template>

<style scoped>
/* =====================================
   INZONE TOPBAR
===================================== */

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  padding: 18px clamp(18px, 5vw, 65px);

  background: #ffffff;
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
  color: #ffffff;
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

  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.logout ion-icon {
  font-size: 17px;
}

.logout:hover {
  background: #dceee4;
  transform: translateY(-1px);
}

.logout:active {
  transform: scale(0.97);
}

.logout:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logout:focus-visible {
  outline: 2px solid #087858;
  outline-offset: 3px;
}

/* =====================================
   IONIC LOGOUT MODAL
===================================== */

.logout-confirm-modal {
  --width: min(430px, calc(100% - 32px));
  --height: auto;
  --max-height: 90vh;

  --border-radius: 25px;
  --background: #ffffff;

  --box-shadow:
    0 25px 80px rgba(3, 47, 32, 0.24);

  --backdrop-opacity: 0.55;
}

.logout-confirm-modal::part(content) {
  border: 1px solid #dceee3;
  overflow-y: auto;
}

/* =====================================
   MODAL BODY
===================================== */

.logout-modal-content {
  position: relative;

  width: 100%;

  padding: 33px 29px 22px;

  background:
    radial-gradient(
      circle at 50% 0%,
      #edf9f1 0%,
      #ffffff 44%
    );

  text-align: center;
  color: #184631;
}

/* =====================================
   CLOSE BUTTON
===================================== */

.modal-close {
  position: absolute;
  top: 17px;
  right: 17px;

  display: grid;
  place-items: center;

  width: 34px;
  height: 34px;

  border: 0;
  border-radius: 10px;

  background: #eff5f0;
  color: #698373;

  font-size: 19px;
  cursor: pointer;

  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.modal-close:hover {
  background: #e0ede4;
  transform: rotate(90deg);
}

/* =====================================
   LOGOUT ICON
===================================== */

.modal-icon-area {
  display: flex;
  justify-content: center;

  margin-top: 6px;
  margin-bottom: 21px;
}

.modal-icon-ring {
  display: grid;
  place-items: center;

  width: 105px;
  height: 105px;

  border-radius: 50%;

  background: rgba(8, 120, 88, 0.08);
  border: 1px solid #ccebdd;

  box-shadow:
    0 0 0 9px rgba(8, 120, 88, 0.035);
}

.modal-icon {
  display: grid;
  place-items: center;

  width: 72px;
  height: 72px;

  border-radius: 22px;

  background: linear-gradient(
    145deg,
    #17ab7e,
    #087858
  );

  color: #ffffff;
  font-size: 32px;

  box-shadow:
    0 9px 19px rgba(8, 120, 88, 0.24);
}

/* =====================================
   MODAL HEADING
===================================== */

.modal-heading {
  margin-bottom: 22px;
}

.modal-eyebrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  color: #0a8c66;

  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1.3px;
}

.modal-eyebrow ion-icon {
  font-size: 13px;
}

.modal-heading h2 {
  margin: 13px 0 11px;

  font-size: clamp(25px, 5vw, 30px);
  font-weight: 850;
  letter-spacing: -0.9px;

  color: #144532;
}

.modal-heading h2 span {
  color: #17ab7e;
}

.modal-heading p {
  max-width: 340px;

  margin: 0 auto;

  color: #7b9384;

  font-size: 13px;
  line-height: 1.8;
}

/* =====================================
   SESSION INFORMATION
===================================== */

.session-info {
  display: flex;
  align-items: center;
  gap: 12px;

  text-align: left;

  padding: 14px;
  margin-bottom: 23px;

  border: 1px solid #d8ebdf;
  border-radius: 14px;

  background: #f3faf5;
}

.session-info-icon {
  display: grid;
  place-items: center;

  width: 39px;
  height: 39px;
  flex-shrink: 0;

  border-radius: 11px;

  background: #def3e7;
  color: #0b825d;

  font-size: 21px;
}

.session-info-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-info-text strong {
  color: #24523a;
  font-size: 12px;
  font-weight: 800;
}

.session-info-text span {
  color: #7a9482;
  font-size: 10px;
  line-height: 1.6;
}

/* =====================================
   ACTION BUTTONS
===================================== */

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
}

.stay-button,
.confirm-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  min-height: 49px;
  padding: 12px 10px;

  border: 0;
  border-radius: 12px;

  font-family: inherit;
  font-size: 12px;
  font-weight: 800;

  cursor: pointer;

  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.stay-button ion-icon,
.confirm-button ion-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* Stay Logged In */
.stay-button {
  background: #eef5f0;
  color: #37654b;
}

.stay-button:hover {
  background: #e1eee5;
}

/* Confirm Logout */
.confirm-button {
  background: linear-gradient(
    135deg,
    #13a276,
    #087858
  );

  color: #ffffff;

  box-shadow:
    0 5px 14px rgba(8, 120, 88, 0.19);
}

.confirm-button:hover {
  background: linear-gradient(
    135deg,
    #149b73,
    #066749
  );

  box-shadow:
    0 7px 18px rgba(8, 120, 88, 0.25);
}

.stay-button:active,
.confirm-button:active {
  transform: scale(0.97);
}

.stay-button:disabled,
.confirm-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.modal-close:focus-visible,
.stay-button:focus-visible,
.confirm-button:focus-visible {
  outline: 2px solid #087858;
  outline-offset: 3px;
}

/* =====================================
   MODAL FOOTER
===================================== */

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;

  margin: 23px 0 0;

  padding-top: 16px;

  border-top: 1px solid #e8f0eb;

  color: #a1b0a4;

  font-size: 10px;
}

.modal-footer ion-icon {
  color: #16a779;
  font-size: 14px;
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

@media (max-width: 480px) {
  .logout-confirm-modal {
    --width: calc(100% - 28px);
    --max-height: calc(100vh - 28px);
  }

  .logout-modal-content {
    padding: 29px 19px 19px;
  }

  .modal-icon-ring {
    width: 90px;
    height: 90px;
  }

  .modal-icon {
    width: 62px;
    height: 62px;
    border-radius: 19px;
    font-size: 28px;
  }

  .modal-heading h2 {
    font-size: 26px;
  }

  .modal-actions {
    gap: 8px;
  }

  .stay-button,
  .confirm-button {
    font-size: 11px;
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

  .modal-actions {
    grid-template-columns: 1fr;
  }
}

/* =====================================
   REDUCED MOTION
===================================== */

@media (prefers-reduced-motion: reduce) {
  .logout,
  .modal-close,
  .stay-button,
  .confirm-button {
    transition: none;
  }
}
</style>
