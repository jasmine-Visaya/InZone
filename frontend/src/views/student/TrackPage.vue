
<script setup lang="ts">
import {
  computed,
  ref,
  onUnmounted,
} from 'vue';

import { useRouter } from 'vue-router';

import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';

import {
  locationOutline,
  locateOutline,
  navigateOutline,
  businessOutline,
  cameraOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  alertCircleOutline,
  lockClosedOutline,
  refreshOutline,
  logInOutline,
  logOutOutline,
  timeOutline,
  shieldCheckmarkOutline,
  trashOutline,
  imageOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import StudentBottomNav from './StudentBottomNav.vue';
import InZoneTopbar from '@/components/InZoneTopbar.vue';
/* =====================================
   ROUTER AND API
===================================== */

const router = useRouter();

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const getToken = (): string => {
  return sessionStorage.getItem('inzone_token') || '';
};

/* =====================================
   TYPES
===================================== */

type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface Geofence {
  id?: string | number;
  name?: string;
  address?: string;
  radius_meters?: number;
}

interface GeofenceResult {
  inside_geofence: boolean;
  distance_meters: number;
  geofence?: Geofence;
}

interface OjtProfile {
  id?: string | number;
  company_name?: string;
  company_address?: string;
  approval_status?: ApprovalStatus;
  rejection_reason?: string | null;
}

interface AttendanceRecord {
  id?: string | number;
  attendance_date?: string;
  date?: string;
  time_in?: string | null;
  time_out?: string | null;
  clock_in?: string | null;
  clock_out?: string | null;
}

/* =====================================
   APPROVAL STATE
===================================== */

const approvalStatus = ref<ApprovalStatus | null>(null);
const approvalLoading = ref(true);
const approvalError = ref('');
const rejectionReason = ref('');

const isApproved = computed(
  () =>
    !approvalLoading.value &&
    approvalStatus.value === 'APPROVED'
);

/* =====================================
   TRACK STATE
===================================== */

const profile = ref<OjtProfile | null>(null);

const coordinates = ref<Coordinates | null>(null);
const geofence = ref<GeofenceResult | null>(null);

const checking = ref(false);
const submitting = ref(false);
const loadingAttendance = ref(false);

const error = ref('');
const success = ref('');

const photo = ref<File | null>(null);
const photoPreview = ref('');

const fileInput = ref<HTMLInputElement | null>(null);

const todayAttendance = ref<AttendanceRecord | null>(null);
const attendanceLoaded = ref(false);

const verifiedAt = ref<number | null>(null);
const currentTime = ref(Date.now());

const MAX_LOCATION_AGE = 60_000;

let clockInterval: ReturnType<typeof setInterval> | null = null;
let approvalRequestId = 0;

/* =====================================
   COMPUTED VALUES
===================================== */

const locationFresh = computed(() => {
  if (verifiedAt.value === null) return false;

  return (
    currentTime.value - verifiedAt.value <
    MAX_LOCATION_AGE
  );
});

const isInside = computed(() => {
  return (
    isApproved.value &&
    geofence.value?.inside_geofence === true &&
    locationFresh.value
  );
});

const isOutside = computed(() => {
  return (
    isApproved.value &&
    geofence.value?.inside_geofence === false &&
    locationFresh.value
  );
});

const hasTimedIn = computed(() => {
  const record = todayAttendance.value;

  return Boolean(
    record?.time_in ||
    record?.clock_in
  );
});

const hasTimedOut = computed(() => {
  const record = todayAttendance.value;

  return Boolean(
    record?.time_out ||
    record?.clock_out
  );
});

const canCapturePhoto = computed(() => {
  return (
    isApproved.value &&
    attendanceLoaded.value &&
    isInside.value &&
    !checking.value &&
    !submitting.value &&
    !hasTimedIn.value
  );
});

const canTimeIn = computed(() => {
  return (
    canCapturePhoto.value &&
    photo.value !== null
  );
});

const canTimeOut = computed(() => {
  return (
    isApproved.value &&
    attendanceLoaded.value &&
    isInside.value &&
    hasTimedIn.value &&
    !hasTimedOut.value &&
    !checking.value &&
    !submitting.value
  );
});

const locationStatus = computed(() => {
  if (checking.value) {
    return 'Checking GPS';
  }

  if (!geofence.value) {
    return 'Not Verified';
  }

  if (!locationFresh.value) {
    return 'Verification Expired';
  }

  return isInside.value
    ? 'Inside Geofence'
    : 'Outside Geofence';
});

const statusClass = computed(() => {
  if (isInside.value) return 'inside';
  if (isOutside.value) return 'outside';

  return 'neutral';
});

const distanceText = computed(() => {
  if (!geofence.value) return '--';

  return `${Math.round(
    geofence.value.distance_meters
  )} m`;
});

const radiusText = computed(() => {
  const radius =
    geofence.value?.geofence?.radius_meters;

  return typeof radius === 'number'
    ? `${radius} m`
    : 'Not available';
});

const attendanceStatus = computed(() => {
  if (!attendanceLoaded.value) {
    return 'Loading';
  }

  if (hasTimedOut.value) {
    return 'Completed';
  }

  if (hasTimedIn.value) {
    return 'Checked In';
  }

  return 'Not Yet Checked In';
});

/* =====================================
   DATE HELPERS
===================================== */

function philippineDate(): string {
  const parts = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value || '';

  return (
    `${getPart('year')}-` +
    `${getPart('month')}-` +
    `${getPart('day')}`
  );
}

function recordDate(
  record: AttendanceRecord
): string {
  const value =
    record.attendance_date ||
    record.date;

  if (!value) return '';

  return value.slice(0, 10);
}

function formatTime(
  value?: string | null
): string {
  if (!value) return '--';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-PH',
    {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  ).format(parsed);
}

/* =====================================
   RESET LOCATION AND CAMERA
===================================== */

function clearPhoto() {
  photo.value = null;

  if (photoPreview.value) {
    URL.revokeObjectURL(
      photoPreview.value
    );

    photoPreview.value = '';
  }

  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function resetVerification() {
  verifiedAt.value = null;
  geofence.value = null;
  coordinates.value = null;

  clearPhoto();
}

/* =====================================
   AUTHENTICATED API HELPER
===================================== */

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();

  if (!token) {
    throw new Error(
      'Please log in again.'
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    // If the backend rejects attendance because
    // approval changed, lock this page immediately.
    if (
      response.status === 403 &&
      data.code === 'OJT_NOT_APPROVED'
    ) {
      approvalStatus.value =
        data.approval_status === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING';

      resetVerification();
    }

    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status}).`
    );
  }

  return data;
}

/* =====================================
   CHECK OJT APPROVAL
===================================== */

async function checkOjtApproval() {
  const requestId = ++approvalRequestId;

  approvalLoading.value = true;
  approvalError.value = '';

  // Lock attendance immediately while rechecking.
  resetVerification();

  try {
    const token = getToken();

    if (!token) {
      throw new Error(
        'Please log in again.'
      );
    }

    const response = await fetch(
      `${API_URL}/api/ojt/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (requestId !== approvalRequestId) {
      return;
    }

    if (response.status === 404) {
      approvalStatus.value = null;
      profile.value = null;

      approvalError.value =
        'You need to create an OJT profile first.';

      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        'Unable to check OJT approval.'
      );
    }

    const loadedProfile =
      data.profile as OjtProfile;

    profile.value = loadedProfile;

    approvalStatus.value =
      loadedProfile.approval_status ||
      'PENDING';

    rejectionReason.value =
      loadedProfile.rejection_reason ||
      '';

    if (
      approvalStatus.value === 'APPROVED'
    ) {
      await loadAttendance();
    }

  } catch (err) {
    if (requestId !== approvalRequestId) {
      return;
    }

    approvalStatus.value = null;

    approvalError.value =
      err instanceof Error
        ? err.message
        : 'Failed to check approval status.';

  } finally {
    if (requestId === approvalRequestId) {
      approvalLoading.value = false;
    }
  }
}

