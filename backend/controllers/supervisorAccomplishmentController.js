
const pool = require("../src/config/database");

const getSupervisorAccomplishments = async (req, res) => {
  try {
    if (
      String(req.user?.role || "").toUpperCase() !==
      "SUPERVISOR"
    ) {
      return res.status(403).json({
        success: false,
        message: "Supervisor access only.",
      });
    }

    const supervisorId = req.user.id;

    const page = Math.max(
      1,
      parseInt(String(req.query.page || "1"), 10) || 1
    );

    const limit = 12;
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);

    const status = String(
      req.query.status || "ALL"
    ).toUpperCase();

    const date = String(req.query.date || "");

    if (
      !["ALL", "SUBMITTED", "MISSING"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    if (
      date &&
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date filter.",
      });
    }

    const conditions = [
      "p.supervisor_id = $1",
      "a.time_in IS NOT NULL",
    ];

    const params = [supervisorId];

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;

      conditions.push(`
        (
          u.first_name ILIKE $${index}
          OR u.last_name ILIKE $${index}
          OR CONCAT(
            u.first_name, ' ', u.last_name
          ) ILIKE $${index}
          OR p.company_name ILIKE $${index}
        )
      `);
    }

    if (date) {
      params.push(date);
      conditions.push(
        `a.attendance_date = $${params.length}::date`
      );
    }

    if (status === "SUBMITTED") {
      conditions.push(
        "a.accomplishment_photo_path IS NOT NULL"
      );
    }

    if (status === "MISSING") {
      conditions.push(
        "a.accomplishment_photo_path IS NULL"
      );
    }

    const fromClause = `
      FROM attendance a
      INNER JOIN users u
        ON u.id = a.user_id
      INNER JOIN ojt_profiles p
        ON p.user_id = a.user_id
      WHERE ${conditions.join(" AND ")}
    `;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       ${fromClause}`,
      params
    );

    const total = countResult.rows[0].total;

    const listParams = [...params, limit, offset];

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const listResult = await pool.query(
      `
      SELECT
        a.id,
        a.user_id,
        TO_CHAR(
          a.attendance_date,
          'YYYY-MM-DD'
        ) AS attendance_date,
        a.time_in,
        a.time_out,
        a.time_in_status,
        a.time_out_status,
        a.accomplishment_uploaded_at,
        a.accomplishment_text,
        COALESCE(a.review_status, 'PENDING') AS review_status,
        a.supervisor_comment,
        a.reviewed_at,
        (
          a.accomplishment_photo_path IS NOT NULL
        ) AS accomplishment_uploaded,
        CASE
          WHEN a.time_in IS NOT NULL
            AND a.time_out IS NOT NULL
          THEN ROUND(
            EXTRACT(
              EPOCH FROM (
                a.time_out - a.time_in
              )
            ) / 3600.0,
            2
          )
          ELSE NULL
        END AS hours_worked,
        u.first_name,
        u.last_name,
        CONCAT(
          u.first_name, ' ', u.last_name
        ) AS student_name,
        p.company_name,
        p.company_address
      ${fromClause}
      ORDER BY
        a.attendance_date DESC,
        a.time_in DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      listParams
    );

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE a.accomplishment_photo_path
            IS NOT NULL
        )::int AS submitted,
        COUNT(*) FILTER (
          WHERE a.accomplishment_photo_path
            IS NULL
        )::int AS missing,
        COUNT(*) FILTER (
          WHERE a.time_out IS NOT NULL
        )::int AS completed
      FROM attendance a
      INNER JOIN ojt_profiles p
        ON p.user_id = a.user_id
      WHERE p.supervisor_id = $1
        AND a.time_in IS NOT NULL
      `,
      [supervisorId]
    );

    return res.json({
      success: true,
      records: listResult.rows,
      summary: summaryResult.rows[0],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(
          1,
          Math.ceil(total / limit)
        ),
      },
    });

  } catch (error) {
    console.error(
      "Supervisor accomplishment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve daily accomplishment reports.",
    });
  }
};

// =====================================
// APPROVE / REJECT DAILY ACCOMPLISHMENT
// =====================================

const reviewSupervisorAccomplishment = async (req, res) => {
  try {
    if (
      String(req.user?.role || "").toUpperCase() !== "SUPERVISOR"
    ) {
      return res.status(403).json({
        success: false,
        message: "Supervisor access only.",
      });
    }

    const supervisorId = req.user.id;
    const attendanceId = req.params.attendanceId;

    const status = String(
      req.body?.status || ""
    ).toUpperCase();

    const supervisorComment = String(
      req.body?.supervisor_comment || ""
    ).trim();

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status.",
      });
    }

    if (supervisorComment.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment must not exceed 2000 characters.",
      });
    }

    if (status === "REJECTED" && !supervisorComment) {
      return res.status(400).json({
        success: false,
        message: "A comment is required when rejecting.",
      });
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(attendanceId)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID.",
      });
    }

    // Update only a pending, submitted report
    // belonging to a student assigned to this supervisor.
    const result = await pool.query(
      `
      UPDATE attendance a
      SET
        review_status = $1,
        supervisor_comment = $2,
        reviewed_at = NOW(),
        reviewed_by = $3
      WHERE a.id = $4
        AND COALESCE(a.review_status, 'PENDING') = 'PENDING'
        AND a.accomplishment_photo_path IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM ojt_profiles p
          WHERE p.user_id = a.user_id
            AND p.supervisor_id = $3
        )
      RETURNING
        a.id,
        a.user_id,
        a.review_status,
        a.supervisor_comment,
        a.reviewed_at,
        a.reviewed_by
      `,
      [
        status,
        supervisorComment,
        supervisorId,
        attendanceId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message:
          "Report not found, not submitted, already reviewed, or not assigned to you.",
      });
    }

    return res.json({
      success: true,
      message:
        status === "APPROVED"
          ? "Daily report approved successfully."
          : "Daily report rejected successfully.",
      record: result.rows[0],
    });

  } catch (error) {
    console.error("Daily review error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save daily report review.",
    });
  }
};

module.exports = {
  getSupervisorAccomplishments,
  reviewSupervisorAccomplishment,
};