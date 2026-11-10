
const pool = require("../src/config/database");
const { getPhilippineDate } = require("../utils/dateTime");
const { getWeekInfo, isValidDate } = require("../utils/holidays");
const { REGULAR_DAILY_HOURS, workHoursSql, toHours } = require("../utils/workHours");

const HOURS = workHoursSql("a.");

function formatDay(day) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function formatLongDay(day) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

// =====================================
// WEEK SUMMARY (data inside the weekly report)
// =====================================
// Builds everything the weekly report shows for the Monday–Sunday week
// containing `day`:
//   * per-day time in/out, regular hours, overtime + its status
//   * attendance summary (present / absent / holidays)
//   * progress toward required hours as of the end of the week
//   * whether the report can be submitted yet (unlock rule)
//
// Unlock rule: the report opens after the student times out on the
// week's LAST WORKING DAY. Holidays are skipped, so if Friday is a
// holiday the report opens after Thursday's time out.
async function buildWeekSummary(userId, day) {
  const today = getPhilippineDate();
  const week = await getWeekInfo(day);

  const profileResult = await pool.query(
    `SELECT
       required_hours,
       TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
       TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
     FROM ojt_profiles
     WHERE user_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
  const profile = profileResult.rows[0] || {};

  const attendanceResult = await pool.query(
    `SELECT
       a.id,
       TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
       a.time_in,
       a.time_out,
       a.accomplishment_text,
       ${HOURS.raw} AS raw_seconds,
       ${HOURS.regular} AS regular_seconds,
       ${HOURS.overtime} AS overtime_seconds,
       ${HOURS.overtimeStatus} AS overtime_status,
       ${HOURS.credited} AS credited_seconds
     FROM attendance a
     WHERE a.user_id = $1
       AND a.attendance_date BETWEEN $2::date AND $3::date
     ORDER BY a.attendance_date, a.time_in`,
    [userId, week.week_start, week.week_end]
  );
  const recordByDate = new Map(
    attendanceResult.rows.map((row) => [row.attendance_date, row])
  );

  // Credited hours from the start of OJT up to the end of this week.
  const progressResult = await pool.query(
    `SELECT COALESCE(SUM(${HOURS.credited}), 0) AS credited_seconds
     FROM attendance a
     WHERE a.user_id = $1
       AND a.attendance_date <= $2::date`,
    [userId, week.week_end]
  );

  const inOjtPeriod = (date) =>
    (!profile.start_date || date >= profile.start_date) &&
    (!profile.end_date || date <= profile.end_date);

  const totals = {
    days_present: 0,
    days_absent: 0,
    holidays: week.holidays.length,
    regular_hours: 0,
    overtime_hours: 0,
    overtime_approved_hours: 0,
    overtime_pending_hours: 0,
    overtime_rejected_hours: 0,
    credited_hours: 0,
  };
  let regularSeconds = 0;
  let creditedSeconds = 0;
  const overtimeSeconds = { ALL: 0, APPROVED: 0, PENDING: 0, REJECTED: 0 };

  const days = week.days.map((info) => {
    const record = recordByDate.get(info.date);
    let status;

    if (record && record.time_in) {
      if (record.time_out) status = "PRESENT";
      else status = info.date === today ? "ON_DUTY" : "NO_TIME_OUT";
    } else if (info.holiday) {
      status = "HOLIDAY";
    } else if (!info.is_work_weekday) {
      status = "REST_DAY";
    } else if (!inOjtPeriod(info.date)) {
      status = "OUTSIDE_OJT";
    } else if (info.date >= today) {
      status = "UPCOMING";
    } else {
      status = "ABSENT";
    }

    if (record && record.time_in) totals.days_present += 1;
    if (status === "ABSENT") totals.days_absent += 1;

    const overtime = record ? Number(record.overtime_seconds) || 0 : 0;
    const overtimeStatus = record ? record.overtime_status : "NONE";

    if (record) {
      regularSeconds += Number(record.regular_seconds) || 0;
      creditedSeconds += Number(record.credited_seconds) || 0;
      overtimeSeconds.ALL += overtime;
      if (overtimeSeconds[overtimeStatus] !== undefined) {
        overtimeSeconds[overtimeStatus] += overtime;
      }
    }

    return {
      date: info.date,
      label: formatDay(info.date),
      status,
      holiday: info.holiday,
      attendance_id: record ? record.id : null,
      time_in: record ? record.time_in : null,
      time_out: record ? record.time_out : null,
      raw_hours: record ? toHours(record.raw_seconds) : 0,
      regular_hours: record ? toHours(record.regular_seconds) : 0,
      overtime_hours: toHours(overtime),
      overtime_status: overtimeStatus,
      credited_hours: record ? toHours(record.credited_seconds) : 0,
      accomplishment_text: record ? record.accomplishment_text : null,
    };
  });

  totals.regular_hours = toHours(regularSeconds);
  totals.overtime_hours = toHours(overtimeSeconds.ALL);
  totals.overtime_approved_hours = toHours(overtimeSeconds.APPROVED);
  totals.overtime_pending_hours = toHours(overtimeSeconds.PENDING);
  totals.overtime_rejected_hours = toHours(overtimeSeconds.REJECTED);
  totals.credited_hours = toHours(creditedSeconds);

  const requiredHours = Number(profile.required_hours) || 0;
  const renderedHours = toHours(progressResult.rows[0].credited_seconds);

  // ---- Unlock rule ----
  const workdays = week.workdays.filter(inOjtPeriod);
  const lastWorkday = workdays.length ? workdays[workdays.length - 1] : null;
  const weekOutsideOjt =
    (profile.start_date && week.week_end < profile.start_date) ||
    (profile.end_date && week.week_start > profile.end_date);

  let canSubmit = false;
  let lockReason = null;

  if (weekOutsideOjt) {
    lockReason = "This week is outside your OJT period.";
  } else if (!lastWorkday) {
    // Whole week is holidays / rest days: open once the week is over.
    canSubmit = today > week.week_end;
    if (!canSubmit) {
      lockReason = `This week has no working days. You can submit after ${formatLongDay(week.week_end)}.`;
    }
  } else if (today > lastWorkday) {
    canSubmit = true;
  } else if (today === lastWorkday) {
    const lastRecord = recordByDate.get(lastWorkday);
    canSubmit = Boolean(lastRecord && lastRecord.time_out);
    if (!canSubmit) {
      lockReason = "You can submit this report after you time out today.";
    }
  } else {
    lockReason = `You can submit this report after you time out on ${formatLongDay(lastWorkday)}.`;
  }

  // Explain when a holiday moved the last working day earlier.
  const skippedHolidays = week.days.filter(
    (d) => d.holiday && d.is_work_weekday && (!lastWorkday || d.date > lastWorkday)
  );
  if (lockReason && lastWorkday && skippedHolidays.length) {
    lockReason += ` (${skippedHolidays
      .map((d) => `${formatDay(d.date)} is ${d.holiday.name}`)
      .join(", ")}.)`;
  }

  // Daily accomplishments, ready to paste into the description.
  const suggestedReport = days
    .filter((d) => d.accomplishment_text && d.accomplishment_text.trim())
    .map((d) => `${formatLongDay(d.date)}: ${d.accomplishment_text.trim()}`)
    .join("\n\n");

  return {
    week_start: week.week_start,
    week_end: week.week_end,
    regular_daily_hours: REGULAR_DAILY_HOURS,
    holidays: week.holidays,
    last_workday: lastWorkday,
    can_submit: canSubmit,
    lock_reason: lockReason,
    days,
    totals,
    progress: {
      required_hours: requiredHours,
      rendered_hours: renderedHours,
      remaining_hours: Math.max(0, Number((requiredHours - renderedHours).toFixed(2))),
      percent:
        requiredHours > 0
          ? Math.min(100, Math.round((renderedHours / requiredHours) * 100))
          : 0,
    },
    suggested_report: suggestedReport,
    generated_at: new Date().toISOString(),
  };
}

// STUDENT: Preview the data for a week before submitting
// GET /api/weekly-reports/preview?date=YYYY-MM-DD (any day in the week)
const getWeekPreview = async (req, res) => {
  try {
    const day = String(req.query.date || req.query.week_start || getPhilippineDate()).trim();

    if (!isValidDate(day)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format.",
      });
    }

    const summary = await buildWeekSummary(req.user.id, day);

    const existing = await pool.query(
      `SELECT id, status
       FROM weekly_reports
       WHERE user_id = $1
         AND week_start = $2::date
         AND week_end = $3::date`,
      [req.user.id, summary.week_start, summary.week_end]
    );

    return res.json({
      success: true,
      summary,
      existing_report: existing.rows[0] || null,
    });
  } catch (error) {
    console.error("Weekly report preview error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load this week's report data.",
    });
  }
};

// STUDENT: Submit a weekly OJT accomplishment report

const submitWeeklyReport = async (req, res) => {
  try {
    const {
      week_start,
      week_end,
      report,
      selected_photo_paths = [],
    } = req.body;

    const userId = req.user.id;

    // Validate weekly description
    if (
      !week_start ||
      !week_end ||
      typeof report !== "string" ||
      !report.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Week dates and weekly report are required.",
      });
    }

    if (report.trim().length > 10000) {
      return res.status(400).json({
        success: false,
        message: "Weekly report must not exceed 10000 characters.",
      });
    }

    // Validate dates
    const validDate = (value) => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (
      !validDate(week_start) ||
      !validDate(week_end) ||
      week_start > week_end
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid weekly reporting dates.",
      });
    }

    // Weekly report must cover a whole Monday–Sunday week,
    // and only opens after the week's last working day.
    const summary = await buildWeekSummary(userId, week_start);

    if (
      summary.week_start !== week_start ||
      summary.week_end !== week_end
    ) {
      return res.status(400).json({
        success: false,
        message: "Weekly reports must cover a Monday to Sunday week.",
      });
    }

    if (!summary.can_submit) {
      return res.status(403).json({
        success: false,
        code: "WEEK_NOT_FINISHED",
        message: summary.lock_reason || "You cannot submit this weekly report yet.",
        last_workday: summary.last_workday,
      });
    }

    // Validate selected photos
    if (
      !Array.isArray(selected_photo_paths) ||
      selected_photo_paths.some(
        (path) => typeof path !== "string" || !path.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected photo paths must be an array of strings.",
      });
    }

    const uniquePaths = [...new Set(selected_photo_paths)];

    if (uniquePaths.length > 70) {
      return res.status(400).json({
        success: false,
        message: "Maximum of 70 photos per weekly report.",
      });
    }

    // Check existing weekly report
    const existingReport = await pool.query(
      `SELECT id, status
       FROM weekly_reports
       WHERE user_id = $1
         AND week_start = $2::date
         AND week_end = $3::date`,
      [userId, week_start, week_end]
    );

    if (existingReport.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You already submitted a report for this week.",
        existing_report: existingReport.rows[0],
      });
    }

    // Fetch only this student's daily attendance
    // within the selected reporting period.
    const attendanceResult = await pool.query(
      `SELECT
         accomplishment_photo_path,
         accomplishment_photo_paths
       FROM attendance
       WHERE user_id = $1
         AND attendance_date BETWEEN $2::date AND $3::date`,
      [userId, week_start, week_end]
    );

    const allowedPaths = new Set();

    for (const attendance of attendanceResult.rows) {
      if (attendance.accomplishment_photo_path) {
        allowedPaths.add(attendance.accomplishment_photo_path);
      }

      if (Array.isArray(attendance.accomplishment_photo_paths)) {
        for (const path of attendance.accomplishment_photo_paths) {
          if (typeof path === "string") {
            allowedPaths.add(path);
          }
        }
      }
    }

    // Prevent students from submitting someone else's photos
    // or photos outside the selected week.
    const invalidPaths = uniquePaths.filter(
      (path) => !allowedPaths.has(path)
    );

    if (invalidPaths.length > 0) {
      return res.status(403).json({
        success: false,
        message:
          "Some selected photos do not belong to your attendance records for this week.",
      });
    }

    // Save report and references to existing photos.
    const result = await pool.query(
      `INSERT INTO weekly_reports (
         user_id,
         week_start,
         week_end,
         report,
         selected_photo_paths,
         status,
         summary
       )
       VALUES (
         $1,
         $2::date,
         $3::date,
         $4,
         $5::jsonb,
         'PENDING',
         $6::jsonb
       )
       RETURNING *`,
      [
        userId,
        week_start,
        week_end,
        report.trim(),
        JSON.stringify(uniquePaths),
        // Snapshot of the week's data at submission time.
        JSON.stringify({ ...summary, suggested_report: undefined }),
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        "Weekly report submitted successfully. Waiting for supervisor review.",
      weekly_report: result.rows[0],
    });
  } catch (error) {
    console.error("Submit weekly report error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit weekly report.",
    });
  }
};

const getMyReports = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
        `SELECT
            id,
            week_start,
            week_end,
            report,
            selected_photo_paths,
            status,
            supervisor_comment,
            reviewed_at,
            created_at,
            summary
        FROM weekly_reports
        WHERE user_id = $1
        ORDER BY week_start DESC`,
        [req.user.id]
        );
        
        return res.json({
            success: true,
            count: result.rows.length,
            reports: result.rows
        });
    } catch (error) {
        console.error("Get my reports error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching your weekly reports."
        });
    }
};

module.exports = {
    submitWeeklyReport,
    getMyReports,
    getWeekPreview,
    buildWeekSummary
};