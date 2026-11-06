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
  arrowForwardOutline,
  personAddOutline,
  pulseOutline,
  cloudDoneOutline,
  sparklesOutline,
  checkmarkOutline,
  shieldCheckmarkOutline,
  timeOutline,
  calendarOutline,
  locationOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  avatarTone,
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

type RosterFilter = 'ALL' | 'ON_DUTY' | 'COMPLETE' | 'OUT';

const router = useRouter();

const summary = ref<DashboardSummary | null>(null);
const today = ref<DailyAttendanceResponse | null>(null);
const pending = ref<WeeklyReport[]>([]);
const loading = ref(false);
const error = ref('');
const now = ref(Date.now());
const syncedAt = ref<number | null>(null);
const rosterFilter = ref<RosterFilter>('ALL');
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

const n = (value: number | undefined | null) => Number(value ?? 0);
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.max(0, Math.round((part / whole) * 100))) : 0;

const assigned = computed(() => n(summary.value?.assigned_students));
const timedIn = computed(() => n(summary.value?.timed_in_today));
const onDuty = computed(() => n(summary.value?.on_duty_now));
const toReview = computed(() => n(summary.value?.pending_reports));
const reviewed = computed(() => n(summary.value?.reviewed_by_me));

const hasStudents = computed(() => assigned.value > 0);
const firstLoad = computed(() => loading.value && !summary.value);
const turnout = computed(() => pct(timedIn.value, assigned.value));

const syncedLabel = computed(() =>
  syncedAt.value ? `Updated ${formatTime(new Date(syncedAt.value).toISOString())}` : 'Not synced yet'
);

// Hero headline reads like a sentence about today.
const hero = computed(() => {
  if (!summary.value) {
    return { lead: 'Getting your', accent: 'workspace ready…', body: 'Loading today’s attendance and reports.' };
  }
  if (!hasStudents.value) {
    return {
      lead: 'Your workspace is',
      accent: 'ready.',
      body: 'Once your OJT coordinator assigns students to you, you’ll see who is on duty, their rendered hours, and the reports waiting for you — all here.',
    };
  }
  if (onDuty.value > 0) {
    return {
      lead: `${onDuty.value} of ${assigned.value} ${assigned.value === 1 ? 'student is' : 'students are'}`,
      accent: 'on duty now.',
      body: `${timedIn.value} timed in today. ${toReview.value ? `${toReview.value} weekly ${toReview.value === 1 ? 'report is' : 'reports are'} waiting for your review.` : 'No reports are waiting for you.'}`,
    };
  }
  if (timedIn.value > 0) {
    return {
      lead: `${timedIn.value} of ${assigned.value} students`,
      accent: 'came in today.',
      body: 'Everyone who timed in has already timed out. Check the attendance log for the hours rendered.',
    };
  }
  return {
    lead: 'No one has',
    accent: 'timed in yet.',
    body: 'Students appear here the moment they time in inside their workplace geofence.',
  };
});

const stats = computed(() => [
  {
    label: 'Students',
    value: summary.value?.assigned_students,
    hint: 'assigned to you',
    icon: peopleOutline,
    tone: 'green',
    to: '/supervisor/students',
    fill: hasStudents.value ? 100 : 0,
  },
  {
    label: 'In today',
    value: summary.value?.timed_in_today,
    hint: summary.value ? `${onDuty.value} still on duty` : '',
    icon: enterOutline,
    tone: 'blue',
    to: '/supervisor/attendance',
    fill: turnout.value,
  },
  {
    label: 'To review',
    value: summary.value?.pending_reports,
    hint: 'weekly reports',
    icon: documentTextOutline,
    tone: 'amber',
    to: '/supervisor/reports',
    fill: pct(toReview.value, toReview.value + reviewed.value),
  },
  {
    label: 'Reviewed',
    value: summary.value?.reviewed_by_me,
    hint: 'by you so far',
    icon: checkmarkDoneOutline,
    tone: 'mint',
    to: '/supervisor/reports',
    fill: pct(reviewed.value, toReview.value + reviewed.value),
  },
]);

const rosterFilters = computed(() => {
  const s = today.value?.summary;
  return [
    { key: 'ALL' as const, label: 'Everyone', count: s?.total ?? 0 },
    { key: 'ON_DUTY' as const, label: 'On duty', count: s?.on_duty ?? 0 },
    { key: 'COMPLETE' as const, label: 'Done', count: s?.complete ?? 0 },
    { key: 'OUT' as const, label: 'Not in', count: (s?.no_record ?? 0) + (s?.no_time_out ?? 0) },
  ];
});

