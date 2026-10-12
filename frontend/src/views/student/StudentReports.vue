
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';

import StudentBottomNav from './StudentBottomNav.vue';
import InZoneTopbar from '@/components/InZoneTopbar.vue';

import {
  statsChartOutline,
  timerOutline,
  hourglassOutline,
  checkmarkCircleOutline,
  calendarOutline,
  calendarNumberOutline,
  documentTextOutline,
  refreshOutline,
  alertCircleOutline,
  businessOutline,
  arrowForwardOutline,
  trendingUpOutline,
  timeOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

/* =====================================
   CONFIGURATION
===================================== */

const router = useRouter();

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
  id: number;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  seconds_worked?: number | string | null;
  hours_worked?: number | string | null;
}

interface PeriodRow {
  key: string;
  label: string;
  hours: number;
  days: number;
  completedDays: number;
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

const activePeriod = ref<'weekly' | 'monthly'>('weekly');

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

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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

const recordedDays = computed(() =>
  attendance.value.filter(record => Boolean(record.time_in)).length
);

const completedDays = computed(() =>
  attendance.value.filter(
    record => Boolean(record.time_in && record.time_out)
  ).length
);

const averageDailyHours = computed(() => {
  if (completedHours.value === null) return null;

  const days = completedDays.value;

  return days > 0
    ? completedHours.value / days
    : 0;
});

/* =====================================
   WEEKLY AND MONTHLY BREAKDOWN
===================================== */

function buildPeriods(
  kind: 'weekly' | 'monthly'
): PeriodRow[] {
  const grouped = new Map<string, PeriodRow>();

  for (const record of attendance.value) {
    if (!record.time_in || !record.attendance_date) {
      continue;
    }

    const date = dateKey(record.attendance_date);

    const key =
      kind === 'weekly'
        ? mondayOf(date)
        : date.slice(0, 7);

    const label =
      kind === 'weekly'
        ? `Week of ${formatDay(key)}`
        : formatMonth(key);

    const existing = grouped.get(key) ?? {
      key,
      label,
      hours: 0,
      days: 0,
      completedDays: 0,
    };

    existing.days += 1;

    if (record.time_out) {
      existing.completedDays += 1;
    }

    existing.hours += hoursFor(record);

    grouped.set(key, existing);
  }

  return [...grouped.values()].sort(
    (a, b) => b.key.localeCompare(a.key)
  );
}

const weeklyData = computed(() =>
  buildPeriods('weekly')
);

const monthlyData = computed(() =>
  buildPeriods('monthly')
);

const selectedData = computed(() =>
  activePeriod.value === 'weekly'
    ? weeklyData.value
    : monthlyData.value
);

const chartData = computed(() =>
  [...selectedData.value].slice(0, 6).reverse()
);

const maxChartHours = computed(() =>
  Math.max(
    1,
    ...chartData.value.map(item => item.hours)
  )
);

function barHeight(hours: number): string {
  return `${Math.max(
    hours > 0 ? 4 : 0,
    (hours / maxChartHours.value) * 100
  )}%`;
}

/* =====================================
   NAVIGATION
===================================== */

function goTo(path: string) {
  void router.push(path);
}

onIonViewWillEnter(() => {
  void loadReport();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="reports-content">
       <InZoneTopbar role="STUDENT" />
      <main class="reports-container">

        <!-- HEADER -->
        <header class="page-header">
          <div>
            <h1>My OJT Reports<span>.</span></h1>
            <p>Monitor your training progress and performance.</p>
          </div>

          <button
            class="refresh-button"
            type="button"
            :disabled="refreshing"
            @click="loadReport"
            aria-label="Refresh reports"
          >
            <IonIcon
              :icon="refreshOutline"
              :class="{ spinning: refreshing }"
            />
          </button>
        </header>

        <!-- ERRORS -->
        <div v-if="error" class="error-banner" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
        </div>

        <!-- PROGRESS HERO -->
        <section class="progress-hero">
          <div class="hero-header">
            <div>
              <span class="hero-eyebrow">OVERALL OJT PROGRESS</span>
              <h2>Your Training Journey</h2>
              <p>
                {{
                  profile?.company_name ||
                  'Your registered OJT workplace'
                }}
              </p>
            </div>

            <div class="hero-icon">
              <IonIcon :icon="trendingUpOutline" />
            </div>
          </div>

          <div class="hero-percentage">
            <strong>
              {{
                loading || progressPercent === null
                  ? '—'
                  : `${progressPercent.toFixed(1)}%`
              }}
            </strong>
            <span>of required hours completed</span>
          </div>

          <div
            class="progress-track"
            role="progressbar"
            :aria-valuenow="progressPercent ?? 0"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="progress-fill"
              :style="{
                width: `${progressPercent ?? 0}%`
              }"
            ></div>
          </div>

          <div class="hero-hours">
            <div>
              <span>COMPLETED HOURS</span>
              <strong>{{ formatHours(completedHours) }}</strong>
            </div>

            <div>
              <span>REQUIRED HOURS</span>
              <strong>{{ formatHours(requiredHours) }}</strong>
            </div>
          </div>
        </section>

        <!-- SUMMARY STATISTICS -->
        <section class="summary-grid">
          <article class="summary-card">
            <div class="summary-icon green">
              <IonIcon :icon="checkmarkCircleOutline" />
            </div>
            <span>Hours Completed</span>
            <strong>{{ formatHours(completedHours) }}</strong>
            <small>From recorded attendance</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon amber">
              <IonIcon :icon="hourglassOutline" />
            </div>
            <span>Hours Remaining</span>
            <strong>{{ formatHours(remainingHours) }}</strong>
            <small>To reach required OJT hours</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon blue">
              <IonIcon :icon="calendarNumberOutline" />
            </div>
            <span>Completed Days</span>
            <strong>{{ loading ? '—' : completedDays }}</strong>
            <small>Days with Time In and Time Out</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon purple">
              <IonIcon :icon="timerOutline" />
            </div>
            <span>Average Daily Hours</span>
            <strong>{{ formatHours(averageDailyHours) }}</strong>
            <small>Per completed attendance day</small>
          </article>
        </section>

        <!-- PERFORMANCE CHART -->
        <section class="panel performance-panel">
          <div class="section-heading">
            <div>
              <span class="section-label">WORK HOUR ANALYTICS</span>
              <h2>Attendance Performance</h2>
              <p>
                Explore the total hours recorded
                per week or month.
              </p>
            </div>

            <div class="period-toggle">
              <button
                type="button"
                :class="{ active: activePeriod === 'weekly' }"
                @click="activePeriod = 'weekly'"
              >
                Weekly
              </button>

              <button
                type="button"
                :class="{ active: activePeriod === 'monthly' }"
                @click="activePeriod = 'monthly'"
              >
                Monthly
              </button>
            </div>
          </div>

          <div v-if="loading" class="empty-state">
            <IonIcon
              :icon="refreshOutline"
              class="spinning"
            />
            <p>Loading report data...</p>
          </div>

          <div
            v-else-if="chartData.length === 0"
            class="empty-state"
          >
            <IonIcon :icon="statsChartOutline" />
            <h3>No performance data yet</h3>
            <p>
              Your work-hour chart will appear
              after attendance is recorded.
            </p>
          </div>

          <div v-else class="chart-scroll">
            <div class="bar-chart">
              <div
                v-for="item in chartData"
                :key="item.key"
                class="chart-column"
              >
                <span class="bar-value">
                  {{ item.hours.toFixed(1) }}h
                </span>

                <div class="bar-track">
                  <div
                    class="chart-bar"
                    :style="{ height: barHeight(item.hours) }"
                  ></div>
                </div>

                <span class="bar-label">
                  {{
                    activePeriod === 'weekly'
                      ? formatDay(item.key)
                      : item.label
                  }}
                </span>
              </div>
            </div>
          </div>

          <p class="chart-note">
            Showing up to six most recent
            {{ activePeriod === 'weekly' ? 'weeks' : 'months' }}.
          </p>
        </section>

        <!-- PERIOD BREAKDOWN -->
        <section class="panel breakdown-panel">
          <div class="section-heading">
            <div>
              <span class="section-label">ACTIVITY BREAKDOWN</span>
              <h2>
                {{
                  activePeriod === 'weekly'
                    ? 'Weekly Summary'
                    : 'Monthly Summary'
                }}
              </h2>
              <p>
                Your recorded attendance and completed
                hours for each period.
              </p>
            </div>
          </div>

          <div
            v-if="!loading && selectedData.length === 0"
            class="empty-state"
          >
            <IonIcon :icon="documentTextOutline" />
            <p>No summary data available.</p>
          </div>

          <div v-else class="period-list">
            <article
              v-for="item in selectedData"
              :key="item.key"
              class="period-row"
            >
              <div class="period-icon">
                <IonIcon :icon="calendarOutline" />
              </div>

              <div class="period-information">
                <h3>{{ item.label }}</h3>
                <p>
                  {{ item.days }} recorded day(s) ·
                  {{ item.completedDays }} completed
                </p>
              </div>

              <strong>{{ formatHours(item.hours) }}</strong>
            </article>
          </div>
        </section>

        <!-- TRAINING INFORMATION -->
        <section class="panel training-panel">
          <div class="section-heading">
            <div>
              <span class="section-label">TRAINING DETAILS</span>
              <h2>My OJT Information</h2>
            </div>
          </div>

          <div class="training-grid">
            <div>
              <IonIcon :icon="businessOutline" />
              <span>Company</span>
              <strong>
                {{ profile?.company_name || 'Not set' }}
              </strong>
            </div>

            <div>
              <IonIcon :icon="shieldCheckmarkOutline" />
              <span>Profile Status</span>
              <strong>
                {{ profile?.approval_status || 'Not set' }}
              </strong>
            </div>

            <div>
              <IonIcon :icon="calendarOutline" />
              <span>Start Date</span>
              <strong>
                {{ formatDay(profile?.start_date) }}
              </strong>
            </div>

            <div>
              <IonIcon :icon="calendarOutline" />
              <span>End Date</span>
              <strong>
                {{ formatDay(profile?.end_date) }}
              </strong>
            </div>
          </div>
        </section>

        <!-- NAVIGATION -->
        <section class="quick-links">
          <button
            type="button"
            @click="goTo('/student/attendance')"
          >
            <IonIcon :icon="calendarOutline" />
            <span>
              <strong>Attendance Records</strong>
              <small>View your daily logs and photo proofs</small>
            </span>
            <IonIcon :icon="arrowForwardOutline" />
          </button>

          <button
            type="button"
            @click="goTo('/student/track')"
          >
            <IonIcon :icon="timeOutline" />
            <span>
              <strong>Track Attendance</strong>
              <small>Verify GPS and record Time In/Out</small>
            </span>
            <IonIcon :icon="arrowForwardOutline" />
          </button>
        </section>

      </main>
    </IonContent>

    <StudentBottomNav />
  </IonPage>
</template>

<style scoped>
.reports-content {
  --background: #f3f8f5;
  --color: #173f31;
}

.reports-container {
  max-width: 1120px;
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

/* HEADER */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.eyebrow,
.section-label {
  color: #0b946c;
  font-size: 10px;
  font-weight: 850;
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
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border: 1px solid #d9e8df;
  border-radius: 12px;
  color: #0b7959;
  background: #ffffff;
  font-size: 22px;
}

/* ERRORS */

.error-banner {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-bottom: 16px;
  padding: 13px 15px;
  border-radius: 12px;
  background: #fff0ed;
  color: #a64138;
  font-size: 12px;
}

/* PROGRESS HERO */

.progress-hero {
  padding: clamp(23px, 4vw, 34px);
  border-radius: 23px;
  color: #ffffff;
  background:
    radial-gradient(
      circle at 100% 0%,
      #2eb58755,
      transparent 45%
    ),
    linear-gradient(120deg, #0b805e, #073e32);
  box-shadow: 0 14px 35px #084e351e;
}

.hero-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}

.hero-eyebrow {
  font-size: 10px;
  font-weight: 850;
  color: #bbebd0;
  letter-spacing: 1.3px;
}

.hero-header h2 {
  margin: 11px 0 9px;
  color: white;
  font-size: clamp(23px, 3vw, 33px);
}

.hero-header p {
  margin: 0;
  color: #cde9db;
  font-size: 12px;
}

.hero-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #ffffff20;
  font-size: 29px;
}

.hero-percentage {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 31px;
}

.hero-percentage strong {
  color: #ffffff;
  font-size: clamp(35px, 6vw, 51px);
  line-height: 1;
}

.hero-percentage span {
  color: #c4e8d5;
  font-size: 12px;
}

.progress-track {
  height: 12px;
  overflow: hidden;
  border-radius: 100px;
  margin: 20px 0 18px;
  background: #ffffff30;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #7af0aa;
  transition: width .3s ease;
}

.hero-hours {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.hero-hours span {
  display: block;
  font-size: 10px;
  font-weight: 750;
  color: #bfdfcb;
  margin-bottom: 8px;
}

.hero-hours strong {
  display: block;
  font-size: 15px;
  color: white;
}

/* SUMMARY */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
  margin: 20px 0;
}

.summary-card {
  padding: 19px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid #e0eae3;
  box-shadow: 0 6px 22px #145b3b09;
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  font-size: 23px;
}

.summary-icon.green {
  background: #e5f6eb;
  color: #087e5b;
}

.summary-icon.amber {
  background: #fff2d9;
  color: #ae7926;
}

.summary-icon.blue {
  background: #e7f2ff;
  color: #2879b2;
}

.summary-icon.purple {
  background: #f1ebfc;
  color: #7356b4;
}

.summary-card > span {
  display: block;
  margin-top: 16px;
  color: #789082;
  font-size: 11px;
  font-weight: 750;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: clamp(17px, 2vw, 23px);
  color: #1a4431;
  overflow-wrap: anywhere;
}

.summary-card small {
  display: block;
  margin-top: 7px;
  font-size: 10px;
  color: #9aa99d;
}

/* PANELS */

.panel {
  margin-top: 19px;
  padding: clamp(19px, 3vw, 27px);
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e0ebe3;
  box-shadow: 0 7px 25px #145b3b09;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.section-heading h2 {
  margin: 7px 0;
  color: #1b4434;
  font-size: 20px;
}

.section-heading p {
  margin: 0;
  color: #85988b;
  font-size: 12px;
  line-height: 1.6;
}

.period-toggle {
  display: inline-flex;
  padding: 4px;
  border-radius: 11px;
  background: #eef5f0;
}

.period-toggle button {
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  color: #759182;
  background: transparent;
}

.period-toggle button.active {
  background: #0b7959;
  color: #ffffff;
}

/* BAR CHART */

.chart-scroll {
  overflow-x: auto;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  min-width: 400px;
  height: 265px;
  padding: 12px 8px 0;
  border-bottom: 1px solid #dcebe1;
}

.chart-column {
  flex: 1;
  min-width: 50px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-value {
  height: 23px;
  font-size: 11px;
  font-weight: 800;
  color: #286c4c;
}

.bar-track {
  flex: 1;
  width: 100%;
  max-width: 50px;
  display: flex;
  align-items: flex-end;
  background: #eef7f1;
  border-radius: 8px 8px 0 0;
}

.chart-bar {
  width: 100%;
  min-height: 0;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #21bc87, #087957);
  transition: height .3s ease;
}

.bar-label {
  height: 43px;
  padding-top: 8px;
  color: #7b9485;
  font-size: 10px;
  text-align: center;
  font-weight: 700;
}

.chart-note {
  margin: 17px 0 0;
  color: #98a99b;
  font-size: 11px;
}

.empty-state {
  min-height: 185px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: #829889;
}

.empty-state ion-icon {
  font-size: 35px;
  color: #7eaf94;
}

.empty-state h3 {
  margin: 0;
  color: #355a43;
  font-size: 14px;
}

.empty-state p {
  max-width: 320px;
  line-height: 1.7;
  font-size: 12px;
}

/* PERIOD BREAKDOWN */

.period-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.period-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px;
  background: #f7fbf8;
  border: 1px solid #e5eee7;
  border-radius: 13px;
}

.period-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: #e2f5e9;
  color: #0b7e59;
  font-size: 21px;
}

.period-information {
  flex: 1;
  min-width: 0;
}

.period-information h3 {
  color: #2a513b;
  font-size: 13px;
  margin: 0 0 6px;
}

.period-information p {
  color: #8da193;
  font-size: 11px;
  margin: 0;
}

.period-row > strong {
  color: #0b7959;
  font-size: 13px;
  white-space: nowrap;
}

/* TRAINING INFORMATION */

.training-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.training-grid > div {
  padding: 15px;
  border-radius: 12px;
  background: #f5f9f6;
}

.training-grid ion-icon {
  display: block;
  color: #0b845e;
  font-size: 22px;
  margin-bottom: 10px;
}

.training-grid span {
  display: block;
  font-size: 11px;
  color: #819789;
  margin-bottom: 7px;
}

.training-grid strong {
  color: #25503b;
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* QUICK LINKS */

.quick-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 19px;
}

.quick-links button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  text-align: left;
  border: 1px solid #d8e8de;
  border-radius: 15px;
  background: #ffffff;
  color: #0b7959;
}

