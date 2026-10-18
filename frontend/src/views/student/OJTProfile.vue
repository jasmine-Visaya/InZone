<script setup lang="ts">

import InZoneTopbar from '@/components/InZoneTopbar.vue';

import StudentBottomNav from './StudentBottomNav.vue';
import InZoneMapViewer from '@/components/InZoneMapViewer.vue';

import { onMounted, onUnmounted, reactive, ref } from 'vue';

import { useRouter } from 'vue-router';

import { IonPage, IonContent, IonIcon, IonButton } from '@ionic/vue';

import {

  locationOutline,

  arrowBackOutline,

  businessOutline,

  navigateOutline,

  timeOutline,

  calendarOutline,

  pencilOutline,

  saveOutline,

  shieldCheckmarkOutline,

  checkmarkCircleOutline,

  alertCircleOutline,

  refreshOutline,

  informationCircleOutline,

  logOutOutline,

} from 'ionicons/icons';

type ApprovalStatus =

  | 'PENDING'

  | 'APPROVED'

  | 'REJECTED';

interface OjtProfile {

  id?: number;

  company_name: string;

  company_address: string | null;

  required_hours: number | string | null;

  start_date: string | null;

  end_date: string | null;

  approval_status?: ApprovalStatus;

  rejection_reason?: string | null;

  reviewed_at?: string | null;

}

const router = useRouter();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const loading = ref(true);

const saving = ref(false);

const hasProfile = ref(false);

const approvalStatus = ref<ApprovalStatus | null>(null);

const rejectionReason = ref<string | null>(null);

const editing = ref(false);

const loadError = ref('');

const formError = ref('');

const message = ref('');

const studentName = ref('Student');
const showAddressMap = ref(false);

// Student schedule settings (used only in the frontend to estimate end date).
// Defaults: 8 hours per day, Monday-Friday. Holidays and absences are not counted.
const hoursPerDay = ref(8);

const workSchedule = ref<'weekdays' | 'mon-sat'>('weekdays');

const autoEndDate = ref(true);

function updateEndDate() {

  if (!autoEndDate.value) return;

  const required = Number(form.required_hours);

  const daily = Number(hoursPerDay.value);

  if (!form.start_date || !Number.isFinite(required) || required <= 0 ||

      !Number.isInteger(daily) || daily < 1 || daily > 24 ||

      Math.ceil(required / daily) > 10000) {

    form.end_date = '';

    return;

  }

  const [year, month, day] = form.start_date.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (!year || !month || !day || Number.isNaN(date.getTime()) ||

      date.toISOString().slice(0, 10) !== form.start_date) {

    form.end_date = '';

    return;

  }

  // A partial final day still uses that date: e.g. 486 / 8 = 61 workdays.
  let daysLeft = Math.ceil(required / daily);

  while (daysLeft > 0) {

    const weekday = date.getUTCDay();

    const isWorkday = weekday !== 0 &&

      (workSchedule.value === 'mon-sat' || weekday !== 6);

    if (isWorkday) daysLeft--;

    if (daysLeft > 0) date.setUTCDate(date.getUTCDate() + 1);

  }

  form.end_date = date.toISOString().slice(0, 10);

}

function setAutoEndDate() {

  if (autoEndDate.value) updateEndDate();

}

// Calendar controls for both OJT dates.
const startDateInput = ref<HTMLInputElement | null>(null);

const endDateInput = ref<HTMLInputElement | null>(null);

function openDatePicker(which: 'start' | 'end') {

  const input = (which === 'start' ? startDateInput : endDateInput).value;

  if (!input) return;

  try {

    // Chrome, Edge and modern mobile browsers support the native picker.
    if (typeof input.showPicker === 'function') {

      input.showPicker();

    } else {

      input.focus();

      input.click();

    }

  } catch {

    // Fall back to the editable date field if a browser restricts showPicker().
    input.focus();

    input.click();

  }

}

const form = reactive({

  company_name: '',

  company_address: '',

  required_hours: 486,

  start_date: '',

  end_date: '',

});

// Geoapify location suggestions are returned by our authenticated backend.
// The frontend never handles the Geoapify API key or raw coordinates.
interface WorkplaceSuggestion {

  name: string;

  address: string;

  result_type: string;

  location_token: string;

}

const workplaceSuggestions = ref<WorkplaceSuggestion[]>([]);

const selectedWorkplace = ref<WorkplaceSuggestion | null>(null);

const searchingWorkplace = ref(false);

const workplaceSearchError = ref('');

let workplaceTimer: ReturnType<typeof setTimeout> | undefined;

let workplaceAbort: AbortController | null = null;

let workplaceSearchId = 0;

function clearWorkplaceSearch() {

  if (workplaceTimer) clearTimeout(workplaceTimer);

  workplaceTimer = undefined;

  workplaceAbort?.abort();

  workplaceAbort = null;

  workplaceSearchId++;

  searchingWorkplace.value = false;

  workplaceSuggestions.value = [];

}