const roster = computed(() => {
  const all = today.value?.records ?? [];
  switch (rosterFilter.value) {
    case 'ON_DUTY':
      return all.filter((r) => r.status === 'ON_DUTY');
    case 'COMPLETE':
      return all.filter((r) => r.status === 'COMPLETE');
    case 'OUT':
      return all.filter((r) => r.status === 'NO_RECORD' || r.status === 'NO_TIME_OUT');
    default:
      return all;
  }
});

// Getting-started steps shown while no students are assigned.
const steps = [
  { title: 'Your account is active', body: 'You can sign in and use the supervisor portal.', icon: shieldCheckmarkOutline, state: 'done' },
  { title: 'Coordinator assigns students', body: 'After approving a student’s workplace, your OJT coordinator links them to you.', icon: personAddOutline, state: 'current' },
  { title: 'Track and review', body: 'Watch time-ins live, check photos, and approve weekly reports.', icon: checkmarkDoneOutline, state: 'next' },
];

const previews = [
  { icon: timeOutline, title: 'Live attendance', body: 'See who is on duty and for how long.' },
  { icon: documentTextOutline, title: 'Weekly reports', body: 'Approve or send back with a comment.' },
  { icon: calendarOutline, title: 'Look back', body: 'Pick any day to see time-ins and photos.' },
];

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

// How far through an 8-hour shift an on-duty student is (for the mini bar).
function shiftPercent(record: DailyAttendance): number {
  if (record.status === 'COMPLETE') return 100;
  if (record.status !== 'ON_DUTY' || !record.time_in) return 0;
  const hours = (now.value - new Date(record.time_in).getTime()) / 3_600_000;
  return pct(hours, 8);
}

