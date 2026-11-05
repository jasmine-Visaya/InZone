const pool = require("../src/config/database");
const supabase = require("../src/config/supabase");

const getAllWeeklyReports = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT wr.id, wr.user_id, u.first_name, u.last_name, u.email,
        wr.week_start, wr.week_end, wr.report, wr.status, wr.supervisor_id,
        wr.supervisor_comment, wr.reviewed_at, wr.created_at
      FROM weekly_reports wr
      JOIN users u ON u.id = wr.user_id
      ORDER BY wr.created_at DESC
    `);
    return res.json({
      success: true,
      count: result.rowCount,
      reports: result.rows,
    });
  } catch (error) {
    console.error("[Admin reports] weekly:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to retrieve weekly reports." });
  }
};

// Administrative overview: database-derived counters, never placeholder values.
const getOverview = async (_req, res) => {
  try {
    const [users, daily, weekly] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE UPPER(role) = 'STUDENT')::int AS students,
        COUNT(*) FILTER (WHERE UPPER(role) = 'SUPERVISOR')::int AS supervisors,
        COUNT(*) FILTER (WHERE UPPER(role) = 'STUDENT' AND UPPER(status) = 'PENDING')::int AS pending_accounts
        FROM users`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE time_in IS NOT NULL)::int AS daily_total,
        COUNT(*) FILTER (WHERE accomplishment_photo_path IS NOT NULL)::int AS daily_submitted,
        COUNT(*) FILTER (WHERE time_in IS NOT NULL AND accomplishment_photo_path IS NULL)::int AS daily_missing,
        COUNT(*) FILTER (WHERE time_in IS NOT NULL AND attendance_date = (NOW() AT TIME ZONE 'Asia/Manila')::date)::int AS today_attendance,
        COUNT(*) FILTER (WHERE time_out IS NOT NULL)::int AS completed_shifts
        FROM attendance`),
      pool.query(`SELECT
        COUNT(*)::int AS weekly_total,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('PENDING','SUBMITTED','FOR_REVIEW'))::int AS weekly_pending,
        COUNT(*) FILTER (WHERE supervisor_comment IS NOT NULL AND BTRIM(supervisor_comment) <> '')::int AS with_feedback
        FROM weekly_reports`),
    ]);
    return res.json({
      success: true,
      overview: { ...users.rows[0], ...daily.rows[0], ...weekly.rows[0] },
    });
  } catch (error) {
    console.error("[Admin reports] overview:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load Admin overview." });
  }
};

const getDailyReports = async (req, res) => {
  const page = Math.min(
    100000,
    Math.max(1, Number.parseInt(req.query.page, 10) || 1),
  );
  const limit = 15;
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 100);
  const status = String(req.query.status || "ALL").toUpperCase();
  const date = String(req.query.date || "");
  if (
    !["ALL", "SUBMITTED", "MISSING"].includes(status) ||
    (date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00Z`))))
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid daily report filters." });
  }
  try {
    const where = ["a.time_in IS NOT NULL"];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR CONCAT(u.first_name,' ',u.last_name) ILIKE $${params.length} OR COALESCE(p.company_name,'') ILIKE $${params.length})`,
      );
    }
    if (date) {
      params.push(date);
      where.push(`a.attendance_date = $${params.length}::date`);
    }
    if (status === "SUBMITTED")
      where.push("a.accomplishment_photo_path IS NOT NULL");
    if (status === "MISSING") where.push("a.accomplishment_photo_path IS NULL");
    const from = `FROM attendance a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN LATERAL (
        SELECT company_name, company_address FROM ojt_profiles
        WHERE user_id = a.user_id ORDER BY id DESC LIMIT 1
      ) p ON TRUE WHERE ${where.join(" AND ")}`;
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const rows = await pool.query(
      `SELECT a.id, a.user_id,
        TO_CHAR(a.attendance_date,'YYYY-MM-DD') AS attendance_date,
        a.time_in, a.time_out, a.time_in_status, a.time_out_status,
        a.accomplishment_uploaded_at,
        (a.accomplishment_photo_path IS NOT NULL) AS accomplishment_uploaded,
        (a.photo_proof_path IS NOT NULL) AS time_in_photo_uploaded,
        CASE WHEN a.time_out IS NOT NULL AND a.time_in IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (a.time_out-a.time_in))/3600.0,2)
          ELSE NULL END AS hours_worked,
        u.first_name, u.last_name, u.email,
        p.company_name, p.company_address
        ${from}
        ORDER BY a.attendance_date DESC, a.time_in DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    const total = count.rows[0].total;
    return res.json({
      success: true,
      records: rows.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("[Admin reports] daily:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to retrieve daily reports." });
  }
};

// Signed URL is created only after ADMIN JWT + live authorization in router/middleware.
const getDailyPhoto = async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(String(req.params.attendanceId))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid attendance ID." });
  }
  if (!["accomplishment", "time-in"].includes(req.params.kind)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid photo type." });
  }
  try {
    const result = await pool.query(
      `SELECT accomplishment_photo_path, photo_proof_path
      FROM attendance WHERE id = $1 LIMIT 1`,
      [req.params.attendanceId],
    );
    const row = result.rows[0];
    const path =
      req.params.kind === "accomplishment"
        ? row?.accomplishment_photo_path
        : row?.photo_proof_path;
    if (!path)
      return res
        .status(404)
        .json({ success: false, message: "Photo not available." });
    const { data, error } = await supabase.storage
      .from("ojt-photo-proofs")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl)
      throw error || new Error("Signed URL unavailable");
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      photo_url: data.signedUrl,
      expires_in_seconds: 300,
    });
  } catch (error) {
    console.error("[Admin reports] photo:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to retrieve report photo." });
  }
};

module.exports = {
  getAllWeeklyReports,
  getOverview,
  getDailyReports,
  getDailyPhoto,
};