/* =====================================
   LOAD ATTENDANCE HISTORY
===================================== */

async function loadAttendance() {
  if (approvalStatus.value !== 'APPROVED') {
    return;
  }

  loadingAttendance.value = true;
  attendanceLoaded.value = false;

  try {
    const result = await apiRequest(
      '/api/attendance/my-history'
    );

    const records =
      result.records ??
      result.attendance ??
      result.data?.records ??
      result.data?.attendance ??
      [];

    if (!Array.isArray(records)) {
      throw new Error(
        'Unexpected attendance history format.'
      );
    }

    const today = philippineDate();

    todayAttendance.value =
      records.find(
        (record: AttendanceRecord) =>
          recordDate(record) === today
      ) ?? null;

    attendanceLoaded.value = true;

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to load attendance.';

  } finally {
    loadingAttendance.value = false;
  }
}

/* =====================================
   GET GPS COORDINATES
===================================== */

function getCurrentCoordinates():
  Promise<Coordinates> {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            'GPS is not available.'
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude:
              position.coords.latitude,
            longitude:
              position.coords.longitude,
            accuracy:
              position.coords.accuracy,
          });
        },

        (gpsError) => {
          let message =
            'Unable to determine location.';

          if (gpsError.code === 1) {
            message =
              'Location permission denied. Enable GPS access.';
          } else if (gpsError.code === 2) {
            message =
              'Your location is unavailable.';
          } else if (gpsError.code === 3) {
            message =
              'GPS request timed out. Try again.';
          }

          reject(new Error(message));
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }
  );
}

/* =====================================
   VERIFY GPS LOCATION
===================================== */

