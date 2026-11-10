// =====================================
// HOLIDAYS + WORKING DAYS
// =====================================
// Holidays live in the `holidays` table (managed by the admin).
// Shared helpers:
//   getHoliday(date)               -> holiday row or null
//   getHolidaysBetween(from, to)   -> holiday rows in range
//   getWeekInfo(anyDateInWeek)     -> Mon–Sun week with workdays/holidays
//
// Columns match Loui's isHoliday() in attendanceController
// (holiday_date, holiday_name, holiday_type).

const pool = require("../src/config/database");

// Working weekdays, ISO numbering (1 = Monday ... 7 = Sunday).
// Default Monday–Friday. Set WORK_DAYS=1,2,3,4,5,6 to include Saturday.
const WORK_DAYS = (() => {
  const parsed = String(process.env.WORK_DAYS || "1,2,3,4,5")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
  return new Set(parsed.length ? parsed : [1, 2, 3, 4, 5]);
})();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

// 1 = Monday ... 7 = Sunday
function isoWeekday(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function mondayOf(day) {
  return addDays(day, 1 - isoWeekday(day));
}

function isWorkWeekday(day) {
  return WORK_DAYS.has(isoWeekday(day));
}

function mapHoliday(row) {
  return {
    id: row.id,
    date: row.holiday_date,
    name: row.holiday_name,
    type: row.holiday_type,
  };
}

async function getHolidaysBetween(from, to, db = pool) {
  const result = await db.query(
    `SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_name, holiday_type
     FROM holidays
     WHERE holiday_date BETWEEN $1::date AND $2::date
     ORDER BY holiday_date`,
    [from, to]
  );
  return result.rows.map(mapHoliday);
}

async function getHoliday(date, db = pool) {
  const rows = await getHolidaysBetween(date, date, db);
  return rows[0] || null;
}

// Week (Monday–Sunday) containing `day`.
// workdays     = working weekdays that are not holidays
// last_workday = the day the weekly report unlocks (after time out)
async function getWeekInfo(day, db = pool) {
  const weekStart = mondayOf(day);
  const weekEnd = addDays(weekStart, 6);
  const holidays = await getHolidaysBetween(weekStart, weekEnd, db);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    days.push({
      date,
      weekday: isoWeekday(date),
      is_work_weekday: isWorkWeekday(date),
      holiday: holidayByDate.get(date) || null,
    });
  }

  const workdays = days
    .filter((d) => d.is_work_weekday && !d.holiday)
    .map((d) => d.date);

  return {
    week_start: weekStart,
    week_end: weekEnd,
    days,
    holidays,
    workdays,
    last_workday: workdays.length ? workdays[workdays.length - 1] : null,
  };
}

module.exports = {
  WORK_DAYS,
  isValidDate,
  addDays,
  isoWeekday,
  mondayOf,
  isWorkWeekday,
  getHolidaysBetween,
  getHoliday,
  getWeekInfo,
};
