<script setup lang="ts">
// =====================================
// SUPERVISOR DASHBOARD
// Today's attendance of assigned students + reports waiting for review.
// APIs: GET /api/supervisor/dashboard
//       GET /api/supervisor/attendance        (today)
//       GET /api/supervisor/reports/pending
// =====================================
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
  onIonViewDidLeave,
} from '@ionic/vue';
import {
  refreshOutline,
  alertCircleOutline,
  warningOutline,
  peopleOutline,
  enterOutline,
  documentTextOutline,
  checkmarkDoneOutline,
  chevronForwardOutline,
  personAddOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  formatTime,
  formatWeek,
  formatWeekday,
  formatHours,
  elapsedSince,
  attendanceLabel,
  attendanceTone,
  type DashboardSummary,
  type DailyAttendanceResponse,
  type DailyAttendance,
  type WeeklyReport,
} from './supervisorApi';

const router = useRouter();

const summary = ref<DashboardSummary | null>(null);
const today = ref<DailyAttendanceResponse | null>(null);
const pending = ref<WeeklyReport[]>([]);
const loading = ref(false);
const error = ref('');
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

const firstName = computed(() => {
  try {
    const user = JSON.parse(sessionStorage.getItem('inzone_user') || '{}');
    return user.first_name || 'Supervisor';
  } catch {
    return 'Supervisor';
  }
});

const greeting = computed(() => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Manila',
    }).format(new Date(now.value))
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
});

const hasStudents = computed(() => (summary.value?.assigned_students ?? 0) > 0);
const firstLoad = computed(() => loading.value && !summary.value);

const stats = computed(() => {
  const s = summary.value;
  return [
    {
      label: 'Students',
      value: s?.assigned_students,
      hint: 'assigned to you',
      icon: peopleOutline,
      tone: 'green',
      to: '/supervisor/students',
    },
    {
      label: 'In today',
      value: s?.timed_in_today,
      hint: s ? `${s.on_duty_now} still on duty` : '',
      icon: enterOutline,
      tone: 'blue',
      to: '/supervisor/attendance',
    },
    {
      label: 'To review',
      value: s?.pending_reports,
      hint: 'weekly reports',
      icon: documentTextOutline,
      tone: 'amber',
      to: '/supervisor/reports',
    },
    {
      label: 'Reviewed',
      value: s?.reviewed_by_me,
      hint: 'by you so far',
      icon: checkmarkDoneOutline,
      tone: 'mint',
      to: '/supervisor/reports',
    },
  ];
});

function rowDetail(record: DailyAttendance): string {
  if (record.status === 'ON_DUTY') {
    return `In at ${formatTime(record.time_in)} · ${elapsedSince(record.time_in, now.value)} so far`;
  }
  if (record.status === 'COMPLETE') {
    return `${formatTime(record.time_in)} – ${formatTime(record.time_out)} · ${formatHours(record.hours_worked)}`;
  }
  if (record.approval_status !== 'APPROVED') {
    return 'Workplace not yet approved';
  }
  return 'No time-in yet';
}

async function loadDashboard() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const [dashboard, attendance, reports] = await Promise.all([
      supervisorRequest<{ summary: DashboardSummary }>('/api/supervisor/dashboard'),
      supervisorRequest<DailyAttendanceResponse>('/api/supervisor/attendance'),
      supervisorRequest<{ reports: WeeklyReport[] }>('/api/supervisor/reports/pending'),
    ]);

    summary.value = dashboard.summary;
    today.value = attendance;
    pending.value = Array.isArray(reports.reports) ? reports.reports : [];
    now.value = Date.now();
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load your dashboard.');
  } finally {
    loading.value = false;
  }
}

function openReport(report: WeeklyReport) {
  void router.push({ path: '/supervisor/reports', query: { open: String(report.id) } });
}

function stopClock() {
  if (clock) clearInterval(clock);
  clock = null;
}

onIonViewWillEnter(() => {
  void loadDashboard();
  stopClock();
  // Keeps the "3h 12m so far" times current.
  clock = setInterval(() => (now.value = Date.now()), 60_000);
});

