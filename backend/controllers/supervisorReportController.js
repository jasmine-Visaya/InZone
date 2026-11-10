
const pool = require("../src/config/database");
const supabase = require("../src/config/supabase");

// A supervisor can only see and review reports of the students
// assigned to them (ojt_profiles.supervisor_id).
const REPORT_COLUMNS = `
  wr.id,
  wr.user_id,
  u.first_name,
  u.last_name,
  u.email,
  p.company_name,
  wr.week_start::text AS week_start,
  wr.week_end::text AS week_end,
  wr.report,
  wr.selected_photo_paths,
  wr.status,
  wr.supervisor_comment,
  wr.supervisor_id,
  wr.reviewed_at,
  wr.created_at,
  wr.summary
`;

const MAX_COMMENT_LENGTH = 2000;
const VALID_FILTERS = ["PENDING", "APPROVED", "REJECTED"];

// SUPERVISOR: View pending weekly reports of assigned students
// GET /api/supervisor/reports/pending
const getPendingReports = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${REPORT_COLUMNS}
             FROM weekly_reports wr
             JOIN users u ON wr.user_id = u.id
             JOIN ojt_profiles p ON p.user_id = wr.user_id
             WHERE wr.status = 'PENDING'
               AND p.supervisor_id = $1
             ORDER BY wr.created_at ASC`,
            [req.user.id]
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

// SUPERVISOR: View all weekly reports of assigned students
// GET /api/supervisor/reports?status=PENDING|APPROVED|REJECTED
const getMyStudentsReports = async (req, res) => {
    try {
        const status = String(req.query.status || "").trim().toUpperCase();

        if (status && !VALID_FILTERS.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status filter must be PENDING, APPROVED, or REJECTED."
            });
        }

        const result = await pool.query(
            `SELECT ${REPORT_COLUMNS}
             FROM weekly_reports wr
             JOIN users u ON wr.user_id = u.id
             JOIN ojt_profiles p ON p.user_id = wr.user_id
             WHERE p.supervisor_id = $1
               AND ($2::text = '' OR wr.status = $2)
             ORDER BY
               CASE WHEN wr.status = 'PENDING' THEN 0 ELSE 1 END,
               COALESCE(wr.reviewed_at, wr.created_at) DESC`,
            [req.user.id, status]
        );

        return res.json({
            success: true,
            count: result.rows.length,
            reports: result.rows
        });
    } catch (error) {
        console.error("Get supervisor reports error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching reports."
        });
    }
};

// SUPERVISOR: Approve or reject a weekly report
// PATCH /api/supervisor/reports/:reportId/review
const reviewReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const status = String(req.body?.status || "").toUpperCase();
        const comment = String(req.body?.supervisor_comment || "").trim();
        const supervisorId = req.user.id;

        // Validate the review status
        if (!["APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be APPROVED or REJECTED."
            });
        }

        // The student needs to know what to fix
        if (status === "REJECTED" && !comment) {
            return res.status(400).json({
                success: false,
                message: "Please add a comment explaining why the report was rejected."
            });
        }

        if (comment.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Comment must be ${MAX_COMMENT_LENGTH} characters or less.`
            });
        }

        // Make sure the report exists and belongs to an assigned student
        const found = await pool.query(
            `SELECT wr.id, wr.status, p.supervisor_id
             FROM weekly_reports wr
             LEFT JOIN ojt_profiles p ON p.user_id = wr.user_id
             WHERE wr.id = $1`,
            [reportId]
        );

        if (found.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Report not found."
            });
        }

        if (String(found.rows[0].supervisor_id) !== String(supervisorId)) {
            return res.status(403).json({
                success: false,
                message: "You can only review reports of students assigned to you."
            });
        }

        // Only pending reports can be reviewed
        const result = await pool.query(
            `UPDATE weekly_reports
             SET status = $1,
                 supervisor_comment = $2,
                 supervisor_id = $3,
                 reviewed_at = NOW()
             WHERE id = $4
               AND status = 'PENDING'
             RETURNING *`,
            [status, comment || null, supervisorId, reportId]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: "This report has already been reviewed."
            });
        }

        return res.json({
            success: true,
            message: `Weekly report ${status.toLowerCase()} successfully.`,
            weekly_report: result.rows[0]
        });
    } catch (error) {
        // Invalid id format (e.g. text instead of a number)
        if (error.code === "22P02") {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID."
            });
        }

        console.error("Review weekly report error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while reviewing the report."
        });
    }
};


const getWeeklyReportPhotos = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { reportId } = req.params;

    const result = await pool.query(
      `SELECT
         wr.id,
         wr.selected_photo_paths
       FROM weekly_reports wr
       WHERE wr.id = $1
         AND EXISTS (
           SELECT 1
           FROM ojt_profiles p
           WHERE p.user_id = wr.user_id
             AND p.supervisor_id = $2
         )
       LIMIT 1`,
      [reportId, supervisorId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Weekly report not found or access denied.",
      });
    }

    const report = result.rows[0];

    const paths = Array.isArray(report.selected_photo_paths)
      ? report.selected_photo_paths.filter(
          (path) => typeof path === "string" && path.trim()
        )
      : [];

    const storage = supabase.storage.from("ojt-photo-proofs");

    const photos = [];

    for (const path of paths) {
      const { data, error } = await storage.createSignedUrl(
        path,
        300
      );

      if (error || !data?.signedUrl) {
        console.error("Weekly photo signed URL error:", error);
        continue;
      }

      photos.push({
        path,
        photo_url: data.signedUrl,
      });
    }

    return res.json({
      success: true,
      report_id: report.id,
      count: photos.length,
      photos,
      expires_in_seconds: 300,
    });
  } catch (error) {
    console.error("Get weekly report photos error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve weekly report photos.",
    });
  }
};


module.exports = {
  getPendingReports,
  getMyStudentsReports,
  reviewReport,
  getWeeklyReportPhotos,
};