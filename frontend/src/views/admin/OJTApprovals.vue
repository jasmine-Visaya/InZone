
<script setup lang="ts">
import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
} from '@ionic/vue';
import {
  shieldCheckmarkOutline,
  timeOutline,
  businessOutline,
  locationOutline,
  calendarOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  alertCircleOutline,
  refreshOutline,
  arrowBackOutline,
  peopleOutline,
  openOutline,
} from 'ionicons/icons';

type ReviewAction = 'APPROVED' | 'REJECTED';

interface PendingProfile {
  id: string | number;
  user_id: string | number;
  company_name: string;
  company_address: string | null;
  required_hours: number | string | null;
  start_date: string | null;
  end_date: string | null;
  approval_status: string;
  geofence_name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radius_meters?: number | string | null;
}

const router = useRouter();

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const profiles = ref<PendingProfile[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const success = ref('');

const selectedProfile = ref<PendingProfile | null>(null);
const reviewAction = ref<ReviewAction | null>(null);
const rejectionReason = ref('');
const search = ref('');

const pendingCount = computed(() => profiles.value.length);

const filteredProfiles = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) return profiles.value;

  return profiles.value.filter((profile) =>
    [
      profile.company_name,
      profile.company_address,
      String(profile.id),
    ].some((value) =>
      String(value || '').toLowerCase().includes(query)
    )
  );
});

function getToken(): string {
  return sessionStorage.getItem('inzone_token') || '';
}

function getHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';

  const datePart = value.slice(0, 10);
  const parts = datePart.split('-').map(Number);

  if (parts.length !== 3 || parts.some((x) => !x)) {
    return datePart;
  }

  const date = new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2])
  );

  if (Number.isNaN(date.getTime())) return datePart;

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatCoordinate(value?: string | number | null) {
  if (value === undefined || value === null) {
    return 'Not available';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(6)
    : 'Not available';
}

function hasGeofence(profile: PendingProfile): boolean {
  return (
    profile.latitude !== null &&
    profile.latitude !== undefined &&
    profile.longitude !== null &&
    profile.longitude !== undefined &&
    Number.isFinite(Number(profile.latitude)) &&
    Number.isFinite(Number(profile.longitude))
  );
}

function openLocation(profile: PendingProfile) {
  if (!hasGeofence(profile)) return;

  const lat = Number(profile.latitude);
  const lon = Number(profile.longitude);

  const url =
    `https://www.google.com/maps?q=${lat},${lon}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}

async function loadPendingProfiles() {
  error.value = '';
  loading.value = true;

  try {
    const token = getToken();

    if (!token) {
      throw new Error('Please log in again as Admin.');
    }

    const response = await fetch(
      `${API_URL}/api/ojt/review/pending`,
      {
        headers: getHeaders(),
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        `Unable to load pending profiles (${response.status}).`
      );
    }

    if (!Array.isArray(data.profiles)) {
      throw new Error('Invalid profile list response.');
    }

    profiles.value = data.profiles;
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to load pending profiles.';
  } finally {
    loading.value = false;
  }
}

function openReview(
  profile: PendingProfile,
  action: ReviewAction
) {
  if (submitting.value) return;

  selectedProfile.value = profile;
  reviewAction.value = action;
  rejectionReason.value = '';
  error.value = '';
  success.value = '';
}

function closeReview() {
  if (submitting.value) return;

  selectedProfile.value = null;
  reviewAction.value = null;
  rejectionReason.value = '';
}

async function submitReview() {
  const profile = selectedProfile.value;
  const action = reviewAction.value;

  if (!profile || !action || submitting.value) return;

  if (action === 'APPROVED' && !hasGeofence(profile)) {
    error.value =
      'Cannot approve a profile without a valid geofence.';
    return;
  }

  if (
    action === 'REJECTED' &&
    !rejectionReason.value.trim()
  ) {
    error.value = 'Please provide a rejection reason.';
    return;
  }

  error.value = '';
  submitting.value = true;

  try {
    const token = getToken();

    if (!token) {
      throw new Error('Please log in again as Admin.');
    }

    const response = await fetch(
      `${API_URL}/api/ojt/review/${encodeURIComponent(
        String(profile.id)
      )}`,
      {
        method: 'PATCH',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: action,
          ...(action === 'REJECTED'
            ? {
                rejection_reason: rejectionReason.value.trim(),
              }
            : {}),
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        `Unable to review profile (${response.status}).`
      );
    }

    success.value =
      action === 'APPROVED'
        ? `${profile.company_name} was approved successfully.`
        : `${profile.company_name} was rejected.`;

    selectedProfile.value = null;
    reviewAction.value = null;
    rejectionReason.value = '';

    // Update the list after successful review.
    await loadPendingProfiles();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to submit review.';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPendingProfiles();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="approval-content">
        <InZoneTopbar role="ADMIN" />
      <div class="page-shell">
        <main class="content">

          <!-- HEADER -->
          <header class="page-header">

            <div class="header-row">
              <div>

                <h1>OJT Profile Approvals<span>.</span></h1>

                <p>
                  Review student workplaces and approve
                  or reject submitted OJT profiles.
                </p>
              </div>

              <button
                type="button"
                class="refresh-button"
                :disabled="loading"
                @click="loadPendingProfiles"
              >
                <IonIcon
                  :icon="refreshOutline"
                  :class="{ spinning: loading }"
                />
                Refresh
              </button>
            </div>
          </header>

          <!-- SUMMARY -->
          <section class="summary-card">
            <div class="summary-icon">
              <IonIcon :icon="peopleOutline" />
            </div>

            <div>
              <span>Profiles Awaiting Review</span>
              <strong>{{ pendingCount }}</strong>
              <p>OJT submissions pending administrator approval</p>
            </div>
          </section>

          <!-- MESSAGES -->
          <div
            v-if="error"
            class="feedback error"
            role="alert"
          >
            <IonIcon :icon="alertCircleOutline" />
            {{ error }}
          </div>

          <div
            v-if="success"
            class="feedback success"
            role="status"
          >
            <IonIcon :icon="checkmarkCircleOutline" />
            {{ success }}
          </div>

          <!-- SEARCH -->
          <div class="list-toolbar">
            <div>
              <h2>Pending Submissions</h2>
              <p>Verify the location before approving a workplace.</p>
            </div>

            <input
              v-model="search"
              class="search-input"
              type="search"
              placeholder="Search company or profile ID..."
              aria-label="Search pending OJT profiles"
            />
          </div>

          <!-- LOADING -->
          <section v-if="loading" class="state-card">
            <IonIcon
              :icon="refreshOutline"
              class="spinning"
            />
            Loading pending profiles...
          </section>

          <!-- EMPTY STATE -->
          <section
            v-else-if="filteredProfiles.length === 0"
            class="empty-card"
          >
            <IonIcon :icon="checkmarkCircleOutline" />

            <h3>
              {{
                profiles.length === 0
                  ? 'All Caught Up!'
                  : 'No Matching Profiles'
              }}
            </h3>

            <p>
              {{
                profiles.length === 0
                  ? 'There are no OJT profiles awaiting approval.'
                  : 'Try a different company name or profile ID.'
              }}
            </p>
          </section>

          <!-- PROFILE LIST -->
          <section v-else class="profiles-grid">
            <article
              v-for="profile in filteredProfiles"
              :key="profile.id"
              class="profile-card"
            >
              <div class="profile-top">
                <span class="status-pill">
                  <IonIcon :icon="timeOutline" />
                  PENDING
                </span>

                <span class="profile-id">
                  Profile #{{ profile.id }}
                </span>
              </div>

              <div class="company-heading">
                <div class="company-icon">
                  <IonIcon :icon="businessOutline" />
                </div>

                <div>
                  <h3>{{ profile.company_name }}</h3>
                  <p>
                    <IonIcon :icon="locationOutline" />
                    {{ profile.company_address || 'Address not set' }}
                  </p>
                </div>
              </div>

              <div class="details-grid">
                <div>
                  <span>Required Hours</span>
                  <strong>
                    {{ profile.required_hours ?? '—' }} hrs
                  </strong>
                </div>

                <div>
                  <span>Start Date</span>
                  <strong>{{ formatDate(profile.start_date) }}</strong>
                </div>

                <div>
                  <span>End Date</span>
                  <strong>{{ formatDate(profile.end_date) }}</strong>
                </div>

                <div>
                  <span>Geofence Radius</span>
                  <strong>
                    {{
                      profile.radius_meters != null
                        ? `${profile.radius_meters} m`
                        : 'Not configured'
                    }}
                  </strong>
                </div>
              </div>

              <div class="geofence-box">
                <div class="geofence-title">
                  <IonIcon :icon="locationOutline" />
                  Saved Geoapify Location
                </div>

                <div class="coordinate-row">
                  <span>Latitude</span>
                  <strong>
                    {{ formatCoordinate(profile.latitude) }}
                  </strong>
                </div>

                <div class="coordinate-row">
                  <span>Longitude</span>
                  <strong>
                    {{ formatCoordinate(profile.longitude) }}
                  </strong>
                </div>

                <button
                  type="button"
                  class="map-button"
                  :disabled="!hasGeofence(profile)"
                  @click="openLocation(profile)"
                >
                  <IonIcon :icon="openOutline" />
                  View Pin on Google Maps
                </button>
              </div>

              <div class="review-actions">
                <button
                  type="button"
                  class="approve-button"
                  :disabled="submitting || !hasGeofence(profile)"
                  @click="openReview(profile, 'APPROVED')"
                >
                  <IonIcon :icon="checkmarkCircleOutline" />
                  Approve
                </button>

                <button
                  type="button"
                  class="reject-button"
                  :disabled="submitting"
                  @click="openReview(profile, 'REJECTED')"
                >
                  <IonIcon :icon="closeCircleOutline" />
                  Reject
                </button>
              </div>
            </article>
          </section>
        </main>
      </div>

      <!-- REVIEW MODAL -->
      <div
        v-if="selectedProfile && reviewAction"
        class="modal-overlay"
        @click.self="closeReview"
      >
        <section
          class="review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-dialog-title"
        >
          <div class="modal-icon" :class="{
            rejection: reviewAction === 'REJECTED'
          }">
            <IonIcon
              :icon="
                reviewAction === 'APPROVED'
                  ? checkmarkCircleOutline
                  : closeCircleOutline
              "
            />
          </div>

          <h2 id="review-dialog-title">
            {{
              reviewAction === 'APPROVED'
                ? 'Approve OJT Profile?'
                : 'Reject OJT Profile?'
            }}
          </h2>

          <p>
            {{ selectedProfile.company_name }}
          </p>

          <p class="modal-description">
            {{
              reviewAction === 'APPROVED'
                ? 'Confirm that the workplace and selected geofence location have been verified. Approval unlocks GPS attendance.'
                : 'The student will be able to correct the profile and resubmit it for review.'
            }}
          </p>

          <div v-if="reviewAction === 'REJECTED'" class="reason-field">
            <label for="rejection-reason">
              Reason for rejection *
            </label>

            <textarea
              id="rejection-reason"
              v-model="rejectionReason"
              rows="4"
              maxlength="2000"
              placeholder="Explain what the student needs to correct..."
            />
          </div>

          <div
            v-if="error"
            class="modal-error"
            role="alert"
          >
            {{ error }}
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="cancel-button"
              :disabled="submitting"
              @click="closeReview"
            >
              Cancel
            </button>

            <button
              type="button"
              class="confirm-button"
              :class="{
                danger: reviewAction === 'REJECTED'
              }"
              :disabled="
                submitting ||
                (reviewAction === 'REJECTED' &&
                 !rejectionReason.trim())
              "
              @click="submitReview"
            >
              {{
                submitting
                  ? 'Submitting...'
                  : reviewAction === 'APPROVED'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'
              }}
            </button>
          </div>
        </section>
      </div>
    </IonContent>

    <AdminBottomNav />
  </IonPage>
</template>

<style scoped>
.approval-content {
  --background: #f1f8f4;
  --color: #163d30;
}

.page-shell {
  min-height: 100%;
  background:
    radial-gradient(circle at 95% 0%, #deeee5, transparent 42%),
    #f1f8f4;
}

.content {
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px clamp(18px, 4vw, 48px)
    calc(140px + env(safe-area-inset-bottom, 0px));
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #0a8361;
  font-size: 13px;
  font-weight: 750;
  padding: 0;
  cursor: pointer;
}

.page-header {
  margin: 0 0 25px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #0b8a63;
  font-weight: 850;
  font-size: 11px;
  letter-spacing: 1.3px;
}

.page-header h1 {
  font-size: clamp(30px, 4vw, 43px);
  color: #133e30;
  margin: 12px 0 7px;
  font-weight: 850;
  letter-spacing: -1.2px;
  line-height: 1.15;
}

.page-header h1 span {
  color: #16a576;
}

.page-header p {
  color: #788f81;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  background: #e1f2e8;
  color: #087d5b;
  border-radius: 11px;
  padding: 12px 17px;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 23px;
  border-radius: 18px;
  background: linear-gradient(110deg, #0c795b, #084d3c);
  color: #fff;
  margin-bottom: 27px;
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  border-radius: 15px;
  background: #ffffff24;
  font-size: 30px;
}

.summary-card span {
  display: block;
  color: #c6f2d9;
  font-size: 12px;
  font-weight: 700;
}

.summary-card strong {
  display: block;
  margin: 4px 0;
  font-size: 36px;
  font-weight: 850;
}

.summary-card p {
  margin: 0;
  font-size: 11px;
  color: #d0ecdd;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.list-toolbar h2 {
  margin: 0 0 6px;
  color: #194533;
  font-size: 20px;
}

.list-toolbar p {
  color: #84988c;
  margin: 0;
  font-size: 12px;
}

.search-input {
  min-height: 44px;
  min-width: 250px;
  padding: 0 14px;
  border-radius: 11px;
  background: #fff;
  border: 1px solid #d5e5da;
  outline-color: #0c9871;
  color: #164432;
  font-size: 13px;
}

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.profile-card,
.state-card,
.empty-card {
  background: #fff;
  border: 1px solid #deebe3;
  border-radius: 20px;
  box-shadow: 0 8px 25px #164d3509;
}

.profile-card {
  padding: 24px;
}

.profile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 23px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border-radius: 30px;
  color: #9c6b19;
  background: #fff0d1;
  font-size: 10px;
  font-weight: 850;
}

.profile-id {
  color: #91a397;
  font-size: 11px;
}

.company-heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 20px;
}

.company-icon {
  display: grid;
  place-items: center;
  width: 47px;
  height: 47px;
  flex-shrink: 0;
  border-radius: 13px;
  background: #e7f7ed;
  color: #0a8462;
  font-size: 23px;
}

.company-heading h3 {
  color: #1a4434;
  font-size: 17px;
  margin: 2px 0 8px;
}

.company-heading p {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: #82988a;
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
}

.company-heading p ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
}

.details-grid > div {
  padding: 13px;
  background: #f5f9f6;
  border-radius: 10px;
}

.details-grid span,
.coordinate-row span {
  display: block;
  color: #87998e;
  font-size: 11px;
  margin-bottom: 7px;
}

.details-grid strong,
.coordinate-row strong {
  color: #234b38;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.geofence-box {
  border: 1px solid #d9e9df;
  border-radius: 12px;
  padding: 15px;
  margin-top: 18px;
}

.geofence-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
  color: #0b7858;
  margin-bottom: 13px;
}

.coordinate-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 0;
}

.coordinate-row span {
  margin: 0;
}

.map-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 15px;
  width: 100%;
  padding: 11px;
  background: #eaf6ee;
  color: #0c7d59;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.review-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.approve-button,
.reject-button {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 13px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.approve-button {
  color: #fff;
  background: #0b7959;
}

.reject-button {
  color: #b7473f;
  background: #fff0ee;
}

.state-card,
.empty-card {
  padding: 45px 22px;
  text-align: center;
  color: #6d8c79;
}

.state-card ion-icon,
.empty-card > ion-icon {
  font-size: 38px;
  color: #0b8964;
}

.empty-card h3 {
  margin: 15px 0 8px;
  color: #244b39;
}

.empty-card p {
  color: #84988c;
  font-size: 13px;
}

.feedback {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 15px;
  border-radius: 11px;
  margin-bottom: 19px;
  font-size: 12px;
}

.feedback.error {
  background: #fff0ed;
  color: #aa4036;
}

.feedback.success {
  background: #e1f7e8;
  color: #097752;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: #102b2180;
  display: grid;
  place-items: center;
  padding: 18px;
}

.review-modal {
  width: min(100%, 470px);
  max-height: 90vh;
  overflow-y: auto;
  background: #ffffff;
  padding: 28px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 20px 70px #102b212e;
}

.modal-icon {
  width: 61px;
  height: 61px;
  display: grid;
  place-items: center;
  margin: 0 auto 15px;
  border-radius: 50%;
  color: #087c57;
  background: #e0f5e8;
  font-size: 33px;
}

.modal-icon.rejection {
  background: #ffe6e2;
  color: #ba463e;
}

.review-modal h2 {
  font-size: 21px;
  color: #204733;
  margin: 0 0 7px;
}

.review-modal > p {
  font-size: 13px;
  color: #718a7a;
}

.modal-description {
  line-height: 1.7;
  margin-bottom: 18px;
}

.reason-field {
  text-align: left;
}

.reason-field label {
  display: block;
  color: #365747;
  font-size: 12px;
  font-weight: 750;
  margin-bottom: 9px;
}

.reason-field textarea {
  width: 100%;
  resize: vertical;
  padding: 13px;
  border: 1px solid #d8e7de;
  border-radius: 11px;
  outline-color: #0b9370;
  color: #234b38;
  font: inherit;
  font-size: 13px;
}

.modal-error {
  margin-top: 14px;
  color: #ad4037;
  background: #ffefec;
  padding: 11px;
  border-radius: 9px;
  font-size: 12px;
}

.modal-actions {
  display: flex;
  gap: 11px;
  margin-top: 22px;
}

.cancel-button,
.confirm-button {
  flex: 1;
  padding: 13px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.cancel-button {
  background: #eef4f0;
  color: #667c6d;
}

.confirm-button {
  background: #0b7959;
  color: white;
}

.confirm-button.danger {
  background: #bd4f45;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 850px) {
  .profiles-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .content {
    padding: 16px 16px
      calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .header-row,
  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .refresh-button {
    align-self: flex-start;
  }

  .search-input {
    min-width: 0;
    width: 100%;
  }

  .profile-card {
    padding: 18px;
  }

  .review-modal {
    padding: 22px 18px;
  }

  .review-actions {
    flex-direction: column;
  }
  .content {
  padding-bottom: calc(
    120px + env(safe-area-inset-bottom, 0px)
  );
}
}

</style>
