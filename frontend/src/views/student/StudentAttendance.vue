

<script setup lang="ts">

import { computed, ref } from 'vue';

import { useRouter } from 'vue-router';

import {

  IonPage,

  IonContent,

  IonIcon,

  onIonViewWillEnter,

} from '@ionic/vue';

import InZoneTopbar from '@/components/InZoneTopbar.vue';

import StudentBottomNav from './StudentBottomNav.vue';

import {

  calendarOutline,

  calendarNumberOutline,

  calendarClearOutline,

  timeOutline,

  timerOutline,

  checkmarkCircleOutline,

  alertCircleOutline,

  refreshOutline,

  documentTextOutline,

  imageOutline,

  eyeOutline,

  closeOutline,

  arrowForwardOutline,

  navigateOutline,

  locationOutline,

  shieldCheckmarkOutline,

  chevronDownOutline,

  chevronUpOutline,

  logInOutline,

  logOutOutline,

} from 'ionicons/icons';

/* ======================================*

*   CONFIGURATION*

*====================================== */

const router = useRouter();

const API_URL =

  import.meta.env.VITE_API_URL ||

  'http://localhost:5000';

/* ======================================*

*   TYPES*

*====================================== */

interface AttendanceRecord {

  id: number;

  attendance_date: string;

  time_in: string | null;

  time_out: string | null;

  latitude_in?: number | null;

  longitude_in?: number | null;

  latitude_out?: number | null;

  longitude_out?: number | null;

  time_in_status?: string | null;

  time_out_status?: string | null;

  hours_worked?: number;

  seconds_worked?: number;

}

interface HistoryResponse {

  success: boolean;

  message?: string;

  attendance?: AttendanceRecord[];

  total_hours?: number | string;

  count?: number;

}

interface PhotoResponse {

  success: boolean;

  message?: string;

  photo_url?: string;

}

/* ======================================*

*   STATE*

*====================================== */

const loading = ref(true);

const refreshing = ref(false);

const error = ref('');

const attendance = ref<AttendanceRecord[]>([]);

const totalHours = ref(0);

const selectedMonth = ref('');

const showAll = ref(false);

const proofLoading = ref<number | null>(null);

const proofUrl = ref('');

const proofError = ref('');

const proofRecord = ref<AttendanceRecord | null>(null);

const studentName = ref('Student');

/* ======================================*

*   DATE HELPERS*

*====================================== */

function getPhilippineDate(): string {

  const parts = new Intl.DateTimeFormat(

    'en-US',

    {

      timeZone: 'Asia/Manila',

      year: 'numeric',

      month: '2-digit',

      day: '2-digit',

    }

  ).formatToParts(new Date());

  const findPart = (type: string) =>

    parts.find((part) => part.type === type)

      ?.value || '';

  return (

    `${findPart('year')}-` +

    `${findPart('month')}-` +

    `${findPart('day')}`

  );

}

const today = ref(getPhilippineDate());

