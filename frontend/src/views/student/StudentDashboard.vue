
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';


import InZoneTopbar from '@/components/InZoneTopbar.vue';
import StudentBottomNav from './StudentBottomNav.vue';

import {
  locationOutline,
  calendarOutline,
  timeOutline,
  businessOutline,
  logOutOutline,
  personCircleOutline,
  navigateOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  informationCircleOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  refreshOutline,
  arrowForwardOutline,
  mapOutline,
  pinOutline,
  compassOutline,
  documentTextOutline,
  statsChartOutline,
  lockClosedOutline,
  hourglassOutline,
  closeCircleOutline,
  createOutline,
  openOutline,
  logInOutline,
  logOutOutline as timeOutIcon,
} from 'ionicons/icons';

/* ======================================
   ROUTER & API
====================================== */

const router = useRouter();

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

function getToken(): string {
  return sessionStorage.getItem('inzone_token') || '';
}

/* ======================================
   TYPES
====================================== */

type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

interface OjtProfile {
  id?: number | string;
  company_name?: string;
  company_address?: string | null;
  required_hours?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  approval_status?: ApprovalStatus;
  rejection_reason?: string | null;
}

interface WorkplaceGeofence {
  id?: number | string;
  name?: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface AttendanceRecord {
  attendance_date?: string;
  time_in?: string | null;
  time_out?: string | null;
}

/* ======================================
   DASHBOARD STATE
====================================== */

const firstName = ref('Student');

const loading = ref(true);
const refreshing = ref(false);

const profile = ref<OjtProfile | null>(null);
const workplace = ref<WorkplaceGeofence | null>(null);

const requiredHours = ref<number | null>(null);
const totalOjtHours = ref<number | null>(null);

const attendanceStatus = ref('—');
const attendanceDetail = ref('Loading attendance...');

const todayRecord = ref<AttendanceRecord | null>(null);

const backendStatus = ref<
  'checking' | 'online' | 'offline'
>('checking');

const profileError = ref('');
const workplaceError = ref('');
const attendanceError = ref('');

const today = ref('');

const showMap = ref(true);

/* ======================================
   PHILIPPINE DATE
====================================== */

function getPhilippineDate(): string {
  const parts = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(new Date());

  const findPart = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value || '';

  return (
    `${findPart('year')}-` +
    `${findPart('month')}-` +
    `${findPart('day')}`
  );
}

function updateToday() {
  today.value = new Intl.DateTimeFormat(
    'en-PH',
    {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(new Date());
}

function formatDate(
  value?: string | null
): string {
  if (!value) return 'Not set';

  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTime(
  value?: string | null
): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/* ======================================
   USER INFORMATION
====================================== */

function loadUser() {
  try {
    const raw =
      sessionStorage.getItem('inzone_user');

    const user = raw ? JSON.parse(raw) : null;

    if (
      !getToken() ||
      String(user?.role || '').toUpperCase() !== 'STUDENT'
    ) {
      signOut();
      return false;
    }

    firstName.value =
      typeof user.first_name === 'string' &&
      user.first_name.trim()
        ? user.first_name.trim()
        : 'Student';

    return true;
  } catch {
    signOut();
    return false;
  }
}

function signOut() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');

  void router.replace('/');
}

/* ======================================
   COMPUTED: PROFILE
====================================== */

const approvalStatus = computed(() => {
  return profile.value?.approval_status ?? null;
});

const isApproved = computed(() => {
  return approvalStatus.value === 'APPROVED';
});

const hasProfile = computed(() => {
  return profile.value !== null;
});

const companyName = computed(() => {
  return (
    profile.value?.company_name?.trim() ||
    'No company assigned'
  );
});

const companyAddress = computed(() => {
  return (
    workplace.value?.address ||
    profile.value?.company_address ||
    'Workplace address not available'
  );
});

/* ======================================
   COMPUTED: HOURS
====================================== */

const progress = computed(() => {
  if (
    requiredHours.value === null ||
    totalOjtHours.value === null ||
    requiredHours.value <= 0
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (totalOjtHours.value / requiredHours.value) * 100
      )
    )
  );
});

const remainingHours = computed(() => {
  if (
    requiredHours.value === null ||
    totalOjtHours.value === null
  ) {
    return null;
  }

  return Math.max(
    0,
    requiredHours.value - totalOjtHours.value
  );
});

/* ======================================
   COMPUTED: DAILY ACTION
====================================== */

const hasTimedIn = computed(() => {
  return Boolean(todayRecord.value?.time_in);
});

const hasTimedOut = computed(() => {
  return Boolean(todayRecord.value?.time_out);
});

const dailyAction = computed(() => {
  if (profileError.value && !hasProfile.value) {
    return {
      title: 'Unable to Load OJT Profile',
      description:
        'Check your connection and refresh the dashboard.',
      button: 'Refresh Dashboard',
      path: '',
      icon: refreshOutline,
    };
  }

  if (!hasProfile.value) {
    return {
      title: 'Complete Your OJT Profile',
      description:
        'Register your workplace to begin the approval process.',
      button: 'Set Up Profile',
      path: '/student/profile',
      icon: createOutline,
    };
  }

  if (approvalStatus.value === 'PENDING') {
    return {
      title: 'Waiting for Approval',
      description:
        'Your OJT profile is being reviewed by the administrator.',
      button: 'View OJT Profile',
      path: '/student/profile',
      icon: hourglassOutline,
    };
  }

  if (approvalStatus.value === 'REJECTED') {
    return {
      title: 'Profile Needs Revision',
      description:
        profile.value?.rejection_reason ||
        'Review your OJT profile and resubmit it.',
      button: 'Update Profile',
      path: '/student/profile',
      icon: alertCircleOutline,
    };
  }

  if (approvalStatus.value !== 'APPROVED') {
    return {
      title: 'Check Your OJT Profile',
      description:
        'Your workplace must be approved before attendance.',
      button: 'View Profile',
      path: '/student/profile',
      icon: informationCircleOutline,
    };
  }

  if (attendanceError.value) {
    return {
      title: 'Check Attendance Status',
      description:
        'Unable to determine your latest attendance status.',
      button: 'View Attendance',
      path: '/student/attendance',
      icon: calendarOutline,
    };
  }

  if (hasTimedOut.value) {
    return {
      title: "Today's Attendance Completed",
      description:
        'Your Time In and Time Out have both been recorded.',
      button: 'View Attendance',
      path: '/student/attendance',
      icon: checkmarkCircleOutline,
    };
  }

  if (hasTimedIn.value) {
    return {
      title: 'OJT Session In Progress',
      description:
        'Remember to Time Out before leaving your workplace.',
      button: 'Go to Track',
      path: '/student/track',
      icon: timeOutline,
    };
  }

  return {
    title: 'Ready for Your OJT Day?',
    description:
      'Verify your approved workplace location before Time In.',
    button: 'Verify Location',
    path: '/student/track',
    icon: navigateOutline,
  };
});

function openDailyAction() {
  if (!dailyAction.value.path) {
    void refreshDashboard();
    return;
  }

  void router.push(dailyAction.value.path);
}

/* ======================================
   COMPUTED: EMBEDDED MAP
====================================== */

const validWorkplace = computed(() => {
  if (!isApproved.value || !workplace.value) {
    return false;
  }

  const { latitude, longitude } = workplace.value;

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
});

// OpenStreetMap embed with a pin at the
// exact saved geofence center.
//
// The bounding box controls the visible
// neighborhood around the workplace.
const mapEmbedUrl = computed(() => {
  if (!validWorkplace.value || !workplace.value) {
    return '';
  }

  const lat = workplace.value.latitude;
  const lon = workplace.value.longitude;

  // Approximately a neighborhood-scale view.
  const latOffset = 0.004;
  const lonOffset = 0.005;

  const south = Math.max(-90, lat - latOffset);
  const north = Math.min(90, lat + latOffset);
  const west = Math.max(-180, lon - lonOffset);
  const east = Math.min(180, lon + lonOffset);

  const bbox = [
    west,
    south,
    east,
    north,
  ].join(',');

  const params = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker: `${lat},${lon}`,
  });

