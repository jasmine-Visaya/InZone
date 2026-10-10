# InZone — API Documentation

**Project:** InZone — OJT Geo-Fencing Tracking System
**Backend:** Node.js + Express.js
**Database and storage:** Supabase PostgreSQL + Supabase Storage
**Frontend:** Ionic + Vue
**Authentication:** JWT Bearer Token

## 1. Base URL

Local backend:

`http://localhost:5000`

The full endpoint URL depends on how the router is mounted in `src/app.js`.

For example, if the attendance router is mounted at `/api/attendance`, the time-in URL is:

`http://localhost:5000/api/attendance/time-in`

**For frontend integration:** `localhost` refers to the device running the backend. If the frontend runs on another device, use an accessible backend address instead.

## 2. Authentication

Protected endpoints require a valid JWT.

Include this header:

`Authorization: Bearer YOUR_JWT_TOKEN`

Obtain a token through the login endpoint. Never hardcode tokens or secrets into the frontend or commit them to GitHub.

### Register

* Method: `POST`
* Route: `/register` relative to the authentication router
* Authentication: Not required by the shown route

Request fields should match the backend registration controller. Confirm the exact required fields before implementing the form.

### Login

* Method: `POST`
* Route: `/login` relative to the authentication router
* Authentication: Not required by the shown route

Example request:

```json
{
  "email": "student@example.com",
  "password": "your-test-password"
}
```

Use the JWT returned by a successful login for protected requests.

## 3. Student OJT Profile

The following routes are defined in the OJT router. All require authentication.

| Method | Route      | Purpose                                      |
| ------ | ---------- | -------------------------------------------- |
| POST   | `/profile` | Create an OJT profile                        |
| GET    | `/profile` | Retrieve the authenticated student's profile |
| PUT    | `/profile` | Update the authenticated student's profile   |

Request fields and response structures must be confirmed against `ojtController.js`.

## 4. Geofencing

The following routes are defined in the geofence router. Both require authentication.

| Method | Route    | Purpose                             |
| ------ | -------- | ----------------------------------- |
| POST   | `/`      | Create a geofence                   |
| POST   | `/check` | Check a location against a geofence |

The frontend should send the location coordinates and any other fields required by `geofenceController.js`.

The backend validates whether the supplied location is inside the configured geofence. Use the actual controller response to display the result.

## 5. Attendance

The attendance routes require authentication.

### Time-in

* Method: `POST`
* Route: `/time-in`
* Content type: `multipart/form-data`

Fields:

* `latitude`: Current latitude
* `longitude`: Current longitude
* `photo`: Image file (JPEG, PNG, or WEBP; maximum 5 MB)

The backend validates the location, uploads the photo proof to private Supabase Storage, and saves the attendance record.

### Time-out

* Method: `POST`
* Route: `/time-out`
* Content type: `application/json`

Example request:

```json
{
  "latitude": 13.4122,
  "longitude": 121.1805
}
```

The backend checks the location and existing attendance record before recording time-out.

### My attendance history

* Method: `GET`
* Route: `/my-history`

Returns the authenticated student's attendance history.

### View photo proof

* Method: `GET`
* Route: `/photo-proof/:attendanceId`

Replace `:attendanceId` with the attendance record ID.

The endpoint returns a temporary signed URL only after its authorization check succeeds. The URL expires after five minutes.

## 6. Weekly Accomplishment Reports

The submitted controller defines the following student operations. Their full URLs depend on the Express routes that invoke these functions.

### Submit weekly report

* Method: Expected to be `POST`
* Function: `submitWeeklyReport`
* Authentication: Must be enforced by its route

Request body:

```json
{
  "week_start": "2026-10-12",
  "week_end": "2026-10-18",
  "report": "Completed assigned OJT tasks and documented the work performed."
}
```

The controller validates the dates and report text, prevents duplicate submissions for the same week, and creates a report with `PENDING` status.

### View my reports

* Method: Expected to be `GET`
* Function: `getMyReports`
* Authentication: Must be enforced by its route

Returns the authenticated student's reports, including status, supervisor comments, and review date.

## 7. Supervisor Report Review

The supplied controller defines two supervisor-related operations. Their route paths and middleware still need verification.

### View pending reports

Function: `getPendingReports`

Returns pending weekly reports with student information.

### Approve or reject a report

Function: `reviewReport`

The controller expects a `reportId` route parameter and this request body:

```json
{
  "status": "APPROVED",
  "supervisor_comment": "The submitted accomplishments have been reviewed."
}
```

Allowed statuses are `APPROVED` and `REJECTED`.

The controller records the reviewing supervisor's ID and review timestamp.

**Security requirement:** The actual routes must enforce authentication and supervisor-role authorization. Verify that supervisors can review only reports they are authorized to handle.

## 8. Common response format

Responses generally include a `success` field and a message. Some responses also include the relevant record or data.

Example:

```json
{
  "success": true,
  "message": "Request completed successfully."
}
```

Actual response fields and HTTP status codes vary by endpoint. Use the backend implementation and Postman tests as the source of truth.

## 9. Frontend integration rules

* Use the actual backend URL configured for the current development environment.
* Send the JWT in the `Authorization` header for protected endpoints.
* Use `multipart/form-data` for time-in photo uploads.
* Request location permission before attempting geofenced attendance.
* Display backend validation messages when a request fails.
* Keep the photo-proof Storage bucket private.
* Never put `.env` credentials or service-role keys in the frontend.
* Coordinate changes to request fields and API responses with the backend developer.