onIonViewDidLeave(stopClock);
onUnmounted(stopClock);
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell">
        <header class="sv-heading">
          <div>
            <h1>{{ greeting }}, {{ firstName }}</h1>
            <p>{{ today ? formatWeekday(today.today) : 'Here is how your OJT students are doing today.' }}</p>
          </div>
          <button class="sv-refresh" type="button" :disabled="loading" @click="loadDashboard">
            <IonIcon :icon="refreshOutline" :class="{ 'sv-spin': loading }" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </header>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadDashboard">Try again</button>
        </div>

        <button
          v-if="summary && summary.missing_time_out > 0"
          type="button"
          class="missing-strip"
          @click="router.push('/supervisor/attendance')"
        >
          <IonIcon :icon="warningOutline" />
          <span>
            <strong>{{ summary.missing_time_out }} past
              {{ summary.missing_time_out === 1 ? 'day has' : 'days have' }} no time-out.</strong>
            Those hours are not counted until it's sorted out.
          </span>
          <IonIcon :icon="chevronForwardOutline" class="strip-arrow" />
        </button>

        <section class="stats" aria-label="Summary">
          <button
            v-for="stat in stats"
            :key="stat.label"
            type="button"
            class="stat"
            @click="router.push(stat.to)"
          >
            <span class="stat-icon" :class="stat.tone"><IonIcon :icon="stat.icon" /></span>
            <span class="stat-text">
              <small>{{ stat.label }}</small>
              <strong>{{ firstLoad ? '–' : stat.value ?? 0 }}</strong>
              <em>{{ stat.hint }}</em>
            </span>
          </button>
        </section>

        <!-- No students assigned yet -->
        <section v-if="summary && !hasStudents" class="sv-card">
          <div class="sv-empty">
            <IonIcon :icon="personAddOutline" />
            <h3>No students assigned to you yet</h3>
            <p>
              Your OJT coordinator assigns students to you after approving their workplace.
              Once they do, their attendance and weekly reports appear here.
            </p>
          </div>
        </section>

        <div v-else class="board">
          <!-- TODAY AT THE WORKPLACE -->
          <section class="sv-card roster-card">
            <div class="sv-section-head">
              <div>
                <h2>At the workplace today</h2>
                <p v-if="today">
                  {{ today.summary.on_duty }} on duty · {{ today.summary.complete }} done ·
                  {{ today.summary.no_record }} not in
                </p>
              </div>
              <button type="button" class="sv-link" @click="router.push('/supervisor/attendance')">
                Attendance log
              </button>
            </div>

            <div v-if="firstLoad" class="roster">
              <div v-for="n in 3" :key="n" class="sv-skeleton roster-skeleton"></div>
            </div>

            <ul v-else-if="today && today.records.length" class="roster">
              <li v-for="record in today.records" :key="record.student_id">
                <button
                  type="button"
                  class="roster-row"
                  :class="attendanceTone(record.status)"
                  @click="router.push(`/supervisor/students/${record.student_id}`)"
                >
                  <span class="sv-avatar">{{ initials(record) }}</span>
                  <span class="roster-main">
                    <span class="roster-top">
                      <span class="sv-name">{{ fullName(record) }}</span>
                      <span class="sv-pill" :class="attendanceTone(record.status)">
                        {{ attendanceLabel(record.status) }}
                      </span>
                    </span>
                    <span class="sv-sub">{{ record.company_name || 'No company' }}</span>
                    <span class="roster-detail">{{ rowDetail(record) }}</span>
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <!-- WAITING FOR REVIEW -->
          <section class="sv-card review-card">
            <div class="sv-section-head">
              <div>
                <h2>Waiting for your review</h2>
                <p>Oldest submissions first.</p>
              </div>
            </div>

            <div v-if="firstLoad" class="queue">
              <div v-for="n in 2" :key="n" class="sv-skeleton queue-skeleton"></div>
            </div>

            <div v-else-if="!pending.length" class="sv-empty compact">
              <IonIcon :icon="checkmarkDoneOutline" />
              <h3>All caught up</h3>
              <p>New weekly reports from your students will show up here.</p>
            </div>

            <ul v-else class="queue">
              <li v-for="report in pending.slice(0, 4)" :key="report.id">
                <button type="button" class="queue-row" @click="openReport(report)">
                  <span class="queue-main">
                    <span class="sv-name">{{ fullName(report) }}</span>
                    <span class="sv-sub">Week of {{ formatWeek(report.week_start, report.week_end) }}</span>
                  </span>
                  <span class="queue-action">Review</span>
                </button>
              </li>
            </ul>

            <button
              v-if="pending.length"
              type="button"
              class="sv-btn soft all-reports"
              @click="router.push('/supervisor/reports')"
            >
              {{ pending.length > 4 ? `See all ${pending.length} reports` : 'Open reports' }}
            </button>
          </section>
        </div>
      </main>
    </IonContent>

    <SupervisorBottomNav />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