function formatDate(value?: string | null): string {

  if (!value) return '—';

  const dateOnly = value.slice(0, 10);

  const date = new Date(`${dateOnly}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {

    return dateOnly;

  }

  return new Intl.DateTimeFormat('en-PH', {

    timeZone: 'UTC',

    month: 'short',

    day: 'numeric',

    year: 'numeric',

  }).format(date);

}

function formatTime(value?: string | null): string {

  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return '—';

  }

  return new Intl.DateTimeFormat('en-PH', {

    timeZone: 'Asia/Manila',

    hour: 'numeric',

    minute: '2-digit',

    hour12: true,

  }).format(date);

}

function formatHours(

  value?: number | string | null

): string {

  const hours = Number(value);

  return Number.isFinite(hours)

    ? `${hours.toFixed(2)} hrs`

    : '0.00 hrs';

}

function recordHours(

  record: AttendanceRecord

): number {

  if (

    record.seconds_worked !== undefined &&

    record.seconds_worked !== null

  ) {

    return Math.max(

      0,

      Number(record.seconds_worked) / 3600 || 0

    );

  }

  if (

    record.hours_worked !== undefined &&

    record.hours_worked !== null

  ) {

    return Math.max(

      0,

      Number(record.hours_worked) || 0

    );

  }

  if (record.time_in && record.time_out) {

    const milliseconds =

      new Date(record.time_out).getTime() -

      new Date(record.time_in).getTime();

    return Number.isFinite(milliseconds)

      ? Math.max(0, milliseconds / 3600000)

      : 0;

  }

  return 0;

}

/* ======================================*

*   COMPUTED DATA*

*====================================== */

const todayRecord = computed(() => {

  return (

    attendance.value.find(

      (record) =>

        record.attendance_date?.slice(0, 10) ===

        today.value

    ) || null

  );

});

const hasTimedIn = computed(() =>

  Boolean(todayRecord.value?.time_in)

);

const hasTimedOut = computed(() =>

  Boolean(todayRecord.value?.time_out)

);

const todayStatus = computed(() => {

  if (!hasTimedIn.value) {

    return 'Not Checked In';

  }

  if (hasTimedOut.value) {

    return 'Completed';

  }

  return 'Checked In';

});

const todayStatusClass = computed(() => {

  if (hasTimedOut.value) return 'completed';

  if (hasTimedIn.value) return 'ongoing';

  return 'not-started';

});

const todayHours = computed(() => {

  if (!todayRecord.value?.time_out) {

    return 0;

  }

  return recordHours(todayRecord.value);

});

const recordedDays = computed(() => {

  return attendance.value.filter(

    (record) => Boolean(record.time_in)

  ).length;

});

const completedDays = computed(() => {

  return attendance.value.filter(

    (record) =>

      Boolean(record.time_in && record.time_out)

  ).length;

});

const filteredAttendance = computed(() => {

  if (!selectedMonth.value) {

    return attendance.value;

  }

  return attendance.value.filter(

    (record) =>

      record.attendance_date

        ?.slice(0, 7) === selectedMonth.value

  );

});

const visibleAttendance = computed(() => {

  if (showAll.value) {

    return filteredAttendance.value;

  }

  return filteredAttendance.value.slice(0, 6);

});

const currentMonthLabel = computed(() => {

  if (!selectedMonth.value) {

    return 'All attendance records';

  }

  const [year, month] =

    selectedMonth.value.split('-').map(Number);

  if (!year || !month) {

    return 'Selected month';

  }

  return new Intl.DateTimeFormat('en-PH', {

    month: 'long',

    year: 'numeric',

    timeZone: 'UTC',

  }).format(

    new Date(Date.UTC(year, month - 1, 1))

  );

});

/* ======================================*

*   SESSION*

*====================================== */

function getToken(): string {

  return sessionStorage.getItem('inzone_token') || '';

}

function loadStudentName() {

  try {

    const raw =

      sessionStorage.getItem('inzone_user');

    const user = raw ? JSON.parse(raw) : {};

    if (

      String(user.role || '').toUpperCase() !==

      'STUDENT'

    ) {

      studentName.value = 'Student';

      return;

    }

    studentName.value =

      user.first_name ||

      user.name ||

      'Student';

  } catch {

    studentName.value = 'Student';

  }

}

/* ======================================*

*   FETCH ATTENDANCE HISTORY*

*====================================== */

async function loadAttendance() {

  const token = getToken();

  today.value = getPhilippineDate();

  if (!token) {

    error.value =

      'Please log in again to view your attendance.';

    loading.value = false;

    return;

  }

  loading.value = true;

  error.value = '';

  try {

    const response = await fetch(

      `${API_URL}/api/attendance/my-history`,

      {

        method: 'GET',

        headers: {

          Authorization: `Bearer ${token}`,

        },

        cache: 'no-store',

      }

    );

    const data: HistoryResponse =

      await response.json().catch(() => ({

        success: false,

      }));

    if (

      !response.ok ||

      !data.success ||

      !Array.isArray(data.attendance)

    ) {

      throw new Error(

        data.message ||

        'Unable to load attendance records.'

      );

    }

    attendance.value = [...data.attendance].sort(

      (a, b) =>

        (b.attendance_date || '').localeCompare(

          a.attendance_date || ''

        )

    );

    totalHours.value =

      Number(data.total_hours) || 0;

  } catch (err) {

    error.value =

      err instanceof Error

        ? err.message

        : 'Failed to load attendance.';

  } finally {

    loading.value = false;

  }

}

async function refreshAttendance() {

  if (refreshing.value) return;

  refreshing.value = true;

  try {

    await loadAttendance();

  } finally {

    refreshing.value = false;

  }

}

/* ======================================*

*   PHOTO PROOF*

*====================================== */

function closePhotoProof() {

  proofUrl.value = '';

  proofError.value = '';

  proofRecord.value = null;

  proofLoading.value = null;

}

async function viewPhotoProof(

  record: AttendanceRecord

) {

  const token = getToken();

  if (!token) {

    error.value = 'Please log in again.';

    return;

  }

  closePhotoProof();

  proofRecord.value = record;

  proofLoading.value = record.id;

  try {

    const response = await fetch(

      `${API_URL}/api/attendance/photo-proof/${record.id}`,

      {

        headers: {

          Authorization: `Bearer ${token}`,

        },

      }

    );

    const data: PhotoResponse =

      await response.json().catch(() => ({

        success: false,

      }));

    if (

      !response.ok ||

      !data.success ||

      !data.photo_url

    ) {

      throw new Error(

        data.message ||

        'Photo proof is unavailable.'

      );

    }

    proofUrl.value = data.photo_url;

  } catch (err) {

    proofError.value =

      err instanceof Error

        ? err.message

        : 'Failed to load photo proof.';

  } finally {

    proofLoading.value = null;

  }

}

/* ======================================*

*   NAVIGATION*

*====================================== */

// Use the exact saved attendance GPS coordinates when they are available.
function validAttendanceCoordinates(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude == null || longitude == null) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function openAttendancePin(latitude?: number | null, longitude?: number | null) {
  if (!validAttendanceCoordinates(latitude, longitude)) return;
  const lat = Number(latitude);
  const lng = Number(longitude);
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function goToTrack() {

  void router.push('/student/track');

}

function clearFilter() {

  selectedMonth.value = '';

  showAll.value = false;

}

/* ======================================*

*   IONIC LIFECYCLE*

*====================================== */

// Ionic can keep a tab page mounted.
// Reload whenever this page becomes active.
onIonViewWillEnter(() => {

  loadStudentName();

  closePhotoProof();

  showAll.value = false;

  void loadAttendance();

});

</script>

<template>

  <IonPage>

    <IonContent

      :fullscreen="true"

      class="attendance-content"

    >

      <InZoneTopbar role="STUDENT" />

      <main class="attendance-container">



        <header class="page-header">

          <div>

            <h1>My Attendance<span>.</span></h1>

            <p>

              View your daily attendance

              and OJT work history.

            </p>

          </div>

          <button

            type="button"

            class="refresh-button"

            :disabled="loading || refreshing"

            @click="refreshAttendance"

          >

            <IonIcon

              :icon="refreshOutline"

              :class="{

                spinning: loading || refreshing

              }"

            />

          </button>

        </header>



        <div

          v-if="error"

          class="notice error-notice"

          role="alert"

        >

          <IonIcon :icon="alertCircleOutline" />

          <span>{{ error }}</span>

        </div>



        <section class="attendance-hero">

          <div class="hero-top">

            <div>

              <span class="hero-eyebrow">

                TODAY'S ATTENDANCE

              </span>

              <h2>

                {{

                  loading

                    ? 'Loading attendance...'

                    : todayStatus

                }}

              </h2>

              <p>

                {{ formatDate(today) }}

              </p>

            </div>

            <div class="hero-symbol">

              <IonIcon

                :icon="calendarOutline"

              />

            </div>

          </div>

          <div class="hero-status">

            <span

              class="status-pill"

              :class="todayStatusClass"

            >

              <IonIcon

                :icon="

                  hasTimedOut

                    ? checkmarkCircleOutline

                    : timeOutline

                "

              />

              {{

                loading

                  ? 'LOADING'

                  : todayStatus.toUpperCase()

              }}

            </span>

          </div>

          <div class="hero-time-grid">

            <div class="hero-time-card">

              <div class="time-card-label">

                <IonIcon :icon="logInOutline" />

                TIME IN

              </div>

              <strong>

                {{

                  formatTime(

                    todayRecord?.time_in

                  )

                }}

              </strong>

            </div>

            <div class="hero-time-card">

              <div class="time-card-label">

                <IonIcon :icon="logOutOutline" />

                TIME OUT

              </div>

              <strong>

                {{

                  formatTime(

                    todayRecord?.time_out

                  )

                }}

              </strong>

            </div>

          </div>

          <div class="hero-bottom">

            <span>

              <IonIcon :icon="timerOutline" />

              Today's completed hours

            </span>

            <strong>

              {{ formatHours(todayHours) }}

            </strong>

          </div>

        </section>



        <section class="summary-grid">

          <div class="summary-card">

            <div class="summary-icon green">

              <IonIcon

                :icon="calendarNumberOutline"

              />

            </div>

            <span>Recorded Days</span>

            <strong>

              {{ loading ? '—' : recordedDays }}

            </strong>

            <small>Days with a Time In</small>

          </div>

          <div class="summary-card">

            <div class="summary-icon blue">

              <IonIcon

                :icon="checkmarkCircleOutline"

              />

            </div>

            <span>Completed Days</span>

            <strong>

              {{ loading ? '—' : completedDays }}

            </strong>

            <small>Time In and Time Out</small>

          </div>

          <div class="summary-card">

            <div class="summary-icon purple">

              <IonIcon

                :icon="timerOutline"

              />

            </div>

            <span>Total OJT Hours</span>

            <strong>

              {{

                loading

                  ? '—'

                  : formatHours(totalHours)

              }}

            </strong>

            <small>Recorded worked hours</small>

          </div>

        </section>



        <section class="track-link-card">

          <div class="track-link-icon">

            <IonIcon

              :icon="navigateOutline"

            />

          </div>

          <div class="track-link-info">

            <h3>

              Need to record attendance?

            </h3>

            <p>

              Visit Track to verify your

              workplace GPS and record

              your Time In or Time Out.

            </p>

          </div>

          <button

            type="button"

            class="track-button"

            @click="goToTrack"

          >

            <span>Go to Track</span>

            <IonIcon

              :icon="arrowForwardOutline"

            />

          </button>

        </section>



        <section class="history-card">

          <div class="section-heading">

            <div>

              <span class="section-eyebrow">

                DAILY LOGS

              </span>

              <h2>

                Attendance History

              </h2>

              <p>

                Review your recorded

                workdays and photo proofs.

              </p>

            </div>

            <div class="heading-icon">

              <IonIcon

                :icon="documentTextOutline"

              />

            </div>

          </div>

          <!-- MONTH FILTER -->
          <div class="filter-row">

            <div class="month-filter">

              <IonIcon

                :icon="calendarClearOutline"

              />

              <input

                v-model="selectedMonth"

                type="month"

                aria-label="Filter attendance by month"

                @change="showAll = false"

              />

            </div>

            <button

              v-if="selectedMonth"

              type="button"

              class="clear-filter"

              @click="clearFilter"

            >

              <IonIcon

                :icon="closeOutline"

              />

              Clear

            </button>

          </div>

          <div class="history-meta">

            <span>

              {{ currentMonthLabel }}

            </span>

            <strong>

              {{

                loading

                  ? '—'

                  : filteredAttendance.length

              }}

              records

            </strong>

          </div>

          <!-- LOADING STATE -->
          <div

            v-if="loading"

            class="empty-state"

          >

            <IonIcon

              :icon="refreshOutline"

              class="spinning"

            />

            <h3>

              Loading attendance

            </h3>

            <p>

              Retrieving records from InZone.

            </p>

          </div>

          <!-- ERROR STATE -->
          <div

            v-else-if="error && !attendance.length"

            class="empty-state"

          >

            <IonIcon

              :icon="alertCircleOutline"

            />

            <h3>

              Unable to load records

            </h3>

            <button

              class="retry-button"

              type="button"

              @click="refreshAttendance"

            >

              Try Again

            </button>

          </div>

          <!-- EMPTY STATE -->
          <div

            v-else-if="

              filteredAttendance.length === 0

            "

            class="empty-state"

          >

            <IonIcon

              :icon="calendarOutline"

            />

            <h3>

              No attendance records

            </h3>

            <p>

              {{

                selectedMonth

                  ? 'No attendance records were found for this month.'

                  : 'Your attendance history will appear here after your first successful Time In.'

              }}

            </p>

          </div>

          <!-- ATTENDANCE RECORDS -->
          <div

            v-else

            class="records-list"

          >

            <article

              v-for="record in visibleAttendance"

              :key="record.id"

              class="attendance-record"

            >

              <!-- RECORD HEADER -->
              <div class="record-header">

                <div class="record-date">

                  <div class="record-calendar">

                    <IonIcon

                      :icon="calendarOutline"

                    />

                  </div>

                  <div>

                    <h3>

                      {{

                        formatDate(

                          record.attendance_date

                        )

                      }}

                    </h3>

                    <p>

                      OJT Attendance Record

                    </p>

                  </div>

                </div>

                <span

                  class="record-status"

                  :class="

                    record.time_out

                      ? 'complete'

                      : 'in-progress'

                  "

                >

                  <IonIcon

                    :icon="

                      record.time_out

                        ? checkmarkCircleOutline

                        : timeOutline

                    "

                  />

                  {{

                    record.time_out

                      ? 'Completed'

                      : 'Checked In'

                  }}

                </span>

              </div>

              <!-- TIMES -->
              <div class="record-times">

                <div>

                  <span>

                    <IonIcon

                      :icon="logInOutline"

                    />

                    Time In

                  </span>

                  <strong>

                    {{

                      formatTime(

                        record.time_in

                      )

                    }}

                  </strong>

                </div>

                <div>

                  <span>

                    <IonIcon

                      :icon="logOutOutline"

                    />

                    Time Out

                  </span>

                  <strong>

                    {{

                      formatTime(

                        record.time_out

                      )

                    }}

                  </strong>

                </div>

                <div>

                  <span>

                    <IonIcon

                      :icon="timerOutline"

                    />

                    Hours Worked

                  </span>

                  <strong>

                    {{

                      record.time_out

                        ? formatHours(

                            recordHours(record)

                          )

                        : '—'

                    }}

                  </strong>

                </div>

              </div>

              <!-- RECORD FOOTER -->
              <div class="record-footer">

                <div class="verified-label">

                  <IonIcon

                    :icon="shieldCheckmarkOutline"

                  />

                  Geofence-validated record

                </div>
              <div class="attendance-map-actions">
                <button
                  v-if="validAttendanceCoordinates(record.latitude_in, record.longitude_in)"
                  type="button"
                  class="map-pin-button"
                  @click="openAttendancePin(record.latitude_in, record.longitude_in)"
                >
                  <IonIcon :icon="locationOutline" /> View Time-in Pin
                </button>
                <button
                  v-if="validAttendanceCoordinates(record.latitude_out, record.longitude_out)"
                  type="button"
                  class="map-pin-button"
                  @click="openAttendancePin(record.latitude_out, record.longitude_out)"
                >
                  <IonIcon :icon="locationOutline" /> View Time-out Pin
                </button>
              </div>

                <button

                  type="button"

                  class="proof-button"

                  :disabled="

                    proofLoading === record.id

                  "

                  @click="viewPhotoProof(record)"

                >

                  <IonIcon

                    :icon="

                      proofLoading === record.id

                        ? refreshOutline

                        : eyeOutline

                    "

                    :class="{

                      spinning:

                        proofLoading === record.id

                    }"

                  />

                  {{

                    proofLoading === record.id

                      ? 'Loading...'

                      : 'View Photo'

                  }}

                </button>

              </div>

            </article>

            <!-- SHOW MORE -->
            <button

              v-if="

                filteredAttendance.length > 6

              "

              type="button"

              class="show-more-button"

              @click="showAll = !showAll"

            >

              <IonIcon

                :icon="

                  showAll

                    ? chevronUpOutline

                    : chevronDownOutline

                "

              />

              {{

                showAll

                  ? 'Show Less'

                  : `View All ${filteredAttendance.length} Records`

              }}

            </button>

          </div>

        </section>



        <div class="security-note">

          <IonIcon

            :icon="shieldCheckmarkOutline"

          />

          <p>

            Your attendance records are

            retrieved from the InZone

            attendance system. Photo proofs

            are accessed using temporary,

            secure links.

          </p>

        </div>

      </main>



      <div

        v-if="proofRecord"

        class="proof-overlay"

        @click.self="closePhotoProof"

      >

        <section

          class="proof-modal"

          role="dialog"

          aria-modal="true"

          aria-labelledby="proof-title"

        >

          <div class="proof-modal-header">

            <div>

              <span>ATTENDANCE EVIDENCE</span>

              <h2 id="proof-title">

                Photo Proof

              </h2>

              <p>

                {{

                  formatDate(

                    proofRecord.attendance_date

                  )

                }}

              </p>

            </div>

            <button

              type="button"

              class="modal-close"

              aria-label="Close photo proof"

              @click="closePhotoProof"

            >

              <IonIcon

                :icon="closeOutline"

              />

            </button>

          </div>

          <div

            v-if="proofLoading !== null"

            class="proof-placeholder"

          >

            <IonIcon

              :icon="refreshOutline"

              class="spinning"

            />

            <p>Loading photo proof...</p>

          </div>

          <div

            v-else-if="proofError"

            class="proof-placeholder"

          >

            <IonIcon

              :icon="alertCircleOutline"

            />

            <p>

              {{ proofError }}

            </p>

          </div>

          <img

            v-else-if="proofUrl"

            :src="proofUrl"

            alt="OJT time-in photo proof"

            class="proof-image"

          />

          <div class="proof-modal-footer">

            <span>

              <IonIcon

                :icon="shieldCheckmarkOutline"

              />

              Secure photo access

            </span>

            <a

              v-if="proofUrl"

              :href="proofUrl"

              target="_blank"

              rel="noopener noreferrer"

              class="open-image"

            >

              <IonIcon

                :icon="imageOutline"

              />

              Open Image

            </a>

          </div>

        </section>

      </div>

    </IonContent>

    <StudentBottomNav />

  </IonPage>

</template>

<style scoped>

/* ======================================*

*   PAGE*

*====================================== */

.attendance-content {

  --background: #f3f8f5;

}

.attendance-container {

  max-width: 950px;

  margin: 0 auto;

  padding: 16px 18px

    calc(145px + env(safe-area-inset-bottom, 0px));

}

button {

  cursor: pointer;

  font-family: inherit;

}

button:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}

/* ======================================*

*   HEADER*

*====================================== */

.page-header {

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 15px;

  margin-bottom: 23px;

}

.eyebrow,

.section-eyebrow {

  color: #0d966f;

  font-size: 10px;

  font-weight: 850;

  letter-spacing: 1.5px;

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

  width: 44px;

  height: 44px;

  border: 1px solid #d9e8de;

  border-radius: 13px;

  background: #ffffff;

  color: #0b835f;

  font-size: 21px;

  display: grid;

  place-items: center;

}

/* ======================================*

*   NOTICES*

*====================================== */

.notice {

  display: flex;

  align-items: flex-start;

  gap: 10px;

  margin-bottom: 18px;

  padding: 13px;

  border-radius: 12px;

  font-size: 12px;

  line-height: 1.6;

}

.notice ion-icon {

  font-size: 20px;

  flex-shrink: 0;

}

.error-notice {

  background: #fff0ec;

  color: #ae4237;

}

/* ======================================*

*   TODAY HERO*

*====================================== */

.attendance-hero {

  position: relative;

  overflow: hidden;

  border-radius: 23px;

  background:

    radial-gradient(

      circle at 100% 0%,

      #29ae8055,

      transparent 45%

    ),

    linear-gradient(

      120deg,

      #0b805e,

      #084d3c

    );

  color: #ffffff;

  padding: 26px;

  box-shadow:

    0 14px 30px rgba(8, 91, 61, 0.15);

}

.hero-top {

  display: flex;

  justify-content: space-between;

  gap: 15px;

  align-items: flex-start;

}

.hero-eyebrow {

  color: #bfead4;

  font-size: 10px;

  font-weight: 800;

  letter-spacing: 1.4px;

}

.hero-top h2 {

  font-size: 28px;

  font-weight: 850;

  margin: 9px 0;

  letter-spacing: -0.6px;

}

.hero-top p {

  color: #d2eadd;

  font-size: 12px;

  margin: 0;

}

.hero-symbol {

  width: 57px;

  height: 57px;

  border-radius: 17px;

  background: #ffffff21;

  display: grid;

  place-items: center;

  font-size: 28px;

}

.hero-status {

  margin-top: 20px;

}

.status-pill {

  display: inline-flex;

  align-items: center;

  gap: 7px;

  padding: 8px 12px;

  border-radius: 30px;

  font-size: 10px;

  font-weight: 850;

  letter-spacing: 0.5px;

}

.status-pill.not-started {

  background: #ffffff25;

  color: #e6f5eb;

}

.status-pill.ongoing {

  background: #fff0c9;

  color: #916216;

}

.status-pill.completed {

  background: #c8f5d9;

  color: #076445;

}

.hero-time-grid {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 12px;

  margin-top: 22px;

}

.hero-time-card {

  border: 1px solid #ffffff22;

  background: #ffffff15;

  border-radius: 15px;

  padding: 18px;

}

.time-card-label {

  display: flex;

  gap: 7px;

  align-items: center;

  color: #c2e8d4;

  font-size: 10px;

  font-weight: 750;

  letter-spacing: 0.8px;

}

.time-card-label ion-icon {

  font-size: 17px;

}

.hero-time-card strong {

  display: block;

  margin-top: 12px;

  font-size: 22px;

  font-weight: 850;

}

.hero-bottom {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 12px;

  margin-top: 20px;

  padding-top: 17px;

  border-top: 1px solid #ffffff2b;

}

.hero-bottom span {

  display: flex;

  align-items: center;

  gap: 7px;

  color: #cbe8d8;

  font-size: 12px;

}

.hero-bottom strong {

  color: #ffffff;

  font-size: 15px;

}

/* ======================================*

*   SUMMARY CARDS*

*====================================== */

.summary-grid {

  display: grid;

  grid-template-columns:

    repeat(3, minmax(0, 1fr));

  gap: 13px;

  margin-top: 18px;

}

.summary-card {

  padding: 19px;

  border: 1px solid #e0ece3;

  border-radius: 17px;

  background: #ffffff;

  box-shadow:

    0 5px 20px rgba(13, 95, 66, 0.04);

}

.summary-icon {

  width: 45px;

  height: 45px;

  display: grid;

  place-items: center;

  border-radius: 13px;

  font-size: 23px;

}

.summary-icon.green {

  background: #e4f7ec;

  color: #0b855f;

}

.summary-icon.blue {

  background: #e7f2ff;

  color: #3177ae;

}

.summary-icon.purple {

  background: #f2edfd;

  color: #7255b2;

}

.summary-card > span {

  display: block;

  margin-top: 15px;

  font-size: 11px;

  color: #7b9384;

  font-weight: 700;

}

.summary-card > strong {

  display: block;

  margin-top: 8px;

  font-size: 23px;

  font-weight: 850;

  color: #19432f;

  overflow-wrap: anywhere;

}

.summary-card > small {

  display: block;

  margin-top: 6px;

  font-size: 10px;

  color: #99aa9e;

}

/* ======================================*

*   TRACK QUICK LINK*

*====================================== */

.track-link-card {

  display: flex;

  align-items: center;

  gap: 14px;

  margin-top: 19px;

  padding: 18px;

  border: 1px solid #d0e7d9;

  border-radius: 17px;

  background: #e8f5ec;

}

.track-link-icon {

  width: 46px;

  height: 46px;

  flex-shrink: 0;

  display: grid;

  place-items: center;

  border-radius: 13px;

  background: #d1ecda;

  color: #0a7a56;

  font-size: 23px;

}

.track-link-info {

  flex: 1;

  min-width: 0;

}

.track-link-info h3 {

  margin: 0 0 6px;

  font-size: 13px;

  color: #1b5638;

}

.track-link-info p {

  margin: 0;

  color: #748d7b;

  font-size: 11px;

  line-height: 1.6;

}

.track-button {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 7px;

  flex-shrink: 0;

  padding: 12px 14px;

  border: 0;

  border-radius: 11px;

  background: #0b7959;

  color: #ffffff;

  font-size: 11px;

  font-weight: 800;

}

/* ======================================*

*   HISTORY*

*====================================== */

.history-card {

  margin-top: 20px;

  padding: 23px;

  border: 1px solid #e0ece3;

  border-radius: 20px;

  background: #ffffff;

  box-shadow:

    0 5px 20px rgba(13, 95, 66, 0.04);

}

.section-heading {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 15px;

}

.section-heading h2 {

  margin: 7px 0;

  font-size: 20px;

  font-weight: 850;

  color: #193e30;

}

.section-heading p {

  margin: 0;

  color: #8b9d90;

  font-size: 12px;

  line-height: 1.6;

}

.heading-icon {

  width: 47px;

  height: 47px;

  flex-shrink: 0;

  display: grid;

  place-items: center;

  border-radius: 13px;

  background: #e7f6ed;

  color: #0b805d;

  font-size: 24px;

}

/* ======================================*

*   FILTER*

*====================================== */

.filter-row {

  display: flex;

  align-items: center;

  gap: 10px;

  margin-top: 24px;

}

.month-filter {

  display: flex;

  align-items: center;

  gap: 9px;

  min-height: 44px;

  padding: 0 13px;

  border: 1px solid #d7e6dc;

  border-radius: 11px;

  background: #f8fbf9;

  color: #0e8a65;

}

.month-filter input {

  width: 155px;

  max-width: 100%;

  border: 0;

  outline: 0;

  background: transparent;

  color: #25553c;

  font-family: inherit;

  font-size: 12px;

}

.clear-filter {

  display: flex;

  align-items: center;

  gap: 5px;

  padding: 10px;

  border: 0;

  background: transparent;

  color: #b14a42;

  font-size: 12px;

  font-weight: 750;

}

.history-meta {

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 10px;

  margin: 20px 0 13px;

}

.history-meta span {

  color: #85998a;

  font-size: 12px;

}

.history-meta strong {

  color: #0b7959;

  font-size: 12px;

}

/* ======================================*

*   ATTENDANCE RECORDS*

*====================================== */

.records-list {

  display: flex;

  flex-direction: column;

  gap: 13px;

}

.attendance-record {

  border: 1px solid #e0ebe3;

  border-radius: 15px;

  padding: 17px;

  background: #fbfdfb;

}

.record-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 12px;

}

.record-date {

  display: flex;

  align-items: center;

  gap: 11px;

  min-width: 0;

}

.record-calendar {

  width: 42px;

  height: 42px;

  flex-shrink: 0;

  display: grid;

  place-items: center;

  background: #e6f6ed;

  border-radius: 11px;

  color: #0b855d;

  font-size: 21px;

}

.record-date h3 {

  margin: 0 0 5px;

  color: #25503a;

  font-size: 13px;

}

.record-date p {

  margin: 0;

  color: #90a296;

  font-size: 10px;

}

.record-status {

  display: inline-flex;

  align-items: center;

  gap: 5px;

  flex-shrink: 0;

  border-radius: 30px;

  padding: 7px 10px;

  font-size: 10px;

  font-weight: 800;

}

.record-status.complete {

  background: #ddf5e6;

  color: #088157;

}

.record-status.in-progress {

  background: #fff1d8;

  color: #a77523;

}

.record-times {

  display: grid;

  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 11px;

  margin-top: 17px;

}

.record-times > div {

  padding: 12px;

  background: #f1f7f3;

  border-radius: 10px;

}

.record-times span {

  display: flex;

  align-items: center;

  gap: 5px;

  color: #879c8c;

  font-size: 10px;

}

.record-times strong {

  display: block;

  margin-top: 8px;

  font-size: 12px;

  color: #28523b;

}

.record-footer {

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 12px;

  padding-top: 15px;

  margin-top: 15px;

  border-top: 1px solid #e2ece5;

}

.verified-label {

  display: flex;

  align-items: center;

  gap: 6px;

  color: #829b8b;

  font-size: 10px;

}

.verified-label ion-icon {

  color: #0b956c;

  font-size: 16px;

}

.proof-button {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 7px;

  padding: 10px 12px;

  background: #e2f3e9;

  border: 0;

  border-radius: 10px;

  color: #087e58;

  font-size: 11px;

  font-weight: 800;

}

.show-more-button {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 8px;

  width: 100%;

  padding: 14px;

  background: transparent;

  border: 0;

  color: #0b8964;

  font-weight: 750;

  font-size: 12px;

}

/* ======================================*

*   EMPTY STATE*

*====================================== */

.empty-state {

  display: flex;

  flex-direction: column;

  align-items: center;

  text-align: center;

  padding: 40px 15px;

}

.empty-state > ion-icon {

  font-size: 39px;

  color: #8cbba0;

}

.empty-state h3 {

  margin: 16px 0 8px;

  color: #365a42;

  font-size: 15px;

}

.empty-state p {

  margin: 0;

  max-width: 300px;

  color: #8b9e90;

  font-size: 12px;

  line-height: 1.7;

}

.retry-button {

  margin-top: 14px;

  border: 0;

  border-radius: 10px;

  padding: 11px 18px;

  background: #0b7959;

  color: #ffffff;

  font-size: 12px;

  font-weight: 800;

}

/* ======================================*

*   SECURITY NOTE*

*====================================== */

.security-note {

  display: flex;

  gap: 10px;

  padding: 15px;

  margin-top: 19px;

  border-radius: 12px;

  background: #e7f3eb;

  color: #728e7d;

}

.security-note ion-icon {

  flex-shrink: 0;

  font-size: 21px;

}

.security-note p {

  margin: 0;

  font-size: 11px;

  line-height: 1.7;

}

/* ======================================*

*   PHOTO PROOF MODAL*

*====================================== */

.proof-overlay {

  position: fixed;

  inset: 0;

  z-index: 5000;

  display: grid;

  place-items: center;

  padding: 18px;

  background: rgba(15, 34, 25, 0.65);

}

.proof-modal {

  width: min(100%, 500px);

  max-height: 85vh;

  overflow-y: auto;

  padding: 20px;

  background: #ffffff;

  border-radius: 19px;

  box-shadow:

    0 20px 55px rgba(0, 0, 0, 0.17);

}

.proof-modal-header {

  display: flex;

  justify-content: space-between;

  align-items: flex-start;

  gap: 15px;

  margin-bottom: 18px;

}

.proof-modal-header span {

  color: #0c9b70;

  font-size: 10px;

  font-weight: 850;

  letter-spacing: 1px;

}

.proof-modal-header h2 {

  margin: 7px 0;

  color: #174632;

  font-size: 21px;

}

.proof-modal-header p {

  margin: 0;

  color: #81988a;

  font-size: 12px;

}

.modal-close {

  width: 35px;

  height: 35px;

  border: 0;

  border-radius: 10px;

  background: #edf3ee;

  color: #55715f;

  font-size: 20px;

}

.proof-placeholder {

  min-height: 190px;

  display: grid;

  place-content: center;

  justify-items: center;

  gap: 10px;

  color: #83998a;

  text-align: center;

}

.proof-placeholder ion-icon {

  font-size: 35px;

}

.proof-placeholder p {

  font-size: 12px;

}

.proof-image {

  display: block;

  width: 100%;

  max-height: 55vh;

  object-fit: contain;

  border-radius: 12px;

  background: #f1f6f2;

}

.proof-modal-footer {

  display: flex;

  align-items: center;

  justify-content: space-between;

  flex-wrap: wrap;

  gap: 12px;

  margin-top: 18px;

}

.proof-modal-footer span,

.open-image {

  display: inline-flex;

  align-items: center;

  gap: 7px;

  font-size: 11px;

}

.proof-modal-footer span {

  color: #81978a;

}

.open-image {

  padding: 10px 13px;

  border-radius: 9px;

  background: #e4f5ec;

  color: #0b7959;

  text-decoration: none;

  font-weight: 800;

}

/* ======================================*

*   ANIMATIONS*

*====================================== */

.spinning {

  animation: spin 1s linear infinite;

}

@keyframes spin {

  to {

    transform: rotate(360deg);

  }

}

/* ======================================*

*   MOBILE RESPONSIVE*

*====================================== */

@media (max-width: 680px) {

  .attendance-container {

    padding-left: 15px;

    padding-right: 15px;

  }

  .attendance-hero {

    padding: 22px 18px;

  }

  .hero-top h2 {

    font-size: 24px;

  }

  .hero-time-card {

    padding: 13px;

  }

  .hero-time-card strong {

    font-size: 17px;

  }

  .summary-grid {

    grid-template-columns:

      repeat(2, minmax(0, 1fr));

    gap: 10px;

  }

  .summary-card {

    padding: 15px;

  }

  .summary-card > strong {

    font-size: 19px;

  }

  .summary-card:last-child {

    grid-column: 1 / -1;

  }

  .track-link-card {

    flex-wrap: wrap;

  }

  .track-button {

    width: 100%;

  }

  .history-card {

    padding: 17px;

  }

  .record-times {

    grid-template-columns:

      repeat(2, minmax(0, 1fr));

  }

  .record-times > div:last-child {

    grid-column: 1 / -1;

  }

}

@media (max-width: 390px) {

  .page-header h1 {

    font-size: 24px;

  }

  .record-header {

    flex-wrap: wrap;

  }

  .record-footer {

    flex-direction: column;

    align-items: stretch;

  }

  .proof-button {

    width: 100%;

  }

  .summary-card > strong {

    font-size: 17px;

  }

}

@media (prefers-reduced-motion: reduce) {

  .spinning {

    animation: none;

  }

}

.record-footer { flex-wrap: wrap; }
.attendance-map-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.map-pin-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: 1px solid #cfe5d6; border-radius: 10px; background: #eff9f3; color: #0a7957; font-size: 11px; font-weight: 800; cursor: pointer; }
.map-pin-button:hover { background: #e0f3e7; }
</style>
