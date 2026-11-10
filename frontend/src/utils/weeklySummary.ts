// =====================================
// WEEKLY REPORT DATA (shared types + labels)
// Matches buildWeekSummary() in backend/controllers/weeklyReportController.js
// =====================================

export type OvertimeStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type WeekDayStatus =
  | 'PRESENT'
  | 'ON_DUTY'
  | 'NO_TIME_OUT'
  | 'HOLIDAY'
  | 'REST_DAY'
  | 'OUTSIDE_OJT'
  | 'UPCOMING'
  | 'ABSENT';

export interface Holiday {
  id: number | string;
  date: string;
  name: string;
  type: 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SUSPENSION' | 'LOCAL';
}

export interface WeekDay {
  date: string;
  label: string;
  status: WeekDayStatus;
  holiday: Holiday | null;
  attendance_id: string | null;
  time_in: string | null;
  time_out: string | null;
  raw_hours: number;
  regular_hours: number;
  overtime_hours: number;
  overtime_status: OvertimeStatus;
  credited_hours: number;
  accomplishment_text: string | null;
}

export interface WeekSummary {
  week_start: string;
  week_end: string;
  regular_daily_hours: number;
  holidays: Holiday[];
  last_workday: string | null;
  can_submit: boolean;
  lock_reason: string | null;
  days: WeekDay[];
  totals: {
    days_present: number;
    days_absent: number;
    holidays: number;
    regular_hours: number;
    overtime_hours: number;
    overtime_approved_hours: number;
    overtime_pending_hours: number;
    overtime_rejected_hours: number;
    credited_hours: number;
  };
  progress: {
    required_hours: number;
    rendered_hours: number;
    remaining_hours: number;
    percent: number;
  };
  suggested_report?: string;
  generated_at: string;
}

export function dayStatusLabel(day: WeekDay): string {
  switch (day.status) {
    case 'PRESENT':
      return day.holiday ? 'Worked (holiday)' : 'Present';
    case 'ON_DUTY':
      return 'On duty';
    case 'NO_TIME_OUT':
      return 'No time-out';
    case 'HOLIDAY':
      return day.holiday?.name || 'Holiday';
    case 'REST_DAY':
      return 'Rest day';
    case 'OUTSIDE_OJT':
      return 'Outside OJT';
    case 'UPCOMING':
      return 'Upcoming';
    default:
      return 'Absent';
  }
}

export function overtimeLabel(status: OvertimeStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'OT approved';
    case 'REJECTED':
      return 'OT rejected';
    case 'PENDING':
      return 'OT pending';
    default:
      return '';
  }
}

// 8.25 -> "8h 15m"
export function hoursText(hours: number | null | undefined): string {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

export function timeText(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
}

export function isWeekSummary(value: unknown): value is WeekSummary {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as WeekSummary).days) &&
      (value as WeekSummary).totals
  );
}
