# InZone — OJT Geo-Fencing API Documentation

## Base URL

Local development:

`http://localhost:5000`

All endpoints below use this base URL unless stated otherwise.

## Authentication

Protected endpoints require this HTTP header:

`Authorization: Bearer <JWT_TOKEN>`

Obtain the token by logging in through `/api/auth/login`. The token expires after one day.

## 1. Health Check

**GET** `/api/health`

Checks whether the API is running.

## 2. Authentication

### Register

**POST** `/api/auth/register`

Request body:

```json
{
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "email": "juan@example.com",
  "password": "your_password"
}
```

All fields are required. A new account must be approved before the user can log in.

Success: `201 Created`

### Login

**POST** `/api/auth/login`

Request body:

```json
{
  "email": "juan@example.com",
  "password": "your_password"
}
```

Success response includes `token` and `user`.

Possible errors: `400` missing fields, `401` invalid credentials, `403` account not approved.

## 3. OJT Profile

All endpoints require authentication.

| Method | Endpoint           | Purpose                          |
| ------ | ------------------ | -------------------------------- |
| POST   | `/api/ojt/profile` | Create a profile                 |
| GET    | `/api/ojt/profile` | Get the signed-in user's profile |
| PUT    | `/api/ojt/profile` | Update the profile               |

Example request body:

```json
{
  "company_name": "ABC Technology Solutions",
  "company_address": "Calapan City, Oriental Mindoro",
  "required_hours": 486,
  "start_date": "2026-10-12",
  "end_date": "2027-01-14"
}
```

`company_name` is required. The current controller defaults `required_hours` to `486` when the value is falsy.

## 4. Geofencing

All endpoints require authentication.

### Create a geofence

**POST** `/api/geofences`

```json
{
  "name": "ABC Technology Solutions",
  "address": "Calapan City, Oriental Mindoro",
  "latitude": 13.4119,
  "longitude": 121.1803,
  "radius_meters": 100
}
```

The geofence is linked to the signed-in user's OJT profile. The default radius is 100 meters.

Possible errors include `400` missing required fields, `404` missing profile, and `409` when a geofence already exists.

### Check a geofence

**POST** `/api/geofences/check`

```json
{
  "latitude": 13.4122,
  "longitude": 121.1805
}
```

The response includes `inside_geofence`, `distance_meters`, and basic geofence information.

## 5. Attendance

All endpoints require authentication.

### Time-in

**POST** `/api/attendance/time-in`

Content type: `multipart/form-data`

Fields:

* `latitude` — required numeric coordinate
* `longitude` — required numeric coordinate
* `photo` — required JPEG, PNG, or WEBP image, maximum 5 MB

The student must be inside the assigned geofence. A successful request creates an attendance record and uploads the photo proof to private Supabase Storage.

Success: `201 Created`

Possible errors include `400` invalid fields or photo, `403` outside the geofence, `404` missing profile or geofence, and `409` duplicate time-in.

### Time-out

**POST** `/api/attendance/time-out`

Content type: `application/json`

```json
{
  "latitude": 13.4122,
  "longitude": 121.1805
}
```

The student must have a time-in record for the current Philippine date and be inside the geofence. The response includes the updated attendance and `hours_worked`.

### Attendance history

**GET** `/api/attendance/my-history`

Returns the signed-in user's attendance records, count, and total recorded hours.

### Retrieve photo proof

**GET** `/api/attendance/photo-proof/:attendanceId`

Example:

`/api/attendance/photo-proof/e2d144d2-a4ff-4ab5-9bfc-7bb93a084be4`

The student who owns the record or an authorized linked supervisor may retrieve a temporary signed photo URL. The URL expires after 300 seconds.

## 6. Weekly Reports

All endpoints require authentication.

### Submit a report

**POST** `/api/weekly-reports/submit`

```json
{
  "week_start": "2026-10-12",
  "week_end": "2026-10-18",
  "report": "Completed assigned tasks and assisted with system testing."
}
```

All three fields are required. The report is submitted with a pending status for review.

### Get my reports

**GET** `/api/weekly-reports/my-reports`

Returns the signed-in user's reports and their review status.

## 7. Supervisor Reports

Both endpoints require a valid JWT and supervisor-role authorization.

### Get pending reports

**GET** `/api/supervisor/reports/pending`

Returns pending weekly reports for supervisor review.

### Review a report

**PATCH** `/api/supervisor/reports/:reportId/review`

Example request:

```json
{
  "status": "APPROVED",
  "supervisor_comment": "Weekly accomplishments reviewed."
}
```

The `status` must be `APPROVED` or `REJECTED`. The review operation should only update reports that are still pending.

## General Notes

* Send JSON requests with `Content-Type: application/json`, except photo time-in requests.
* Never put the Supabase service-role key or database password in the frontend.
* Do not commit `.env` to GitHub.
* Use an accessible deployed API URL when testing from another device; `localhost` refers to the device making the request.
* The testing endpoints mounted under `/api/test` are development-only and should be reviewed before deployment.