async function verifyLocation(
  preservePhoto = false
): Promise<Coordinates> {
  if (!isApproved.value) {
    throw new Error(
      'Your OJT profile must be approved first.'
    );
  }

  // Invalidate old verification.
  verifiedAt.value = null;
  geofence.value = null;

  const gps =
    await getCurrentCoordinates();

  coordinates.value = gps;

  const result = await apiRequest(
    '/api/geofences/check',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        latitude: gps.latitude,
        longitude: gps.longitude,
      }),
    }
  );

  const data = result.data ?? result;

  if (
    typeof data.inside_geofence !==
    'boolean'
  ) {
    throw new Error(
      'Invalid geofence response.'
    );
  }

  geofence.value = data;

  verifiedAt.value = Date.now();
  currentTime.value = Date.now();

  if (!data.inside_geofence) {
    clearPhoto();

    if (preservePhoto) {
      throw new Error(
        'You are outside the company geofence. Attendance cannot be recorded.'
      );
    }
  } else if (!preservePhoto) {
    // A manual verification requires a new photo.
    clearPhoto();
  }

  return gps;
}

async function checkLocation() {
  if (
    !isApproved.value ||
    checking.value ||
    submitting.value
  ) {
    return;
  }

  checking.value = true;
  error.value = '';
  success.value = '';

  try {
    await verifyLocation();
  } catch (err) {
    resetVerification();

    error.value =
      err instanceof Error
        ? err.message
        : 'GPS verification failed.';
  } finally {
    checking.value = false;
  }
}

/* =====================================
   CAMERA
===================================== */

function openCamera() {
  error.value = '';
  success.value = '';

  if (!canCapturePhoto.value) {
    error.value =
      'Verify that you are inside your company geofence before taking a photo.';

    return;
  }

  fileInput.value?.click();
}

function onPhotoSelected(event: Event) {
  const input =
    event.target as HTMLInputElement;

  const selected =
    input.files?.[0];

  if (!selected) return;

  if (!canCapturePhoto.value) {
    clearPhoto();

    error.value =
      'GPS verification is required.';

    return;
  }

  const acceptedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!acceptedTypes.includes(
    selected.type
  )) {
    clearPhoto();

    error.value =
      'Only JPG, PNG, or WEBP photos are allowed.';

    return;
  }

  if (
    selected.size >
    5 * 1024 * 1024
  ) {
    clearPhoto();

    error.value =
      'Photo must not exceed 5 MB.';

    return;
  }

  clearPhoto();

  photo.value = selected;

  photoPreview.value =
    URL.createObjectURL(selected);
}

/* =====================================
   TIME IN
===================================== */

async function timeIn() {
  if (
    !canTimeIn.value ||
    !photo.value
  ) {
    return;
  }

  submitting.value = true;
  error.value = '';
  success.value = '';

  try {
    // Check the current GPS again.
    const gps =
      await verifyLocation(true);

    if (!photo.value) {
      throw new Error(
        'Photo proof is required.'
      );
    }

    const formData =
      new FormData();

    formData.append(
      'latitude',
      String(gps.latitude)
    );

    formData.append(
      'longitude',
      String(gps.longitude)
    );

    formData.append(
      'photo',
      photo.value
    );

    await apiRequest(
      '/api/attendance/time-in',
      {
        method: 'POST',
        body: formData,
      }
    );

    clearPhoto();

    success.value =
      'Time-in recorded successfully!';

    await loadAttendance();

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Failed to record time-in.';

  } finally {
    submitting.value = false;
  }
}

/* =====================================
   TIME OUT
===================================== */

async function timeOut() {
  if (!canTimeOut.value) return;

  submitting.value = true;
  error.value = '';
  success.value = '';

  try {
    const gps =
      await verifyLocation(true);

    await apiRequest(
      '/api/attendance/time-out',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          latitude: gps.latitude,
          longitude: gps.longitude,
        }),
      }
    );

    success.value =
      'Time-out recorded successfully!';

    await loadAttendance();

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Failed to record time-out.';

  } finally {
    submitting.value = false;
  }
}

/* =====================================
   NAVIGATION
===================================== */

function viewOjtProfile() {
  // Change this path only if your OJT Profile
  // route uses a different URL.
  void router.push('/student/profile');
}

/* =====================================
   LIFECYCLE
===================================== */

// Ionic pages may remain mounted while navigating.
// Recheck approval each time this view opens.
onIonViewWillEnter(() => {
  error.value = '';
  success.value = '';

  if (!clockInterval) {
    clockInterval = setInterval(() => {
      currentTime.value =
        Date.now();

      if (
        photo.value &&
        verifiedAt.value !== null &&
        currentTime.value -
          verifiedAt.value >=
          MAX_LOCATION_AGE
      ) {
        clearPhoto();
      }
    }, 1000);
  }

  void checkOjtApproval();
});

