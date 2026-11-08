
const pool = require("../src/config/database");

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
         status
       )
       VALUES (
         $1,
         $2::date,
         $3::date,
         $4,
         $5::jsonb,
         'PENDING'
       )
       RETURNING *`,
      [
        userId,
        week_start,
        week_end,
        report.trim(),
        JSON.stringify(uniquePaths),
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
            created_at
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
    getMyReports
};