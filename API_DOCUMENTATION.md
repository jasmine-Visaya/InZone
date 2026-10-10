# InZone — API Documentation

**Project:** OJT Geo-Fencing Tracking System
**Backend:** Node.js, Express.js
**Database:** PostgreSQL via Supabase
**Frontend:** Ionic + Vue
**Authentication:** JWT Bearer Token

## 1. Backend Setup

During local development, the backend runs at:

`http://localhost:5000`

> Important: `localhost` works only on the computer running the backend. Other teammates cannot use your localhost address from their own computers. For shared testing, use your computer's local network IP address or a deployed backend URL.

## 2. Authentication

Protected endpoints require a valid JWT.

In Postman or your frontend HTTP request, include this header:

`Authorization: Bearer YOUR_JWT_TOKEN`

Do not commit JWT tokens, database credentials, or Supabase service-role keys to GitHub.

### Register

* **Method:** POST
* **Endpoint:** `/api/auth/register`
* **Request body:** Registration fields required by the backend.
* **Expected result:** Account registration confirmation. New accounts may require approval before login.

### Login

* **Method:** POST
* **Endpoint:** `/api/auth/login`
* **Request body:**

```json
{
  "email": "student@example.com",
  "password": "your-test-password"
}
```

* **Expected result:** Login response containing authentication information, including a JWT if login succeeds.

## 3. Attendance Endpoints

All endpoints below use the `/api/attendance` prefix.

### Record Time-in

* **Method:** POST
* **Endpoint:** `/api/attendance/time-in`
* **Authentication:** Required
* **Content-Type:** `multipart/form-data`
* **Fields:**

  * `latitude`: Student's current latitude.
  * `longitude`: Student's current longitude.
  * `photo`: Image file; JPEG, PNG, or WEBP; maximum 5 MB.

The backend validates the student's approved geofence, uploads the photo proof to private Supabase Storage, and saves the attendance record.

### Record Time-out

* **Method:** POST
* **Endpoint:** `/api/attendance/time-out`
* **Authentication:** Required
* **Request body:** JSON containing the current latitude and longitude.

The backend checks the approved geofence and the existing attendance record before recording time-out.

### View Attendance History

* **Method:** GET
* **Endpoint:** `/api/attendance/my-history`
* **Authentication:** Required

Returns the authenticated student's attendance history.

### View Attendance Photo Proof

* **Method:** GET
* **Endpoint:** `/api/attendance/photo-proof/:attendanceId`
* **Authentication:** Required

Replace `:attendanceId` with the actual attendance record ID.

The backend checks whether the requester is the student who owns the record or an authorized supervisor. If authorized, it returns a temporary signed URL for the private photo.

The signed URL expires after five minutes.

## 4. Other Project Modules

Add the verified routes from the backend route files before frontend integration:

* OJT profile management
* Geofence and company location
* Weekly accomplishment reports
* Supervisor review and approval
* User approval and account management

For each endpoint, document its HTTP method, path, required authentication, request fields, and example response.

## 5. Standard Response Format

Responses generally include a success indicator and a message.

Example:

```json
{
  "success": true,
  "message": "Request completed successfully."
}
```

Actual response fields vary by endpoint. Check the controller and test the endpoint in Postman before relying on a specific response structure.

## 6. Development Rules

* Never commit `.env` or secret credentials.
* Use test accounts for development.
* Do not make the photo-proof Storage bucket public.
* Send JWTs through the Authorization header for protected endpoints.
* Coordinate API changes with the frontend developers.
* Test the integrated application before submission.