  return (
    'https://www.openstreetmap.org/export/embed.html?' +
    params.toString()
  );
});

const externalMapUrl = computed(() => {
  if (!validWorkplace.value || !workplace.value) {
    return '';
  }

  const lat = workplace.value.latitude;
  const lon = workplace.value.longitude;

  return (
    'https://www.openstreetmap.org/?' +
    new URLSearchParams({
      mlat: String(lat),
      mlon: String(lon),
      zoom: '17',
    }).toString() +
    `#map=17/${lat}/${lon}`
  );
});

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

/* ======================================
   API: LOAD OJT PROFILE
====================================== */

async function refreshProfile() {
  profileError.value = '';
  profile.value = null;
  workplace.value = null;
  requiredHours.value = null;

  const token = getToken();
  if (!token) return;

  try {
    const response = await fetch(
      `${API_URL}/api/ojt/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    if (response.status === 404) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Unable to load OJT profile.'
      );
    }

    const loaded =
      data.profile ??
      data.data?.profile ??
      data.data;

    if (!loaded || typeof loaded !== 'object') {
      throw new Error('Invalid OJT profile response.');
    }

    profile.value = loaded as OjtProfile;

    const hours = Number(
      profile.value.required_hours
    );

    requiredHours.value =
      Number.isFinite(hours) && hours > 0
        ? hours
        : null;

    // Only approved workplaces can load
    // and display their saved map coordinates.
    if (profile.value.approval_status === 'APPROVED') {
      await refreshWorkplace();
    }

  } catch (err) {
    profileError.value =
      err instanceof Error
        ? err.message
        : 'Unable to load OJT profile.';
  }
}

/* ======================================
   API: LOAD APPROVED WORKPLACE
====================================== */

async function refreshWorkplace() {
  workplaceError.value = '';
  workplace.value = null;

  const token = getToken();

  if (!token || !isApproved.value) {
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/geofences/mine`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        'Unable to load approved workplace.'
      );
    }

    const geofence = data.geofence;

    if (!geofence) {
      throw new Error('Workplace location not found.');
    }

    const latitude = Number(
      geofence.latitude
    );

    const longitude = Number(
      geofence.longitude
    );

    const radius = Number(
      geofence.radius_meters
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      throw new Error(
        'Saved workplace coordinates are invalid.'
      );
    }

    workplace.value = {
      id: geofence.id,
      name: geofence.name,
      address: geofence.address,
      latitude,
      longitude,
      radius_meters: radius,
    };

  } catch (err) {
    workplaceError.value =
      err instanceof Error
        ? err.message
        : 'Unable to load workplace map.';
  }
}

