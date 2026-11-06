
<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from "@ionic/vue";

import InZoneTopbar from "@/components/InZoneTopbar.vue";
import StudentBottomNav from "./StudentBottomNav.vue";
import InZoneMapViewer from "@/components/InZoneMapViewer.vue";

import {
  alertCircleOutline,
  arrowForwardOutline,
  businessOutline,
  calendarOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  compassOutline,
  eyeOutline,
  hourglassOutline,
  informationCircleOutline,
  locationOutline,
  lockClosedOutline,
  logInOutline,
  logOutOutline,
  mapOutline,
  navigateOutline,
  pinOutline,
  refreshOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";

// ======================================
// ROUTER AND API
// ======================================

const router = useRouter();

const API_URL = String(
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const token = () =>
  sessionStorage.getItem("inzone_token") || "";

// ======================================
// TYPES
// ======================================

type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

interface Profile {
  company_name?: string;
  company_address?: string | null;
  required_hours?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  approval_status?: ApprovalStatus;
  rejection_reason?: string | null;
}

interface Geofence {
  id?: number | string;
  name?: string;
  address?: string | null;

  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface Attendance {
  attendance_date?: string;
  time_in?: string | null;
  time_out?: string | null;
}

// ======================================
// DASHBOARD STATE
// ======================================

const firstName = ref("Student");

const loading = ref(true);
const refreshing = ref(false);

const today = ref("");

const profile = ref<Profile | null>(null);
const workplace = ref<Geofence | null>(null);

const requiredHours = ref<number | null>(null);
const totalHours = ref<number | null>(null);

const attendance =
  ref<Attendance | null>(null);

const attendanceError = ref("");
const profileError = ref("");
const workplaceError = ref("");

const backendStatus = ref<
  "checking" | "online" | "offline"
>("checking");

const showMap = ref(true);
const showFullMap = ref(false);

// ======================================
// COMPUTED
// ======================================

const approved = computed(() => {
  return (
    profile.value?.approval_status ===
    "APPROVED"
  );
});

const approvalStatus = computed(() => {
  return (
    profile.value?.approval_status ?? null
  );
});

const companyName = computed(() => {
  return (
    profile.value?.company_name?.trim() ||
    "No company assigned"
  );
});

const companyAddress = computed(() => {
  return (
    workplace.value?.address ||
    profile.value?.company_address ||
    "Workplace address unavailable"
  );
});

const validWorkplace = computed(() => {
  if (!approved.value || !workplace.value) {
    return false;
  }

  const {
    latitude: lat,
    longitude: lng,
    radius_meters: radius,
  } = workplace.value;

  return (
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    Number.isFinite(radius) &&
    radius > 0
  );
});

const radiusLabel = computed(() => {
  return validWorkplace.value
    ? `${workplace.value!.radius_meters.toLocaleString()} m`
    : "Not configured";
});

const progress = computed(() => {
  if (
    requiredHours.value === null ||
    totalHours.value === null ||
    requiredHours.value <= 0
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (
          totalHours.value /
          requiredHours.value
        ) * 100
      )
    )
  );
});

const remainingHours = computed(() => {
  if (
    requiredHours.value === null ||
    totalHours.value === null
  ) {
    return null;
  }

  return Math.max(
    0,
    requiredHours.value - totalHours.value
  );
});

const attendanceStatus = computed(() => {
  return !attendance.value?.time_in
    ? "Not timed in"
    : attendance.value.time_out
      ? "Completed"
      : "Timed in";
});

const attendanceDetail = computed(() => {
  if (attendanceError.value) {
    return "Unable to load attendance";
  }

  if (!attendance.value?.time_in) {
    return "No attendance recorded today";
  }

  return attendance.value.time_out
    ? "Workday completed"
    : "Waiting for Time Out";
});

// ======================================
// PHILIPPINE DATE AND TIME
// ======================================

function dayPH() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const part = (type: string) => {
    return (
      parts.find(
        (item) => item.type === type
      )?.value || ""
    );
  };

  return (
    `${part("year")}-` +
    `${part("month")}-` +
    `${part("day")}`
  );
}

function updateToday() {
  today.value = new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: "Asia/Manila",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date());
}

