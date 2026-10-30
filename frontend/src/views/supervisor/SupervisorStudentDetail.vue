<script setup lang="ts">
// =====================================
// SUPERVISOR: ONE STUDENT
// Hours progress, workplace, attendance history and weekly reports.
// API: GET /api/supervisor/students/:studentId
// =====================================
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  arrowBackOutline,
  alertCircleOutline,
  refreshOutline,
  mailOutline,
  businessOutline,
  mapOutline,
  calendarOutline,
  locateOutline,
  cameraOutline,
  timeOutline,
  documentTextOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import InZoneMapViewer from '@/components/InZoneMapViewer.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import SupervisorPhotoProof from './SupervisorPhotoProof.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  formatDate,
  formatTime,
  formatHours,
  formatWeek,
  hoursNumber,
  attendanceLabel,
  attendanceTone,
  reportStatus,
  reportLabel,
  reportTone,
  type SupervisedStudent,
  type StudentAttendance,
  type WeeklyReport,
  type Id,
} from './supervisorApi';

interface DetailResponse {
  date: string;
  student: SupervisedStudent;
  attendance: StudentAttendance[];
  reports: WeeklyReport[];
}

const route = useRoute();
const router = useRouter();

const detail = ref<DetailResponse | null>(null);
const loading = ref(false);
const error = ref('');
const tab = ref<'attendance' | 'reports'>('attendance');
const mapOpen = ref(false);
const photo = ref<{ id: Id; date: string } | null>(null);

const student = computed(() => detail.value?.student ?? null);
const studentId = computed(() => String(route.params.studentId || ''));

