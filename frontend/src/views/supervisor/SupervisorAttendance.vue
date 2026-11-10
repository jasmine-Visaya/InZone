<script setup lang="ts">
// =====================================
// SUPERVISOR: DAILY ATTENDANCE LOG
// Who timed in / out on a given day.
// API: GET /api/supervisor/attendance?date=YYYY-MM-DD
// =====================================
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  refreshOutline,
  alertCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cameraOutline,
  personAddOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import SupervisorPhotoProof from './SupervisorPhotoProof.vue';
import OvertimeReview from './OvertimeReview.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  avatarTone,
  formatTime,
  formatHours,
  formatWeekday,
  formatDate,
  philippineToday,
  shiftDate,
  attendanceLabel,
  attendanceTone,
  type DailyAttendanceResponse,
  type DailyAttendance,
  type Id,
} from './supervisorApi';

type Filter = 'ALL' | 'ON_DUTY' | 'COMPLETE' | 'NO_TIME_OUT' | 'NO_RECORD';

const router = useRouter();

const today = ref(philippineToday());
const date = ref(today.value);
const data = ref<DailyAttendanceResponse | null>(null);
const loading = ref(false);
const error = ref('');
const filter = ref<Filter>('ALL');
const photo = ref<DailyAttendance | null>(null);

const isToday = computed(() => date.value === today.value);

// Monday-to-Sunday strip for the week of the selected date.
const weekDays = computed(() => {
  const selected = new Date(`${date.value}T12:00:00Z`);
  const offset = (selected.getUTCDay() + 6) % 7; // Monday = 0
  const monday = shiftDate(date.value, -offset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftDate(monday, i);
    const d = new Date(`${day}T12:00:00Z`);
    return {
      day,
      weekday: new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' }).format(d),
      num: d.getUTCDate(),
      future: day > today.value,
    };
  });
});

// Coloured bar showing how the day split up. Click a segment to filter.
const segments = computed(() => {
  const s = data.value?.summary;
  if (!s || !s.total) return [];
  return [
    { key: 'ON_DUTY' as Filter, label: 'On duty', count: s.on_duty, tone: 'active' },
    { key: 'COMPLETE' as Filter, label: 'Timed out', count: s.complete, tone: 'done' },
    { key: 'NO_TIME_OUT' as Filter, label: 'No time-out', count: s.no_time_out, tone: 'alert' },
    { key: 'NO_RECORD' as Filter, label: isToday.value ? 'Not in yet' : 'No record', count: s.no_record, tone: 'idle' },
  ].map((seg) => ({ ...seg, width: (seg.count / s.total) * 100 }));
});

const turnoutPercent = computed(() => {
  const s = data.value?.summary;
  if (!s || !s.total) return 0;
  return Math.round(((s.on_duty + s.complete + s.no_time_out) / s.total) * 100);
});

const filters = computed(() => {
  const s = data.value?.summary;
  const list: { key: Filter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: s?.total ?? 0 },
    { key: 'ON_DUTY', label: 'On duty', count: s?.on_duty ?? 0 },
    { key: 'COMPLETE', label: 'Timed out', count: s?.complete ?? 0 },
    { key: 'NO_TIME_OUT', label: 'No time-out', count: s?.no_time_out ?? 0 },
    { key: 'NO_RECORD', label: isToday.value ? 'Not in yet' : 'No record', count: s?.no_record ?? 0 },
  ];
  // Hide empty groups except "All" to keep the bar short on phones.
  return list.filter((f) => f.key === 'ALL' || f.count > 0 || f.key === filter.value);
});

const records = computed(() => {
  const all = data.value?.records ?? [];
  return filter.value === 'ALL' ? all : all.filter((r) => r.status === filter.value);
});

