// =====================================
// SUPERVISOR API HELPER
// =====================================
// Every supervisor page calls the backend through supervisorRequest().
// It adds the JWT from sessionStorage, and handles the common errors
// (expired session, no access, server offline) in one place.

import router from '@/router';

export const API_URL: string =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function clearSessionAndGoHome() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  void router.replace('/');
}

export async function supervisorRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('inzone_token');

  if (!token) {
    clearSessionAndGoHome();
    throw new ApiError('Your session has ended. Please log in again.', 401);
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError(
      "Can't reach the InZone server. Check your connection and try again.",
      0
    );
  }

  const data = await response.json().catch(() => ({}));

  // Expired or invalid token: log out.
  if (response.status === 401) {
    clearSessionAndGoHome();
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.message || `Request failed (HTTP ${response.status}).`,
      response.status
    );
  }

  return data as T;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// =====================================
// TYPES (match the backend responses)
// =====================================

export type Id = string | number;

export type AttendanceStatus =
  | 'COMPLETE'
  | 'ON_DUTY'
  | 'NO_TIME_OUT'
  | 'NO_RECORD';

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DashboardSummary {
  assigned_students: number;
  timed_in_today: number;
  on_duty_now: number;
  missing_time_out: number;
  pending_reports: number;
  reviewed_by_me: number;
}

export interface SupervisedStudent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_status: string;
  ojt_profile_id: Id;
  company_name: string | null;
  company_address: string | null;
  required_hours: number;
  start_date: string | null;
  end_date: string | null;
  approval_status: string;
  geofence_name: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  radius_meters: string | number | null;
  days_present: number;
  last_attendance_date: string | null;
  today_time_in: string | null;
  today_time_out: string | null;
  today_status: AttendanceStatus;
  pending_reports: number;
  hours_rendered: number;
  remaining_hours: number;
  progress_percent: number;
}

export interface StudentAttendance {
  id: Id;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  time_in_status: string | null;
  time_out_status: string | null;
  has_photo_proof: boolean;
  status: AttendanceStatus;
  hours_worked: number;
}

export interface DailyAttendance {
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  approval_status: string;
  attendance_id: Id | null;
  time_in: string | null;
  time_out: string | null;
  has_photo_proof: boolean;
  status: AttendanceStatus;
  hours_worked: number;
}

export interface DailyAttendanceResponse {
  date: string;
  today: string;
  summary: {
    total: number;
    complete: number;
    on_duty: number;
    no_time_out: number;
    no_record: number;
  };
  records: DailyAttendance[];
}

export interface WeeklyReport {
  id: Id;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  week_start: string | null;
  week_end: string | null;
  report: string | null;
  status: string;
  supervisor_comment: string | null;
  supervisor_id: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface SupervisorProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string | null;
  assigned_students: number;
  companies: { company_name: string | null; students: number }[];
}

// =====================================
// FORMATTERS
// =====================================

export function fullName(person: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return [person.first_name, person.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Unnamed student';
}

export function initials(person: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return (
    `${person.first_name?.trim()[0] || ''}${person.last_name?.trim()[0] || ''}`
      .toUpperCase() || 'ST'
  );
}

// "2026-10-27" -> "Oct 27, 2026". Dates are plain calendar days,
// so they are read as noon UTC to avoid timezone shifts.
export function formatDate(
  value: string | null | undefined,
  withYear = true
): string {
  if (!value) return 'Not set';
  const day = String(value).slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date);
}

export function formatWeekday(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatWeek(start: string | null, end: string | null): string {
  if (!start && !end) return 'Week not set';
  return `${formatDate(start, false)} – ${formatDate(end)}`;
}

// Timestamp -> "8:02 AM" in Philippine time.
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
}

// 8.25 -> "8h 15m"
export function formatHours(hours: number | null | undefined): string {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Time since a timestamp, e.g. "3h 12m"
export function elapsedSince(value: string | null, now = Date.now()): string {
  if (!value) return '';
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return '';
  return formatHours((now - start) / 3_600_000);
}

export function hoursNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Today's date in the Philippines as YYYY-MM-DD
export function philippineToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
  }).format(new Date());
}

export function shiftDate(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// =====================================
// STATUS LABELS
// =====================================

export function attendanceLabel(
  status: AttendanceStatus,
  isToday = true
): string {
  switch (status) {
    case 'COMPLETE':
      return 'Timed out';
    case 'ON_DUTY':
      return 'On duty';
    case 'NO_TIME_OUT':
      return 'No time-out';
    default:
      return isToday ? 'Not in yet' : 'No record';
  }
}

export function attendanceTone(status: AttendanceStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'done';
    case 'ON_DUTY':
      return 'active';
    case 'NO_TIME_OUT':
      return 'alert';
    default:
      return 'idle';
  }
}

export function reportStatus(report: { status?: string | null }): string {
  return String(report.status || 'PENDING').toUpperCase();
}

export function reportLabel(status: string): string {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return 'Waiting for review';
  }
}

export function reportTone(status: string): string {
  switch (status) {
    case 'APPROVED':
      return 'done';
    case 'REJECTED':
      return 'alert';
    default:
      return 'waiting';
  }
}
