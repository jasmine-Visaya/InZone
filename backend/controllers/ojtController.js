const pool = require("../src/config/database");

const createProfile = async (req, res) => {
    try {
        const {
            company_name,
            company_address,
            required_hours,
            start_date,
            end_date
        } = req.body;

        // Check required field
        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: "Company name is required."
            });
        }

        // Check if student already has an OJT profile
        const existingProfile = await pool.query(
            "SELECT id FROM ojt_profiles WHERE user_id = $1",
            [req.user.id]
        );

        if (existingProfile.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "OJT profile already exists."
            });
        }

        const result = await pool.query(
            `INSERT INTO ojt_profiles
                (user_id, company_name, company_address, required_hours, start_date, end_date)
             VALUES
                ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user.id,
                company_name,
                company_address || null,
                required_hours || 486,
                start_date || null,
                end_date || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "OJT profile created successfully.",
            profile: result.rows[0]
        });

    } catch (error) {
        console.error("Create OJT profile error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

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
                message: "OJT profile not found."
            });
        }

        res.json({
            success: true,
            profile: result.rows[0]
        });

    } catch (error) {
        console.error("Get OJT profile error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const {
            company_name,
            company_address,
            required_hours,
            start_date,
            end_date
        } = req.body;

        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: "Company name is required."
            });
        }

        const result = await pool.query(
            `UPDATE ojt_profiles
             SET
                company_name = $1,
                company_address = $2,
                required_hours = $3,
                start_date = $4,
                end_date = $5
             WHERE user_id = $6
             RETURNING *`,
            [
                company_name,
                company_address || null,
                required_hours || 486,
                start_date || null,
                end_date || null,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "OJT profile not found."
            });
        }

        res.json({
            success: true,
            message: "OJT profile updated successfully.",
            profile: result.rows[0]
        });

    } catch (error) {
        console.error("Update OJT profile error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

module.exports = {
    createProfile,
    getProfile,
    updateProfile
};