
const express = require("express");
const cors = require("cors");

// Authentication
const authRoutes = require("../routes/authRoutes");

// Student
const ojtRoutes = require("../routes/ojtRoutes");
const geofenceRoutes = require("../routes/geofenceRoutes");
const attendanceRoutes = require("../routes/attendanceRoutes");
const weeklyReportRoutes = require("../routes/weeklyReportRoutes");
const supervisorReportRoutes = require("../routes/supervisorReportRoutes");
const ojtApprovalRoutes = require("../routes/ojtApprovalRoutes");
const adminStudentRoutes = require("../routes/adminStudentRoutes");
const adminReportRoutes = require("../routes/adminReportRoutes");

const adminUserRoutes = require("../routes/adminUserRoutes");
const placesRoutes = require("../routes/placesRoutes");

//tesing lang
const testRoutes = require("../routes/testRoutes");

const app = express();

// =====================================
// MIDDLEWARE
// =====================================
app.use(cors());
app.use(express.json());

// =====================================
// HEALTH
// =====================================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "OJT Geo-Fencing API is running",
  });
});

// =====================================
// AUTHENTICATION
// =====================================
app.use("/api/auth", authRoutes);

// =====================================
// LOCATION
// =====================================
app.use("/api/places", placesRoutes);

// =====================================
// STUDENT
// =====================================
app.use("/api/ojt", ojtRoutes);
app.use("/api/geofences", geofenceRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/weekly-reports", weeklyReportRoutes);
app.use("/api/supervisor/reports", supervisorReportRoutes);
app.use("/api/ojt/review", ojtApprovalRoutes);
app.use("/api/admin/students", adminStudentRoutes);
app.use("/api/admin/reports", adminReportRoutes);

app.use("/api/geofences", geofenceRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/weekly-reports", weeklyReportRoutes);

// =====================================
// SUPERVISOR
// =====================================
app.use(
  "/api/supervisor/reports",
  supervisorReportRoutes
);

// =====================================
// ADMIN OJT APPROVALS
// =====================================
app.use(
  "/api/ojt/review",
  ojtApprovalRoutes
);

// =====================================
// ADMIN STUDENT MANAGEMENT
// =====================================
app.use(
  "/api/admin/students",
  adminStudentRoutes
);

// =====================================
// ADMIN USER MANAGEMENT
// =====================================
app.use(
  "/api/admin/users",
  adminUserRoutes
);

// =====================================
// TEST
// =====================================
app.use("/api/test", testRoutes);

module.exports = app;