function formatDate(
  value?: string | null
) {
  if (!value) return "Not set";

  const d = new Date(
    `${value.slice(0, 10)}T12:00:00Z`
  );

  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(d);
}

function formatTime(
  value?: string | null
) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(d);
}

// ======================================
// AUTH
// ======================================

function signOut() {
  sessionStorage.removeItem(
    "inzone_token"
  );

  sessionStorage.removeItem(
    "inzone_user"
  );

  void router.replace("/");
}

function loadUser(): boolean {
  try {
    const raw =
      sessionStorage.getItem(
        "inzone_user"
      );

    const user = JSON.parse(
      raw || "{}"
    );

    if (
      !token() ||
      String(user.role || "")
        .toUpperCase() !== "STUDENT"
    ) {
      signOut();
      return false;
    }

    firstName.value =
      String(user.first_name || "")
        .trim() || "Student";

    return true;

  } catch {
    signOut();
    return false;
  }
}

function navigate(path: string) {
  void router.push(path);
}

// ======================================
// OPEN FULL GEOFENCE MAP
// ======================================

function openGeofenceMap() {
  if (!validWorkplace.value) {
    return;
  }

  showFullMap.value = true;
}

// ======================================
// API: LOAD APPROVED GEOFENCE
// ======================================

async function fetchWorkplace() {
  workplace.value = null;
  workplaceError.value = "";

  if (!approved.value || !token()) {
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/geofences/mine`,
      {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      !data.success ||
      !data.geofence
    ) {
      throw new Error(
        data.message ||
        "Unable to load approved workplace."
      );
    }

    const g = data.geofence;

    const latitude = Number(
      g.latitude
    );

    const longitude = Number(
      g.longitude
    );

    const radius_meters = Number(
      g.radius_meters
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(radius_meters) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      radius_meters <= 0
    ) {
      throw new Error(
        "Invalid saved workplace geofence."
      );
    }

    workplace.value = {
      id: g.id,
      name: g.name,
      address: g.address,
      latitude,
      longitude,
      radius_meters,
    };

  } catch (error) {
    workplaceError.value =
      error instanceof Error
        ? error.message
        : "Workplace unavailable.";
  }
}

// ======================================
// API: LOAD OJT PROFILE
// ======================================

async function fetchProfile() {
  profile.value = null;
  workplace.value = null;

  requiredHours.value = null;
  profileError.value = "";

  if (!token()) return;

  try {
    const response = await fetch(
      `${API_URL}/api/ojt/profile`,
      {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
        cache: "no-store",
      }
    );

    if (response.status === 404) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Unable to load profile."
      );
    }

    const value =
      data.profile ??
      data.data?.profile ??
      data.data;

    if (
      !value ||
      typeof value !== "object"
    ) {
      throw new Error(
        "Invalid profile data."
      );
    }

    profile.value = value as Profile;

    const hours = Number(
      profile.value.required_hours
    );

    requiredHours.value =
      Number.isFinite(hours) && hours > 0
        ? hours
        : null;

    if (approved.value) {
      await fetchWorkplace();
    }

  } catch (error) {
    profileError.value =
      error instanceof Error
        ? error.message
        : "Profile unavailable.";
  }
}

// ======================================
// API: ATTENDANCE HISTORY
// ======================================

async function fetchAttendance() {
  attendance.value = null;
  totalHours.value = null;
  attendanceError.value = "";

  if (!token()) return;

  try {
    const response = await fetch(
      `${API_URL}/api/attendance/my-history`,
      {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(
        data.attendance
      )
    ) {
      throw new Error(
        data.message ||
        "Unable to load attendance."
      );
    }

    const total = Number(
      data.total_hours
    );

    totalHours.value =
      Number.isFinite(total)
        ? total
        : null;

    attendance.value =
      data.attendance.find(
        (row: Attendance) =>
          String(
            row.attendance_date || ""
          ).slice(0, 10) === dayPH()
      ) || null;

  } catch (error) {
    attendanceError.value =
      error instanceof Error
        ? error.message
        : "Attendance unavailable.";
  }
}

// ======================================
// BACKEND CONNECTION
// ======================================

async function checkBackend() {
  backendStatus.value = "checking";

  try {
    const response = await fetch(
      `${API_URL}/api/health`
    );

    backendStatus.value =
      response.ok
        ? "online"
        : "offline";

  } catch {
    backendStatus.value = "offline";
  }
}

// ======================================
// REFRESH
// ======================================

async function refreshDashboard() {
  if (refreshing.value) return;

  loading.value = true;
  refreshing.value = true;

  updateToday();

  try {
    await Promise.all([
      fetchProfile(),
      fetchAttendance(),
      checkBackend(),
    ]);

  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

onIonViewWillEnter(() => {
  if (loadUser()) {
    void refreshDashboard();
  }
});
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="dashboard-content"
    >
      <InZoneTopbar role="STUDENT" />

      <main class="main-content">

        <!-- WELCOME -->
        <section class="welcome-panel">
          <div class="welcome-copy">

            <div class="date-text">
              <IonIcon
                :icon="calendarOutline"
              />
              {{ today }}
            </div>

            <h1>
              Welcome back,
              <span>{{ firstName }}!</span>
            </h1>

            <p>
              Check your workplace,
              view your geofence coverage,
              and monitor your OJT progress.
            </p>

            <button
              type="button"
              class="hero-refresh"
              :disabled="refreshing"
              @click="refreshDashboard"
            >
              <IonIcon
                :icon="refreshOutline"
                :class="{
                  spinning: refreshing
                }"
              />

              {{
                refreshing
                  ? "Refreshing..."
                  : "Refresh Dashboard"
              }}
            </button>

          </div>

          <div
            class="welcome-illustration"
            aria-hidden="true"
          >
            <div class="orbit orbit-outer"></div>
            <div class="orbit orbit-inner"></div>

            <div class="location-core">
              <IonIcon
                :icon="navigateOutline"
              />
            </div>
          </div>
        </section>

        <!-- WORKPLACE HEADING -->
        <div class="section-heading">
          <div>
            <span class="eyebrow">
              ASSIGNED WORKPLACE
            </span>

            <h2>My OJT Location</h2>

            <p>
              Your approved workplace and
              geofence coverage.
            </p>
          </div>

          <span
            class="approval-pill"
            :class="{
              approved: approved,
              pending:
                approvalStatus === 'PENDING',
              rejected:
                approvalStatus === 'REJECTED'
            }"
          >
            <IonIcon
              :icon="
                approved
                  ? checkmarkCircleOutline
                  : hourglassOutline
              "
            />

            {{
              loading
                ? "LOADING"
                : approvalStatus || "NOT SET UP"
            }}
          </span>
        </div>

        <!-- WORKPLACE CARD -->
        <section class="workplace-card">

          <div class="workplace-info">
            <div class="workplace-icon">
              <IonIcon
                :icon="businessOutline"
              />
            </div>

            <div class="workplace-text">
              <span>
                REGISTERED OJT COMPANY
              </span>

              <h3>{{ companyName }}</h3>

              <p>
                <IonIcon
                  :icon="locationOutline"
                />

                {{ companyAddress }}
              </p>
            </div>
          </div>

          <!-- NO PROFILE -->
          <div
            v-if="!loading && !profile"
            class="workplace-placeholder"
          >
            <IonIcon
              :icon="businessOutline"
            />

            <h3>No OJT Workplace Yet</h3>

            <p>
              {{
                profileError ||
                "Complete your profile to register your workplace."
              }}
            </p>

            <button
              type="button"
              @click="
                navigate('/student/profile')
              "
            >
              Create OJT Profile
            </button>
          </div>

          <!-- PENDING / REJECTED -->
          <div
            v-else-if="
              !loading &&
              !approved
            "
            class="workplace-placeholder"
          >
            <IonIcon
              :icon="lockClosedOutline"
            />

            <h3>
              {{
                approvalStatus === "REJECTED"
                  ? "Workplace Needs Revision"
                  : "Workplace Awaiting Approval"
              }}
            </h3>

            <p>
              {{
                profile?.rejection_reason ||
                "Your workplace map becomes available after approval."
              }}
            </p>

            <button
              type="button"
              @click="
                navigate('/student/profile')
              "
            >
              View OJT Profile
            </button>
          </div>

          <!-- APPROVED WORKPLACE -->
          <template v-else-if="approved">

            <!-- COORDINATES -->
            <div
              v-if="
                validWorkplace &&
                workplace
              "
              class="workplace-meta"
            >
              <div>
                <span>
                  <IonIcon
                    :icon="pinOutline"
                  />
                  Latitude
                </span>

                <strong>
                  {{
                    workplace.latitude
                      .toFixed(6)
                  }}
                </strong>
              </div>

              <div>
                <span>
                  <IonIcon
                    :icon="pinOutline"
                  />
                  Longitude
                </span>

                <strong>
                  {{
                    workplace.longitude
                      .toFixed(6)
                  }}
                </strong>
              </div>

              <div>
                <span>
                  <IonIcon
                    :icon="compassOutline"
                  />
                  Allowed Radius
                </span>

                <strong class="radius-value">
                  {{ radiusLabel }}
                </strong>
              </div>
            </div>

            <!-- MAP HEADING -->
            <div class="map-heading">
              <div>
                <h4>
                  <IonIcon
                    :icon="mapOutline"
                  />

                  Approved Workplace Satellite Map
                </h4>

                <p>
                  Green circle is the allowed
                  attendance area. The center
                  marks your assigned workplace,
                  not your live GPS.
                </p>
              </div>

              <span class="map-label">
                <IonIcon
                  :icon="shieldCheckmarkOutline"
                />
                APPROVED
              </span>
            </div>

            <!-- ===================================
                 NEW INLINE GEOFENCE MAP
                 Circle shows without opening
                 the full map
                 =================================== -->

            <InZoneMapViewer
              v-if="
                validWorkplace &&
                workplace &&
                showMap
              "
              inline
              :is-open="showMap"
              :latitude="workplace.latitude"
              :longitude="workplace.longitude"
              :radius-meters="
                workplace.radius_meters
              "
              :address="companyAddress"
              :is-exact-pin="true"
            />

            <div
              v-else
              class="map-placeholder"
            >
              <IonIcon
                :icon="alertCircleOutline"
              />

              <p>
                {{
                  workplaceError ||
                  (showMap
                    ? "Approved geofence coordinates unavailable."
                    : "Map preview hidden.")
                }}
              </p>
            </div>

            <!-- MAP ACTIONS -->
            <div class="map-actions">

              <button
                v-if="validWorkplace"
                type="button"
                class="open-map"
                @click="openGeofenceMap"
              >
                <IonIcon :icon="eyeOutline" />

                View {{ radiusLabel }} Geofence
              </button>

              <button
                v-if="validWorkplace"
                type="button"
                class="toggle-map"
                @click="showMap = !showMap"
              >
                {{
                  showMap
                    ? "Hide Map"
                    : "Show Map"
                }}
              </button>

            </div>

            <p class="map-note">
              <IonIcon
                :icon="informationCircleOutline"
              />

              Map is a visual guide.
              Time In and Time Out eligibility
              is checked by the backend using
              your GPS location.
            </p>

          </template>

          <!-- LOADING -->
          <div
            v-else
            class="map-placeholder"
          >
            <IonIcon
              :icon="refreshOutline"
              class="spinning"
            />

            Loading workplace...
          </div>

        </section>

        <!-- TODAY HEADING -->
        <div class="section-heading">
          <div>
            <span class="eyebrow">
              PERSONAL OVERVIEW
            </span>

            <h2>My OJT Today</h2>

            <p>
              Daily attendance summary.
            </p>
          </div>
        </div>

        <!-- ATTENDANCE CARDS -->
        <section class="stat-grid">

          <article class="stat-card">
            <span class="stat-icon teal">
              <IonIcon
                :icon="calendarOutline"
              />
            </span>

            <p>Today's Attendance</p>

            <strong>
              {{ attendanceStatus }}
            </strong>

            <small>
              {{ attendanceDetail }}
            </small>
          </article>

          <article class="stat-card">
            <span class="stat-icon blue">
              <IonIcon
                :icon="logInOutline"
              />
            </span>

            <p>Time In Today</p>

            <strong>
              {{
                formatTime(
                  attendance?.time_in
                )
              }}
            </strong>

            <small>
              Philippine local time
            </small>
          </article>

          <article class="stat-card">
            <span class="stat-icon amber">
              <IonIcon
                :icon="logOutOutline"
              />
            </span>

            <p>Time Out Today</p>

            <strong>
              {{
                formatTime(
                  attendance?.time_out
                )
              }}
            </strong>

            <small>
              Philippine local time
            </small>
          </article>

        </section>

        <!-- TRAINING SCHEDULE -->
        <section
          v-if="profile"
          class="schedule-card"
        >
          <div class="schedule-heading">
            <IonIcon
              :icon="calendarOutline"
            />

            <div>
              <h3>OJT Training Schedule</h3>

              <p>
                Dates in your approved OJT profile
              </p>
            </div>
          </div>

          <div class="schedule-grid">
            <div>
              <span>START DATE</span>

              <strong>
                {{
                  formatDate(
                    profile.start_date
                  )
                }}
              </strong>
            </div>

            <div>
              <span>END DATE</span>

              <strong>
                {{
                  formatDate(
                    profile.end_date
                  )
                }}
              </strong>
            </div>
          </div>
        </section>

        <!-- OJT PROGRESS -->
        <section class="progress-panel">

          <div class="progress-heading">
            <div>
              <span class="eyebrow">
                PROGRESS PREVIEW
              </span>

              <h2>My OJT Progress</h2>

              <p>
                Training hours completed so far.
              </p>
            </div>

            <strong>
              {{
                progress === null
                  ? "—"
                  : `${progress}%`
              }}
            </strong>
          </div>

          <div
            class="progress-track"
            role="progressbar"
            :aria-valuenow="
              progress ?? 0
            "
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
                totalHours === null
                  ? "—"
                  : `${totalHours.toFixed(2)} hrs`
              }}
              completed
            </span>

            <span>
              {{
                remainingHours === null
                  ? "—"
                  : `${remainingHours.toFixed(2)} hrs`
              }}
              remaining
            </span>
          </div>

          <button
            type="button"
            class="view-reports"
            @click="
              navigate('/student/reports')
            "
          >
            View Detailed Reports

            <IonIcon
              :icon="arrowForwardOutline"
            />
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

          {{
            backendStatus === "online"
              ? "InZone server connected."
              : backendStatus === "offline"
                ? "InZone server is currently unreachable."
                : "Checking server connection..."
          }}
        </div>

      </main>
    </IonContent>

    <!-- BOTTOM NAV -->
    <StudentBottomNav />

    <!-- FULL MAP -->
    <InZoneMapViewer
      :is-open="showFullMap"
      title="My Approved Workplace Geofence"
      :latitude="
        workplace?.latitude ?? null
      "
      :longitude="
        workplace?.longitude ?? null
      "
      :radius-meters="
        workplace?.radius_meters ?? null
      "
      :address="companyAddress"
      :is-exact-pin="validWorkplace"
      @close="showFullMap = false"
    />
  </IonPage>
</template>

<style scoped>
.dashboard-content {
  --background: #f2f8f5;
  --color: #163c33;
}

.main-content {
  max-width: 1260px;
  margin: 0 auto;
  padding:
    32px clamp(16px, 4vw, 46px)
    calc(135px + env(safe-area-inset-bottom, 0px));
}

button {
  font-family: inherit;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* WELCOME */

.welcome-panel {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 220px;

  padding: clamp(25px, 4vw, 42px);
  border-radius: 25px;

  background: linear-gradient(
    115deg,
    #0b775b,
    #064938 70%,
    #073a34
  );

  color: #ffffff;
  box-shadow: 0 18px 45px #0d594026;
}

.welcome-copy {
  position: relative;
  z-index: 1;
  max-width: 680px;
}

.date-text {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #b6eed5;
  font-size: 12px;
}

.welcome-panel h1 {
  margin: 16px 0 12px;
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -1px;
}

.welcome-panel h1 span {
  color: #91f2c0;
}

.welcome-panel p {
  color: #d9f0e6;
  line-height: 1.7;
  font-size: 13px;
}

.hero-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  padding: 11px 15px;
  margin-top: 12px;

  border: 1px solid #ffffff55;
  border-radius: 11px;

  background: #ffffff20;
  color: #ffffff;

  font-size: 12px;
  font-weight: 750;
}

.welcome-illustration {
  position: absolute;
  width: 255px;
  height: 255px;
  right: 35px;
  top: -15px;
  opacity: 0.48;
}

.orbit {
  position: absolute;
  left: 50%;
  top: 50%;

  transform: translate(-50%, -50%);

  border: 1px dashed #b8f2d566;
  border-radius: 50%;
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
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);

  width: 78px;
  height: 78px;

  display: grid;
  place-items: center;

  border-radius: 23px;

  background: #ceffe1;
  color: #08765a;
  font-size: 37px;
}

/* HEADINGS */

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  margin: 30px 0 16px;
}

.eyebrow {
  color: #0b9970;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.2px;
}

.section-heading h2 {
  margin: 6px 0;
  color: #173f33;
  font-size: 22px;
}

.section-heading p {
  margin: 0;
  color: #80958a;
  font-size: 12px;
}

/* APPROVAL */

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

/* CARDS */

.workplace-card,
.schedule-card,
.progress-panel {
  background: #ffffff;
  border: 1px solid #dfece3;
  border-radius: 22px;
  box-shadow: 0 8px 30px #14563d09;
}

.workplace-card {
  padding: 23px;
}

.workplace-info {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.workplace-icon {
  display: grid;
  place-items: center;

  width: 55px;
  height: 55px;
  flex-shrink: 0;

  border-radius: 16px;

  color: #0b7f5c;
  background: #e2f6e9;

  font-size: 27px;
}

.workplace-text {
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
  color: #173e30;
  font-size: 22px;
  overflow-wrap: anywhere;
}

.workplace-text p {
  display: flex;
  gap: 7px;
  margin: 0;

  color: #819588;
  font-size: 12px;
  line-height: 1.6;
}

.workplace-text p ion-icon {
  flex-shrink: 0;
}

/* GEOFENCE COORDINATES */

.workplace-meta {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: 12px;
  margin: 22px 0;
}

.workplace-meta > div {
  padding: 15px;
  border-radius: 13px;
  background: #f3f9f5;
}

.workplace-meta span {
  display: flex;
  align-items: center;
  gap: 6px;

  font-size: 11px;
  color: #81998b;
}

.workplace-meta strong {
  display: block;
  margin-top: 8px;

  color: #1f4e37;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.radius-value {
  color: #07845b !important;
}

/* MAP HEADER AND BUTTONS */

.map-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  margin: 22px 0 13px;
}

.map-heading h4 {
  display: flex;
  align-items: center;
  gap: 7px;

  margin: 0 0 5px;

  color: #1d4834;
  font-size: 15px;
}

.map-heading p {
  margin: 0;
  color: #899d8d;
  font-size: 11px;
  line-height: 1.5;
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

.map-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-top: 13px;
}

.open-map,
.toggle-map {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  padding: 12px 15px;

  border-radius: 11px;

  font-size: 12px;
  font-weight: 800;
}

.open-map {
  background: #087957;
  color: #ffffff;
  border: 0;
}

.toggle-map {
  background: #e9f6ed;
  color: #087957;
  border: 1px solid #cfe6d7;
}

.map-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  margin: 15px 0 0;

  color: #698875;
  font-size: 11px;
  line-height: 1.7;
}

.map-note ion-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

/* PLACEHOLDERS */

.map-placeholder,
.workplace-placeholder {
  min-height: 185px;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;

  text-align: center;

  margin-top: 17px;
  padding: 25px;

  background: #f7fbf8;
  border: 1px dashed #cde5d6;
  border-radius: 15px;
}

.map-placeholder ion-icon,
.workplace-placeholder ion-icon {
  color: #7aaf91;
  font-size: 30px;
}

.workplace-placeholder h3 {
  margin: 0;
  color: #28523a;
  font-size: 16px;
}

.workplace-placeholder p {
  color: #829a8a;
  font-size: 12px;
  line-height: 1.6;
}

.workplace-placeholder button {
  padding: 11px 17px;

  border: 0;
  border-radius: 10px;

  background: #0b7959;
  color: #ffffff;
}

/* ATTENDANCE */

.stat-grid {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  min-width: 0;
  padding: 20px;

  background: #ffffff;
  border: 1px solid #dfece3;
  border-radius: 18px;
}

.stat-icon {
  display: grid;
  place-items: center;

  width: 42px;
  height: 42px;

  border-radius: 12px;
  font-size: 22px;
}

.stat-icon.teal {
  background: #e2f5e9;
  color: #0a936a;
}

.stat-icon.blue {
  background: #e7f0ff;
  color: #3d7dc4;
}

.stat-icon.amber {
  background: #fff1d8;
  color: #b88228;
}

.stat-card p {
  margin: 16px 0 7px;
  color: #81998b;
  font-size: 12px;
}

.stat-card strong {
  display: block;
  color: #184a36;
  font-size: 19px;
  overflow-wrap: anywhere;
}

.stat-card small {
  display: block;
  margin-top: 7px;
  color: #94a69b;
  font-size: 11px;
}

/* SCHEDULE */

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
  border-radius: 11px;

  background: #e7f6ec;
  color: #0b815e;

  font-size: 24px;
}

.schedule-heading h3 {
  margin: 0 0 5px;
  color: #1f4937;
  font-size: 16px;
}

.schedule-heading p {
  margin: 0;
  color: #8a9f90;
  font-size: 11px;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 17px;
}

.schedule-grid > div {
  padding: 16px;

  background: #f3f9f5;
  border-radius: 12px;
}

.schedule-grid span {
  display: block;
  margin-bottom: 8px;

  color: #829c8a;
  font-size: 10px;
}

.schedule-grid strong {
  color: #27503b;
  font-size: 15px;
}

/* PROGRESS */

.progress-panel {
  margin-top: 22px;
  padding: 23px;
}

.progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.progress-heading h2 {
  margin: 7px 0 5px;
  color: #173f33;
  font-size: 20px;
}

.progress-heading p {
  margin: 0;
  color: #829788;
  font-size: 12px;
}

.progress-heading > strong {
  color: #0b775b;
  font-size: 26px;
}

.progress-track {
  height: 12px;
  margin: 20px 0 13px;

  border-radius: 99px;

  background: #e5f2eb;
  overflow: hidden;
}

.progress-fill {
  height: 100%;

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
  gap: 10px;

  color: #738d80;
  font-size: 11px;
}

.view-reports {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  margin-top: 17px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #0b8762;
  font-weight: 800;
  font-size: 12px;
}

/* CONNECTION */

.connection-note {
  display: flex;
  align-items: center;
  gap: 9px;

  margin-top: 22px;
  padding: 14px 17px;

  color: #436c5c;
  background: #eaf6ef;

  border: 1px solid #d1e7d9;
  border-radius: 12px;

  font-size: 12px;
}

/* ANIMATIONS */

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

/* MOBILE */

@media (max-width: 650px) {
  .main-content {
    padding:
      22px 15px
      calc(
        140px +
        env(safe-area-inset-bottom, 0px)
      );
  }

  .welcome-panel {
    padding: 25px 21px;
    min-height: 210px;
    border-radius: 19px;
  }

  .welcome-panel h1 {
    font-size: 29px;
  }

  .welcome-illustration {
    opacity: 0.15;
    right: -85px;
  }

  .workplace-card {
    padding: 17px;
  }

  .workplace-meta {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .workplace-meta > div:last-child {
    grid-column: 1 / -1;
  }

  .map-actions > button {
    flex: 1;
  }

  .stat-grid {
    gap: 9px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card p {
    font-size: 10px;
  }

  .stat-card strong {
    font-size: 14px;
  }

  .stat-card small {
    font-size: 10px;
  }

  .schedule-card,
  .progress-panel {
    padding: 17px;
  }
}

@media (max-width: 380px) {
  .stat-grid,
  .schedule-grid,
  .workplace-meta {
    grid-template-columns: 1fr;
  }

  .workplace-meta > div:last-child {
    grid-column: auto;
  }
}
</style>