/* ======================================
   API: ATTENDANCE SUMMARY
====================================== */

async function refreshAttendance() {
  const token = getToken();

  attendanceError.value = '';
  todayRecord.value = null;
  totalOjtHours.value = null;
  attendanceStatus.value = '—';
  attendanceDetail.value = 'Loading attendance...';

  if (!token) return;

  try {
    const response = await fetch(
      `${API_URL}/api/attendance/my-history`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(data.attendance)
    ) {
      throw new Error(
        data.message || 'Could not load attendance.'
      );
    }

    const hours = Number(data.total_hours);

    totalOjtHours.value =
      Number.isFinite(hours) ? hours : null;

    todayRecord.value =
      data.attendance.find(
        (item: AttendanceRecord) =>
          item.attendance_date?.slice(0, 10) ===
          getPhilippineDate()
      ) || null;

    attendanceStatus.value =
      !todayRecord.value
        ? 'Not timed in'
        : todayRecord.value.time_out
          ? 'Completed'
          : 'Timed in';

    attendanceDetail.value =
      !todayRecord.value
        ? 'No attendance recorded today'
        : todayRecord.value.time_out
          ? 'Workday completed'
          : 'Waiting for Time Out';

  } catch (err) {
    attendanceError.value =
      err instanceof Error
        ? err.message
        : 'Attendance could not be loaded.';

    attendanceDetail.value =
      'Attendance could not be loaded';
  }
}

/* ======================================
   API: BACKEND STATUS
====================================== */

async function checkBackend() {
  backendStatus.value = 'checking';

  try {
    const response = await fetch(
      `${API_URL}/api/health`
    );

    backendStatus.value =
      response.ok ? 'online' : 'offline';
  } catch {
    backendStatus.value = 'offline';
  }
}

/* ======================================
   DASHBOARD REFRESH
====================================== */

