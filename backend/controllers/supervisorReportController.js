
const pool = require("../src/config/database");

// SUPERVISOR: View pending weekly reports
const getPendingReports = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                wr.id,
                wr.user_id,
                u.first_name,
                u.last_name,
                u.email,
                wr.week_start,
                wr.week_end,
                wr.report,
                wr.status,
                wr.created_at
             FROM weekly_reports wr
             JOIN users u ON wr.user_id = u.id
             WHERE wr.status = 'PENDING'
             ORDER BY wr.created_at ASC`
        );

        return res.json({
            success: true,
            count: result.rows.length,
            reports: result.rows
        });
    } catch (error) {
        console.error("Get pending reports error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching pending reports."
        });
    }
};

// SUPERVISOR: Approve or reject a weekly report
const reviewReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, supervisor_comment } = req.body;
        const supervisorId = req.user.id;

        // Validate the review status
        if (!["APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be APPROVED or REJECTED."
            });
        }

        // Make sure the report exists and is still pending
        const result = await pool.query(
            `UPDATE weekly_reports
             SET status = $1,
                 supervisor_comment = $2,
                 supervisor_id = $3,
                 reviewed_at = NOW()
             WHERE id = $4
               AND status = 'PENDING'
             RETURNING *`,
            [
                status,
                supervisor_comment ? supervisor_comment.trim() : null,
                supervisorId,
                reportId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Report not found or it has already been reviewed."
            });
        }

        return res.json({
            success: true,
            message: `Weekly report ${status.toLowerCase()} successfully.`,
            weekly_report: result.rows[0]
        });
    } catch (error) {
        console.error("Review weekly report error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while reviewing the report."
        });
    }
};

module.exports = {
    getPendingReports,
    reviewReport
};