onUnmounted(() => {
  approvalRequestId++;

  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  clearPhoto();
});
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="track-content"
    >
    
      <InZoneTopbar role="STUDENT" />
      <main class="track-container">

        <!-- PAGE HEADER -->
        <header class="page-header">
          <div>
            <h1>
              Track & Attendance<span>.</span>
            </h1>

            <p>
              Verify your workplace
              before checking in.
            </p>
          </div>

          <div class="header-icon">
            <IonIcon
              :icon="navigateOutline"
            />
          </div>
        </header>

        <!-- APPROVAL LOADING -->
        <section
          v-if="approvalLoading"
          class="approval-loading-card"
        >
          <IonIcon
            :icon="refreshOutline"
            class="spinning"
          />

          <h2>
            Checking OJT Approval
          </h2>

          <p>
            Verifying your workplace
            approval status...
          </p>
        </section>

        <!-- ATTENDANCE LOCKED -->
        <section
          v-else-if="!isApproved"
          class="approval-locked-card"
        >
          <div
            class="approval-lock-icon"
            :class="{
              rejected:
                approvalStatus === 'REJECTED'
            }"
          >
            <IonIcon
              :icon="
                approvalStatus === 'REJECTED'
                  ? closeCircleOutline
                  : lockClosedOutline
              "
            />
          </div>

          <span
            class="approval-label"
            :class="{
              rejected:
                approvalStatus === 'REJECTED'
            }"
          >
            {{
              approvalStatus === 'REJECTED'
                ? 'PROFILE REJECTED'
                : approvalStatus === 'PENDING'
                  ? 'PENDING APPROVAL'
                  : 'PROFILE REQUIRED'
            }}
          </span>

          <h2>
            {{
              approvalStatus === 'REJECTED'
                ? 'OJT Profile Needs Revision'
                : approvalStatus === 'PENDING'
                  ? 'Attendance Locked'
                  : 'OJT Profile Unavailable'
            }}
          </h2>

          <p v-if="approvalError">
            {{ approvalError }}
          </p>

          <p
            v-else-if="
              approvalStatus === 'REJECTED'
            "
          >
            Your OJT profile was rejected.
            Please correct your workplace
            information and resubmit it
            for approval.
          </p>

          <p
            v-else-if="
              approvalStatus === 'PENDING'
            "
          >
            Your OJT profile has been
            submitted successfully and
            is awaiting administrator
            approval.
          </p>

          <p v-else>
            Please create your OJT profile
            before using GPS attendance.
          </p>

          <!-- REJECTION REASON -->
          <div
            v-if="
              approvalStatus === 'REJECTED' &&
              rejectionReason
            "
            class="rejection-details"
          >
            <strong>
              Reason for rejection
            </strong>

            <p>
              {{ rejectionReason }}
            </p>
          </div>

          <!-- STATUS -->
          <div
            class="approval-status-box"
          >
            <span>
              OJT Profile Status
            </span>

            <strong
              :class="{
                rejected:
                  approvalStatus === 'REJECTED'
              }"
            >
              {{
                approvalStatus ||
                'NOT AVAILABLE'
              }}
            </strong>
          </div>

          <!-- DISABLED FEATURES -->
          <div class="locked-features">
            <IonIcon
              :icon="lockClosedOutline"
            />

            <div>
              <strong>
                GPS Attendance Disabled
              </strong>

              <p>
                Camera, Time In, and
                Time Out are unavailable
                until your profile
                is approved.
              </p>
            </div>
          </div>

          <div class="locked-actions">
            <button
              class="view-profile-button"
              type="button"
              @click="viewOjtProfile"
            >
              <IonIcon
                :icon="businessOutline"
              />

              View OJT Profile

              <IonIcon
                :icon="arrowForwardOutline"
              />
            </button>

            <button
              class="refresh-status-button"
              type="button"
              @click="checkOjtApproval"
            >
              <IonIcon
                :icon="refreshOutline"
              />

              Refresh Approval Status
            </button>
          </div>
        </section>

        <!-- APPROVED TRACK PAGE -->
        <template v-else>

          <!-- ERROR MESSAGE -->
          <div
            v-if="error"
            class="alert alert-error"
            role="alert"
          >
            <IonIcon
              :icon="alertCircleOutline"
            />

            <span>
              {{ error }}
            </span>

            <button
              type="button"
              @click="error = ''"
            >
              ×
            </button>
          </div>

          <!-- SUCCESS MESSAGE -->
          <div
            v-if="success"
            class="alert alert-success"
            role="status"
          >
            <IonIcon
              :icon="checkmarkCircleOutline"
            />

            <span>
              {{ success }}
            </span>
          </div>

          <!-- APPROVED INDICATOR -->
          <div class="approved-banner">
            <IonIcon
              :icon="checkmarkCircleOutline"
            />

            <div>
              <strong>
                Workplace Approved
              </strong>

              <p>
                Your OJT profile is approved.
                GPS attendance is available.
              </p>
            </div>
          </div>

          <!-- GPS VERIFICATION -->
          <section class="track-card">
            <div class="card-heading">
              <div class="heading-left">
                <IonIcon
                  :icon="shieldCheckmarkOutline"
                />

                <h2>
                  GPS Verification
                </h2>
              </div>

              <span
                class="status-badge"
                :class="statusClass"
              >
                {{ locationStatus }}
              </span>
            </div>

            <div class="location-display">
              <div
                class="location-circle"
                :class="statusClass"
              >
                <IonIcon
                  :icon="
                    isInside
                      ? checkmarkCircleOutline
                      : isOutside
                        ? closeCircleOutline
                        : locationOutline
                  "
                />
              </div>

              <h3>
                {{
                  isInside
                    ? 'Location Verified'
                    : isOutside
                      ? 'Outside Workplace Range'
                      : 'Location Not Verified'
                }}
              </h3>

              <p v-if="isInside">
                You are inside your
                assigned workplace.
                Attendance actions
                are available.
              </p>

              <p v-else-if="isOutside">
                You must be within your
                company's allowed radius
                to record attendance.
              </p>

              <p v-else>
                Verify your GPS location
                to unlock attendance
                features.
              </p>
            </div>

            <button
              type="button"
              class="primary-button"
              :disabled="
                checking ||
                submitting ||
                !attendanceLoaded
              "
              @click="checkLocation"
            >
              <IonIcon
                :icon="
                  checking
                    ? refreshOutline
                    : locateOutline
                "
                :class="{
                  spinning: checking
                }"
              />

              {{
                checking
                  ? 'Checking Location...'
                  : 'Verify GPS Location'
              }}
            </button>

            <div
              v-if="coordinates"
              class="gps-details"
            >
              <div>
                <span>
                  GPS Accuracy
                </span>

                <strong>
                  ±{{
                    Math.round(
                      coordinates.accuracy
                    )
                  }} m
                </strong>
              </div>

              <div>
                <span>
                  Latitude
                </span>

                <strong>
                  {{
                    coordinates.latitude
                      .toFixed(6)
                  }}
                </strong>
              </div>

              <div>
                <span>
                  Longitude
                </span>

                <strong>
                  {{
                    coordinates.longitude
                      .toFixed(6)
                  }}
                </strong>
              </div>
            </div>
          </section>

          <!-- ASSIGNED WORKPLACE -->
          <section class="track-card">
            <div class="card-heading">
              <div class="heading-left">
                <IonIcon
                  :icon="businessOutline"
                />

                <h2>
                  Assigned Workplace
                </h2>
              </div>
            </div>

            <div class="company-details">
              <h3>
                {{
                  profile?.company_name ||
                  'Company not assigned'
                }}
              </h3>

              <p>
                <IonIcon
                  :icon="locationOutline"
                />

                {{
                  profile?.company_address ||
                  'No company address'
                }}
              </p>
            </div>

            <div class="distance-grid">
              <div class="info-tile">
                <span>
                  Allowed Radius
                </span>

                <strong>
                  {{ radiusText }}
                </strong>
              </div>

              <div class="info-tile">
                <span>
                  Your Distance
                </span>

                <strong>
                  {{ distanceText }}
                </strong>
              </div>
            </div>
          </section>

          <!-- PHOTO PROOF -->
          <section
            v-if="!hasTimedIn"
            class="track-card"
          >
            <div class="card-heading">
              <div class="heading-left">
                <IonIcon
                  :icon="cameraOutline"
                />

                <h2>
                  Photo Proof
                </h2>
              </div>

              <IonIcon
                :icon="
                  canCapturePhoto
                    ? checkmarkCircleOutline
                    : lockClosedOutline
                "
                :class="
                  canCapturePhoto
                    ? 'unlocked-icon'
                    : 'locked-icon'
                "
              />
            </div>

            <div
              class="photo-area"
              :class="{
                'photo-locked':
                  !canCapturePhoto
              }"
            >
              <template
                v-if="
                  photoPreview &&
                  canCapturePhoto
                "
              >
                <img
                  :src="photoPreview"
                  alt="Student photo proof"
                  class="photo-preview"
                />

                <button
                  type="button"
                  class="remove-photo"
                  :disabled="submitting"
                  @click="clearPhoto"
                >
                  <IonIcon
                    :icon="trashOutline"
                  />

                  Remove Photo
                </button>
              </template>

              <template v-else>
                <div
                  class="photo-placeholder-icon"
                >
                  <IonIcon
                    :icon="
                      canCapturePhoto
                        ? cameraOutline
                        : lockClosedOutline
                    "
                  />
                </div>

                <h3>
                  {{
                    canCapturePhoto
                      ? 'Ready to Capture'
                      : 'Camera Locked'
                  }}
                </h3>

                <p>
                  {{
                    canCapturePhoto
                      ? 'Take a photo as proof of your workplace attendance.'
                      : 'GPS verification is required to unlock your camera.'
                  }}
                </p>
              </template>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              class="hidden-input"
              @change="onPhotoSelected"
            />

            <button
              type="button"
              class="camera-button"
              :disabled="!canCapturePhoto"
              @click="openCamera"
            >
              <IonIcon
                :icon="
                  canCapturePhoto
                    ? cameraOutline
                    : lockClosedOutline
                "
              />

              {{
                photo
                  ? 'Retake Photo'
                  : canCapturePhoto
                    ? 'Capture Photo'
                    : 'Verify GPS to Unlock Camera'
              }}
            </button>

            <p class="photo-hint">
              <IonIcon
                :icon="imageOutline"
              />

              JPG, PNG, or WEBP • Maximum 5 MB
            </p>
          </section>

          <!-- TODAY'S ATTENDANCE -->
          <section class="track-card">
            <div class="card-heading">
              <div class="heading-left">
                <IonIcon
                  :icon="timeOutline"
                />

                <h2>
                  Today's Attendance
                </h2>
              </div>

              <span
                class="attendance-badge"
                :class="{
                  completed: hasTimedOut,
                  ongoing:
                    hasTimedIn &&
                    !hasTimedOut
                }"
              >
                {{ attendanceStatus }}
              </span>
            </div>

            <div class="attendance-times">
              <div class="time-tile">
                <span>
                  Time In
                </span>

                <strong>
                  {{
                    formatTime(
                      todayAttendance?.time_in ??
                      todayAttendance?.clock_in
                    )
                  }}
                </strong>
              </div>

              <div class="time-tile">
                <span>
                  Time Out
                </span>

                <strong>
                  {{
                    formatTime(
                      todayAttendance?.time_out ??
                      todayAttendance?.clock_out
                    )
                  }}
                </strong>
              </div>
            </div>

            <!-- COMPLETED -->
            <div
              v-if="hasTimedOut"
              class="completed-message"
            >
              <IonIcon
                :icon="checkmarkCircleOutline"
              />

              You have completed
              today's attendance.
            </div>

            <!-- TIME OUT -->
            <div
              v-else-if="hasTimedIn"
              class="attendance-actions"
            >
              <button
                type="button"
                class="timeout-button"
                :disabled="!canTimeOut"
                @click="timeOut"
              >
                <IonIcon
                  :icon="logOutOutline"
                />

                {{
                  submitting
                    ? 'Processing...'
                    : 'Time Out'
                }}
              </button>

              <p>
                Verify your GPS location
                before recording your time-out.
              </p>
            </div>

            <!-- TIME IN -->
            <div
              v-else
              class="attendance-actions"
            >
              <button
                type="button"
                class="timein-button"
                :disabled="!canTimeIn"
                @click="timeIn"
              >
                <IonIcon
                  :icon="logInOutline"
                />

                {{
                  submitting
                    ? 'Processing...'
                    : 'Time In'
                }}
              </button>

              <p>
                You must be inside the
                geofence and provide
                photo proof before Time In.
              </p>
            </div>

            <button
              type="button"
              class="refresh-attendance"
              :disabled="
                loadingAttendance ||
                submitting
              "
              @click="loadAttendance"
            >
              <IonIcon
                :icon="refreshOutline"
              />

              Refresh Attendance
            </button>
          </section>

          <!-- SECURITY NOTE -->
          <div class="security-note">
            <IonIcon
              :icon="shieldCheckmarkOutline"
            />

            <p>
              Attendance is validated
              using your approved workplace
              geofence. Your location is
              checked again before Time In
              or Time Out is submitted.
            </p>
          </div>

        </template>
      </main>
    </IonContent>
   <StudentBottomNav />
  </IonPage>