const coordinates = computed(() => {
  const lat = Number(student.value?.latitude);
  const lng = Number(student.value?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    ? { lat, lng }
    : null;
});

function weekday(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' }).format(date);
}

async function loadStudent() {
  if (loading.value || !studentId.value) return;
  loading.value = true;
  error.value = '';

  try {
    detail.value = await supervisorRequest<DetailResponse>(
      `/api/supervisor/students/${encodeURIComponent(studentId.value)}`
    );
  } catch (err) {
    detail.value = null;
    error.value = errorMessage(err, "Unable to load this student's details.");
  } finally {
    loading.value = false;
  }
}

function openReport(report: WeeklyReport) {
  void router.push({ path: '/supervisor/reports', query: { open: String(report.id) } });
}

onIonViewWillEnter(() => {
  // A different student may be opened from the list: reset first.
  if (detail.value && String(detail.value.student.id) !== studentId.value) {
    detail.value = null;
    tab.value = 'attendance';
  }
  void loadStudent();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell">
        <div class="topline">
          <button type="button" class="back" @click="router.push('/supervisor/students')">
            <IonIcon :icon="arrowBackOutline" /> My students
          </button>
          <button class="sv-refresh" type="button" :disabled="loading" @click="loadStudent">
            <IonIcon :icon="refreshOutline" :class="{ 'sv-spin': loading }" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </div>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadStudent">Try again</button>
        </div>

        <div v-if="loading && !student" class="loading-stack">
          <div class="sv-skeleton" style="height: 120px"></div>
          <div class="sv-skeleton" style="height: 260px"></div>
        </div>

        <template v-if="student && detail">
          <!-- WHO -->
          <header class="person">
            <span class="sv-avatar big">{{ initials(student) }}</span>
            <div class="person-text">
              <h1>{{ fullName(student) }}</h1>
              <p><IonIcon :icon="mailOutline" /> {{ student.email || 'No email' }}</p>
              <p><IonIcon :icon="businessOutline" /> {{ student.company_name || 'No company yet' }}</p>
            </div>
            <span v-if="student.approval_status !== 'APPROVED'" class="sv-pill waiting">
              Workplace {{ student.approval_status === 'REJECTED' ? 'rejected' : 'pending approval' }}
            </span>
            <span v-else class="sv-pill" :class="attendanceTone(student.today_status)">
              Today: {{ attendanceLabel(student.today_status) }}
            </span>
          </header>

          <div class="overview">
            <!-- HOURS -->
            <section class="sv-card hours-card">
              <h2>OJT hours</h2>
              <p class="hours-big">
                <strong>{{ hoursNumber(student.hours_rendered) }}</strong>
                <span>of {{ student.required_hours || '—' }} required</span>
              </p>
              <div class="sv-progress" aria-hidden="true">
                <span :style="{ width: `${student.progress_percent}%` }"></span>
              </div>
              <dl class="hours-facts">
                <div><dt>Remaining</dt><dd>{{ hoursNumber(student.remaining_hours) }} h</dd></div>
                <div><dt>Days present</dt><dd>{{ student.days_present }}</dd></div>
                <div><dt>Complete</dt><dd>{{ student.progress_percent }}%</dd></div>
              </dl>
            </section>

            <!-- WORKPLACE -->
            <section class="sv-card place-card">
              <h2>Workplace</h2>
              <ul class="facts">
                <li>
                  <IonIcon :icon="mapOutline" />
                  <span>{{ student.company_address || 'No address on file' }}</span>
                </li>
                <li>
                  <IonIcon :icon="calendarOutline" />
                  <span>{{ formatDate(student.start_date) }} to {{ formatDate(student.end_date) }}</span>
                </li>
                <li>
                  <IonIcon :icon="locateOutline" />
                  <span>
                    {{ student.radius_meters ? `Time-in allowed within ${student.radius_meters} m` : 'No geofence set' }}
                  </span>
                </li>
              </ul>
              <button
                type="button"
                class="sv-btn soft map-btn"
                :disabled="!coordinates"
                @click="mapOpen = true"
              >
                <IonIcon :icon="mapOutline" /> View geofence on map
              </button>
            </section>
          </div>

          <!-- HISTORY -->
          <section class="sv-card">
            <div class="sv-tabs history-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                :aria-selected="tab === 'attendance'"
                :class="{ 'is-active': tab === 'attendance' }"
                @click="tab = 'attendance'"
              >
                <IonIcon :icon="timeOutline" /> Attendance <span class="count">{{ detail.attendance.length }}</span>
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="tab === 'reports'"
                :class="{ 'is-active': tab === 'reports' }"
                @click="tab = 'reports'"
              >
                <IonIcon :icon="documentTextOutline" /> Weekly reports <span class="count">{{ detail.reports.length }}</span>
              </button>
            </div>

            <!-- Attendance -->
            <template v-if="tab === 'attendance'">
              <div v-if="!detail.attendance.length" class="sv-empty">
                <IonIcon :icon="timeOutline" />
                <h3>No attendance yet</h3>
                <p>Time-ins appear here once the student starts reporting to the workplace.</p>
              </div>

              <ul v-else class="days">
                <li v-for="day in detail.attendance" :key="day.id" class="day" :class="attendanceTone(day.status)">
                  <span class="day-date">
                    <strong>{{ formatDate(day.attendance_date, false) }}</strong>
                    <small>{{ weekday(day.attendance_date) }}</small>
                  </span>
                  <span class="day-times">
                    <span>
                      {{ day.time_out
                        ? `${formatTime(day.time_in)} – ${formatTime(day.time_out)}`
                        : `In at ${formatTime(day.time_in)}` }}
                    </span>
                    <small>{{ day.status === 'COMPLETE' ? formatHours(day.hours_worked) : attendanceLabel(day.status) }}</small>
                  </span>
                  <span class="sv-pill" :class="attendanceTone(day.status)">{{ attendanceLabel(day.status) }}</span>
                  <button
                    v-if="day.has_photo_proof"
                    type="button"
                    class="photo-btn"
                    :aria-label="`View time-in photo for ${formatDate(day.attendance_date)}`"
                    @click="photo = { id: day.id, date: day.attendance_date }"
                  >
                    <IonIcon :icon="cameraOutline" />
                  </button>
                  <span v-else class="photo-btn is-empty" aria-hidden="true"></span>
                </li>
              </ul>
            </template>

            <!-- Reports -->
            <template v-else>
              <div v-if="!detail.reports.length" class="sv-empty">
                <IonIcon :icon="documentTextOutline" />
                <h3>No weekly reports yet</h3>
                <p>Reports this student submits will appear here.</p>
              </div>

              <ul v-else class="reports">
                <li v-for="report in detail.reports" :key="report.id">
                  <button type="button" class="report-row" @click="openReport(report)">
                    <span class="report-top">
                      <strong>Week of {{ formatWeek(report.week_start, report.week_end) }}</strong>
                      <span class="sv-pill" :class="reportTone(reportStatus(report))">
                        {{ reportLabel(reportStatus(report)) }}
                      </span>
                    </span>
                    <span class="snippet">{{ report.report || 'No report text.' }}</span>
                    <span v-if="report.supervisor_comment" class="comment">
                      Comment: {{ report.supervisor_comment }}
                    </span>
                  </button>
                </li>
              </ul>
            </template>
          </section>
        </template>
      </main>
    </IonContent>

    <SupervisorBottomNav />

    <InZoneMapViewer
      v-if="student"
      :is-open="mapOpen"
      :title="student.company_name || 'OJT workplace'"
      :latitude="coordinates?.lat ?? null"
      :longitude="coordinates?.lng ?? null"
      :radius-meters="Number(student.radius_meters) || null"
      :address="student.company_address || ''"
      @close="mapOpen = false"
    />

    <SupervisorPhotoProof
      :attendance-id="photo?.id ?? null"
      :title="student ? fullName(student) : 'Time-in photo'"
      :subtitle="photo ? `Time-in photo · ${formatDate(photo.date)}` : ''"
      @close="photo = null"
    />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--sv-primary);
  font-size: 14px;
  font-weight: 800;
}

.back ion-icon {
  font-size: 19px;
}

.loading-stack {
  display: grid;
  gap: 14px;
}

/* ---------- person ---------- */
.person {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.sv-avatar.big {
  width: 62px;
  height: 62px;
  border-radius: 19px;
  font-size: 20px;
}

.person-text {
  flex: 1;
  min-width: 0;
}

.person-text h1 {
  margin: 0 0 5px;
  font-size: clamp(24px, 4vw, 32px);
  letter-spacing: -0.7px;
  color: var(--sv-ink);
  overflow-wrap: anywhere;
}

.person-text p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0 0;
  color: var(--sv-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* ---------- overview ---------- */
.overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.overview h2 {
  margin: 0 0 12px;
  font-size: 15px;
  color: var(--sv-ink);
}

.hours-big {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--sv-muted);
  font-size: 14px;
}

.hours-big strong {
  color: var(--sv-ink);
  font-size: 40px;
  letter-spacing: -1.2px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.hours-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0 0;
}

.hours-facts div {
  padding: 10px;
  border-radius: 12px;
  background: #f5faf7;
}

.hours-facts dt {
  font-size: 11px;
  color: var(--sv-muted);
}

.hours-facts dd {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--sv-ink);
}

.facts {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.facts li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: var(--sv-ink-soft);
  font-size: 13px;
  line-height: 1.5;
}

.facts ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--sv-primary);
  font-size: 17px;
}