async function refreshDashboard() {
  if (refreshing.value) return;

  refreshing.value = true;
  loading.value = true;

  updateToday();

  try {
    await Promise.all([
      refreshProfile(),
      refreshAttendance(),
      checkBackend(),
    ]);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

/* ======================================
   ROUTE HELPERS
====================================== */

function goTo(path: string) {
  void router.push(path);
}

function routeExists(path: string): boolean {
  return router.resolve(path).matched.length > 0;
}

/* ======================================
   IONIC LIFECYCLE
====================================== */

onIonViewWillEnter(() => {
  if (!loadUser()) return;

  void refreshDashboard();
});
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="dashboard-content"
    >
    <div class="dashboard-shell">

      <InZoneTopbar role="STUDENT" />

        <main class="main-content">

          <!-- WELCOME HERO -->
          <section class="welcome-panel">
            <div class="welcome-copy">
              <div class="date-text">
                <IonIcon :icon="calendarOutline" />
                {{ today }}
              </div>

              <h1>
                Welcome back,
                <span>{{ firstName }}!</span>
              </h1>

              <p>
                Your OJT workspace is ready.
                Check your workplace, see
                today's next action, and
                stay on top of your internship.
              </p>

              <button
                type="button"
                class="hero-refresh"
                :disabled="refreshing"
                @click="refreshDashboard"
              >
                <IonIcon
                  :icon="refreshOutline"
                  :class="{ spinning: refreshing }"
                />
                Refresh Dashboard
              </button>
            </div>

            <div
              class="welcome-illustration"
              aria-hidden="true"
            >
              <div class="orbit orbit-outer"></div>
              <div class="orbit orbit-inner"></div>

              <div class="location-core">
                <IonIcon :icon="navigateOutline" />
              </div>
            </div>
          </section>

          <!-- OJT WORKPLACE -->
          <div class="section-heading">
            <div>
              <span class="section-eyebrow">
                ASSIGNED WORKPLACE
              </span>

              <h2>My OJT Location</h2>

              <p>
                Your registered OJT company
                and approved geofence.
              </p>
            </div>

            <span
              class="approval-pill"
              :class="{
                approved: isApproved,
                pending: approvalStatus === 'PENDING',
                rejected: approvalStatus === 'REJECTED'
              }"
            >
              <IonIcon
                :icon="
                  isApproved
                    ? checkmarkCircleOutline
                    : approvalStatus === 'REJECTED'
                      ? closeCircleOutline
                      : hourglassOutline
                "
              />

              {{
                loading
                  ? 'LOADING'
                  : approvalStatus || 'NOT SET UP'
              }}
            </span>
          </div>

          <section class="workplace-card">

            <!-- WORKPLACE HEADER -->
            <div class="workplace-info">
              <div class="workplace-icon">
                <IonIcon :icon="businessOutline" />
              </div>

              <div class="workplace-text">
                <span>REGISTERED OJT COMPANY</span>

                <h3>{{ companyName }}</h3>

                <p>
                  <IonIcon :icon="locationOutline" />
                  {{ companyAddress }}
                </p>
              </div>
            </div>

            <!-- NO PROFILE -->
            <div
              v-if="!loading && !hasProfile"
              class="workplace-placeholder"
            >
              <IonIcon :icon="businessOutline" />

              <h3>No OJT Workplace Yet</h3>

              <p>
                Complete your profile and choose
                your workplace using Geoapify.
              </p>

              <button
                type="button"
                @click="goTo('/student/profile')"
              >
                Create OJT Profile
              </button>
            </div>

            <!-- PENDING / REJECTED -->
            <div
              v-else-if="
                !loading &&
                !isApproved
              "
              class="workplace-placeholder"
            >
              <IonIcon :icon="lockClosedOutline" />

              <h3>
                {{
                  approvalStatus === 'REJECTED'
                    ? 'Workplace Needs Revision'
                    : 'Workplace Awaiting Approval'
                }}
              </h3>

              <p>
                {{
                  approvalStatus === 'REJECTED'
                    ? 'Correct your OJT profile and resubmit it.'
                    : 'Your map will appear once your OJT profile is approved.'
                }}
              </p>

              <button
                type="button"
                @click="goTo('/student/profile')"
              >
                View Profile
              </button>
            </div>

            <!-- APPROVED WORKPLACE -->
            <template v-else-if="isApproved">

              <!-- COORDINATE DETAILS -->
              <div
                v-if="validWorkplace && workplace"
                class="workplace-meta"
              >
                <div>
                  <span>
                    <IonIcon :icon="pinOutline" />
                    Latitude
                  </span>

                  <strong>
                    {{
                      formatCoordinate(
                        workplace.latitude
                      )
                    }}
                  </strong>
                </div>

                <div>
                  <span>
                    <IonIcon :icon="pinOutline" />
                    Longitude
                  </span>

                  <strong>
                    {{
                      formatCoordinate(
                        workplace.longitude
                      )
                    }}
                  </strong>
                </div>

                <div>
                  <span>
                    <IonIcon :icon="compassOutline" />
                    Allowed Radius
                  </span>

                  <strong>
                    {{ workplace.radius_meters }} m
                  </strong>
                </div>
              </div>

              <!-- MAP HEADER -->
              <div class="map-heading">
                <div>
                  <h4>
                    <IonIcon :icon="mapOutline" />
                    Approved Workplace Map
                  </h4>

                  <p>
                    Pin shows your saved geofence
                    center, not your current GPS.
                  </p>
                </div>

                <span class="map-label">
                  <IonIcon
                    :icon="shieldCheckmarkOutline"
                  />
                  APPROVED
                </span>
              </div>

              <!-- MAP EMBED -->
              <div
                v-if="
                  validWorkplace &&
                  mapEmbedUrl &&
                  showMap
                "
                class="map-container"
              >
                <iframe
                  :src="mapEmbedUrl"
                  title="Approved OJT workplace location"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                ></iframe>
              </div>

              <div
                v-else-if="workplaceError"
                class="map-placeholder"
              >
                <IonIcon
                  :icon="alertCircleOutline"
                />

                <p>{{ workplaceError }}</p>
              </div>

              <div
                v-else-if="!validWorkplace"
                class="map-placeholder"
              >
                <IonIcon :icon="mapOutline" />

                <p>
                  Saved geofence location is
                  currently unavailable.
                </p>
              </div>

              <div
                v-else
                class="map-placeholder"
              >
                <IonIcon :icon="mapOutline" />

                <p>
                  Map preview is hidden.
                </p>
              </div>

              <!-- MAP ACTIONS -->
              <div class="map-actions">
                <a
                  v-if="validWorkplace"
                  :href="externalMapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="open-map"
                >
                  <IonIcon :icon="openOutline" />
                  Open Larger Map
                </a>

                <button
                  v-if="validWorkplace"
                  type="button"
                  class="toggle-map"
                  @click="showMap = !showMap"
                >
                  {{ showMap ? 'Hide Map' : 'Show Map' }}
                </button>
              </div>

              <p class="map-note">
                <IonIcon
                  :icon="informationCircleOutline"
                />

                The marker represents your registered
                workplace. GPS verification and
                Time In / Time Out are handled
                separately on the Track page.
              </p>

            </template>

            <!-- INITIAL LOADING -->
            <div v-else class="map-placeholder">
              <IonIcon
                :icon="refreshOutline"
                class="spinning"
              />

              <p>Loading workplace details...</p>
            </div>
          </section>

          <!-- OJT SCHEDULE AND TODAY -->
          <div class="section-heading">
            <div>
              <span class="section-eyebrow">
                PERSONAL OVERVIEW
              </span>

              <h2>My OJT Today</h2>

              <p>
                Only the essentials.
                Detailed records are in Attendance.
              </p>
            </div>
          </div>

          <section class="stat-grid">

            <article class="stat-card">
              <span class="stat-icon teal">
                <IonIcon :icon="calendarOutline" />
              </span>

              <p>Today's Attendance</p>

              <strong class="attendance-value">
                {{ attendanceStatus }}
              </strong>

              <small>
                {{ attendanceDetail }}
              </small>
            </article>

            <article class="stat-card">
              <span class="stat-icon blue">
                <IonIcon :icon="logInOutline" />
              </span>

              <p>Time In Today</p>

              <strong>
                {{
                  formatTime(todayRecord?.time_in)
                }}
              </strong>

              <small>
                Philippine local time
              </small>
            </article>

            <article class="stat-card">
              <span class="stat-icon amber">
                <IonIcon :icon="timeOutIcon" />
              </span>

              <p>Time Out Today</p>

              <strong>
                {{
                  formatTime(todayRecord?.time_out)
                }}
              </strong>

              <small>
                Philippine local time
              </small>
            </article>

          </section>

          <!-- OJT SCHEDULE -->
          <section
            v-if="hasProfile"
            class="schedule-card"
          >
            <div class="schedule-heading">
              <IonIcon :icon="calendarOutline" />

              <div>
                <h3>OJT Training Schedule</h3>
                <p>
                  Dates registered in your OJT profile
                </p>
              </div>
            </div>

            <div class="schedule-grid">
              <div>
                <span>START DATE</span>

                <strong>
                  {{
                    formatDate(profile?.start_date)
                  }}
                </strong>
              </div>

              <div>
                <span>END DATE</span>

                <strong>
                  {{
                    formatDate(profile?.end_date)
                  }}
                </strong>
              </div>
            </div>
          </section>

         

          <!-- MINI PROGRESS -->
          <section class="progress-panel">
            <div class="progress-heading">
              <div>
                <span class="section-eyebrow">
                  PROGRESS PREVIEW
                </span>

                <h2>My OJT Progress</h2>

                <p>
                  A quick look at your training hours.
                </p>
              </div>

              <strong>
                {{
                  progress === null
                    ? '—'
                    : `${progress}%`
                }}
              </strong>
            </div>

            <div
              class="progress-track"
              role="progressbar"
              :aria-valuenow="progress ?? 0"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="OJT completion progress"
            >
              <div
                class="progress-fill"
                :style="{
                  width: `${progress ?? 0}%`
                }"
              ></div>
            </div>

            <div class="progress-meta">
              <span>
                {{
                  totalOjtHours === null
                    ? '—'
                    : `${totalOjtHours.toFixed(2)} hrs`
                }}
                completed
              </span>

              <span>
                {{
                  remainingHours === null
                    ? '—'
                    : `${remainingHours.toFixed(2)} hrs`
                }}
                remaining
              </span>
            </div>

            <button
              v-if="routeExists('/student/reports')"
              type="button"
              class="view-reports"
              @click="goTo('/student/reports')"
            >
              View Detailed Reports
              <IonIcon :icon="arrowForwardOutline" />
            </button>
          </section>

          <!-- CONNECTION STATUS -->
          <div class="connection-note">
            <IonIcon
              :icon="
                backendStatus === 'online'
                  ? checkmarkCircleOutline
                  : backendStatus === 'offline'
                    ? cloudOfflineOutline
                    : informationCircleOutline
              "
            />

            <span>
              {{
                backendStatus === 'online'
                  ? 'InZone server connected.'
                  : backendStatus === 'offline'
                    ? 'InZone server is currently unreachable.'
                    : 'Checking server connection...'
              }}
            </span>
          </div>

        </main>
      </div>
    </IonContent>

    <StudentBottomNav />
  </IonPage>