function onWorkplaceInput() {

  clearWorkplaceSearch();

  selectedWorkplace.value = null;

  workplaceSearchError.value = '';

  const query = form.company_address.trim();

  if (query.length < 3) return;

  const requestId = workplaceSearchId;

  workplaceTimer = setTimeout(async () => {

    const token = sessionToken();

    if (!token) {

      workplaceSearchError.value = 'Please sign in again.';

      return;

    }

    const controller = new AbortController();

    workplaceAbort = controller;

    searchingWorkplace.value = true;

    try {

      const response = await fetch(

        `${API_BASE}/api/places/autocomplete?q=${encodeURIComponent(query)}`,

        {

          headers: { Authorization: `Bearer ${token}` },

          signal: controller.signal,

        },

      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !Array.isArray(data.suggestions)) {

        throw new Error(data.message || 'Unable to search locations.');

      }

      if (requestId === workplaceSearchId) {

        workplaceSuggestions.value = data.suggestions;

      }

    } catch (err) {

      if (controller.signal.aborted || requestId !== workplaceSearchId) return;

      workplaceSearchError.value = err instanceof Error ? err.message : 'Location search failed.';

    } finally {

      if (requestId === workplaceSearchId) searchingWorkplace.value = false;

    }

  }, 500);

}

function selectWorkplace(place: WorkplaceSuggestion) {

  clearWorkplaceSearch();

  selectedWorkplace.value = place;

  form.company_address = place.address;

  workplaceSearchError.value = '';

}

onUnmounted(clearWorkplaceSearch);

// Search the saved workplace ADDRESS. This is not the exact assigned geofence pin.
// For the exact workplace marker, the backend must expose geofence coordinates
// to the student's authorized API response.
function searchWorkplaceAddressOnGoogleMaps() {
  if (!form.company_address.trim()) return;
  showAddressMap.value = true;
}

function sessionToken(): string | null {

  return sessionStorage.getItem('inzone_token');

}

function showDate(value: string | null): string {

  if (!value) return 'Not set';

  const datePart = value.slice(0, 10);

  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) return datePart;

  return new Intl.DateTimeFormat('en-PH', {

    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',

  }).format(new Date(Date.UTC(year, month - 1, day)));

}

function fillForm(profile: OjtProfile) {

  autoEndDate.value = false;

  form.company_name = profile.company_name || '';

  form.company_address = profile.company_address || '';

  form.required_hours = Number(profile.required_hours) || 486;

  form.start_date = profile.start_date?.slice(0, 10) || '';

  form.end_date = profile.end_date?.slice(0, 10) || '';

  approvalStatus.value = profile.approval_status || 'PENDING';

  rejectionReason.value = profile.rejection_reason || null;

}

function resetNewForm() {

  clearWorkplaceSearch();

  selectedWorkplace.value = null;

  workplaceSearchError.value = '';

  hoursPerDay.value = 8;

  workSchedule.value = 'weekdays';

  autoEndDate.value = true;

  form.company_name = '';

  form.company_address = '';

  form.required_hours = 486;

  form.start_date = '';

  form.end_date = '';

  approvalStatus.value = null;

  rejectionReason.value = null;

}

function logout() {

  sessionStorage.removeItem('inzone_token');

  sessionStorage.removeItem('inzone_user');

  void router.replace('/');

}

