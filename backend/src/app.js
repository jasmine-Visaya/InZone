const express = require("express");
const cors = require("cors");

const authRoutes = require("../routes/authRoutes");
const ojtRoutes = require("../routes/ojtRoutes");
const geofenceRoutes = require("../routes/geofenceRoutes");
const attendanceRoutes = require("../routes/attendanceRoutes");
const weeklyReportRoutes = require("../routes/weeklyReportRoutes");
const supervisorReportRoutes = require("../routes/supervisorReportRoutes");

//tesing lang
const testRoutes = require("../routes/testRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "OJT Geo-Fencing API is running"
    });
});

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/ojt", ojtRoutes);
app.use("/api/geofences", geofenceRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/weekly-reports", weeklyReportRoutes);
app.use("/api/supervisor/reports", supervisorReportRoutes);

//testing lang
app.use("/api/test", testRoutes);

module.exports = app;