.quick-links button > ion-icon {
  font-size: 23px;
  flex-shrink: 0;
}

.quick-links button > ion-icon:last-child {
  font-size: 18px;
}

.quick-links button span {
  flex: 1;
}

.quick-links strong,
.quick-links small {
  display: block;
}

.quick-links strong {
  font-size: 12px;
  color: #24513a;
  margin-bottom: 6px;
}

.quick-links small {
  font-size: 10px;
  color: #809789;
  line-height: 1.5;
}

/* ANIMATION */

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* TABLET */

@media (max-width: 850px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* MOBILE */

@media (max-width: 600px) {
  .reports-container {
    padding-left: 15px;
    padding-right: 15px;
  }

  .summary-grid {
    gap: 10px;
  }

  .summary-card {
    padding: 15px;
  }

  .hero-header h2 {
    font-size: 23px;
  }

  .hero-percentage {
    flex-direction: column;
    gap: 5px;
  }

  .hero-percentage strong {
    font-size: 40px;
  }

  .period-row {
    padding: 12px;
  }

  .quick-links {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 370px) {
  .hero-hours {
    flex-direction: column;
  }

  .training-grid {
    grid-template-columns: 1fr;
  }

  .period-row {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }

  .chart-bar,
  .progress-fill {
    transition: none;
  }
}
</style>