async function loadProfile() {

  const token = sessionToken();

  if (!token) {

    logout();

    return;

  }

  loading.value = true;

  loadError.value = '';

  formError.value = '';

  message.value = '';

  try {

    const response = await fetch(`${API_BASE}/api/ojt/profile`, {

      headers: { Authorization: `Bearer ${token}` },

    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {

      logout();

      return;

    }

    // Your backend uses 404 specifically for students without an OJT profile.
    if (response.status === 404 && data.message === 'OJT profile not found.') {

      hasProfile.value = false;

      editing.value = true;

      resetNewForm();

      return;

    }

    if (!response.ok || !data.success || !data.profile) {

      throw new Error(data.message || `Could not load OJT profile (HTTP ${response.status}).`);

    }

    hasProfile.value = true;

    editing.value = false;

    fillForm(data.profile as OjtProfile);

  } catch (err) {

    loadError.value = err instanceof Error ? err.message : 'Unable to load OJT profile.';

  } finally {

    loading.value = false;

  }

}

function beginEdit() {

  if (approvalStatus.value === 'PENDING') return;

  formError.value = '';

  message.value = '';

  editing.value = true;

}

function cancelEdit() {

  formError.value = '';

  message.value = '';

  editing.value = false;

  // If editing an existing profile, the form still contains the last loaded data
  // until save. Refresh it from the backend to undo unsaved edits.
  void loadProfile();

}

async function saveProfile() {

  formError.value = '';

  message.value = '';

  const companyName = form.company_name.trim();

  const hours = Number(form.required_hours);

  if (!companyName) {

    formError.value = 'Company name is required.';

    return;

  }

  if (!Number.isInteger(hours) || hours <= 0) {

    formError.value = 'Required hours must be a positive whole number.';

    return;

  }

  if (autoEndDate.value && (!Number.isInteger(Number(hoursPerDay.value)) ||

      Number(hoursPerDay.value) < 1 || Number(hoursPerDay.value) > 24)) {

    formError.value = 'Hours per day must be between 1 and 24.';

    return;

  }

  if (autoEndDate.value && Math.ceil(hours / Number(hoursPerDay.value)) > 10000) {

    formError.value = 'Too many workdays to estimate. Check the required hours.';

    return;

  }

  if (autoEndDate.value && form.start_date) updateEndDate();

  if (autoEndDate.value && !form.start_date) {

    formError.value = 'Please choose a start date to calculate the end date.';

    return;

  }

  if (form.start_date && form.end_date && form.end_date < form.start_date) {

    formError.value = 'End date cannot be earlier than start date.';

    return;

  }

  if (!hasProfile.value && !selectedWorkplace.value) {

    formError.value = 'Search and select your actual workplace address from the suggestions.';

    return;

  }

  if (!hasProfile.value && !form.company_address.trim()) {

    formError.value = 'Company address is required.';

    return;

  }

  const token = sessionToken();

  if (!token) {

    logout();

    return;

  }

  saving.value = true;

  try {

    const response = await fetch(`${API_BASE}/api/ojt/profile`, {

      method: hasProfile.value ? 'PUT' : 'POST',

      headers: {

        'Content-Type': 'application/json',

        Authorization: `Bearer ${token}`,

      },

      body: JSON.stringify({

        company_name: companyName,

        company_address: form.company_address.trim() || null,

        required_hours: hours,

        start_date: form.start_date || null,

        end_date: form.end_date || null,

        location_token: selectedWorkplace.value?.location_token ?? null,

      }),

    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {

      logout();

      return;

    }

    if (!response.ok || !data.success) {

      throw new Error(data.message || `Unable to save profile (HTTP ${response.status}).`);

    }

    hasProfile.value = true;

    editing.value = false;

    if (data.profile) fillForm(data.profile as OjtProfile);

    message.value = data.message || 'OJT profile saved successfully.';

  } catch (err) {

    formError.value = err instanceof Error ? err.message : 'Unable to save OJT profile.';

  } finally {

    saving.value = false;

  }

}

onMounted(() => {

  try {

    const raw = sessionStorage.getItem('inzone_user');

    const user = raw ? JSON.parse(raw) : null;

    if (user?.role && String(user.role).toUpperCase() !== 'STUDENT') {

      logout();

      return;

    }

    studentName.value = user?.first_name || 'Student';

  } catch {

    studentName.value = 'Student';

  }

  void loadProfile();

});

</script>

<template>

  <IonPage>

    <IonContent :fullscreen="true" class="profile-content">

      <div class="page-shell">

        <InZoneTopbar role="STUDENT" />

        <main class="content">

          <div class="heading">

            <div>

              <h1>My OJT Profile<span>.</span></h1>

              <p>Manage your company details, training schedule, and required hours.</p>

            </div>

            <div v-if="!loading && !loadError && hasProfile" class="profile-badge"><IonIcon :icon="checkmarkCircleOutline" /> Profile saved</div>

          </div>

      <section

        v-if="hasProfile && approvalStatus === 'PENDING'"

        class="approval-card pending-card"

      >

        <div class="approval-icon">

          <IonIcon :icon="timeOutline" />

        </div>

        <div class="approval-info">

          <h3>OJT Profile Pending Approval</h3>

          <p>

            Your OJT profile has been submitted successfully.

            Please wait for your administrator or supervisor

            to review and approve your company information.

          </p>

          <span class="approval-status pending">

            PENDING REVIEW

          </span>

        </div>

      </section>

      <section

        v-if="hasProfile && approvalStatus === 'APPROVED'"

        class="approval-card approved-card"

      >

        <div class="approval-icon">

          <IonIcon :icon="checkmarkCircleOutline" />

        </div>

        <div class="approval-info">

          <h3>OJT Profile Approved!</h3>

          <p>

            Your OJT workplace has been approved.

            You can now use GPS tracking and attendance

            within your assigned geofence.

          </p>

          <span class="approval-status approved">

            APPROVED

          </span>

        </div>

      </section>

      <section

        v-if="hasProfile && approvalStatus === 'REJECTED'"

        class="approval-card rejected-card"

      >

        <div class="approval-icon">

          <IonIcon :icon="alertCircleOutline" />

        </div>

        <div class="approval-info">

          <h3>OJT Profile Needs Revision</h3>

          <p>

            Your OJT profile was rejected.

            Please review the reason below, update your

            information, and submit it again.

          </p>

          <div class="rejection-reason">

            <strong>Reason for rejection:</strong>

            <p>

              {{ rejectionReason || 'No specific reason was provided.' }}

            </p>

          </div>

          <span class="approval-status rejected">

            REJECTED

          </span>

        </div>

      </section>

          <section class="hero">

            <div class="hero-copy">

              <span class="hero-pill"><IonIcon :icon="businessOutline" /> OJT COMPANY DETAILS</span>

              <h2>{{ hasProfile ? form.company_name : 'Set up your OJT journey' }}</h2>

              <p>{{ hasProfile ? `Welcome, ${studentName}. Keep your internship information up to date.` : 'Create your OJT profile to start organizing your internship details.' }}</p>

            </div>

            <div class="hero-icon" aria-hidden="true"><IonIcon :icon="navigateOutline" /></div>

          </section>

          <div v-if="loading" class="state-card" role="status">

            <IonIcon :icon="refreshOutline" /> Loading your OJT profile...

          </div>

          <div v-else-if="loadError" class="state-card error-state" role="alert">

            <IonIcon :icon="alertCircleOutline" />

            <span>{{ loadError }}</span>

            <button type="button" @click="loadProfile">Try again</button>

          </div>

          <div v-else class="profile-grid">

            <section class="main-card">

              <div class="card-title-row">

                <div>

                  <h3>{{ editing ? (hasProfile ? 'Edit OJT Profile' : 'Create OJT Profile') : 'Company Information' }}</h3>

                  <p>{{ editing ? 'Fill out the information below.' : 'Your saved training details' }}</p>

                </div>

                <button

                  v-if="hasProfile && !editing && approvalStatus !== 'PENDING'"

                  type="button"

                  class="edit-button"

                  @click="beginEdit"

                >

                  <IonIcon :icon="pencilOutline" /> Edit profile

                </button>

              </div>

              <div v-if="!editing" class="details">

                <div class="detail"><span><IonIcon :icon="businessOutline" /> Company name</span><strong>{{ form.company_name }}</strong></div>

                <div class="detail"><span><IonIcon :icon="locationOutline" /> Company address</span><strong>{{ form.company_address || 'Not set' }}</strong></div>

                  <div v-if="form.company_address" class="profile-map-action">

                    <button type="button" class="workplace-map-button" @click="searchWorkplaceAddressOnGoogleMaps">

                      <IonIcon :icon="locationOutline" /> Preview Workplace Map

                    </button>

                    <small>Searches the saved address. This is not necessarily the exact approved geofence pin.</small>

                  </div>

                <div class="detail"><span><IonIcon :icon="timeOutline" /> Required OJT hours</span><strong>{{ form.required_hours }} hours</strong></div>

                <div class="detail"><span><IonIcon :icon="calendarOutline" /> Start date</span><strong>{{ showDate(form.start_date || null) }}</strong></div>

                <div class="detail"><span><IonIcon :icon="calendarOutline" /> End date</span><strong>{{ showDate(form.end_date || null) }}</strong></div>

              </div>

              <form v-else @submit.prevent="saveProfile">

                <div class="field">

                  <label for="company-name">Company name <span>*</span></label>

                  <div class="input-wrap"><IonIcon :icon="businessOutline" /><input id="company-name" v-model="form.company_name" type="text" maxlength="150" placeholder="e.g. ABC Technologies Inc." autocomplete="organization" required /></div>

                </div>

                <div class="field workplace-field">

                  <label for="company-address">Company address <span>*</span></label>

                  <div class="input-wrap">

                    <IonIcon :icon="locationOutline" />

                    <input

                      id="company-address"

                      v-model="form.company_address"

                      type="text"

                      placeholder="Search your exact company or campus address"

                      autocomplete="off"

                      :required="!hasProfile"

                      @input="onWorkplaceInput"

                    />

                  </div>

                  <small class="hint">Type at least 3 characters, then choose the correct workplace from the suggestions.</small>

                  <div v-if="searchingWorkplace" class="workplace-message" role="status">Searching workplaces...</div>

                  <div v-if="workplaceSuggestions.length" class="workplace-results" aria-label="Suggested workplace addresses">

                    <button

                      v-for="place in workplaceSuggestions"

                      :key="place.location_token"

                      type="button"

                      class="workplace-option"

                      @click="selectWorkplace(place)"

                    >

                      <IonIcon :icon="locationOutline" />

                      <span><strong>{{ place.name }}</strong><small>{{ place.address }}</small></span>

                    </button>

                  </div>

                  <div v-if="selectedWorkplace" class="workplace-selected" role="status">

                    <IonIcon :icon="checkmarkCircleOutline" />

                    <span>Workplace selected. The backend will create its geofence when you save.</span>

                  </div>

                  <div v-if="workplaceSearchError" class="workplace-error" role="alert">{{ workplaceSearchError }}</div>

                  <small v-if="hasProfile" class="hint">For an already assigned geofence, changing the company or address may require administrator approval.</small>

                  <small class="geoapify-credit">

                    Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>

                    · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>

                  </small>

                </div>

                <div class="field">

                  <label for="required-hours">Required OJT hours <span>*</span></label>

                  <div class="input-wrap"><IonIcon :icon="timeOutline" /><input id="required-hours" v-model.number="form.required_hours" type="number" min="1" step="1" required @input="updateEndDate" /></div>

                  <small class="hint">The default is 486 hours, as defined in your backend.</small>

                </div>

                <div class="schedule-panel">

                  <label class="auto-end-toggle">

                    <input v-model="autoEndDate" type="checkbox" @change="setAutoEndDate" />

                    <span>Automatically calculate End Date</span>

                  </label>

                  <div v-if="autoEndDate" class="schedule-grid">

                    <div class="field">

                      <label for="hours-per-day">OJT hours per day</label>

                      <input id="hours-per-day" v-model.number="hoursPerDay" class="schedule-control" type="number" min="1" max="24" step="1" @input="updateEndDate" />

                    </div>

                    <div class="field">

                      <label for="work-schedule">Working days</label>

                      <select id="work-schedule" v-model="workSchedule" class="schedule-control" @change="updateEndDate">

                        <option value="weekdays">Monday – Friday</option>

                        <option value="mon-sat">Monday – Saturday</option>

                      </select>

                    </div>

                  </div>

                  <small class="schedule-hint">Estimated dates exclude non-working days, but not public holidays, leaves, or absences. You can switch off automatic calculation to set a different End Date.</small>

                </div>

                <div class="date-grid">

                  <div class="field">

                    <label for="start-date">Start date</label>

                    <div class="input-wrap date-wrap">

                      <IonIcon :icon="calendarOutline" aria-hidden="true" />

                      <input

                        id="start-date"

                        ref="startDateInput"

                        v-model="form.start_date"

                        type="date"

                        class="date-input"

                        :max="autoEndDate ? undefined : (form.end_date || undefined)"

                        aria-label="OJT start date"

                        @input="updateEndDate"

                        @change="updateEndDate"

                        @click="openDatePicker('start')"

                      />

                      <button

                        class="calendar-trigger"

                        type="button"

                        aria-label="Open start date calendar"

                        aria-controls="start-date"

                        @click="openDatePicker('start')"

                      >

                        <IonIcon :icon="calendarOutline" aria-hidden="true" />

                      </button>

                    </div>

                  </div>

                  <div class="field">

                    <label for="end-date">End date</label>

                    <div class="input-wrap date-wrap">

                      <IonIcon :icon="calendarOutline" aria-hidden="true" />

                      <input

                        id="end-date"

                        ref="endDateInput"

                        v-model="form.end_date"

                        type="date"

                        class="date-input"

                        :min="form.start_date || undefined"

                        :disabled="autoEndDate"

                        aria-label="OJT end date"

                        @click="openDatePicker('end')"

                      />

                      <button

                        class="calendar-trigger"

                        type="button"

                        aria-label="Open end date calendar"

                        aria-controls="end-date"

                        :disabled="autoEndDate"

                        @click="openDatePicker('end')"

                      >

                        <IonIcon :icon="calendarOutline" aria-hidden="true" />

                      </button>

                    </div>

                  </div>

                </div>

                <p v-if="autoEndDate && form.end_date" class="estimate-note" role="status">

                  <IonIcon :icon="checkmarkCircleOutline" /> Estimated end: <strong>{{ showDate(form.end_date) }}</strong>

                  ({{ Math.ceil(Number(form.required_hours) / Number(hoursPerDay)) }} working days)

                </p>

                <div v-if="formError" class="feedback error" role="alert"><IonIcon :icon="alertCircleOutline" /> {{ formError }}</div>

                <div class="actions">

                  <IonButton class="save-btn" type="submit" :disabled="saving">

                    <IonIcon :icon="saveOutline" slot="start" /> {{ saving ? 'Saving...' : hasProfile ? 'Save changes' : 'Create OJT profile' }}

                  </IonButton>

                  <button v-if="hasProfile" type="button" class="cancel-btn" :disabled="saving" @click="cancelEdit">Cancel</button>

                </div>

              </form>

              <div v-if="message" class="feedback success" role="status"><IonIcon :icon="checkmarkCircleOutline" /> {{ message }}</div>

            </section>

            <aside class="side">

              <div class="side-card">

                <span class="side-icon"><IonIcon :icon="timeOutline" /></span>

                <h3>Required Hours</h3>

                <div class="hours">{{ hasProfile ? form.required_hours : '—' }} <span v-if="hasProfile">hrs</span></div>

                <p>{{ hasProfile ? 'Saved target hours for your OJT.' : 'Create your profile to set your target hours.' }}</p>

              </div>

              <div class="side-card light">

                <span class="side-icon muted"><IonIcon :icon="informationCircleOutline" /></span>

                <h3>Good to know</h3>

                <p>Your details are stored through the InZone backend and linked to your student account. Attendance hours are tracked separately.</p>

              </div>

            </aside>

          </div>

        </main>

        <footer class="footer">InZone © 2026 · OJT Attendance & Monitoring</footer>

      </div>

    </IonContent>

    <StudentBottomNav />
    <InZoneMapViewer
      :is-open="showAddressMap"
      title="Workplace Address Preview"
      :query="[form.company_name.trim(), form.company_address.trim()].filter(Boolean).join(', ')"
      :address="form.company_address"
      :is-exact-pin="false"
      @close="showAddressMap = false"
    />

  </IonPage>

</template>

<style scoped>

.profile-content { --background: #f1f8f4; --color: #153b30; }

.page-shell { min-height: 100%; background: radial-gradient(circle at 95% 0%, #deeee5, transparent 42%), #f1f8f4; }

.topbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e0ebe4; padding: 18px clamp(20px, 5vw, 64px); }

.brand { display: inline-flex; align-items: center; gap: 11px; background: transparent; padding: 0; color: #144a38; cursor: pointer; }

.logo { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #0b775b; color: #fff; font-size: 24px; }

.brand strong { font-size: 23px; letter-spacing: -0.7px; }

.brand strong span { color: #16aa7e; }

.brand small { border-left: 1px solid #dbe9e0; padding-left: 12px; color: #799083; font-size: 12px; font-weight: 700; }

.logout { display: flex; align-items: center; gap: 7px; border-radius: 10px; padding: 11px 15px; background: #eaf5ef; color: #0c7656; font-weight: 750; cursor: pointer; }

.content { max-width: 1220px; margin: 0 auto; padding: 32px clamp(18px, 4vw, 48px) 60px; }.content {

  max-width: 1220px;

  margin: 0 auto;

  padding: 16px clamp(18px, 4vw, 48px)

    calc(140px + env(safe-area-inset-bottom, 0px));

}

.back { display: flex; align-items: center; gap: 7px; padding: 0; color: #0c8664; background: transparent; cursor: pointer; font-size: 13px; font-weight: 750; }

.back:hover { text-decoration: underline; }

.heading {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 12px;

  margin: 0 0 24px;

}

.eyebrow { color: #0b8a63; font-weight: 850; font-size: 11px; letter-spacing: 1.4px; display: flex; gap: 7px; align-items: center; }

.heading h1 { font-size: clamp(30px, 4vw, 43px); color: #133e30; margin: 12px 0 7px; font-weight: 850; letter-spacing: -1.2px; }

.heading h1 span { color: #16a576; }

.heading p { color: #788f81; margin: 0; font-size: 14px; }

.profile-badge { display: flex; align-items: center; gap: 7px; border-radius: 99px; background: #def5e7; color: #107955; font-size: 12px; font-weight: 750; padding: 10px 13px; }

.hero { display: flex; align-items: center; justify-content: space-between; padding: 33px clamp(24px, 4vw, 45px); min-height: 198px; border-radius: 23px; background: linear-gradient(115deg, #0c795b, #07513d 75%, #053f35); color: #fff; overflow: hidden; position: relative; box-shadow: 0 18px 40px #15564120; }

.hero-copy { position: relative; z-index: 1; }

.hero-pill { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #ffffff35; border-radius: 50px; padding: 7px 11px; color: #c1f6d7; font-size: 10px; font-weight: 850; letter-spacing: 1.3px; }

.hero h2 { font-size: clamp(23px, 3vw, 35px); margin: 17px 0 8px; letter-spacing: -.8px; }

.hero p { color: #cfefdf; line-height: 1.6; font-size: 14px; margin: 0; }

.hero-icon { position: absolute; right: 70px; font-size: 130px; opacity: .14; transform: rotate(20deg); }

.profile-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(230px, .8fr); gap: 20px; margin-top: 24px; }

.main-card, .side-card, .state-card { background: #fff; border-radius: 20px; border: 1px solid #deebe3; box-shadow: 0 8px 26px #164d3509; }

.main-card { padding: clamp(22px, 3vw, 33px); }

.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 29px; }

.card-title-row h3 { font-size: 19px; color: #1a4334; margin: 0 0 6px; }

.card-title-row p { color: #82988b; font-size: 12px; margin: 0; }

.edit-button { display: inline-flex; align-items: center; gap: 7px; color: #087754; background: #e8f6ed; padding: 11px 13px; font-size: 12px; font-weight: 800; border-radius: 11px; cursor: pointer; }

.field { margin-bottom: 20px; }

.field label { color: #315949; font-weight: 750; font-size: 12px; display: block; margin-bottom: 9px; }

.field label span { color: #c65b40; }

.input-wrap { display: flex; align-items: center; min-height: 49px; border-radius: 12px; border: 1px solid #d8e7de; padding: 0 13px; background: #fcfefd; transition: box-shadow .2s, border-color .2s; }

.input-wrap:focus-within { border-color: #0b9b71; box-shadow: 0 0 0 3px #0a9c711b; }

.input-wrap ion-icon { font-size: 19px; color: #92a89a; margin-right: 11px; flex-shrink: 0; }

.input-wrap input { border: 0; background: transparent; outline: none; width: 100%; min-width: 0; color: #184334; font: inherit; font-size: 13px; min-height: 49px; }

.input-wrap input::placeholder { color: #9aada1; }

.hint { color: #92a498; font-size: 11px; display: block; margin-top: 7px; }

.date-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

.schedule-panel { background: #eff8f2; border: 1px solid #d7e9dd; border-radius: 14px; padding: 17px; margin: 5px 0 22px; }

.auto-end-toggle { display: flex !important; align-items: center; gap: 10px; color: #0b6d52 !important; cursor: pointer; font-size: 13px !important; margin: 0 0 12px !important; }

.auto-end-toggle input { accent-color: #087957; width: 17px; height: 17px; flex-shrink: 0; }

.schedule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.schedule-grid .field { margin-bottom: 6px; }

.schedule-control { display: block; width: 100%; min-height: 45px; padding: 0 11px; color: #184334; background: #fff; border: 1px solid #c9e2d4; border-radius: 10px; outline-color: #0b9b71; font: inherit; font-size: 13px; }

.schedule-hint { color: #668678; font-size: 11px; line-height: 1.55; display: block; margin-top: 8px; }

.estimate-note { color: #137853; font-size: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin: 0 0 18px; }

.estimate-note ion-icon { font-size: 17px; }

.date-wrap { padding-right: 6px; }

.date-input:disabled { opacity: 1; color: #24674d; background: transparent; cursor: not-allowed; }

.calendar-trigger:disabled { opacity: .45; cursor: not-allowed; }

.date-input { min-width: 0; flex: 1; cursor: pointer; color-scheme: light; }

/* We supply a larger visible calendar button on the right. */

.date-input::-webkit-calendar-picker-indicator { display: none; }

.calendar-trigger { border: 0; background: #e7f6ed; color: #087957; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; cursor: pointer; transition: background .15s, transform .15s; }

.calendar-trigger:hover { background: #d2eddb; }

.calendar-trigger:active { transform: scale(.96); }

.calendar-trigger:focus-visible { outline: 2px solid #087957; outline-offset: 2px; }

.calendar-trigger ion-icon { margin: 0; color: #087957; font-size: 20px; }

.actions { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 16px; }

.save-btn { --background: #0b7959; --border-radius: 11px; --box-shadow: none; text-transform: none; font-size: 13px; font-weight: 800; min-height: 49px; }

.cancel-btn { background: #eef5f0; color: #587465; border-radius: 10px; font-weight: 750; padding: 15px 20px; cursor: pointer; }

.detail { display: grid; grid-template-columns: minmax(150px, .8fr) 1.2fr; gap: 15px; padding: 17px 0; border-bottom: 1px solid #eaf1ed; }

.detail:last-child { border: 0; }

.detail span { display: flex; align-items: center; gap: 9px; color: #829789; font-size: 12px; }

.detail span ion-icon { color: #128969; font-size: 19px; }

.detail strong { font-size: 13px; line-height: 1.5; color: #234a3b; overflow-wrap: anywhere; }

.side { display: flex; flex-direction: column; gap: 17px; }

.side-card { padding: 26px; }

.side-icon { height: 44px; width: 44px; display: grid; place-items: center; border-radius: 13px; color: #0c8b66; background: #e6f8ed; font-size: 24px; }

.side-card h3 { margin: 21px 0 9px; color: #234535; font-size: 15px; }

.hours { font-size: 37px; line-height: 1.2; color: #136b52; font-weight: 850; }

.hours span { font-size: 14px; font-weight: 700; }

.side-card p { font-size: 12px; color: #879b8f; line-height: 1.7; }

.side-card.light { background: #e9f4ee; box-shadow: none; }

.side-icon.muted { background: #d9ecdf; }

.feedback { display: flex; align-items: center; gap: 9px; padding: 13px 15px; margin-top: 17px; border-radius: 10px; font-size: 12px; line-height: 1.5; }

.feedback.error { background: #fff0ed; color: #a43c32; }

.feedback.success { background: #e5f7ea; color: #08784e; }

.state-card { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; padding: 30px; color: #617f6d; }

.state-card ion-icon { font-size: 23px; }

.state-card.error-state { color: #a33b32; background: #fff8f6; }

.state-card button { border: 0; border-radius: 9px; background: #ebf1eb; color: #226c50; padding: 9px 13px; font-weight: 750; cursor: pointer; }

.footer { border-top: 1px solid #dae9df; padding: 22px 15px; text-align: center; color: #91a69a; font-size: 11px; }

@media(max-width: 920px) { .profile-grid { grid-template-columns: 1fr; } }

@media(max-width: 600px) { .content { padding: 22px 16px 45px; } .brand small { display: none; } .heading { flex-direction: column; align-items: flex-start; } .hero { padding: 26px; min-height: 177px; } .hero-icon { right: -10px; } .card-title-row { align-items: flex-start; } .date-grid, .schedule-grid { grid-template-columns: 1fr; gap: 0; } .detail { grid-template-columns: 1fr; gap: 6px; } .main-card { padding: 20px; } }

/* Address autocomplete */

.workplace-field { position: relative; }

.workplace-message { padding: 10px 0; color: #708b7c; font-size: 12px; }

.workplace-results { margin-top: 8px; padding: 5px; max-height: 270px; overflow-y: auto; border: 1px solid #d8e9de; border-radius: 13px; background: #fff; box-shadow: 0 12px 28px #0c5d3e17; }

.workplace-option { width: 100%; display: flex; gap: 12px; align-items: flex-start; padding: 13px 12px; border: 0; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; }

.workplace-option:hover, .workplace-option:focus-visible { background: #eff8f2; }

.workplace-option ion-icon { flex-shrink: 0; margin-top: 2px; font-size: 20px; color: #0b775b; }

.workplace-option span { display: flex; flex-direction: column; gap: 5px; min-width: 0; }

.workplace-option strong { color: #214936; font-size: 12px; }

.workplace-option small { color: #809488; line-height: 1.5; font-size: 11px; }

.workplace-selected { margin-top: 12px; display: flex; gap: 9px; align-items: flex-start; background: #e4f7eb; color: #0b775b; border: 1px solid #c8e8d4; padding: 12px; border-radius: 11px; font-weight: 700; font-size: 12px; line-height: 1.6; }

.workplace-selected ion-icon { font-size: 20px; flex-shrink: 0; }

.workplace-error { margin-top: 10px; color: #b74242; font-size: 12px; }

.geoapify-credit { display: block; margin-top: 10px; color: #829687; font-size: 10px; }

.geoapify-credit a { color: #0b775b; text-decoration: underline; }

/* OJT PROFILE APPROVAL STATUS */

.approval-card {

  display: flex;

  align-items: flex-start;

  gap: 16px;

  padding: 22px;

  border-radius: 16px;

  margin-bottom: 22px;

  border: 1px solid;

}

.approval-icon {

  width: 48px;

  height: 48px;

  border-radius: 13px;

  display: grid;

  place-items: center;

  flex-shrink: 0;

}

.approval-icon ion-icon {

  font-size: 25px;

}

.approval-info {

  flex: 1;

  min-width: 0;

}

.approval-info h3 {

  font-size: 16px;

  font-weight: 800;

  margin: 0 0 8px;

}

.approval-info > p {

  font-size: 13px;

  line-height: 1.7;

  margin: 0 0 13px;

}

.approval-status {

  display: inline-flex;

  padding: 7px 12px;

  border-radius: 99px;

  font-size: 10px;

  font-weight: 850;

  letter-spacing: 0.7px;

}

/* PENDING */

.pending-card {

  background: #fff9eb;

  border-color: #f0dfac;

}

.pending-card .approval-icon {

  background: #ffedc2;

  color: #a96c09;

}

.pending-card h3 {

  color: #805616;

}

.pending-card p {

  color: #927c55;

}

.approval-status.pending {

  background: #f7e5b8;

  color: #90600c;

}

/* APPROVED */

.approved-card {

  background: #eaf8f0;

  border-color: #bfe6cf;

}

.approved-card .approval-icon {

  background: #cff0db;

  color: #087957;

}

.approved-card h3 {

  color: #0c694c;

}

.approved-card p {

  color: #57816c;

}

.approval-status.approved {

  background: #c5ebd4;

  color: #08734d;

}

/* REJECTED */

.rejected-card {

  background: #fff2f0;

  border-color: #f4cbc5;

}

.rejected-card .approval-icon {

  background: #ffdbd5;

  color: #b74337;

}

.rejected-card h3 {

  color: #a43a31;

}

.rejected-card p {

  color: #99675f;

}

.approval-status.rejected {

  background: #ffdcd6;

  color: #a33d33;

}

.rejection-reason {

  padding: 13px;

  margin-bottom: 13px;

  background: #ffffff;

  border: 1px solid #f0cfca;

  border-radius: 10px;

}

.rejection-reason strong {

  color: #a43a31;

  font-size: 12px;

}

.rejection-reason p {

  margin: 6px 0 0;

  font-size: 12px;

  line-height: 1.6;

}

/* MOBILE */

@media (max-width: 600px) {

  .approval-card {

    padding: 17px;

    gap: 12px;

  }

  .approval-icon {

    width: 41px;

    height: 41px;

  }

  .approval-info h3 {

    font-size: 14px;

  }

  .approval-info > p {

    font-size: 12px;

  }

}

.profile-map-action { margin-top: 18px; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }

.workplace-map-button { display: inline-flex; gap: 9px; align-items: center; border: none; padding: 12px 16px; border-radius: 11px; background: #e6f5ec; color: #0a7857; font-size: 12px; font-weight: 800; cursor: pointer; }

.workplace-map-button:hover { background: #d9f0e2; }

.profile-map-action small { font-size: 11px; color: #7a9083; line-height: 1.5; }

</style>
