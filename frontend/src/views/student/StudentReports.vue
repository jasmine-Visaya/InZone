<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';

import StudentBottomNav from './StudentBottomNav.vue';
import InZoneTopbar from '@/components/InZoneTopbar.vue';
import WeeklyReportData from '@/components/WeeklyReportData.vue';
import { type WeekSummary, isWeekSummary } from '@/utils/weeklySummary';

import {
  refreshOutline, alertCircleOutline,
  documentTextOutline, calendarOutline, chevronDownOutline,
  chatbubbleEllipsesOutline, imagesOutline, addOutline,
  lockClosedOutline,
} from 'ionicons/icons';

/* =====================================
   CONFIGURATION
===================================== */


const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

interface OjtProfile {
  company_name?: string;
  company_address?: string;
  required_hours?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  approval_status?: ApprovalStatus;
}

interface AttendanceRecord {
  id: number | string;
  accomplishment_text?: string | null;
  accomplishment_uploaded_at?: string | null;
  accomplishment_photo_path?: string | null;
  review_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  supervisor_comment?: string | null;
  reviewed_at?: string | null;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  seconds_worked?: number | string | null;
  hours_worked?: number | string | null;
}

/* =====================================
   STATE
===================================== */

const loading = ref(true);
const refreshing = ref(false);

const error = ref('');
const profile = ref<OjtProfile | null>(null);
const attendance = ref<AttendanceRecord[]>([]);
const totalHours = ref<number | null>(null);

const activeReportTab = ref<'daily' | 'weekly'>('daily');
const dailyFilter = ref<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNKNOWN'>('ALL');
const dailySearch = ref('');
const dailyExpanded = ref<string | null>(null);
const weeklyExpanded = ref<string | null>(null);
const showWeeklyForm = ref(false);

interface DailyPhoto {
  path: string;
  photo_url: string;
}
interface DailyPhotoRecord {
  attendance_id: string;
  attendance_date: string;
  accomplishment_text: string | null;
  photos: DailyPhoto[];
}
interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  report: string;
  selected_photo_paths: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  supervisor_comment?: string | null;
  summary?: WeekSummary | null;
}

const phParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date());
const phDatePart = (type: string) => phParts.find(part => part.type === type)?.value || '';
const todayPH = `${phDatePart('year')}-${phDatePart('month')}-${phDatePart('day')}`;
const selectedWeekDate = ref(todayPH);
const weekStart = computed(() => mondayOf(selectedWeekDate.value));
const weekEnd = computed(() => {
  const date = parseDay(weekStart.value);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
});
const dailyPhotoRecords = ref<DailyPhotoRecord[]>([]);
const selectedPhotoPaths = ref<string[]>([]);
const weeklyDescription = ref('');
const weeklyReports = ref<WeeklyReport[]>([]);
const weeklyLoading = ref(false);
const weeklySubmitting = ref(false);
const weeklyError = ref('');
const weeklySuccess = ref('');
// Hours / OT / attendance data for the selected week + unlock status
const weekPreview = ref<WeekSummary | null>(null);
const canSubmitWeek = computed(() => Boolean(weekPreview.value?.can_submit));
const availablePhotoCount = computed(() =>
  dailyPhotoRecords.value.reduce((sum, item) => sum + item.photos.length, 0)
);
const existingWeekReport = computed(() =>
  weeklyReports.value.find(item =>
    dateKey(item.week_start) === weekStart.value &&
    dateKey(item.week_end) === weekEnd.value
  )
);


/* =====================================
   HELPERS
===================================== */

function getToken(): string {
  return sessionStorage.getItem('inzone_token') || '';
}

async function apiRequest(path: string): Promise<any> {
  const token = getToken();

  if (!token) {
    throw new Error('Please log in again.');
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
      `Unable to load data (${response.status}).`
    );
  }

  return data;
}