</template>

<style scoped>
/* ======================================
   PAGE
====================================== */

.dashboard-content {
  --background: #f2f8f5;
  --color: #163c33;
}

.dashboard-shell {
  min-height: 100%;
  background:
    radial-gradient(
      circle at 95% 0%,
      #ddf1e8,
      transparent 40%
    ),
    #f2f8f5;
}

button {
  font-family: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* ======================================
   TOPBAR
====================================== */

.topbar {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;

  padding: 16px clamp(18px, 4vw, 60px);
  background: #fff;
  border-bottom: 1px solid #e0ece6;
}

.brand,
.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: #0b775b;
  color: white;
  font-size: 24px;
}

.brand-title {
  font-size: 23px;
  font-weight: 850;
  letter-spacing: -0.8px;
  color: #124d3c;
}

.brand-title span {
  color: #17ab7b;
}

.brand-divider {
  height: 24px;
  width: 1px;
  background: #dce8e2;
}

.brand-subtitle {
  font-size: 13px;
  font-weight: 700;
  color: #728c80;
}

.student-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #607e70;
}

.student-label ion-icon {
  font-size: 21px;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 14px;
  border: 0;
  border-radius: 11px;
  background: #edf5f0;
  color: #0b775b;
  font-size: 13px;
  font-weight: 750;
}

