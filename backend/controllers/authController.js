const bcrypt = require("bcrypt");
const pool = require("../src/config/database");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            password
        } = req.body;

        // Check required fields
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        // Check if email already exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered."
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users
                (first_name, last_name, email, password_hash)
             VALUES
                ($1, $2, $3, $4)
             RETURNING id, first_name, last_name, email, role, status, created_at`,
            [
                first_name,
                last_name,
                email,
                passwordHash
            ]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful. Waiting for approval.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        // Find user
        const result = await pool.query(
            `SELECT *
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Check account status
        if (user.status !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: `Account is ${user.status.toLowerCase()}.`
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

module.exports = {
    register,
    login
};