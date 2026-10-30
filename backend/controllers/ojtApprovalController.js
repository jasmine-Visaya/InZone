
const pool = require("../src/config/database");

/* =========================================
   CHECK ADMIN ROLE
========================================= */

function isAdmin(req) {
  return String(req.user?.role || "").toUpperCase() === "ADMIN";
}

/* =========================================
   GET PENDING OJT PROFILES
   GET /api/ojt/review/pending
========================================= */

const getPendingProfiles = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         p.company_name,
         p.company_address,
         p.required_hours,
         p.start_date,
         p.end_date,
         p.approval_status,
         g.name AS geofence_name,
         g.latitude,
         g.longitude,
         g.radius_meters
       FROM ojt_profiles p
       LEFT JOIN geofences g
         ON g.ojt_profile_id = p.id
       WHERE p.approval_status = 'PENDING'
       ORDER BY p.id DESC`
    );

    return res.json({
      success: true,
      count: result.rows.length,
      profiles: result.rows,
    });
  } catch (error) {
    console.error("Get pending profiles error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load pending OJT profiles.",
    });
  }
};

/* =========================================
   GET PROFILE FOR REVIEW
   GET /api/ojt/review/:profileId
========================================= */

const getProfileForReview = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const result = await pool.query(
      `SELECT
         p.*,
         g.id AS geofence_id,
         g.name AS geofence_name,
         g.address AS geofence_address,
         g.latitude,
         g.longitude,
         g.radius_meters
       FROM ojt_profiles p
       LEFT JOIN geofences g
         ON g.ojt_profile_id = p.id
       WHERE p.id = $1`,
      [req.params.profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    return res.json({
      success: true,
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Get review profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load OJT profile.",
    });
  }
};

/* =========================================
   APPROVE OR REJECT PROFILE
   PATCH /api/ojt/review/:profileId
========================================= */

const reviewProfile = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  const status = String(req.body?.status || "").toUpperCase();

  const rejectionReason =
    String(req.body?.rejection_reason || "").trim();

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be APPROVED or REJECTED.",
    });
  }

  if (status === "REJECTED" && !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is required.",
    });
  }

  if (rejectionReason.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is too long.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the profile to prevent concurrent reviews.
    const current = await client.query(
      `SELECT id, approval_status
       FROM ojt_profiles
       WHERE id = $1
       FOR UPDATE`,
      [req.params.profileId]
    );

    if (current.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    if (current.rows[0].approval_status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Only pending profiles can be reviewed.",
      });
    }

    // An approved workplace must have a geofence.
    if (status === "APPROVED") {
      const fence = await client.query(
        `SELECT id
         FROM geofences
         WHERE ojt_profile_id = $1`,
        [req.params.profileId]
      );

      if (fence.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message:
            "Cannot approve a profile without an assigned geofence.",
        });
      }
    }

    const updated = await client.query(
      `UPDATE ojt_profiles
       SET
         approval_status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         rejection_reason = $3
       WHERE id = $4
         AND approval_status = 'PENDING'
       RETURNING *`,
      [
        status,
        req.user.id,
        status === "REJECTED" ? rejectionReason : null,
        req.params.profileId,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        status === "APPROVED"
          ? "OJT profile approved successfully."
          : "OJT profile rejected successfully.",
      profile: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Review OJT profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to review OJT profile.",
    });
  } finally {
    client.release();
  }
};



/* =========================================
   ASSIGN OR CHANGE THE COMPANY SUPERVISOR
   PATCH /api/ojt/review/:profileId/supervisor
   Body: { "supervisor_id": "<uuid>" }  or  { "supervisor_id": null } to remove
========================================= */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assignSupervisor = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const rawId = req.body?.supervisor_id;
    const supervisorId =
      rawId === null || rawId === undefined || rawId === ""
        ? null
        : String(rawId).trim();

    let supervisor = null;

    if (supervisorId !== null) {
      if (!UUID_PATTERN.test(supervisorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid supervisor ID.",
        });
      }

      const found = await pool.query(
        `SELECT id, first_name, last_name, email, role, status
         FROM users
         WHERE id = $1`,
        [supervisorId]
      );

      supervisor = found.rows[0] || null;

      if (
        !supervisor ||
        String(supervisor.role).toUpperCase() !== "SUPERVISOR"
      ) {
        return res.status(400).json({
          success: false,
          message: "The selected user is not a supervisor.",
        });
      }

      if (String(supervisor.status).toUpperCase() !== "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "The selected supervisor account is not active.",
        });
      }
    }

    const updated = await pool.query(
      `UPDATE ojt_profiles
       SET supervisor_id = $1
       WHERE id = $2
       RETURNING id, user_id, supervisor_id`,
      [supervisorId, req.params.profileId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    return res.json({
      success: true,
      message: supervisor
        ? `${supervisor.first_name} ${supervisor.last_name} is now the student's supervisor.`
        : "Supervisor removed from this student.",
      profile: updated.rows[0],
      supervisor: supervisor
        ? {
            id: supervisor.id,
            first_name: supervisor.first_name,
            last_name: supervisor.last_name,
            email: supervisor.email,
          }
        : null,
    });
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid OJT profile ID.",
      });
    }

    console.error("Assign supervisor error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign the supervisor.",
    });
  }
};

module.exports = {
  getPendingProfiles,
  getProfileForReview,
  reviewProfile,
  assignSupervisor,
};