.logout-button:hover {
  background: #dcefe5;
}

/* ======================================
   MAIN CONTAINER
====================================== */

.main-content {
  max-width: 1260px;
  margin: 0 auto;

  padding: 32px clamp(16px, 4vw, 46px)
    calc(140px + env(safe-area-inset-bottom, 0px));
}

/* ======================================
   WELCOME HERO
====================================== */

.welcome-panel {
  display: flex;
  min-height: 225px;
  position: relative;
  overflow: hidden;
  border-radius: 25px;

  padding: clamp(25px, 4vw, 42px);

  background: linear-gradient(
    115deg,
    #0b775b,
    #064938 70%,
    #073a34
  );

  color: #fff;

  box-shadow:
    0 18px 45px rgba(13, 89, 64, 0.15);
}

.welcome-copy {
  position: relative;
  z-index: 1;
  max-width: 720px;
}

.date-text {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #b6eed5;
  font-size: 12px;
  font-weight: 650;
}

.welcome-panel h1 {
  margin: 16px 0 12px;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: -1.4px;
}

.welcome-panel h1 span {
  color: #91f2c0;
}

.welcome-panel p {
  max-width: 560px;
  margin: 0;
  color: #d9f0e6;
  line-height: 1.7;
  font-size: 14px;
}

.hero-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 19px;
  padding: 11px 14px;
  border: 1px solid #ffffff55;
  border-radius: 11px;
  color: #ffffff;
  background: #ffffff20;
  font-size: 12px;
  font-weight: 750;
}

.welcome-illustration {
  position: absolute;
  width: 270px;
  height: 270px;
  right: 35px;
  top: -15px;
  opacity: 0.7;
}

.orbit {
  position: absolute;
  border: 1px dashed #b8f2d566;
  border-radius: 50%;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.orbit-outer {
  width: 255px;
  height: 255px;
}

.orbit-inner {
  width: 175px;
  height: 175px;
}

.location-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  display: grid;
  place-items: center;

  width: 78px;
  height: 78px;
  border-radius: 23px;
  background: #ceffe1;
  color: #08765a;
  font-size: 37px;
}

/* ======================================
   SECTION HEADINGS
====================================== */

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 32px 0 17px;
}

.section-eyebrow {
  color: #0b9970;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.2px;
}

.section-heading h2 {
  margin: 6px 0;
  font-size: 22px;
  color: #173f33;
  letter-spacing: -0.5px;
}

.section-heading p {
  margin: 0;
  color: #80958a;
  font-size: 12px;
  line-height: 1.5;
}

/* ======================================
   DAILY ACTION
====================================== */

.daily-action-card {
  display: flex;
  align-items: center;
  gap: 17px;

  padding: 20px;
  border-radius: 20px;
  border: 1px solid #cce8d8;
  background: #ffffff;
  box-shadow: 0 8px 26px #14563d09;
}

.daily-action-icon {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #e3f6e9;
  color: #0b815c;
  font-size: 29px;
}

.daily-action-info {
  flex: 1;
  min-width: 0;
}

.daily-action-info h3 {
  margin: 0 0 6px;
  font-size: 17px;
  color: #174932;
}

.daily-action-info p {
  margin: 0;
  line-height: 1.6;
  color: #7b9385;
  font-size: 12px;
}

.daily-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  padding: 13px 17px;
  border: 0;
  border-radius: 12px;
  white-space: nowrap;
  color: #ffffff;
  background: #0b7959;
  font-size: 12px;
  font-weight: 800;
}

/* ======================================
   APPROVAL BADGE
====================================== */

.approval-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: 30px;
  background: #eef1ed;
  color: #698175;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.approval-pill.approved {
  background: #dcf6e7;
  color: #087d55;
}

.approval-pill.pending {
  background: #fff0d2;
  color: #a87724;
}