async function loadAttendance() {
  loading.value = true;
  error.value = '';

  try {
    const response = await supervisorRequest<DailyAttendanceResponse>(
      `/api/supervisor/attendance?date=${encodeURIComponent(date.value)}`
    );
    data.value = response;
    today.value = response.today;
    if (filter.value !== 'ALL' && !response.records.some((r) => r.status === filter.value)) {
      filter.value = 'ALL';
    }
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load attendance.');
  } finally {
    loading.value = false;
  }
}

function goToDay(day: string) {
  if (!day || day > today.value) return;
  date.value = day;
  void loadAttendance();
}

function timesFor(record: DailyAttendance): string {
  if (record.status === 'NO_RECORD') {
    return record.approval_status !== 'APPROVED' ? 'Workplace not approved yet' : 'No time-in';
  }
  return record.time_out
    ? `${formatTime(record.time_in)} – ${formatTime(record.time_out)}`
    : `In at ${formatTime(record.time_in)}`;
}

onIonViewWillEnter(() => {
  void loadAttendance();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell">
        <header class="sv-heading">
          <div>
            <span class="sv-eyebrow">Time-in &amp; time-out</span>
            <h1>Attendance <em>log.</em></h1>
            <p>Time-in and time-out of your students for one day. Pick a date to look back.</p>
          </div>
          <button class="sv-refresh" type="button" :disabled="loading" @click="loadAttendance">
            <IonIcon :icon="refreshOutline" :class="{ 'sv-spin': loading }" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </header>

        <!-- DATE PICKER -->
        <div class="day-picker">
          <button type="button" class="step" aria-label="Previous day" :disabled="loading" @click="goToDay(shiftDate(date, -1))">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <label class="day-label">
            <span class="day-name">{{ isToday ? 'Today' : formatWeekday(date) }}</span>
            <input
              type="date"
              :value="date"
              :max="today"
              aria-label="Choose a date"
              @change="goToDay(($event.target as HTMLInputElement).value)"
            />
          </label>
          <button type="button" class="step" aria-label="Next day" :disabled="loading || isToday" @click="goToDay(shiftDate(date, 1))">
            <IonIcon :icon="chevronForwardOutline" />
          </button>
          <button v-if="!isToday" type="button" class="sv-link today-link" @click="goToDay(today)">Back to today</button>
        </div>

        <!-- WEEK STRIP -->
        <div class="week" role="group" aria-label="Days this week">
          <button
            v-for="d in weekDays"
            :key="d.day"
            type="button"
            class="week-day"
            :class="{ 'is-active': d.day === date, 'is-today': d.day === today }"
            :disabled="d.future || loading"
            :aria-pressed="d.day === date"
            @click="goToDay(d.day)"
          >
            <small>{{ d.weekday }}</small>
            <strong>{{ d.num }}</strong>
          </button>
        </div>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadAttendance">Try again</button>
        </div>

        <section class="sv-card sv-rise">
          <!-- DAY SPLIT BAR -->
          <div v-if="segments.length" class="split">
            <div class="split-head">
              <span>
                <strong>{{ turnoutPercent }}%</strong>
                {{ isToday ? 'timed in today' : 'timed in that day' }}
              </span>
              <small>{{ data?.summary.total }} {{ data?.summary.total === 1 ? 'student' : 'students' }}</small>
            </div>
            <div class="split-bar">
              <button
                v-for="seg in segments.filter((s) => s.count > 0)"
                :key="seg.key"
                type="button"
                class="split-seg"
                :class="[seg.tone, { 'is-dim': filter !== 'ALL' && filter !== seg.key }]"
                :style="{ width: `${seg.width}%` }"
                :aria-label="`${seg.label}: ${seg.count}`"
                :title="`${seg.label}: ${seg.count}`"
                @click="filter = filter === seg.key ? 'ALL' : seg.key"
              ></button>
            </div>
            <div class="split-legend">
              <span v-for="seg in segments" :key="seg.key" :class="seg.tone">
                <i></i>{{ seg.label }} <b>{{ seg.count }}</b>
              </span>
            </div>
          </div>

          <div v-if="data && data.summary.total" class="sv-tabs filters" role="tablist" aria-label="Filter by status">
            <button
              v-for="item in filters"
              :key="item.key"
              type="button"
              role="tab"
              :aria-selected="filter === item.key"
              :class="{ 'is-active': filter === item.key }"
              @click="filter = item.key"
            >
              {{ item.label }} <span class="count">{{ item.count }}</span>
            </button>
          </div>

          <div v-if="loading && !data" class="rows">
            <div v-for="n in 4" :key="n" class="sv-skeleton" style="height: 64px"></div>
          </div>

          <div v-else-if="data && !data.summary.total" class="sv-empty">
            <IonIcon :icon="personAddOutline" />
            <h3>No students assigned to you yet</h3>
            <p>Attendance shows up here once your OJT coordinator assigns students to you.</p>
          </div>

          <ul v-else-if="data" class="rows" :class="{ dim: loading }">
            <li
              v-for="(record, i) in records"
              :key="record.student_id"
              class="row sv-rise"
              :class="attendanceTone(record.status)"
              :style="{ '--i': Math.min(i, 8) }"
            >
              <button type="button" class="row-person" @click="router.push(`/supervisor/students/${record.student_id}`)">
                <span class="sv-avatar" :class="avatarTone(record.student_id)">{{ initials(record) }}</span>
                <span class="row-text">
                  <span class="sv-name">{{ fullName(record) }}</span>
                  <span class="sv-sub">{{ record.company_name || 'No company' }}</span>
                </span>
              </button>

              <span class="row-times">
                <span>{{ timesFor(record) }}</span>
                <small v-if="record.status === 'COMPLETE'">{{ formatHours(record.hours_worked) }}</small>
              </span>

              <span class="sv-pill" :class="attendanceTone(record.status)">
                {{ attendanceLabel(record.status, isToday) }}
              </span>

              <button
                v-if="record.has_photo_proof && record.attendance_id !== null"
                type="button"
                class="photo-btn"
                :aria-label="`View ${fullName(record)}'s time-in photo`"
                @click="photo = record"
              >
                <IonIcon :icon="cameraOutline" />
              </button>
              <span v-else class="photo-btn is-empty" aria-hidden="true"></span>

              <OvertimeReview
                v-if="record.attendance_id !== null && (record.overtime_hours ?? 0) > 0 && record.overtime_status && record.overtime_status !== 'NONE'"
                class="row-ot"
                :attendance-id="record.attendance_id"
                :overtime-hours="record.overtime_hours ?? 0"
                :status="record.overtime_status"
                :comment="record.overtime_comment"
                @updated="loadAttendance"
              />
            </li>
          </ul>

          <p v-if="data && data.records.some((r) => (r.overtime_hours ?? 0) > 0)" class="note">
            Hours shown count up to 8 regular hours a day. Overtime beyond that only counts
            toward the student's required hours once you approve it.
          </p>

          <p v-if="data && data.summary.no_time_out" class="note">
            "No time-out" means the student timed in on {{ formatDate(date) }} but never timed out,
            so those hours are not counted.
          </p>
        </section>
      </main>
    </IonContent>

    <SupervisorBottomNav />

    <SupervisorPhotoProof
      :attendance-id="(photo?.attendance_id as Id | null) ?? null"
      :title="photo ? fullName(photo) : 'Time-in photo'"
      :subtitle="photo ? `Time-in photo · ${formatDate(date)}` : ''"
      @close="photo = null"
    />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
/* ---------- day picker ---------- */
.day-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.step {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border: 1px solid var(--sv-line);
  border-radius: 13px;
  background: #fff;
  color: var(--sv-primary);
  font-size: 20px;
}

.day-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  flex: 0 1 380px;
  height: 46px;
  padding: 0 8px 0 14px;
  border: 1px solid var(--sv-line);
  border-radius: 13px;
  background: #fff;
}

.day-name {
  color: var(--sv-ink);
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-label input {
  border: 0;
  background: transparent;
  color: var(--sv-ink-soft);
  font-size: 13px;
  min-width: 0;
}

.today-link {
  margin-left: 4px;
}

/* ---------- week strip ---------- */
.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  max-width: 560px;
  margin-bottom: 18px;
}

.week-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 9px 0 10px;
  border: 1px solid var(--sv-line);
  border-radius: 14px;
  background: #fff;
  color: var(--sv-ink-soft);
  transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.week-day small {
  color: var(--sv-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.week-day strong {
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.week-day:not(:disabled):not(.is-active):hover {
  transform: translateY(-2px);
  border-color: #bfe0cc;
}

.week-day.is-today::after {
  content: '';
  position: absolute;
  bottom: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sv-accent);
}

.week-day.is-active {
  border-color: var(--sv-primary);
  background: linear-gradient(160deg, #0b8c65, #075441);
  color: #fff;
  box-shadow: 0 10px 20px #0b795933;
}

.week-day.is-active small {
  color: #b4f8d8;
}

.week-day.is-active.is-today::after {
  background: #8cf8b7;
}

.week-day:disabled {
  opacity: 0.4;
}

/* ---------- day split bar ---------- */
.split {
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px dashed #e3eee7;
}

.split-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: var(--sv-muted);
  font-size: 13px;
}

.split-head strong {
  color: var(--sv-ink);
  font-size: 24px;
  letter-spacing: -0.8px;
  margin-right: 4px;
}

.split-bar {
  display: flex;
  gap: 3px;
  height: 14px;
  border-radius: 99px;
  overflow: hidden;
  background: #eef3f0;
}

.split-seg {
  min-width: 10px;
  padding: 0;
  border: 0;
  transition: opacity 0.2s ease, filter 0.2s ease, width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.split-seg:hover {
  filter: brightness(1.08);
}

.split-seg.is-dim {
  opacity: 0.3;
}

.split-seg.active { background: var(--sv-active); }
.split-seg.done { background: var(--sv-accent); }
.split-seg.alert { background: var(--sv-alert); }
.split-seg.idle { background: #c9d6cf; }

.split-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  color: var(--sv-muted);
  font-size: 11px;
}

.split-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.split-legend i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
}

.split-legend b {
  color: var(--sv-ink);
}

.split-legend .active i { background: var(--sv-active); }
.split-legend .done i { background: var(--sv-accent); }
.split-legend .alert i { background: var(--sv-alert); }
.split-legend .idle i { background: #c9d6cf; }

/* ---------- list ---------- */
.filters {
  margin-bottom: 14px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s ease;
}

.rows.dim {
  opacity: 0.55;
}

.row {
  --rail: #d3ddd7;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border: 1px solid #e6efe9;
  border-radius: 14px;
  background: #fcfefd;
  overflow: hidden;
}

.row-ot {
  grid-column: 1 / -1;
}

.row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: var(--rail);
}

.row.active { --rail: var(--sv-active); }
.row.done { --rail: var(--sv-accent); }

.row {
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.row:hover {
  border-color: #c7e2d2;
  box-shadow: 0 8px 20px #104a330d;
}
.row.alert { --rail: var(--sv-alert); }

.row-person {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}

.row-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-times {
  display: flex;
  flex-direction: column;
  color: var(--sv-ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.row.idle .row-times {
  color: var(--sv-muted);
}

.row-times small {
  margin-top: 2px;
  color: var(--sv-muted);
  font-size: 12px;
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

.note {
  margin: 14px 2px 0;
  color: var(--sv-muted);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 680px) {
  /* Phone: name + photo on top, times + status underneath */
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }

  .row-person { grid-column: 1; grid-row: 1; }
  .photo-btn { grid-column: 2; grid-row: 1; justify-self: end; }
  .row-times { grid-column: 1; grid-row: 2; padding-left: 55px; }
  .row > .sv-pill { grid-column: 2; grid-row: 2; justify-self: end; }

  .today-link {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rows {
    transition: none;
  }
}
</style>