</template>

<style scoped>
/* =====================================
   PAGE
===================================== */

.track-content {
  --background: #f3f8f5;
}

.track-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;

  padding: 16px clamp(16px, 3vw, 32px)
    calc(140px + env(safe-area-inset-bottom, 0px));

  box-sizing: border-box;
}

/* =====================================
   HEADER
===================================== */

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 25px;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 1.7px;
  font-weight: 800;
  color: #0b9871;
}

.page-header h1 {
  font-size: clamp(30px, 4vw, 43px);
  color: #133e30;
  margin: 12px 0 7px;
  font-weight: 850;
  letter-spacing: -1.2px;
  line-height: 1.15;
}

.page-header h1 span {
  color: #16a576;
}

.page-header p {
  color: #788f81;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 17px;
  background: #e0f3e9;
  color: #0b775b;
  font-size: 25px;
}

/* =====================================
   APPROVAL LOADING
===================================== */

.approval-loading-card {
  background: #ffffff;
  border: 1px solid #e2ede6;
  border-radius: 22px;
  padding: 55px 25px;
  text-align: center;
  box-shadow: 0 7px 25px rgba(13, 95, 66, 0.045);
}

.approval-loading-card > ion-icon {
  font-size: 36px;
  color: #0b775b;
}

.approval-loading-card h2 {
  font-size: 19px;
  color: #173e30;
  margin: 17px 0 9px;
}