.approval-pill.rejected {
  background: #ffe8e5;
  color: #b7473e;
}

/* ======================================
   WORKPLACE CARD
====================================== */

.workplace-card {
  padding: 24px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #dfece3;
  box-shadow: 0 8px 30px #14563d09;
}

.workplace-info {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.workplace-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 16px;
  color: #0b7f5c;
  background: #e2f6e9;
  font-size: 27px;
}

.workplace-text {
  flex: 1;
  min-width: 0;
}

.workplace-text > span {
  color: #88a092;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.workplace-text h3 {
  margin: 7px 0;
  font-size: 23px;
  font-weight: 850;
  color: #173e30;
  overflow-wrap: anywhere;
}

.workplace-text p {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #819588;
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
}

.workplace-text p ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 16px;
}

/* ======================================
   WORKPLACE COORDINATES
====================================== */

.workplace-meta {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0;
}

.workplace-meta > div {
  padding: 16px;
  border-radius: 13px;
  background: #f3f9f5;
}

.workplace-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #81998b;
  font-size: 11px;
}

.workplace-meta strong {
  display: block;
  margin-top: 9px;
  color: #1f4e37;
  font-size: 15px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

/* ======================================
   EMBEDDED MAP
====================================== */

.map-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  margin-bottom: 13px;
}

.map-heading h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1d4834;
  font-size: 15px;
  margin: 0 0 6px;
}

.map-heading p {
  color: #899d8d;
  font-size: 11px;
  margin: 0;
}

.map-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: 8px;
  background: #dcf5e5;
  color: #0b7955;
  font-size: 10px;
  font-weight: 800;
}

.map-container {
  position: relative;
  width: 100%;
  height: 370px;
  overflow: hidden;
  border-radius: 17px;
  border: 1px solid #d5e8db;
  background: #e7efea;
}

.map-container iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.map-placeholder,
.workplace-placeholder {
  min-height: 235px;
  padding: 27px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 13px;
  text-align: center;
  border: 1px dashed #cde5d6;
  border-radius: 16px;
  background: #f7fbf8;
  margin-top: 20px;
}

.map-placeholder > ion-icon,
.workplace-placeholder > ion-icon {
  font-size: 37px;
  color: #7aaf91;
}

.workplace-placeholder h3 {
  color: #28523a;
  font-size: 16px;
  margin: 0;
}

.map-placeholder p,
.workplace-placeholder p {
  max-width: 400px;
  font-size: 12px;
  line-height: 1.7;
  color: #829a8a;
  margin: 0;
}

.workplace-placeholder button {
  padding: 12px 18px;
  border: none;
  border-radius: 10px;
  color: #ffffff;
  background: #0b7959;
  font-weight: 750;
  font-size: 12px;
}

.map-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  margin-top: 14px;
}

.open-map,
.toggle-map {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
}

.open-map {
  background: #0b7959;
  color: #ffffff;
}

.toggle-map {
  background: #e6f5ec;
  color: #0b7959;
  border: none;
}

.map-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 17px 0 0;
  color: #8ba091;
  font-size: 11px;
  line-height: 1.6;
}

.map-note ion-icon {
  font-size: 17px;
  flex-shrink: 0;
}

/* ======================================
   STATS
====================================== */

.stat-grid {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 15px;
}

.stat-card,
.schedule-card,
.progress-panel,
.quick-card {
  background: #ffffff;
  border: 1px solid #e0ede6;
  border-radius: 19px;
  box-shadow: 0 8px 30px #14563d09;
}

.stat-card {
  min-height: 170px;
  padding: 21px;
}

.stat-icon {
  width: 43px;
  height: 43px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  font-size: 22px;
}

.stat-icon.teal {
  color: #078665;
  background: #e5f8ee;
}

.stat-icon.blue {
  color: #2876ae;
  background: #eaf4fe;
}

.stat-icon.amber {
  color: #b47b1d;
  background: #fff4df;
}

.stat-card p {
  margin: 17px 0 8px;
  font-size: 12px;
  color: #5f7c6e;
  font-weight: 700;
}

.stat-card strong {
  display: block;
  line-height: 1.2;
  font-size: clamp(17px, 2.2vw, 26px);
  color: #123e32;
  overflow-wrap: anywhere;
}

.stat-card small {
  display: block;
  margin-top: 9px;
  color: #94a69b;
  font-size: 11px;
}

/* ======================================
   OJT SCHEDULE
====================================== */

.schedule-card {
  margin-top: 17px;
  padding: 22px;
}

.schedule-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.schedule-heading > ion-icon {
  padding: 11px;
  font-size: 25px;
  background: #e7f6ec;
  color: #0b815e;
  border-radius: 12px;
}

.schedule-heading h3 {
  color: #1f4937;
  font-size: 16px;
  margin: 0 0 5px;
}

.schedule-heading p {
  margin: 0;
  color: #8a9f90;
  font-size: 11px;
}

