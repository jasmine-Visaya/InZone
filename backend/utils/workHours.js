// =====================================
// WORK HOURS: REGULAR vs OVERTIME
// =====================================
// A day's time is split into:
//   regular  = up to REGULAR_DAILY_HOURS (default 8)
//   overtime = anything beyond that
// Overtime only counts toward the student's required hours once the
// supervisor approves it (attendance.overtime_status = 'APPROVED').
//
// "credited" = regular + approved overtime. This is what every
// "hours rendered" / progress number in the app should use.

const configuredHours = Number(process.env.REGULAR_DAILY_HOURS);

const REGULAR_DAILY_HOURS =
  Number.isFinite(configuredHours) && configuredHours > 0
    ? configuredHours
    : 8;

const REGULAR_DAILY_SECONDS = Math.round(REGULAR_DAILY_HOURS * 3600);

// SQL expressions for one attendance row.
// alias: the table alias with its dot ("a.") or "" for no alias.
function workHoursSql(alias = "") {
  const raw = `(
    CASE
      WHEN ${alias}time_in IS NOT NULL AND ${alias}time_out IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (${alias}time_out - ${alias}time_in)))
      ELSE 0
    END
  )`;

  const regular = `LEAST(${raw}, ${REGULAR_DAILY_SECONDS})`;
  const overtime = `GREATEST(${raw} - ${REGULAR_DAILY_SECONDS}, 0)`;

  const credited = `(
    ${regular} +
    CASE WHEN ${alias}overtime_status = 'APPROVED' THEN ${overtime} ELSE 0 END
  )`;

  // NONE when there is no overtime; PENDING until the supervisor decides.
  const overtimeStatus = `(
    CASE
      WHEN ${overtime} <= 0 THEN 'NONE'
      ELSE COALESCE(${alias}overtime_status, 'PENDING')
    END
  )`;

  return { raw, regular, overtime, credited, overtimeStatus };
}

function toHours(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) ? Number((value / 3600).toFixed(2)) : 0;
}

// Same split in JavaScript, for a single record already loaded.
function splitSeconds(rawSeconds, overtimeStatus) {
  const raw = Math.max(0, Number(rawSeconds) || 0);
  const regular = Math.min(raw, REGULAR_DAILY_SECONDS);
  const overtime = Math.max(0, raw - REGULAR_DAILY_SECONDS);
  const status =
    overtime <= 0 ? "NONE" : String(overtimeStatus || "PENDING").toUpperCase();
  const credited = regular + (status === "APPROVED" ? overtime : 0);

  return { raw, regular, overtime, credited, status };
}

module.exports = {
  REGULAR_DAILY_HOURS,
  REGULAR_DAILY_SECONDS,
  workHoursSql,
  splitSeconds,
  toHours,
};