.approval-loading-card p {
  font-size: 13px;
  color: #82978a;
  line-height: 1.7;
}

/* =====================================
   LOCKED APPROVAL SCREEN
===================================== */

.approval-locked-card {
  background: #ffffff;
  border: 1px solid #dfeae3;
  border-radius: 24px;
  padding: 37px 27px;
  text-align: center;
  box-shadow: 0 10px 35px rgba(13, 95, 66, 0.055);
}

.approval-lock-icon {
  width: 83px;
  height: 83px;
  display: grid;
  place-items: center;
  margin: 0 auto 19px;
  background: #fff0d4;
  color: #ac7923;
  border-radius: 50%;
  font-size: 40px;
}

.approval-lock-icon.rejected {
  color: #bd4b43;
  background: #ffe8e4;
}

.approval-label {
  display: inline-flex;
  border-radius: 30px;
  background: #fff2d8;
  color: #a77828;
  padding: 8px 13px;
  font-weight: 850;
  font-size: 10px;
  letter-spacing: 1px;
}

.approval-label.rejected {
  background: #ffebe8;
  color: #b8433a;
}

.approval-locked-card h2 {
  margin: 20px 0 11px;
  font-size: 24px;
  font-weight: 850;
  letter-spacing: -0.6px;
  color: #153d30;
}