/* ---------- missing time-out strip ---------- */
.missing-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px solid #f2d3cd;
  border-radius: 14px;
  background: var(--sv-alert-soft);
  color: #7c3026;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
}

.missing-strip > ion-icon:first-child {
  font-size: 22px;
  flex-shrink: 0;
  color: var(--sv-alert);
}

.missing-strip strong {
  font-weight: 800;
}

.strip-arrow {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 18px;
}

/* ---------- stats ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--sv-line);
  border-radius: 18px;
  background: #fff;
  text-align: left;
}

.stat:hover {
  border-color: #bfe0cc;
}

.stat-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  font-size: 21px;
}

.stat-icon.green { background: #e5f6ea; color: #0a845d; }
.stat-icon.blue { background: var(--sv-active-soft); color: var(--sv-active); }
.stat-icon.amber { background: var(--sv-waiting-soft); color: var(--sv-waiting); }
.stat-icon.mint { background: #e1f4ee; color: #167e71; }

.stat-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-text small {
  color: var(--sv-muted);
  font-size: 12px;
  font-weight: 700;
}

.stat-text strong {
  color: var(--sv-ink);
  font-size: 26px;
  line-height: 1.15;
  letter-spacing: -0.6px;
}

.stat-text em {
  font-style: normal;
  color: #9aaca1;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- board ---------- */
.board {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

/* ---------- roster (the signature element) ---------- */
.roster,
.queue {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.roster-row {
  --rail: var(--sv-idle);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 13px 13px 13px 17px;
  border: 1px solid #e6efe9;
  border-radius: 14px;
  background: #fcfefd;
  text-align: left;
  overflow: hidden;
}

.roster-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: var(--rail);
}

.roster-row.active { --rail: var(--sv-active); background: #f8fbfd; }
.roster-row.done { --rail: var(--sv-accent); }
.roster-row.alert { --rail: var(--sv-alert); }
.roster-row.idle { --rail: #d3ddd7; }

.roster-row:hover {
  border-color: #c7e2d2;
}

.roster-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.roster-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.roster-detail {
  margin-top: 7px;
  color: var(--sv-ink-soft);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.roster-row.active .roster-detail {
  color: var(--sv-active);
  font-weight: 700;
}

.roster-row.idle .roster-detail {
  color: var(--sv-muted);
}

.roster-skeleton {
  height: 78px;
}

/* ---------- review queue ---------- */
.queue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 14px;
  border: 1px solid #efe3c4;
  border-radius: 14px;
  background: #fffdf6;
  text-align: left;
}

.queue-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.queue-action {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--sv-waiting-soft);
  color: var(--sv-waiting);
  font-size: 12px;
  font-weight: 800;
}

.queue-skeleton {
  height: 62px;
}

.all-reports {
  width: 100%;
  margin-top: 12px;
}

.sv-empty.compact {
  padding: 22px 10px;
}

@media (max-width: 960px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .board {
    grid-template-columns: 1fr;
  }

  /* On phones, reviews come first: they are the action item. */
  .review-card {
    order: -1;
  }
}

@media (max-width: 420px) {
  .stats {
    gap: 9px;
  }

  .stat {
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    font-size: 18px;
  }

  .stat-text strong {
    font-size: 22px;
  }

  .roster-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>