.map-btn {
  width: 100%;
}

/* ---------- history ---------- */
.history-tabs {
  margin-bottom: 14px;
}

.days,
.reports {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.day {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid #edf3ef;
}

.day:last-child {
  border-bottom: 0;
}

.day-date,
.day-times {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.day-date strong,
.day-times span {
  color: var(--sv-ink);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.day-date small,
.day-times small {
  margin-top: 2px;
  color: var(--sv-muted);
  font-size: 12px;
}

.day.alert .day-times small {
  color: var(--sv-alert);
  font-weight: 700;
}

.photo-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 11px;
  background: var(--sv-primary-soft);
  color: var(--sv-primary);
  font-size: 18px;
}

.photo-btn.is-empty {
  background: transparent;
}

.reports {
  gap: 9px;
}

.report-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  padding: 14px 15px;
  border: 1px solid #e6efe9;
  border-radius: 14px;
  background: #fcfefd;
  text-align: left;
}

.report-row:hover {
  border-color: #c7e2d2;
}

.report-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.report-top strong {
  color: var(--sv-ink);
  font-size: 14px;
}

.snippet {
  color: var(--sv-ink-soft);
  font-size: 13px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.comment {
  color: var(--sv-waiting);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 760px) {
  .overview {
    grid-template-columns: 1fr;
  }

  .person {
    flex-wrap: wrap;
    row-gap: 12px;
  }

  /* Name gets the full width; status goes on its own line below */
  .person-text {
    flex: 1 1 calc(100% - 80px);
  }

  .person > .sv-pill {
    margin-left: 78px;
  }
}

@media (max-width: 480px) {
  .day {
    grid-template-columns: 62px minmax(0, 1fr) 40px;
  }

  .day > .sv-pill {
    display: none;
  }

  .report-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>