.schedule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
  margin-top: 17px;
}

.schedule-grid > div {
  padding: 17px;
  border-radius: 13px;
  background: #f3f9f5;
}

.schedule-grid span {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 750;
  color: #829c8a;
}

.schedule-grid strong {
  font-size: 15px;
  color: #27503b;
}

/* ======================================
   QUICK ACTIONS
====================================== */

.quick-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.quick-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 19px;
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.quick-card:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px #14563d15;
}

.quick-icon {
  width: 47px;
  height: 47px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #0b7f5c;
  background: #e5f7ec;
  font-size: 25px;
}

.quick-card strong {
  font-size: 14px;
  color: #204d38;
}

.quick-card small {
  font-size: 11px;
  color: #82998a;
}

.quick-arrow {
  position: absolute;
  top: 20px;
  right: 18px;
  color: #78a18a;
}

/* ======================================
   PROGRESS
====================================== */

.progress-panel {
  margin-top: 23px;
  padding: 24px;
}

.progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.progress-heading h2 {
  margin: 7px 0 6px;
  font-size: 20px;
  color: #173f33;
}

.progress-heading p {
  margin: 0;
  font-size: 12px;
  color: #829788;
}

.progress-heading > strong {
  font-size: 28px;
  color: #0b775b;
}

.progress-track {
  height: 12px;
  margin: 22px 0 13px;
  border-radius: 100px;
  background: #e5f2eb;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #0b775b,
    #22c991
  );
  transition: width 0.3s ease;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  color: #738d80;
  font-size: 11px;
}

.view-reports {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 18px;
  padding: 0;
  background: transparent;
  border: none;
  color: #0b8762;
  font-weight: 800;
  font-size: 12px;
}

/* ======================================
   CONNECTION NOTE
====================================== */

.connection-note {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 24px;
  padding: 14px 17px;
  border: 1px solid #d1e7d9;
  border-radius: 13px;
  background: #eaf6ef;
  color: #436c5c;
  font-size: 12px;
}

.connection-note ion-icon {
  font-size: 18px;
}

/* ======================================
   ANIMATION
====================================== */

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ======================================
   TABLET
====================================== */

@media (max-width: 850px) {
  .quick-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .daily-action-card {
    flex-wrap: wrap;
  }

  .daily-action-button {
    margin-left: auto;
  }
}

/* ======================================
   MOBILE
====================================== */

@media (max-width: 600px) {
  .topbar {
    padding: 14px 16px;
    min-height: 72px;
  }

  .brand-subtitle,
  .brand-divider,
  .student-label {
    display: none;
  }

  .brand-title {
    font-size: 21px;
  }

  .main-content {
    padding:
      22px 15px
      calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .welcome-panel {
    border-radius: 19px;
    padding: 26px 22px;
    min-height: 225px;
  }

  .welcome-panel h1 {
    font-size: 30px;
  }

  .welcome-panel p {
    font-size: 12px;
  }

  .welcome-illustration {
    opacity: 0.15;
    right: -100px;
  }

  .section-heading h2 {
    font-size: 19px;
  }

  .daily-action-card {
    padding: 16px;
    gap: 12px;
  }

  .daily-action-icon {
    width: 46px;
    height: 46px;
    font-size: 23px;
  }

  .daily-action-info h3 {
    font-size: 14px;
  }

  .daily-action-button {
    width: 100%;
  }

  .workplace-card {
    padding: 17px;
  }

  .workplace-text h3 {
    font-size: 19px;
  }

  .workplace-meta {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .workplace-meta > div {
    padding: 13px;
  }

  .workplace-meta > div:last-child {
    grid-column: 1 / -1;
  }

  .workplace-meta strong {
    font-size: 13px;
  }

  .map-container {
    height: 300px;
  }

  .map-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .stat-grid {
    gap: 10px;
  }

  .stat-card {
    min-height: 150px;
    padding: 13px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 19px;
  }

  .stat-card p {
    font-size: 11px;
    margin-top: 12px;
  }

  .stat-card strong {
    font-size: 16px;
  }

  .stat-card small {
    font-size: 10px;
  }

  .schedule-card,
  .progress-panel {
    padding: 17px;
  }

  .quick-grid {
    gap: 10px;
  }

  .quick-card {
    padding: 14px;
  }

  .quick-icon {
    width: 39px;
    height: 39px;
    font-size: 21px;
  }
}

/* ======================================
   SMALL MOBILE
====================================== */

@media (max-width: 380px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    min-height: 0;
  }

  .schedule-grid {
    grid-template-columns: 1fr;
  }

  .workplace-meta {
    grid-template-columns: 1fr;
  }

  .workplace-meta > div:last-child {
    grid-column: auto;
  }

  .quick-grid {
    grid-template-columns: 1fr 1fr;
  }

  .quick-card strong {
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }

  .quick-card,
  .progress-fill {
    transition: none;
  }
}
</style>
