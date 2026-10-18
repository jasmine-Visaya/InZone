
const pool = require("../src/config/database");

/* =====================================
   ADMIN: VIEW ALL WEEKLY OJT REPORTS
   GET /api/admin/reports
===================================== */

const getAllWeeklyReports = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        wr.id,
        wr.user_id,
        u.first_name,
        u.last_name,
        u.email,
        wr.week_start,
        wr.week_end,
        wr.report,
        wr.status,
        wr.supervisor_id,
        wr.supervisor_comment,
        wr.reviewed_at,
        wr.created_at
      FROM weekly_reports wr
      INNER JOIN users u ON u.id = wr.user_id
      ORDER BY wr.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      reports: result.rows,
    });
  } catch (error) {
    console.error("Get admin weekly reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve weekly OJT reports.",
    });
  }
};

module.exports = {
  getAllWeeklyReports,
};
