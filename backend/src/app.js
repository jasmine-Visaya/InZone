
const express = require("express");
const cors = require("cors");

// =====================================
// AUTHENTICATION ROUTES
// =====================================
const authRoutes = require("../routes/authRoutes");

// =====================================
// STUDENT ROUTES
// =====================================
const ojtRoutes = require("../routes/ojtRoutes");
const geofenceRoutes = require("../routes/geofenceRoutes");
const attendanceRoutes = require("../routes/attendanceRoutes");
const weeklyReportRoutes = require("../routes/weeklyReportRoutes");
const placesRoutes = require("../routes/placesRoutes");
const holidayRoutes = require("../routes/holidayRoutes");

// =====================================
// SUPERVISOR ROUTES
// =====================================
const supervisorRoutes = require("../routes/supervisorRoutes");
const supervisorReportRoutes = require("../routes/supervisorReportRoutes");

const supervisorAccomplishmentRoutes = require(
  "../routes/supervisorAccomplishmentRoutes"
);

// =====================================
// ADMIN ROUTES
// =====================================
const ojtApprovalRoutes = require("../routes/ojtApprovalRoutes");
const adminStudentRoutes = require("../routes/adminStudentRoutes");
const adminReportRoutes = require("../routes/adminReportRoutes");
const adminUserRoutes = require("../routes/adminUserRoutes");

// =====================================
// TEST ROUTES
// =====================================
const testRoutes = require("../routes/testRoutes");

// =====================================
// EXPRESS APPLICATION
// =====================================
const app = express();

// =====================================
// MIDDLEWARE
// =====================================
app.use(cors());
app.use(express.json());

// =====================================
// HEALTH CHECK
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

// =====================================
// HOLIDAYS (read: everyone, write: admin)
// =====================================
app.use("/api/holidays", holidayRoutes);

// =====================================
// SUPERVISOR - DAILY ACCOMPLISHMENTS
// =====================================
app.use(
  "/api/supervisor/accomplishments",
  supervisorAccomplishmentRoutes
);

// =====================================
// SUPERVISOR - WEEKLY REPORTS
// =====================================
app.use(
  "/api/supervisor/reports",
  supervisorReportRoutes
);

// =====================================
// SUPERVISOR - GENERAL
// =====================================
// Dashboard, assigned students,
// attendance and supervisor profile

app.use(
  "/api/supervisor",
  supervisorRoutes
);

// =====================================
// ADMIN - OJT APPROVALS
// =====================================
app.use(
  "/api/ojt/review",
  ojtApprovalRoutes
);

// =====================================
// ADMIN - STUDENTS
// =====================================
app.use(
  "/api/admin/students",
  adminStudentRoutes
);

// =====================================
// ADMIN - REPORTS
// =====================================
app.use(
  "/api/admin/reports",
  adminReportRoutes
);

// =====================================
// ADMIN - USERS
// =====================================
app.use(
  "/api/admin/users",
  adminUserRoutes
);

// =====================================
// DEVELOPMENT TEST ROUTES
// =====================================
app.use("/api/test", testRoutes);

// =====================================
// EXPORT APPLICATION
// =====================================
module.exports = app;