.approval-locked-card > p {
  max-width: 430px;
  margin: 0 auto 23px;
  font-size: 13px;
  line-height: 1.9;
  color: #73897b;
}

.rejection-details {
  margin: 20px 0;
  padding: 17px;
  border-radius: 12px;
  border: 1px solid #f4cfca;
  background: #fff1ef;
  text-align: left;
}

.rejection-details strong {
  display: block;
  font-size: 12px;
  color: #a63f36;
}

.rejection-details p {
  color: #98655d;
  font-size: 12px;
  line-height: 1.7;
  margin: 8px 0 0;
}

.approval-status-box {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  margin-top: 20px;
  padding: 18px;
  background: #f5f8f6;
  border: 1px solid #e7eee9;
  border-radius: 13px;
}

.approval-status-box span {
  font-size: 12px;
  color: #73897b;
}

.approval-status-box strong {
  color: #aa7727;
  font-size: 11px;
  font-weight: 850;
}

.approval-status-box strong.rejected {
  color: #b8433a;
}

.locked-features {
  display: flex;
  align-items: flex-start;
  text-align: left;
  gap: 13px;
  padding: 18px;
  background: #edf6f0;
  border-radius: 13px;
  margin-top: 16px;
}

.locked-features > ion-icon {
  color: #70927d;
  font-size: 24px;
  flex-shrink: 0;
}

.locked-features strong {
  color: #426b53;
  font-size: 13px;
}

.locked-features p {
  color: #7c9482;
  font-size: 11px;
  line-height: 1.7;
  margin: 6px 0 0;
}

.locked-actions {
  display: flex;
  flex-direction: column;
  gap: 11px;
  margin-top: 25px;
}

.view-profile-button,
.refresh-status-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 15px 18px;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.view-profile-button {
  color: #ffffff;
  background: #0b7959;
}

.refresh-status-button {
  color: #0b7959;
  background: #e8f5ed;
}

/* =====================================
   APPROVED BANNER
===================================== */

.approved-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #e4f7ea;
  border: 1px solid #bce7cb;
  padding: 15px;
  border-radius: 14px;
  margin-bottom: 18px;
}

.approved-banner > ion-icon {
  font-size: 23px;
  color: #078357;
  flex-shrink: 0;
}

.approved-banner strong {
  font-size: 13px;
  color: #0a704d;
}

.approved-banner p {
  color: #678d77;
  font-size: 11px;
  margin: 5px 0 0;
  line-height: 1.6;
}

/* =====================================
   CARDS
===================================== */

.track-card {
  background: #ffffff;
  border: 1px solid #e2ede6;
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 18px;
  box-shadow: 0 7px 25px rgba(13, 95, 66, 0.045);
}

.card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.heading-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.heading-left ion-icon {
  font-size: 21px;
  color: #0b775b;
}

.card-heading h2 {
  font-size: 15px;
  font-weight: 800;
  color: #193d31;
  margin: 0;
}

/* =====================================
   GPS STATUS
===================================== */

.status-badge {
  padding: 7px 10px;
  border-radius: 30px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.status-badge.neutral {
  background: #eef1ef;
  color: #75877d;
}

.status-badge.inside {
  background: #dff6e9;
  color: #098355;
}

.status-badge.outside {
  background: #fee9e8;
  color: #d14646;
}

.location-display {
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;
  padding: 12px 5px 24px;
}

.location-circle {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 85px;
  height: 85px;
  margin-bottom: 17px;
  border-radius: 50%;
  background: #e9f5ee;
  color: #0b775b;
  font-size: 40px;
}

.location-circle.inside {
  background: #dcf6e7;
  color: #099661;
}

.location-circle.outside {
  background: #fee8e7;
  color: #d84646;
}

.location-display h3 {
  font-size: 17px;
  color: #173d30;
  font-weight: 800;
  margin: 0 0 8px;
}

.location-display p {
  color: #84958c;
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
  max-width: 290px;
}

/* =====================================
   BUTTONS
===================================== */

.primary-button,
.camera-button,
.timein-button,
.timeout-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  min-height: 49px;
  padding: 13px 14px;
  border: none;
  border-radius: 13px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.primary-button,
.timein-button {
  color: #ffffff;
  background: linear-gradient(
    135deg,
    #18ae81,
    #087858
  );
}

.camera-button {
  background: #e5f5ec;
  color: #087b58;
}

.timeout-button {
  background: #0c8062;
  color: #ffffff;
}

button ion-icon {
  font-size: 19px;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

button:not(:disabled):active {
  transform: scale(0.98);
}

/* =====================================
   GPS INFORMATION
===================================== */

.gps-details {
  margin-top: 16px;
  padding: 14px;
  border-radius: 13px;
  background: #f5f9f6;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gps-details div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.gps-details span {
  font-size: 12px;
  color: #82968a;
}

.gps-details strong {
  font-size: 12px;
  color: #214b39;
}

/* =====================================
   COMPANY INFORMATION
===================================== */

.company-details h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #1a4434;
  font-weight: 800;
}

.company-details p {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #8a9d91;
}

.company-details ion-icon {
  flex-shrink: 0;
  font-size: 17px;
}

.distance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.info-tile,
.time-tile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 14px;
  background: #f5f9f6;
}