async function apiPost(path: string, body: unknown): Promise<any> {
  const token = getToken();
  if (!token) throw new Error('Please log in again.');
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Unable to submit report (${response.status}).`);
  }
  return data;
}

function dateKey(value?: string | null): string {
  return value?.slice(0, 10) || '';
}

function parseDay(value: string): Date {
  const [year, month, day] =
    value.slice(0, 10).split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDay(value?: string | null): string {
  if (!value) return 'Not set';

  const date = parseDay(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function mondayOf(value: string): string {
  const date = parseDay(value);
  const weekday = date.getUTCDay();
  const offset = (weekday + 6) % 7;

  date.setUTCDate(date.getUTCDate() - offset);

  return date.toISOString().slice(0, 10);
}

function hoursFor(record: AttendanceRecord): number {
  if (!record.time_in || !record.time_out) return 0;

  if (
    record.seconds_worked !== undefined &&
    record.seconds_worked !== null
  ) {
    const seconds = Number(record.seconds_worked);
    return Number.isFinite(seconds)
      ? Math.max(0, seconds / 3600)
      : 0;
  }

  if (
    record.hours_worked !== undefined &&
    record.hours_worked !== null
  ) {
    const hours = Number(record.hours_worked);
    return Number.isFinite(hours)
      ? Math.max(0, hours)
      : 0;
  }

  const start = new Date(record.time_in).getTime();
  const end = new Date(record.time_out).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, (end - start) / 3600000);
}

function formatHours(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : `${value.toFixed(2)} hrs`;
}

/* =====================================
   DATA LOADING
===================================== */

async function loadReport() {
  if (refreshing.value) return;

  refreshing.value = true;
  loading.value = true;
  error.value = '';

  try {
    const results = await Promise.allSettled([
      apiRequest('/api/ojt/profile'),
      apiRequest('/api/attendance/my-history'),
    ]);

    const [profileResult, attendanceResult] = results;

    if (profileResult.status === 'fulfilled') {
      const data = profileResult.value;

      profile.value =
        data.profile ??
        data.data?.profile ??
        null;
    } else {
      profile.value = null;
    }

    if (attendanceResult.status === 'fulfilled') {
      const data = attendanceResult.value;

      const records =
        data.attendance ??
        data.data?.attendance;

      if (!Array.isArray(records)) {
        throw new Error(
          'Invalid attendance history response.'
        );
      }

      attendance.value = [...records].sort(
        (a, b) =>
          dateKey(b.attendance_date).localeCompare(
            dateKey(a.attendance_date)
          )
      );

      const hours = Number(data.total_hours);

      totalHours.value =
        data.total_hours != null &&
        Number.isFinite(hours)
          ? Math.max(0, hours)
          : attendance.value.reduce(
              (sum, item) => sum + hoursFor(item),
              0
            );
    } else {
      attendance.value = [];
      totalHours.value = null;
    }

    if (
      profileResult.status === 'rejected' ||
      attendanceResult.status === 'rejected'
    ) {
      const messages: string[] = [];

      if (profileResult.status === 'rejected') {
        messages.push('OJT profile could not be loaded.');
      }

      if (attendanceResult.status === 'rejected') {
        messages.push('Attendance records could not be loaded.');
      }

      error.value = messages.join(' ');
    }
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to load report.';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

/* =====================================
   WEEKLY ACCOMPLISHMENT REPORT
===================================== */
async function loadWeeklyReports() {
  try {
    const data = await apiRequest('/api/weekly-reports/my-reports');
    weeklyReports.value = Array.isArray(data.reports) ? data.reports : [];
  } catch (err) {
    weeklyError.value = err instanceof Error ? err.message : 'Unable to load weekly reports.';
  }
}

async function loadWeekPhotos() {
  weeklyLoading.value = true;
  weeklyError.value = '';
  weeklySuccess.value = '';
  dailyPhotoRecords.value = [];
  selectedPhotoPaths.value = [];
  weekPreview.value = null;
  try {
    const params = new URLSearchParams({
      week_start: weekStart.value,
      week_end: weekEnd.value,
    });
    const [photoData, previewData] = await Promise.all([
      apiRequest(`/api/attendance/accomplishment-photos?${params}`),
      apiRequest(`/api/weekly-reports/preview?date=${weekStart.value}`),
    ]);
    dailyPhotoRecords.value = Array.isArray(photoData.records) ? photoData.records : [];
    weekPreview.value = isWeekSummary(previewData.summary) ? previewData.summary : null;
    // Pre-fill the description with this week's daily accomplishments.
    if (!weeklyDescription.value.trim()) useDailyAccomplishments();
  } catch (err) {
    weeklyError.value = err instanceof Error ? err.message : 'Unable to load daily photos.';
  } finally {
    weeklyLoading.value = false;
  }
}

async function changeReportWeek() {
  weeklyDescription.value = '';
  await loadWeekPhotos();
}

function useDailyAccomplishments() {
  const text = weekPreview.value?.suggested_report?.trim();
  if (text) weeklyDescription.value = text.slice(0, 10000);
}

function toggleWeeklyPhoto(path: string) {
  selectedPhotoPaths.value = selectedPhotoPaths.value.includes(path)
    ? selectedPhotoPaths.value.filter(item => item !== path)
    : [...selectedPhotoPaths.value, path];
}

async function submitWeeklyAccomplishment() {
  if (weeklySubmitting.value || existingWeekReport.value) return;
  weeklyError.value = '';
  if (!canSubmitWeek.value) {
    weeklyError.value = weekPreview.value?.lock_reason || 'This week is not finished yet.';
    return;
  }
  weeklySuccess.value = '';
  if (!weeklyDescription.value.trim()) {
    weeklyError.value = 'Please enter your weekly accomplishment description.';
    return;
  }
  if (selectedPhotoPaths.value.length === 0) {
    weeklyError.value = 'Please select at least one existing daily photo.';
    return;
  }
  weeklySubmitting.value = true;
  try {
    await apiPost('/api/weekly-reports/submit', {
      week_start: weekStart.value,
      week_end: weekEnd.value,
      report: weeklyDescription.value.trim(),
      selected_photo_paths: selectedPhotoPaths.value,
    });
    weeklySuccess.value = 'Weekly report submitted! Waiting for supervisor review.';
    weeklyDescription.value = '';
    selectedPhotoPaths.value = [];
    await loadWeeklyReports();
    await loadWeekPhotos();
  } catch (err) {
    weeklyError.value = err instanceof Error ? err.message : 'Unable to submit weekly report.';
  } finally {
    weeklySubmitting.value = false;
  }
}


const dailyReports = computed(() => attendance.value.filter(item =>
  Boolean(item.accomplishment_uploaded_at || item.accomplishment_photo_path || item.accomplishment_text)
));
function dailyStatus(item: AttendanceRecord): 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNKNOWN' {
  const status = String(item.review_status ?? '').toUpperCase();
  if (status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING') return status;
  return 'UNKNOWN';
}
const filteredDailyReports = computed(() => dailyReports.value.filter(item => {
  if (dailyFilter.value !== 'ALL' && dailyStatus(item) !== dailyFilter.value) return false;
  const search = dailySearch.value.trim().toLowerCase();
  return !search || [formatDay(item.attendance_date), item.attendance_date, item.accomplishment_text, item.supervisor_comment]
    .some(value => String(value || '').toLowerCase().includes(search));
}));
const dailyPendingCount = computed(() => dailyReports.value.filter(item => dailyStatus(item) === 'PENDING').length);
const dailyReviewedCount = computed(() => dailyReports.value.filter(item => ['APPROVED', 'REJECTED'].includes(dailyStatus(item))).length);
function toggleDaily(id: string | number) { const key = String(id); dailyExpanded.value = dailyExpanded.value === key ? null : key; }
function toggleWeekly(id: string | number) { const key = String(id); weeklyExpanded.value = weeklyExpanded.value === key ? null : key; }
async function refreshAll() {
  await Promise.all([loadReport(), loadWeeklyReports(), loadWeekPhotos()]);
}

/* =====================================
   OVERALL METRICS
===================================== */

const requiredHours = computed(() => {
  const value = Number(profile.value?.required_hours);

  return value > 0 && Number.isFinite(value)
    ? value
    : null;
});

const completedHours = computed(() => totalHours.value);

const remainingHours = computed(() => {
  if (
    requiredHours.value === null ||
    completedHours.value === null
  ) {
    return null;
  }

  return Math.max(
    0,
    requiredHours.value - completedHours.value
  );
});

const progressPercent = computed(() => {
  if (
    requiredHours.value === null ||
    completedHours.value === null
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (completedHours.value / requiredHours.value) * 100
    )
  );
});

onIonViewWillEnter(() => {
  void refreshAll();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="reports-content">
      <InZoneTopbar role="STUDENT" />
      <main class="reports-container">
        <header class="page-header">
          <div class="header-copy"><span class="page-kicker">STUDENT REPORT CENTER</span><h1>My OJT Reports<span>.</span></h1><p>View daily accomplishments, weekly submissions, and supervisor feedback.</p></div>
          <button class="refresh-button" type="button" :disabled="refreshing" aria-label="Refresh all reports" @click="refreshAll"><IonIcon :icon="refreshOutline" :class="{ spinning: refreshing }" /></button>
        </header>
        <div v-if="error" class="notice error" role="alert"><IonIcon :icon="alertCircleOutline" />{{ error }}</div>
        <section class="progress-strip">
          <div class="progress-main"><span><IonIcon :icon="documentTextOutline" /> TRAINING OVERVIEW</span><h2>Your OJT progress</h2><strong>{{ loading || progressPercent === null ? '—' : `${progressPercent.toFixed(1)}%` }}</strong><small>{{ profile?.company_name || 'Your OJT workplace' }}</small></div>
          <div class="progress-right"><div class="progress-metric"><span>HOURS COMPLETED</span><strong>{{ formatHours(completedHours) }}</strong></div><div class="progress-metric"><span>HOURS REMAINING</span><strong>{{ formatHours(remainingHours) }}</strong></div></div>
          <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent ?? 0" aria-valuemin="0" aria-valuemax="100" aria-label="OJT completion progress"><div class="progress-fill" :style="{ width: `${progressPercent ?? 0}%` }"></div></div>
        </section>
        <section class="report-hub">
          <div class="hub-top"><div><span class="eyebrow">ACCOMPLISHMENT CENTER</span><h2>My report submissions</h2><p>Switch between daily and weekly reports to check reviews and feedback.</p></div><span class="hub-top-icon"><IonIcon :icon="documentTextOutline" /></span></div>
          <div class="hub-tabs" role="tablist" aria-label="Report type">
            <button type="button" role="tab" :aria-selected="activeReportTab === 'daily'" :class="{ active: activeReportTab === 'daily' }" @click="activeReportTab = 'daily'"><IonIcon :icon="calendarOutline" /> Daily reports <span>{{ dailyReports.length }}</span></button>
            <button type="button" role="tab" :aria-selected="activeReportTab === 'weekly'" :class="{ active: activeReportTab === 'weekly' }" @click="activeReportTab = 'weekly'"><IonIcon :icon="documentTextOutline" /> Weekly reports <span>{{ weeklyReports.length }}</span></button>
          </div>
          <div v-if="activeReportTab === 'daily'" class="tab-body">
            <div class="compact-summary"><div class="mini-stat"><span class="mini-stat-icon pending-icon"><IonIcon :icon="calendarOutline" /></span><span><small>AWAITING REVIEW</small><strong>{{ dailyPendingCount }}</strong></span></div><div class="mini-stat"><span class="mini-stat-icon reviewed-icon"><IonIcon :icon="chatbubbleEllipsesOutline" /></span><span><small>REVIEWED REPORTS</small><strong>{{ dailyReviewedCount }}</strong></span></div></div>
            <div class="filters"><select v-model="dailyFilter" aria-label="Filter daily report status"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="UNKNOWN">Status unavailable</option></select><input v-model="dailySearch" type="search" placeholder="Search date or feedback" aria-label="Search daily reports" /></div>
            <div v-if="loading" class="empty">Loading daily reports…</div>
            <div v-else-if="!filteredDailyReports.length" class="empty"><IonIcon :icon="documentTextOutline" /><strong>No daily reports found</strong><p>Submitted daily accomplishments and feedback will appear here.</p></div>
            <div v-else class="report-list">
              <article v-for="item in filteredDailyReports" :key="item.id" class="report-item">
                <button type="button" class="report-row" :aria-expanded="dailyExpanded === String(item.id)" @click="toggleDaily(item.id)">
                  <span class="report-icon"><IonIcon :icon="calendarOutline" /></span>
                  <span class="report-summary"><strong>{{ formatDay(item.attendance_date) }}</strong><small>{{ item.accomplishment_text ? item.accomplishment_text : 'Daily accomplishment submitted' }}</small></span>
                  <span class="status" :class="dailyStatus(item).toLowerCase()">{{ dailyStatus(item) === 'PENDING' ? 'To review' : dailyStatus(item) === 'UNKNOWN' ? 'Status unavailable' : dailyStatus(item) }}</span>
                  <IonIcon :icon="chevronDownOutline" class="chevron" :class="{ rotated: dailyExpanded === String(item.id) }" />
                </button>
                <div v-if="dailyExpanded === String(item.id)" class="report-details">
                  <div class="detail-grid"><div><span>Attendance date</span><strong>{{ formatDay(item.attendance_date) }}</strong></div><div><span>Hours worked</span><strong>{{ formatHours(hoursFor(item)) }}</strong></div></div>
                  <h3><IonIcon :icon="documentTextOutline" /> Daily accomplishment</h3><p class="detail-text">{{ item.accomplishment_text || 'No description available.' }}</p>
                  <h3><IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor feedback</h3>
                  <div v-if="dailyStatus(item) === 'PENDING'" class="feedback pending">Waiting for supervisor review.</div>
                  <div v-else-if="dailyStatus(item) === 'UNKNOWN'" class="feedback pending">Review status is not included in the attendance API response. Please update the backend.</div>
                   <div v-else class="feedback" :class="dailyStatus(item).toLowerCase()"><p>{{ item.supervisor_comment || 'Reviewed without additional comment.' }}</p><small v-if="item.reviewed_at">Reviewed {{ new Date(item.reviewed_at).toLocaleString('en-PH') }}</small></div>
                </div>
              </article>
            </div>
          </div>
          <div v-else class="tab-body">
            <div class="weekly-toolbar"><p>Track weekly review status and submit a report for a new week.</p><button type="button" class="new-report" @click="showWeeklyForm = !showWeeklyForm"><IonIcon :icon="showWeeklyForm ? chevronDownOutline : addOutline" />{{ showWeeklyForm ? 'Hide form' : 'Create weekly report' }}</button></div>
            <section v-if="showWeeklyForm" class="weekly-form">
              <h3>Create weekly report</h3>
              <label for="weekly-date">Select a date within the week</label><input id="weekly-date" v-model="selectedWeekDate" type="date" @change="changeReportWeek" />
              <p class="muted">Reporting period: <strong>{{ formatDay(weekStart) }} – {{ formatDay(weekEnd) }}</strong></p>
              <div v-if="weeklyError" class="notice error" role="alert">{{ weeklyError }}</div><div v-if="weeklySuccess" class="notice success" role="status">{{ weeklySuccess }}</div>
              <div v-if="existingWeekReport" class="notice info">A report has already been submitted for this week. <strong>{{ existingWeekReport.status }}</strong></div>
              <div v-else-if="weekPreview && !weekPreview.can_submit" class="notice lock" role="status"><IonIcon :icon="lockClosedOutline" />{{ weekPreview.lock_reason || 'This week is not finished yet.' }}</div>
              <div class="photo-heading"><strong>This week's hours and attendance</strong><span v-if="weekPreview?.holidays.length">Holidays: {{ weekPreview.holidays.map(h => h.name).join(', ') }}</span></div>
              <p v-if="weeklyLoading" class="muted">Loading this week's data…</p>
              <WeeklyReportData v-else-if="weekPreview" :summary="weekPreview" />
              <div class="photo-heading"><strong>Choose daily accomplishment photos</strong><span>{{ availablePhotoCount }} available · {{ selectedPhotoPaths.length }} selected</span></div>
              <p v-if="weeklyLoading" class="muted">Loading daily photos…</p><p v-else-if="availablePhotoCount === 0" class="muted">No daily photos found for this week.</p>
              <div v-else class="weekly-days"><div v-for="day in dailyPhotoRecords" :key="day.attendance_id" class="weekly-day"><strong>{{ formatDay(day.attendance_date) }}</strong><p v-if="day.accomplishment_text">{{ day.accomplishment_text }}</p><div class="photo-grid"><label v-for="photo in day.photos" :key="photo.path" class="photo-choice" :class="{ selected: selectedPhotoPaths.includes(photo.path) }"><input type="checkbox" :checked="selectedPhotoPaths.includes(photo.path)" :disabled="Boolean(existingWeekReport) || weeklySubmitting" @change="toggleWeeklyPhoto(photo.path)" /><img :src="photo.photo_url" alt="Daily accomplishment photo" loading="lazy" /><small>{{ selectedPhotoPaths.includes(photo.path) ? 'Selected' : 'Select' }}</small></label></div></div></div>
              <div class="description-head"><label for="weekly-description">Weekly accomplishment description</label><button v-if="weekPreview?.suggested_report && !existingWeekReport" type="button" class="link-button" :disabled="weeklySubmitting" @click="useDailyAccomplishments">Use my daily accomplishments</button></div><textarea id="weekly-description" v-model="weeklyDescription" rows="4" maxlength="10000" :disabled="Boolean(existingWeekReport) || weeklySubmitting" placeholder="Describe your activities and accomplishments this week…"></textarea>
              <button class="submit" type="button" :disabled="weeklySubmitting || weeklyLoading || !canSubmitWeek || Boolean(existingWeekReport) || selectedPhotoPaths.length === 0 || !weeklyDescription.trim()" @click="submitWeeklyAccomplishment">{{ weeklySubmitting ? 'Submitting…' : 'Submit weekly report' }}</button>
            </section>
            <div v-if="!weeklyReports.length" class="empty"><IonIcon :icon="documentTextOutline" /><strong>No weekly reports yet</strong><p>Submitted weekly reports will appear here.</p></div>
            <div v-else class="report-list"><article v-for="item in weeklyReports" :key="item.id" class="report-item"><button type="button" class="report-row" :aria-expanded="weeklyExpanded === String(item.id)" @click="toggleWeekly(item.id)"><span class="report-icon"><IonIcon :icon="documentTextOutline" /></span><span class="report-summary"><strong>{{ formatDay(item.week_start) }} – {{ formatDay(item.week_end) }}</strong><small>{{ item.report }}</small></span><span class="status" :class="String(item.status || 'PENDING').toLowerCase()">{{ item.status || 'PENDING' }}</span><IonIcon :icon="chevronDownOutline" class="chevron" :class="{ rotated: weeklyExpanded === String(item.id) }" /></button><div v-if="weeklyExpanded === String(item.id)" class="report-details"><template v-if="isWeekSummary(item.summary)"><h3><IonIcon :icon="calendarOutline" /> Hours and attendance</h3><WeeklyReportData :summary="item.summary" snapshot /></template><h3><IonIcon :icon="documentTextOutline" /> Weekly accomplishment</h3><p class="detail-text">{{ item.report }}</p><p class="muted"><IonIcon :icon="imagesOutline" /> {{ Array.isArray(item.selected_photo_paths) ? item.selected_photo_paths.length : 0 }} selected photos</p><h3><IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor feedback</h3><div v-if="item.status === 'PENDING'" class="feedback pending">Waiting for supervisor review.</div><div v-else class="feedback" :class="String(item.status).toLowerCase()">{{ item.supervisor_comment || 'Reviewed without additional comment.' }}</div></div></article></div>
          </div>
        </section>
      </main>
    </IonContent>
    <StudentBottomNav />
  </IonPage>
</template>

<style scoped>
.reports-content{--background:#f4f8f5;--color:#183d2e}.reports-container{max-width:1000px;margin:auto;padding:23px 18px calc(125px + env(safe-area-inset-bottom,0px));font-family:inherit}button,input,textarea,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.page-header{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:20px}.eyebrow{font-size:10px;letter-spacing:1.2px;color:#0b946c;font-weight:850}.page-header h1{font-size:clamp(28px,4vw,39px);letter-spacing:-1px;margin:7px 0;color:#173e2e}.page-header h1 em{font-style:normal;color:#13a676}.page-header p,.hub-top p{font-size:13px;line-height:1.6;color:#7c9484;margin:0}.refresh-button{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border:1px solid #dcebe1;border-radius:12px;background:white;color:#087a58;font-size:20px}.progress-strip{display:grid;grid-template-columns:1fr auto;gap:15px 20px;padding:20px 24px;background:linear-gradient(110deg,#0b7959,#104c3c);color:white;border-radius:18px;box-shadow:0 10px 24px #104a3319}.progress-main{display:flex;flex-direction:column;gap:4px}.progress-main>span{font-size:10px;font-weight:800;letter-spacing:1px;color:#b8e6cf}.progress-main strong{font-size:30px;line-height:1.2}.progress-main small{color:#d2e9dc;font-size:12px}.progress-right{display:flex;flex-direction:column;justify-content:center;gap:7px;text-align:right;font-size:12px;color:#e1f6e9}.progress-track{grid-column:1/-1;height:8px;background:#ffffff40;border-radius:20px;overflow:hidden}.progress-fill{height:100%;background:#8af0b5;border-radius:inherit;transition:width .25s}.report-hub{background:white;border:1px solid #e0ebe3;border-radius:20px;margin-top:18px;box-shadow:0 8px 26px #124c3510;overflow:hidden}.hub-top{padding:22px 24px 16px}.hub-top h2{font-size:21px;margin:5px 0 6px;color:#173e2e}.hub-tabs{display:flex;gap:8px;padding:0 24px 14px;border-bottom:1px solid #e9f0eb}.hub-tabs button{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;min-width:0;padding:13px 9px;background:#f2f7f3;color:#668171;border:1px solid transparent;border-radius:12px;font-size:13px;font-weight:800}.hub-tabs button.active{background:#e7f7ed;color:#087a58;border-color:#bce7cc}.hub-tabs button span{border-radius:12px;padding:3px 7px;background:#ffffffb8;font-size:11px}.tab-body{padding:20px 24px 24px}.compact-summary{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:16px;color:#6b8575;font-size:12px}.compact-summary strong{color:#0b7959;font-size:16px}.filters{display:grid;grid-template-columns:170px minmax(0,1fr);gap:10px;margin-bottom:16px}.filters input,.filters select,.weekly-form input,.weekly-form textarea{width:100%;min-width:0;box-sizing:border-box;padding:12px 13px;background:#fbfdfb;border:1px solid #d9e7dd;border-radius:11px;color:#254936;font-size:13px;outline:none}.filters input:focus,.filters select:focus,.weekly-form input:focus,.weekly-form textarea:focus{border-color:#0b946c}.report-list{display:grid;gap:9px}.report-item{border:1px solid #e3eee7;border-radius:14px;overflow:hidden;background:#fcfefd}.report-row{display:flex;align-items:center;gap:12px;text-align:left;width:100%;border:0;background:transparent;padding:14px;color:#244634}.report-row:hover{background:#f8fcf9}.report-icon{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;background:#e8f6ed;color:#087a58;border-radius:12px;font-size:20px}.report-summary{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.report-summary strong{font-size:13px;color:#234835}.report-summary small{color:#8a9c90;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;font-size:10px;font-weight:850;padding:7px 9px;border-radius:20px;background:#fff3dc;color:#966e20}.status.approved{background:#e2f5e9;color:#087a58}.status.rejected{background:#fff0ed;color:#b1443d}.chevron{font-size:18px;color:#8da99a;flex-shrink:0;transition:transform .2s}.chevron.rotated{transform:rotate(180deg)}.report-details{padding:17px 20px 20px;border-top:1px solid #e3eee7;background:white}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.detail-grid>div{padding:12px;border:1px solid #e3eee7;border-radius:11px}.detail-grid span{display:block;color:#879d8f;font-size:11px;margin-bottom:5px}.detail-grid strong{font-size:13px}.report-details h3{display:flex;align-items:center;gap:7px;margin:15px 0 8px;font-size:13px;color:#24513a}.report-details h3 ion-icon{font-size:17px;color:#0b946c}.detail-text,.feedback{padding:13px 15px;border-radius:11px;background:#f7fbf8;border:1px solid #e4eee7;color:#486552;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.feedback{background:#f5faf6}.feedback.rejected{background:#fff7f5;border-color:#f2d9d5}.feedback.approved{background:#f0faf4;border-color:#cfe9d8}.feedback.pending{color:#8c7b50;background:#fffbef;border-color:#f3e6c7}.feedback p{margin:0 0 6px}.feedback small{color:#82998b}.weekly-toolbar{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px}.weekly-toolbar p,.muted{font-size:12px;color:#7c9484;line-height:1.6;margin:0}.new-report,.submit{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#0b7959;color:white;border:0;border-radius:11px;padding:12px 15px;font-size:12px;font-weight:800;white-space:nowrap}.weekly-form{padding:20px;border:1px solid #d9e9de;background:#f9fcfa;border-radius:14px;margin-bottom:18px}.weekly-form h3{margin:0 0 15px;font-size:17px}.weekly-form label:not(.photo-choice){display:block;font-size:12px;font-weight:800;margin:15px 0 8px;color:#315541}.weekly-form input[type=date]{max-width:280px}.weekly-form .muted{margin:10px 0 16px}.photo-heading{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;margin-top:16px}.photo-heading span{color:#80988a}.weekly-days{display:grid;gap:12px;margin:13px 0}.weekly-day{background:white;border:1px solid #e0ebe3;border-radius:12px;padding:13px;min-width:0}.weekly-day>strong{font-size:13px}.weekly-day>p{font-size:12px;color:#789082;overflow-wrap:anywhere}.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:10px}.photo-choice{position:relative;display:flex;flex-direction:column;gap:6px;border:2px solid #e0ebe3;border-radius:11px;padding:6px;background:white;cursor:pointer}.photo-choice.selected{border-color:#0b946c;background:#eaf8f0}.photo-choice input{position:absolute;top:10px;left:10px;width:17px;height:17px;accent-color:#087a58}.photo-choice img{width:100%;height:110px;object-fit:cover;border-radius:7px}.photo-choice small{text-align:center;color:#24513a;font-weight:750}.weekly-form textarea{min-height:110px;resize:vertical}.submit{margin-top:14px}.notice{display:flex;align-items:center;gap:9px;margin:10px 0;padding:12px 14px;border-radius:11px;font-size:12px}.notice.error{background:#fff0ed;color:#a64138}.notice.success{background:#e5f6eb;color:#087e5b}.notice.info{background:#e7f2ff;color:#28649a}.notice.lock{background:#fff8e6;color:#8a6414;line-height:1.5}.notice.lock ion-icon{flex-shrink:0;font-size:16px}.description-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap}.link-button{border:0;background:none;padding:0 0 8px;color:#0b7959;font-size:12px;font-weight:800;text-decoration:underline}.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:45px 15px;text-align:center;color:#879d8f;font-size:13px}.empty ion-icon{font-size:30px;color:#9abdab}.empty strong{color:#355a43}.empty p{max-width:290px;margin:0;font-size:12px;line-height:1.6}.spinning{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.reports-container{padding:16px 12px calc(110px + env(safe-area-inset-bottom,0px))}.page-header h1{font-size:29px}.page-header p{font-size:12px}.progress-strip{padding:17px}.progress-main strong{font-size:27px}.progress-right{font-size:11px}.hub-top{padding:19px 16px 13px}.hub-tabs{padding:0 13px 12px}.hub-tabs button{font-size:12px;gap:5px}.tab-body{padding:16px 12px 20px}.filters{grid-template-columns:1fr}.report-row{gap:9px;padding:12px 9px}.report-icon{width:34px;height:36px;font-size:17px}.status{font-size:9px;padding:6px}.report-details{padding:14px}.weekly-toolbar{align-items:stretch;flex-direction:column}.new-report{width:100%}.weekly-form{padding:13px}.photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:360px){.progress-strip{grid-template-columns:1fr}.progress-right{text-align:left}.hub-tabs button{font-size:11px}.report-icon{display:none}.detail-grid{grid-template-columns:1fr}}

/* Match OJT Profile header exactly while retaining Reports page layout */
.page-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:0 0 24px; }
.page-header h1 { font-size:clamp(30px,4vw,43px); color:#133e30; margin:12px 0 7px; font-weight:850; letter-spacing:-1.2px; line-height:1.15; }
.page-header h1 span { color:#16a576; }
.page-header p { color:#788f81; margin:0; font-size:14px; line-height:1.5; }
.status.unknown { background:#edf1f0; color:#61756c; }
@media(max-width:600px) { .page-header h1 {font-size:30px;} .page-header p {font-size:13px;} }

/* Unified InZone student/admin visual system — presentation only */
.reports-content{--background:#f2f8f5;--color:#163c33}
.reports-container{max-width:1260px;padding:32px clamp(16px,4vw,46px) calc(135px + env(safe-area-inset-bottom,0px))}
.page-header{margin-bottom:25px;align-items:center}
.page-kicker{display:inline-block;font-size:11px;letter-spacing:1.6px;font-weight:850;color:#0b946c}
.page-header h1{margin:9px 0 9px;font-size:clamp(30px,4vw,43px);line-height:1.15;letter-spacing:-1.2px}
.page-header p{max-width:640px;color:#788f81;font-size:14px;line-height:1.6}
.refresh-button{width:48px;height:48px;border-radius:14px;box-shadow:0 4px 14px #124c350d;transition:transform .2s,box-shadow .2s}
.refresh-button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 22px #124c351b}
.progress-strip{position:relative;isolation:isolate;overflow:hidden;grid-template-columns:minmax(0,1fr) auto;gap:20px;padding:clamp(23px,3.5vw,38px);border-radius:25px;background:linear-gradient(115deg,#0b775b,#064938 70%,#073a34);box-shadow:0 18px 45px #0d594026}
.progress-strip::before,.progress-strip::after{content:"";position:absolute;border:1px solid #ffffff22;border-radius:50%;z-index:-1;pointer-events:none}
.progress-strip::before{width:320px;height:320px;right:-105px;top:-175px}
.progress-strip::after{width:215px;height:215px;right:-50px;top:-115px}
.progress-main{gap:6px;min-width:0}
.progress-main>span{display:flex;align-items:center;gap:8px;color:#b6eed5;font-size:11px;letter-spacing:1.1px}
.progress-main>span ion-icon{font-size:17px}
.progress-main h2{margin:9px 0 0;color:white;font-size:clamp(20px,2.5vw,28px);font-weight:800;letter-spacing:-.5px}
.progress-main strong{font-size:clamp(36px,5vw,53px);font-weight:850;letter-spacing:-1.8px;color:#91f2c0}
.progress-main small{font-size:13px;overflow-wrap:anywhere}
.progress-right{flex-direction:row;align-items:center;gap:12px;text-align:left}
.progress-metric{display:flex;flex-direction:column;justify-content:center;gap:10px;min-width:145px;min-height:93px;padding:17px 18px;border:1px solid #ffffff33;background:#ffffff16;border-radius:16px;backdrop-filter:blur(4px)}
.progress-metric span{font-size:10px;font-weight:800;letter-spacing:.8px;color:#c7e9d6}
.progress-metric strong{font-size:17px;color:white;font-weight:850;white-space:nowrap}
.progress-track{height:10px;background:#ffffff38;margin-top:4px}
.progress-fill{background:linear-gradient(90deg,#69dfa4,#b4f8d0);transition:width .45s ease}
.report-hub{margin-top:23px;border-radius:22px;border-color:#deebe3;box-shadow:0 10px 30px #124c350c}
.hub-top{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:28px 30px 22px}
.hub-top h2{font-size:clamp(20px,2.4vw,25px);letter-spacing:-.5px}
.hub-top-icon{display:grid;place-items:center;width:52px;height:52px;flex-shrink:0;border-radius:15px;background:#e7f6ed;color:#0b805d;font-size:26px}
.hub-tabs{padding:0 30px 18px;gap:12px}
.hub-tabs button{padding:15px 14px;border-radius:13px;font-size:14px;transition:background .2s,transform .2s}
.hub-tabs button:hover{transform:translateY(-1px)}
.hub-tabs button.active{background:#e2f5e9;border-color:#aee1c0;box-shadow:inset 0 0 0 1px #bce7cc}
.tab-body{padding:25px 30px 30px}
.compact-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-bottom:22px}
.mini-stat{display:flex;align-items:center;gap:14px;min-width:0;padding:17px;border:1px solid #e1ece5;border-radius:15px;background:#fbfdfb}
.mini-stat-icon{display:grid;place-items:center;width:43px;height:43px;flex-shrink:0;border-radius:12px;font-size:21px}
.pending-icon{background:#fff2d9;color:#a47524}.reviewed-icon{background:#e4f5eb;color:#0b855f}
.mini-stat>span:last-child{display:flex;flex-direction:column;gap:4px}
.mini-stat small{color:#829a8a;font-size:10px;font-weight:800;letter-spacing:.7px}
.mini-stat strong{font-size:24px;color:#19432f}
.filters{grid-template-columns:minmax(165px,220px) minmax(0,1fr);gap:12px;margin-bottom:20px}
.filters input,.filters select{min-height:48px;border-radius:12px;font-size:13px}
.report-list{gap:12px}.report-item{border-radius:16px;background:#fff;border-color:#e0ebe3;box-shadow:0 3px 12px #124c3506;transition:border-color .2s,box-shadow .2s}
.report-item:hover{border-color:#b9dfc7;box-shadow:0 7px 20px #124c3510}
.report-row{padding:17px;gap:14px}.report-icon{width:47px;height:47px;border-radius:13px;font-size:23px}
.report-summary strong{font-size:14px}.report-summary small{font-size:12px}.status{font-size:10px;padding:8px 11px}
.report-details{padding:20px 22px 24px}.detail-grid>div{padding:15px;background:#f8fbf9}.report-details h3{font-size:14px}
.detail-text,.feedback{font-size:13px;line-height:1.75}
.weekly-toolbar{margin-bottom:20px}.weekly-toolbar p{font-size:13px}.new-report,.submit{min-height:44px;font-size:13px;border-radius:12px}
.weekly-form{padding:24px;border-radius:17px}.weekly-form h3{font-size:19px}.weekly-day{padding:17px;border-radius:13px}
.photo-choice{transition:border-color .2s,transform .2s}.photo-choice:hover{transform:translateY(-2px)}
@media(max-width:850px){.progress-right{flex-direction:column;align-items:stretch}.progress-metric{min-width:145px;min-height:65px;padding:12px 15px;gap:5px}}
@media(max-width:600px){.reports-container{padding:18px 15px calc(130px + env(safe-area-inset-bottom,0px))}.page-header{gap:10px;margin-bottom:20px}.page-kicker{font-size:9px}.page-header h1{font-size:29px;margin:8px 0}.page-header p{font-size:12px}.refresh-button{width:43px;height:43px}.progress-strip{padding:23px 19px;grid-template-columns:1fr;gap:18px;border-radius:21px}.progress-main h2{font-size:21px}.progress-main strong{font-size:42px}.progress-right{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.progress-metric{min-width:0;min-height:75px;padding:12px 10px}.progress-metric span{font-size:9px}.progress-metric strong{font-size:13px;white-space:normal}.hub-top{padding:20px 17px 15px}.hub-top h2{font-size:21px}.hub-top-icon{width:42px;height:42px;font-size:22px}.hub-tabs{padding:0 14px 14px;gap:8px}.hub-tabs button{font-size:12px;padding:13px 7px}.tab-body{padding:17px 14px 22px}.compact-summary{gap:9px}.mini-stat{padding:12px 10px;gap:9px}.mini-stat-icon{width:35px;height:35px;font-size:18px}.mini-stat small{font-size:9px}.mini-stat strong{font-size:21px}.filters{grid-template-columns:1fr}.report-row{padding:13px 11px;gap:9px}.report-icon{width:38px;height:40px;font-size:18px}.report-summary strong{font-size:12px}.report-summary small{font-size:11px}.status{font-size:9px;padding:6px 8px}.report-details{padding:16px 13px 19px}.weekly-form{padding:15px}}
@media(max-width:380px){.progress-metric strong{font-size:12px}.mini-stat-icon{display:none}.hub-top-icon{display:none}.report-icon{display:none}.report-row{gap:7px}.status{font-size:8px;padding:6px}}
@media(prefers-reduced-motion:reduce){.progress-fill,.report-item,.refresh-button,.hub-tabs button,.photo-choice{transition:none}}
</style>