function waitingDays(report: WeeklyReport): string {
  if (!report.created_at) return '';
  const days = Math.floor((now.value - new Date(report.created_at).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 1) return 'New';
  return `${days}d waiting`;
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
    syncedAt.value = now.value;
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
        <!-- GREETING -->
        <header class="sv-heading">
          <div>
            <span class="sv-eyebrow"><span class="sv-live-dot"></span> Supervisor workspace</span>
            <h1>{{ greeting }}, <em>{{ firstName }}.</em></h1>
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

        <!-- HERO: today in one sentence + turnout ring -->
        <section class="sv-hero hero sv-rise" aria-label="Today at a glance">
          <div class="hero-copy">
            <span class="sv-hero-kicker"><IonIcon :icon="sparklesOutline" /> TODAY AT THE WORKPLACE</span>
            <h2>{{ hero.lead }} <span>{{ hero.accent }}</span></h2>
            <p>{{ hero.body }}</p>

            <div class="hero-actions">
              <button type="button" class="sv-hero-btn" @click="router.push('/supervisor/reports')">
                Review reports
                <span v-if="toReview" class="badge">{{ toReview }}</span>
                <IonIcon v-else :icon="arrowForwardOutline" />
              </button>
              <button type="button" class="sv-hero-btn ghost" @click="router.push('/supervisor/attendance')">
                Attendance log <IonIcon :icon="chevronForwardOutline" />
              </button>
            </div>

            <span class="sync-stamp"><IonIcon :icon="cloudDoneOutline" /> {{ syncedLabel }}</span>
          </div>

          <div class="hero-visual" aria-hidden="true">
            <span class="orbit orbit-one"></span>
            <span class="orbit orbit-two"></span>
            <!-- Before any students: a location pin, like the student hero -->
            <div v-if="summary && !hasStudents" class="pin-core">
              <IonIcon :icon="locationOutline" />
            </div>
            <div v-else class="big-ring" :style="{ '--p': turnout }">
              <div class="big-ring-inner">
                <small>TURNOUT</small>
                <strong>{{ summary ? `${turnout}%` : '—' }}</strong>
                <span>{{ timedIn }} of {{ assigned }} timed in</span>
              </div>
            </div>
            <template v-if="hasStudents">
              <span class="orbit-chip chip-a"><IonIcon :icon="pulseOutline" /> {{ onDuty }} on duty</span>
              <span class="orbit-chip chip-b"><IonIcon :icon="documentTextOutline" /> {{ toReview }} to review</span>
            </template>
            <span v-else-if="summary" class="orbit-chip chip-a"><IonIcon :icon="checkmarkDoneOutline" /> {{ reviewed }} reviewed</span>
          </div>
        </section>

        <!-- MISSING TIME-OUT STRIP -->
        <button
          v-if="summary && summary.missing_time_out > 0"
          type="button"
          class="missing-strip sv-rise"
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

        <!-- METRICS -->
        <section class="stats" aria-label="Summary">
          <button
            v-for="(stat, i) in stats"
            :key="stat.label"
            type="button"
            class="stat sv-lift sv-rise"
            :class="stat.tone"
            :style="{ '--i': i + 1 }"
            @click="router.push(stat.to)"
          >
            <span class="stat-top">
              <span class="stat-icon"><IonIcon :icon="stat.icon" /></span>
              <span class="stat-index">0{{ i + 1 }}</span>
            </span>
            <small>{{ stat.label }}</small>
            <strong>{{ firstLoad ? '–' : stat.value ?? 0 }}</strong>
            <em>{{ stat.hint }}</em>
            <span class="mini-track"><span :style="{ width: `${stat.fill}%` }"></span></span>
          </button>
        </section>

        <!-- NO STUDENTS YET: getting started -->
        <section v-if="summary && !hasStudents" class="sv-card start sv-rise" style="--i: 5">
          <div class="sv-section-head">
            <div>
              <span class="sv-eyebrow">Getting started</span>
              <h2>You're one step away</h2>
              <p>Here's what happens before your students show up on this page.</p>
            </div>
          </div>

          <ol class="steps">
            <li v-for="(step, i) in steps" :key="step.title" class="step" :class="step.state">
              <span class="step-dot">
                <IonIcon :icon="step.state === 'done' ? checkmarkOutline : step.icon" />
              </span>
              <span class="step-text">
                <small>STEP 0{{ i + 1 }}</small>
                <strong>{{ step.title }}</strong>
                <span>{{ step.body }}</span>
              </span>
              <span v-if="step.state === 'current'" class="sv-pill waiting">Waiting</span>
            </li>
          </ol>

          <div class="previews">
            <div v-for="item in previews" :key="item.title" class="preview">
              <IonIcon :icon="item.icon" />
              <strong>{{ item.title }}</strong>
              <span>{{ item.body }}</span>
            </div>
          </div>
        </section>

        <div v-else class="board">
          <!-- TODAY AT THE WORKPLACE -->
          <section class="sv-card roster-card sv-rise" style="--i: 5">
            <div class="sv-section-head">
              <div>
                <span class="sv-eyebrow">Live roster</span>
                <h2>At the workplace today</h2>
                <p v-if="today">
                  {{ today.summary.on_duty }} on duty · {{ today.summary.complete }} done ·
                  {{ today.summary.no_record }} not in
                </p>
              </div>
              <button type="button" class="sv-link" @click="router.push('/supervisor/attendance')">
                Attendance log <IonIcon :icon="arrowForwardOutline" />
              </button>
            </div>

            <div v-if="today && today.records.length" class="sv-chips roster-chips" role="tablist" aria-label="Filter roster">
              <button
                v-for="item in rosterFilters"
                :key="item.key"
                type="button"
                role="tab"
                class="sv-chip"
                :class="{ 'is-active': rosterFilter === item.key }"
                :aria-selected="rosterFilter === item.key"
                @click="rosterFilter = item.key"
              >
                {{ item.label }} <b>{{ item.count }}</b>
              </button>
            </div>

            <div v-if="firstLoad" class="roster">
              <div v-for="i in 3" :key="i" class="sv-skeleton roster-skeleton"></div>
            </div>

            <p v-else-if="today && !roster.length" class="roster-empty">
              Nobody in this group right now.
            </p>

            <TransitionGroup v-else-if="today" tag="ul" name="list" class="roster">
              <li v-for="record in roster" :key="record.student_id">
                <button
                  type="button"
                  class="roster-row"
                  :class="attendanceTone(record.status)"
                  @click="router.push(`/supervisor/students/${record.student_id}`)"
                >
                  <span class="sv-avatar" :class="avatarTone(record.student_id)">{{ initials(record) }}</span>
                  <span class="roster-main">
                    <span class="roster-top">
                      <span class="sv-name">{{ fullName(record) }}</span>
                      <span class="sv-pill" :class="attendanceTone(record.status)">
                        {{ attendanceLabel(record.status) }}
                      </span>
                    </span>
                    <span class="sv-sub">{{ record.company_name || 'No company' }}</span>
                    <span class="roster-detail">{{ rowDetail(record) }}</span>
                    <span v-if="record.status === 'ON_DUTY' || record.status === 'COMPLETE'" class="shift-bar" aria-hidden="true">
                      <span :style="{ width: `${shiftPercent(record)}%` }"></span>
                    </span>
                  </span>
                  <IonIcon :icon="chevronForwardOutline" class="row-arrow" />
                </button>
              </li>
            </TransitionGroup>
          </section>

          <!-- WAITING FOR REVIEW -->
          <section class="sv-card review-card sv-rise" style="--i: 6">
            <div class="sv-section-head">
              <div>
                <span class="sv-eyebrow">Action board</span>
                <h2>Waiting for you</h2>
                <p>Oldest submissions first.</p>
              </div>
              <span v-if="pending.length" class="count-tag">{{ pending.length }}</span>
            </div>

            <div v-if="firstLoad" class="queue">
              <div v-for="i in 2" :key="i" class="sv-skeleton queue-skeleton"></div>
            </div>

            <div v-else-if="!pending.length" class="sv-empty compact">
              <IonIcon :icon="checkmarkDoneOutline" />
              <h3>All caught up</h3>
              <p>New weekly reports from your students will show up here.</p>
            </div>

            <ul v-else class="queue">
              <li v-for="(report, i) in pending.slice(0, 4)" :key="report.id">
                <button type="button" class="queue-row" @click="openReport(report)">
                  <span class="queue-index">0{{ i + 1 }}</span>
                  <span class="sv-avatar small" :class="avatarTone(report.user_id ?? report.id)">{{ initials(report) }}</span>
                  <span class="queue-main">
                    <span class="sv-name">{{ fullName(report) }}</span>
                    <span class="sv-sub">Week of {{ formatWeek(report.week_start, report.week_end) }}</span>
                  </span>
                  <span class="queue-action">
                    <small>{{ waitingDays(report) }}</small>
                    Review
                  </span>
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
              <IonIcon :icon="arrowForwardOutline" />
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
/* ---------- hero ---------- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
  align-items: center;
  gap: 20px;
  min-height: 300px;
  margin-bottom: 18px;
}

.hero-copy {
  position: relative;
  z-index: 1;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.sync-stamp {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 20px;
  color: #b2dec9;
  font-size: 10px;
}

.hero-visual {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 260px;
}

.orbit {
  position: absolute;
  border-radius: 50%;
  border: 1px dashed #dcffe549;
}

.orbit-one {
  width: 262px;
  height: 262px;
  animation: orbit-spin 40s linear infinite;
}

.orbit-two {
  width: 222px;
  height: 222px;
  border-style: solid;
  border-color: #effff119;
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}

.big-ring {
  --p: 0;
  display: grid;
  place-items: center;
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: conic-gradient(#8cf8b7 calc(var(--p) * 1%), #ffffff24 0);
  box-shadow: 0 15px 60px #03271e77;
}

.big-ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 162px;
  height: 162px;
  border-radius: 50%;
  background: #0a5340;
  text-align: center;
}

.pin-core {
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  border-radius: 28px;
  background: #ceffe1;
  color: #08765a;
  font-size: 44px;
  box-shadow: 0 0 0 14px #ffffff10, 0 0 0 28px #ffffff08, 0 15px 50px #03271e66;
  animation: chip-bob 4s ease-in-out infinite;
}

.big-ring-inner small {
  color: #b5f3d2;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1.5px;
}

.big-ring-inner strong {
  font-size: 42px;
  line-height: 1.15;
  letter-spacing: -2px;
}

.big-ring-inner span {
  color: #bbe2ce;
  font-size: 10px;
}

.orbit-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: 12px;
  background: #ffffffed;
  color: #0d7050;
  font-size: 10px;
  font-weight: 850;
  box-shadow: 0 8px 30px #002e222c;
  animation: chip-bob 4s ease-in-out infinite;
}

.chip-a { top: 14px; right: 4px; }
.chip-b { bottom: 16px; left: 4px; animation-delay: -2s; }

@keyframes chip-bob {
  50% { transform: translateY(-6px); }
}

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
  transition: transform 0.18s ease;
}

.missing-strip:hover {
  transform: translateX(3px);
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

/* ---------- metrics (admin style) ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat {
  --accent: #169b72;
  --pale: #e0f7ec;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--sv-line);
  border-radius: 19px;
  background: #fff;
  box-shadow: 0 9px 28px #104a3310;
  text-align: left;
}

.stat.blue { --accent: #3f7fb0; --pale: #e5f1f8; }
.stat.amber { --accent: #b98228; --pale: #fff4db; }
.stat.mint { --accent: #167e71; --pale: #e1f4ee; }

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--pale);
  color: var(--accent);
  font-size: 22px;
  transition: transform 0.25s ease;
}

.stat:hover .stat-icon {
  transform: rotate(-8deg) scale(1.06);
}

.stat-index {
  color: #c9dccf;
  font-size: 11px;
  font-weight: 900;
}

.stat small {
  margin-top: 18px;
  color: var(--sv-muted);
  font-size: 11px;
  font-weight: 800;
}

.stat strong {
  color: var(--sv-ink);
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1.15;
  letter-spacing: -1.4px;
  font-variant-numeric: tabular-nums;
}

.stat em {
  width: 100%;
  margin-bottom: 14px;
  font-style: normal;
  color: #91a698;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-track {
  width: 100%;
  height: 5px;
  border-radius: 99px;
  background: #edf4ee;
  overflow: hidden;
}

.mini-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}

/* ---------- getting started ---------- */
.steps {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 0 18px;
}

/* connector line between steps */
.step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 21px;
  top: 56px;
  bottom: -2px;
  width: 2px;
  background: linear-gradient(#cfe6d8, #e8f2ec);
}

.step-dot {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #eef3f0;
  color: #9aaca1;
  font-size: 20px;
}

.step.done .step-dot {
  background: var(--sv-primary);
  color: #fff;
}

.step.current .step-dot {
  background: var(--sv-waiting-soft);
  color: var(--sv-waiting);
  box-shadow: 0 0 0 0 #e9b84a66;
  animation: step-ping 2s ease-out infinite;
}

@keyframes step-ping {
  70% { box-shadow: 0 0 0 10px #e9b84a00; }
}

.step-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.step-text small {
  color: #a7b7ac;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.2px;
}

.step-text strong {
  color: var(--sv-ink);
  font-size: 15px;
}

.step.next .step-text strong {
  color: var(--sv-muted);
}

.step-text span {
  color: var(--sv-muted);
  font-size: 12px;
  line-height: 1.6;
}

.previews {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px dashed #cfe3d6;
  border-radius: 16px;
  background: #f7fbf8;
}

.preview ion-icon {
  margin-bottom: 6px;
  color: var(--sv-accent);
  font-size: 22px;
}

.preview strong {
  color: var(--sv-ink);
  font-size: 13px;
}

.preview span {
  color: var(--sv-muted);
  font-size: 11px;
  line-height: 1.5;
}

/* ---------- board ---------- */
.board {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.roster-chips {
  margin-bottom: 14px;
}

.roster,
.queue {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.roster-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--sv-muted);
  font-size: 13px;
}

.roster-row {
  --rail: var(--sv-idle);
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 13px 13px 17px;
  border: 1px solid #e6efe9;
  border-radius: 14px;
  background: #fcfefd;
  text-align: left;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
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
  transform: translateX(3px);
  border-color: #c7e2d2;
  box-shadow: 0 8px 20px #104a330d;
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

.shift-bar {
  height: 4px;
  margin-top: 9px;
  border-radius: 99px;
  background: #e8f0eb;
  overflow: hidden;
}

.shift-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rail);
  transition: width 0.7s ease;
}

.row-arrow {
  flex-shrink: 0;
  color: #a9c0b2;
  font-size: 17px;
  transition: transform 0.18s ease, color 0.18s ease;
}

.roster-row:hover .row-arrow {
  transform: translateX(2px);
  color: var(--sv-primary);
}

.roster-skeleton {
  height: 78px;
}

/* list filter animation */
.list-enter-active,
.list-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ---------- review queue ---------- */
.count-tag {
  flex-shrink: 0;
  padding: 7px 11px;
  border-radius: 30px;
  background: #fff2d8;
  color: #966220;
  font-size: 11px;
  font-weight: 850;
}

.queue-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 12px;
  border: 1px solid #efe3c4;
  border-radius: 14px;
  background: #fffdf6;
  text-align: left;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.queue-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px #96701d14;
}

.queue-index {
  color: #cbb98f;
  font-size: 10px;
  font-weight: 900;
}

.sv-avatar.small {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  font-size: 12px;
}

.queue-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.queue-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  color: var(--sv-waiting);
  font-size: 12px;
  font-weight: 850;
}

.queue-action small {
  color: #b39a62;
  font-size: 10px;
  font-weight: 700;
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
    /* minmax(0, …) stops the scrolling chip row from widening the column */
    grid-template-columns: minmax(0, 1fr);
  }

  /* On phones, reviews come first: they are the action item. */
  .review-card {
    order: -1;
  }
}

@media (max-width: 760px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: 230px;
    margin: -10px 0 -20px;
    transform: scale(0.85);
  }

  .previews {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .stats {
    gap: 9px;
  }

  .stat {
    padding: 14px;
    border-radius: 16px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    font-size: 18px;
  }

  .roster-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .orbit-chip {
    font-size: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orbit-one,
  .orbit-chip,
  .pin-core,
  .step.current .step-dot {
    animation: none;
  }

  .roster-row,
  .queue-row,
  .missing-strip,
  .stat-icon {
    transition: none;
  }
}
</style>
