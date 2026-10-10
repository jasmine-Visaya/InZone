
const pool = require("../src/config/database");

// STUDENT: Submit a weekly OJT accomplishment report
const submitWeeklyReport = async (req, res) => {
    try {
        const { week_start, week_end, report } = req.body;
        const userId = req.user.id;

        // 1. Validate required fields
        if (!week_start || !week_end || !report || !report.trim()) {
            return res.status(400).json({
                success: false,
                message: "Week start, week end, and report are required."
            });
        }

        // 2. Validate date format and date order
        const startDate = new Date(`${week_start}T00:00:00Z`);
        const endDate = new Date(`${week_end}T00:00:00Z`);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            startDate.toISOString().slice(0, 10) !== week_start ||
            endDate.toISOString().slice(0, 10) !== week_end ||
            week_start > week_end
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid dates. Week start must not be after week end."
            });
        }

        // 3. Check if the student already submitted this week
        const existingReport = await pool.query(
            `SELECT id, status
             FROM weekly_reports
             WHERE user_id = $1
               AND week_start = $2
               AND week_end = $3`,
            [userId, week_start, week_end]
        );

        if (existingReport.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "You have already submitted a report for this week.",
                existing_report: existingReport.rows[0]
            });
        }

        // 4. Save the weekly report
        const result = await pool.query(
            `INSERT INTO weekly_reports
                (user_id, week_start, week_end, report, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [userId, week_start, week_end, report.trim()]
        );

        return res.status(201).json({
            success: true,
            message: "Weekly OJT report submitted successfully. Waiting for supervisor review.",
            weekly_report: result.rows[0]
        });

    } catch (error) {
        console.error("Submit weekly report error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while submitting the weekly report."
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
                status,
                supervisor_comment,
                reviewed_at,
                created_at
             FROM weekly_reports
             WHERE user_id = $1
             ORDER BY week_start DESC`,
            [userId]
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