.info-tile span,
.time-tile span {
  font-size: 11px;
  color: #82968a;
}

.info-tile strong,
.time-tile strong {
  font-size: 17px;
  color: #173f30;
  font-weight: 800;
}

/* =====================================
   PHOTO PROOF
===================================== */

.unlocked-icon {
  color: #0f9c70;
  font-size: 21px;
}

.locked-icon {
  color: #96a59c;
  font-size: 19px;
}

.photo-area {
  min-height: 205px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 15px;
  margin-bottom: 16px;
  border: 2px dashed #c9e5d4;
  border-radius: 16px;
  background: #f7fbf8;
  text-align: center;
}

.photo-area.photo-locked {
  background: #f7f8f7;
  border-color: #d9e0dc;
}

.photo-placeholder-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e3f2e9;
  color: #0b775b;
  font-size: 26px;
}

.photo-locked .photo-placeholder-icon {
  background: #e9edeb;
  color: #97a49b;
}

.photo-area h3 {
  font-size: 14px;
  font-weight: 800;
  color: #325646;
  margin: 0;
}

.photo-area p {
  margin: 0;
  max-width: 240px;
  font-size: 11px;
  line-height: 1.6;
  color: #8b9c90;
}

.photo-preview {
  width: 100%;
  max-height: 290px;
  object-fit: cover;
  border-radius: 12px;
}

.remove-photo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border: none;
  border-radius: 9px;
  color: #c64e4e;
  background: #feecec;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.photo-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 12px 0 0;
  font-size: 10px;
  color: #92a398;
}

/* =====================================
   ATTENDANCE
===================================== */

.attendance-badge {
  padding: 7px 10px;
  border-radius: 20px;
  background: #eef1ef;
  color: #829187;
  font-size: 10px;
  font-weight: 800;
}

.attendance-badge.ongoing {
  background: #fff2d9;
  color: #ae741e;
}

.attendance-badge.completed {
  background: #ddf6e7;
  color: #088157;
}

.attendance-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.attendance-actions {
  margin-top: 18px;
}

.attendance-actions p {
  text-align: center;
  color: #8d9e93;
  font-size: 11px;
  line-height: 1.6;
  margin: 12px 0 0;
}

.completed-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 17px;
  padding: 15px;
  color: #07815a;
  background: #e5f7ec;
  border-radius: 12px;
  font-weight: 700;
  font-size: 12px;
}

.completed-message ion-icon {
  font-size: 20px;
}

.refresh-attendance {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  margin-top: 16px;
  padding: 10px;
  background: transparent;
  border: none;
  color: #0b8964;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

/* =====================================
   ALERTS
===================================== */

.alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: 13px;
  margin-bottom: 17px;
  font-size: 12px;
  line-height: 1.6;
}

.alert ion-icon {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 19px;
}

.alert span {
  flex: 1;
}

.alert button {
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.alert-error {
  color: #bb4141;
  background: #feeeee;
}

.alert-success {
  color: #087a57;
  background: #e3f7eb;
}

/* =====================================
   SECURITY NOTE
===================================== */

.security-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: 13px;
  background: #e7f3ec;
  color: #678b76;
}

.security-note ion-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.security-note p {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
}

/* =====================================
   ANIMATIONS
===================================== */

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =====================================
   RESPONSIVE
===================================== */

@media (max-width: 480px) {
  .track-container {
    padding-top: 20px;
    padding-left: 15px;
    padding-right: 15px;
  }

  .track-card {
    padding: 17px;
    border-radius: 19px;
  }

  .card-heading h2 {
    font-size: 14px;
  }

  .status-badge,
  .attendance-badge {
    font-size: 9px;
  }

  .location-circle {
    width: 75px;
    height: 75px;
    font-size: 35px;
  }

  .approval-locked-card {
    padding: 29px 18px;
  }

  .approval-locked-card h2 {
    font-size: 21px;
  }

  .approval-status-box {
    padding: 14px;
  }
}

@media (max-width: 360px) {
  .track-container {
    padding-left: 11px;
    padding-right: 11px;
  }

  .header-icon {
    width: 43px;
    height: 43px;
  }

  .info-tile,
  .time-tile {
    padding: 12px;
  }

  .info-tile strong,
  .time-tile strong {
    font-size: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }

  button {
    transition: none;
  }
}

@media (max-width: 600px) {
  .track-container {
    max-width: 100%;
    padding: 16px 15px
      calc(140px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
