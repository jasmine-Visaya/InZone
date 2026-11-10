<script setup lang="ts">
// =====================================
// WEEKLY REPORT DATA
// Hours, overtime, attendance summary and progress for one week.
// Used by the student weekly report form/list and the supervisor
// weekly report review.
// =====================================
import { computed } from 'vue';
import {
  type WeekSummary,
  dayStatusLabel,
  overtimeLabel,
  hoursText,
  timeText,
} from '@/utils/weeklySummary';

const props = withDefaults(
  defineProps<{
    summary: WeekSummary;
    // Show the snapshot note ("as submitted on …")
    snapshot?: boolean;
  }>(),
  { snapshot: false }
);

const totals = computed(() => props.summary.totals);
const progress = computed(() => props.summary.progress);

const shownDays = computed(() =>
  // Hide rest days that have no attendance (e.g. an empty Sunday).
  props.summary.days.filter(
    (day) => day.status !== 'REST_DAY' || day.attendance_id
  )
);

const weekEndLabel = computed(() => {
  const date = new Date(`${props.summary.week_end}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? props.summary.week_end
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
});

const generatedAt = computed(() => {
  const date = new Date(props.summary.generated_at);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      }).format(date);
});
</script>

<template>
  <section class="wrd" aria-label="Weekly report data">
    <div class="wrd-stats">
      <div class="wrd-stat">
        <span>Days present</span>
        <strong>{{ totals.days_present }}</strong>
        <small>{{ totals.days_absent }} absent · {{ totals.holidays }} holiday{{ totals.holidays === 1 ? '' : 's' }}</small>
      </div>
      <div class="wrd-stat">
        <span>Regular hours</span>
        <strong>{{ hoursText(totals.regular_hours) }}</strong>
        <small>max {{ summary.regular_daily_hours }}h per day</small>
      </div>
      <div class="wrd-stat" :class="{ 'has-ot': totals.overtime_hours > 0 }">
        <span>Overtime</span>
        <strong>{{ hoursText(totals.overtime_hours) }}</strong>
        <small v-if="totals.overtime_hours > 0">
          {{ hoursText(totals.overtime_approved_hours) }} approved
          <template v-if="totals.overtime_pending_hours > 0"> · {{ hoursText(totals.overtime_pending_hours) }} pending</template>
          <template v-if="totals.overtime_rejected_hours > 0"> · {{ hoursText(totals.overtime_rejected_hours) }} rejected</template>
        </small>
        <small v-else>No overtime</small>
      </div>
      <div class="wrd-stat accent">
        <span>Hours counted</span>
        <strong>{{ hoursText(totals.credited_hours) }}</strong>
        <small>regular + approved OT</small>
      </div>
    </div>

    <div class="wrd-progress">
      <div class="wrd-progress-top">
        <span>Progress as of {{ weekEndLabel }}</span>
        <strong>{{ progress.rendered_hours.toFixed(1) }} / {{ progress.required_hours }} hrs · {{ progress.percent }}%</strong>
      </div>
      <div class="wrd-track" role="progressbar" :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100">
        <div class="wrd-fill" :style="{ width: `${progress.percent}%` }"></div>
      </div>
      <small>{{ progress.remaining_hours.toFixed(1) }} hrs remaining</small>
    </div>

    <ul class="wrd-days">
      <li v-for="day in shownDays" :key="day.date" class="wrd-day" :class="day.status.toLowerCase()">
        <div class="wrd-day-head">
          <strong>{{ day.label }}</strong>
          <span class="wrd-chip" :class="day.status.toLowerCase()">{{ dayStatusLabel(day) }}</span>
          <span v-if="day.overtime_status !== 'NONE'" class="wrd-chip ot" :class="day.overtime_status.toLowerCase()">
            {{ overtimeLabel(day.overtime_status) }}
          </span>
        </div>
        <div v-if="day.attendance_id" class="wrd-day-hours">
          <span>{{ timeText(day.time_in) }} – {{ timeText(day.time_out) }}</span>
          <span>{{ hoursText(day.regular_hours) }} regular</span>
          <span v-if="day.overtime_hours > 0">+ {{ hoursText(day.overtime_hours) }} OT</span>
        </div>
        <p v-if="day.holiday && day.status === 'PRESENT'" class="wrd-note">{{ day.holiday.name }}</p>
      </li>
    </ul>

    <p v-if="snapshot && generatedAt" class="wrd-note">
      Data as of submission ({{ generatedAt }}). Overtime approved later is not reflected here.
    </p>
  </section>
</template>

<style scoped>
.wrd { display: grid; gap: 12px; margin: 12px 0 16px; color: #173e2e; }
.wrd-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.wrd-stat { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 11px 12px; background: #fff; border: 1px solid #e0ebe3; border-radius: 12px; }
.wrd-stat span { font-size: 10px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: #7c9484; }
.wrd-stat strong { font-size: 18px; color: #173e2e; }
.wrd-stat small { font-size: 11px; color: #7c9484; line-height: 1.4; }
.wrd-stat.has-ot { border-color: #f0dca8; background: #fffcf2; }
.wrd-stat.accent { background: #e9f7ef; border-color: #c4e8d2; }
.wrd-stat.accent strong { color: #087a58; }
.wrd-progress { padding: 12px 14px; background: #fff; border: 1px solid #e0ebe3; border-radius: 12px; }
.wrd-progress-top { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #6b8575; }
.wrd-progress-top strong { color: #173e2e; }
.wrd-track { height: 7px; margin: 8px 0 6px; background: #e6efe9; border-radius: 10px; overflow: hidden; }
.wrd-fill { height: 100%; background: #0b946c; border-radius: inherit; }
.wrd-progress small { font-size: 11px; color: #7c9484; }
.wrd-days { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.wrd-day { padding: 10px 12px; background: #fff; border: 1px solid #e3eee7; border-radius: 11px; }
.wrd-day.absent { border-color: #f2d9d5; }
.wrd-day.holiday { background: #f4f8ff; border-color: #d8e5f7; }
.wrd-day-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.wrd-day-head strong { font-size: 13px; margin-right: auto; }
.wrd-chip { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 20px; background: #eef4f0; color: #557b61; }
.wrd-chip.present { background: #e2f5e9; color: #087a58; }
.wrd-chip.absent, .wrd-chip.no_time_out { background: #fff0ed; color: #b1443d; }
.wrd-chip.holiday { background: #e3eeff; color: #28649a; }
.wrd-chip.on_duty { background: #e7f2ff; color: #28649a; }
.wrd-chip.ot.pending { background: #fff3dc; color: #966e20; }
.wrd-chip.ot.approved { background: #e2f5e9; color: #087a58; }
.wrd-chip.ot.rejected { background: #fff0ed; color: #b1443d; }
.wrd-day-hours { display: flex; gap: 6px 14px; flex-wrap: wrap; margin-top: 6px; font-size: 12px; color: #5d7867; }
.wrd-note { margin: 4px 0 0; font-size: 11px; color: #7c9484; line-height: 1.5; }
@media (max-width: 600px) {
  .wrd-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wrd-stat strong { font-size: 16px; }
}
</style>
