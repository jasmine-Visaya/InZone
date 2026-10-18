const path = require("path");
const dotenv = require("dotenv");

// =====================================
// LOAD BACKEND .ENV FILE
// =====================================
const envPath = path.resolve(__dirname, "../.env");

const envResult = dotenv.config({
  path: envPath,
});

// =====================================
// ENVIRONMENT DIAGNOSTICS
// Do not print actual secret values.
// =====================================
console.log("Environment file:", envResult.error ? "NOT LOADED" : "LOADED");

if (envResult.error) {
  console.error("Environment error:", envResult.error.message);
}

console.log(
  "Geoapify configuration:",
  process.env.GEOAPIFY_API_KEY?.trim() ? "FOUND" : "MISSING",
);

// =====================================
// IMPORT APP AND DATABASE
// =====================================
const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 5000;

// =====================================
// START SERVER
// =====================================
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected successfully!");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
});
