
const pool = require("../src/config/database");

const {
  verifyLocationTicket,
} = require("../utils/locationTicket");

const DEFAULT_RADIUS = 100;

function getLocation(ticket, userId) {
  return verifyLocationTicket(ticket, userId);
}

/* =======================================
   CREATE OJT PROFILE + GEOFENCE
======================================= */

const createProfile = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      company_name,
      required_hours,
      start_date,
      end_date,
      location_token,
    } = req.body;

    const companyName = String(company_name || "").trim();

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: "Company name is required.",
      });
    }

    if (!location_token) {
      return res.status(400).json({
        success: false,
        message:
          "Please select your workplace from the address suggestions.",
      });
    }

    let location;

    try {
      location = getLocation(
        location_token,
        req.user.id
      );
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM ojt_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "OJT profile already exists.",
      });
    }

      const profileResult = await client.query(
        `INSERT INTO ojt_profiles
          (
            user_id,
            company_name,
            company_address,
            required_hours,
            start_date,
            end_date,
            approval_status
          )
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
        RETURNING *`,
        [
          req.user.id,
          companyName,
          location.address,
          required_hours || 486,
          start_date || null,
          end_date || null,
        ]
      );

    const profile = profileResult.rows[0];

    const geofenceResult = await client.query(
      `INSERT INTO geofences
         (
           name,
           address,
           latitude,
           longitude,
           radius_meters,
           ojt_profile_id
         )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        companyName,
        location.address,
        location.latitude,
        location.longitude,
        DEFAULT_RADIUS,
        profile.id,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message:
        "OJT profile and workplace geofence created successfully.",
      profile,
      geofence: geofenceResult.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Create OJT profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create OJT profile.",
    });
  } finally {
    client.release();
  }
};

/* =======================================
   GET STUDENT OJT PROFILE
======================================= */

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM ojt_profiles
       WHERE user_id = $1`,
      [req.user.id]
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
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =======================================
   UPDATE OJT PROFILE
   WITH APPROVAL SYSTEM
======================================= */

const updateProfile = async (req, res) => {
  const {
    company_name,
    company_address,
    required_hours,
    start_date,
    end_date,
    location_token,
  } = req.body;

  const companyName = String(company_name || "").trim();

  if (!companyName) {
    return res.status(400).json({
      success: false,
      message: "Company name is required.",
    });
  }

  const hours = Number(required_hours);

  if (!Number.isInteger(hours) || hours <= 0) {
    return res.status(400).json({
      success: false,
      message: "Required hours must be a positive whole number.",
    });
  }

  let newLocation = null;

  if (location_token) {
    try {
      newLocation = getLocation(
        location_token,
        req.user.id
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get existing student profile
    const current = await client.query(
      `SELECT *
       FROM ojt_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [req.user.id]
    );

    if (current.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    const profile = current.rows[0];
    const status = profile.approval_status;

    // Prevent editing while pending review
    if (status === "PENDING") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "Your OJT profile is pending approval. Please wait for review.",
      });
    }

    // Get existing geofence
    const fenceResult = await client.query(
      `SELECT *
       FROM geofences
       WHERE ojt_profile_id = $1
       FOR UPDATE`,
      [profile.id]
    );

    const existingFence = fenceResult.rows[0] || null;

    const companyChanged =
      companyName !== profile.company_name;

    const addressChanged =
      String(company_address || "") !==
      String(profile.company_address || "");

    // Approved students cannot change their workplace
    if (
      status === "APPROVED" &&
      (
        companyChanged ||
        addressChanged ||
        newLocation !== null
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message:
          "Your workplace is already approved. Contact your administrator to change it.",
      });
    }

    // Rejected students can correct their workplace
    if (status === "REJECTED") {

      // A changed address requires a new Geoapify selection
      if (
        addressChanged &&
        !newLocation
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Please select your updated workplace from the address suggestions.",
        });
      }

      // If an existing geofence is missing,
      // a new workplace selection is required.
      if (!existingFence && !newLocation) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Please select your workplace to configure its geofence.",
        });
      }

      // Do not trust an edited address when a location
      // token is supplied. Use the signed address.
      const finalAddress = newLocation
        ? newLocation.address
        : profile.company_address;

      const updated = await client.query(
        `UPDATE ojt_profiles
         SET
           company_name = $1,
           company_address = $2,
           required_hours = $3,
           start_date = $4,
           end_date = $5,
           approval_status = 'PENDING',
           reviewed_by = NULL,
           reviewed_at = NULL,
           rejection_reason = NULL,
           -- A different company means a different supervisor.
           supervisor_id = CASE
             WHEN $7::boolean THEN NULL
             ELSE supervisor_id
           END
         WHERE id = $6
         RETURNING *`,
        [
          companyName,
          finalAddress,
          hours,
          start_date || null,
          end_date || null,
          profile.id,
          companyChanged || addressChanged,
        ]
      );

      let geofence = existingFence;

      if (newLocation && existingFence) {
        const updatedFence = await client.query(
          `UPDATE geofences
           SET
             name = $1,
             address = $2,
             latitude = $3,
             longitude = $4,
             radius_meters = $5
           WHERE ojt_profile_id = $6
           RETURNING *`,
          [
            companyName,
            newLocation.address,
            newLocation.latitude,
            newLocation.longitude,
            DEFAULT_RADIUS,
            profile.id,
          ]
        );

        geofence = updatedFence.rows[0];

      } else if (newLocation && !existingFence) {
        const createdFence = await client.query(
          `INSERT INTO geofences
             (
               name,
               address,
               latitude,
               longitude,
               radius_meters,
               ojt_profile_id
             )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            companyName,
            newLocation.address,
            newLocation.latitude,
            newLocation.longitude,
            DEFAULT_RADIUS,
            profile.id,
          ]
        );

        geofence = createdFence.rows[0];
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message:
          "Your corrected OJT profile has been resubmitted for approval.",
        profile: updated.rows[0],
        geofence,
      });
    }

    // Approved profile: allow only OJT hours/dates edits
    if (status === "APPROVED") {
      const updated = await client.query(
        `UPDATE ojt_profiles
         SET
           required_hours = $1,
           start_date = $2,
           end_date = $3
         WHERE id = $4
         RETURNING *`,
        [
          hours,
          start_date || null,
          end_date || null,
          profile.id,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "OJT profile updated successfully.",
        profile: updated.rows[0],
      });
    }

    await client.query("ROLLBACK");

    return res.status(409).json({
      success: false,
      message: "Invalid OJT profile approval status.",
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Update OJT profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update OJT profile.",
    });

  } finally {
    client.release();
  }
};


module.exports = {
  createProfile,
  getProfile,
  updateProfile,
};
