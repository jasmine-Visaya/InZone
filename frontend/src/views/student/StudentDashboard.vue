
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
  sparklesOutline, pulseOutline, cloudDoneOutline, trendingUpOutline, documentTextOutline, chevronForwardOutline,
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
const updatedAt = ref<Date | null>(null);
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

const syncedAt = computed(() => updatedAt.value
  ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(updatedAt.value)
  : 'Not synced');
const hourText = (value: number | null) => value === null ? '—' : value.toFixed(2);
const profileHint = computed(() => !profile.value ? 'Set up your OJT profile to begin tracking progress.'
  : !approved.value ? 'Your workplace must be approved before attendance becomes available.'
  : !validWorkplace.value ? 'Your workplace is approved. Geofence details are not available yet.'
  : 'Your workplace is approved and ready for location-based attendance.');
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
    updatedAt.value = new Date();
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
    <IonContent :fullscreen="true" class="page">
      <InZoneTopbar role="STUDENT" />
      <main class="wrap">
        <header class="welcome">
          <div>
            <div class="overline"><span class="live-dot" /> INZONE / STUDENT WORKSPACE</div>
            <h1>Good to see you, <em>{{ firstName }}.</em></h1>
            <p>Your personal hub for attendance, workplace location, and OJT milestones.</p>
          </div>
          <button class="sync-btn" :disabled="refreshing" @click="refreshDashboard"><IonIcon :icon="refreshOutline" :class="{ spinning: refreshing }" /> {{ refreshing ? 'Syncing data…' : 'Refresh dashboard' }}</button>
        </header>

        <section class="hero" aria-label="Personal OJT progress">
          <div class="hero-sheen" />
          <div class="hero-left">
            <span class="hero-kicker"><IonIcon :icon="sparklesOutline" /> YOUR OJT JOURNEY, ALL IN ONE PLACE</span>
            <h2>Make every <span>hour count.</span></h2>
            <p>Stay on top of your training hours, today's attendance, and your assigned workplace.</p>
            <div class="hero-actions">
              <button class="hero-primary" @click="navigate('/student/track')">Go to attendance <IonIcon :icon="arrowForwardOutline" /></button>
              <button class="hero-secondary" @click="navigate('/student/reports')">View my reports <IonIcon :icon="chevronForwardOutline" /></button>
            </div>
            <div class="sync-stamp"><IonIcon :icon="cloudDoneOutline" /> Last synced: {{ syncedAt }} · {{ today }}</div>
          </div>
          <div class="hero-visual">
            <div class="orbit orbit-one" /><div class="orbit orbit-two" />
            <div class="ring" :style="{ '--progress': `${progress ?? 0}%` }">
              <div class="ring-inner"><small>OJT COMPLETION</small><strong>{{ progress === null ? '—' : `${progress}%` }}</strong><span>{{ hourText(totalHours) }} / {{ hourText(requiredHours) }} hrs</span></div>
            </div>
            <span class="orbit-chip chip-a"><IonIcon :icon="pulseOutline" /> Live progress</span>
            <span class="orbit-chip chip-b"><IonIcon :icon="checkmarkCircleOutline" /> {{ hourText(remainingHours) }} hrs remaining</span>
          </div>
        </section>

        <div v-if="profileError || attendanceError || workplaceError" class="error"><IonIcon :icon="alertCircleOutline" /><span>{{ profileError || attendanceError || workplaceError }}</span><button @click="refreshDashboard">Retry</button></div>
        <section class="section-head">
          <div><span class="eyebrow">YOUR DAILY SNAPSHOT</span><h2>Everything at a glance<span>.</span></h2><p>Attendance and training details from your InZone account.</p></div>
          <span class="time-badge"><IonIcon :icon="pulseOutline" /> {{ loading ? 'Loading' : attendanceStatus }}</span>
        </section>

        <section class="metric-grid">
          <article class="metric mint"><div class="metric-top"><span class="metric-icon"><IonIcon :icon="calendarOutline" /></span><span class="metric-number">01</span></div><small>Today's attendance</small><strong class="status-value">{{ loading ? 'Loading…' : attendanceStatus }}</strong><p>{{ attendanceDetail }}</p><div class="mini-track"><div :style="{ width: attendance?.time_in ? (attendance?.time_out ? '100%' : '50%') : '0%' }" /></div></article>
          <article class="metric blue"><div class="metric-top"><span class="metric-icon"><IonIcon :icon="logInOutline" /></span><span class="metric-number">02</span></div><small>Time in today</small><strong class="time-value">{{ formatTime(attendance?.time_in) }}</strong><p>Philippine local time</p><div class="mini-track"><div :style="{ width: attendance?.time_in ? '100%' : '0%' }" /></div></article>
          <article class="metric amber"><div class="metric-top"><span class="metric-icon"><IonIcon :icon="logOutOutline" /></span><span class="metric-number">03</span></div><small>Time out today</small><strong class="time-value">{{ formatTime(attendance?.time_out) }}</strong><p>Philippine local time</p><div class="mini-track"><div :style="{ width: attendance?.time_out ? '100%' : '0%' }" /></div></article>
          <article class="metric violet"><div class="metric-top"><span class="metric-icon"><IonIcon :icon="hourglassOutline" /></span><span class="metric-number">04</span></div><small>Remaining training hours</small><strong>{{ hourText(remainingHours) }}</strong><p>Of {{ hourText(requiredHours) }} required hours</p><div class="mini-track"><div :style="{ width: `${progress ?? 0}%` }" /></div></article>
        </section>

        <div class="visual-grid">
          <section class="panel progress-panel">
            <div class="panel-head"><div><span class="eyebrow">TRAINING PROGRESS</span><h2>Your hours, your progress</h2><p>Track your completed and remaining training hours.</p></div><span class="panel-icon"><IonIcon :icon="trendingUpOutline" /></span></div>
            <div class="pulse-body"><div class="pulse-ring" :style="{ '--progress': `${progress ?? 0}%` }"><div><strong>{{ progress === null ? '—' : `${progress}%` }}</strong><small>completed</small></div></div><div class="pulse-legend"><div><span class="legend-dot mint-dot" /><span>Hours completed</span><strong>{{ hourText(totalHours) }}</strong></div><div><span class="legend-dot amber-dot" /><span>Hours remaining</span><strong>{{ hourText(remainingHours) }}</strong></div><div><span class="legend-dot navy-dot" /><span>Required hours</span><strong>{{ hourText(requiredHours) }}</strong></div><button class="text-cta" @click="navigate('/student/reports')">Open detailed reports <IonIcon :icon="arrowForwardOutline" /></button></div></div>
            <div class="insight"><IonIcon :icon="checkmarkCircleOutline" /><span>{{ profileHint }}</span></div>
          </section>
          <section class="panel overview-panel">
            <div class="panel-head"><div><span class="eyebrow">WORKPLACE STATUS</span><h2>My assigned company</h2><p>Your current OJT placement and approval status.</p></div><span class="approval-pill" :class="{ approved, pending: approvalStatus === 'PENDING', rejected: approvalStatus === 'REJECTED' }">{{ loading ? 'LOADING' : approvalStatus || 'NOT SET UP' }}</span></div>
            <div class="company-block"><span class="company-icon"><IonIcon :icon="businessOutline" /></span><div><small>REGISTERED OJT COMPANY</small><strong>{{ companyName }}</strong><p><IonIcon :icon="locationOutline" /> {{ companyAddress }}</p></div></div>
            <div v-if="profile" class="schedule-grid"><div><small>START DATE</small><strong>{{ formatDate(profile.start_date) }}</strong></div><div><small>END DATE</small><strong>{{ formatDate(profile.end_date) }}</strong></div></div>
            <div class="workplace-note"><IonIcon :icon="approved ? shieldCheckmarkOutline : informationCircleOutline" /><span>{{ profileHint }} <template v-if="profile?.rejection_reason">{{ profile.rejection_reason }}</template></span></div>
            <button class="full-link" @click="navigate('/student/profile')">{{ profile ? 'View OJT profile' : 'Create OJT profile' }} <IonIcon :icon="arrowForwardOutline" /></button>
          </section>
        </div>

        <div class="bottom-head"><div><span class="eyebrow">APPROVED WORKPLACE</span><h2>Know your location<span>.</span></h2><p>Review your assigned geofence and coverage.</p></div><span class="location-label"><IonIcon :icon="compassOutline" /> {{ radiusLabel }}</span></div>
        <section class="panel map-panel">
          <div class="map-top"><div><span class="eyebrow">GEOFENCE MONITORING</span><h2>My workplace map</h2><p>Green circle shows your allowed attendance area, not your live GPS.</p></div><button v-if="validWorkplace" class="map-toggle" @click="showMap = !showMap">{{ showMap ? 'Hide map' : 'Show map' }}</button></div>
          <div v-if="!loading && !profile" class="empty-map"><IonIcon :icon="businessOutline" /><strong>No workplace registered yet</strong><p>Create your OJT profile to set up a workplace.</p><button @click="navigate('/student/profile')">Create OJT profile</button></div>
          <div v-else-if="!loading && !approved" class="empty-map"><IonIcon :icon="lockClosedOutline" /><strong>{{ approvalStatus === 'REJECTED' ? 'Workplace needs revision' : 'Awaiting workplace approval' }}</strong><p>{{ profile?.rejection_reason || 'Your workplace map becomes available after approval.' }}</p><button @click="navigate('/student/profile')">View OJT profile</button></div>
          <template v-else-if="approved">
            <div class="geo-stats"><div><small>LATITUDE</small><strong>{{ validWorkplace && workplace ? workplace.latitude.toFixed(6) : '—' }}</strong></div><div><small>LONGITUDE</small><strong>{{ validWorkplace && workplace ? workplace.longitude.toFixed(6) : '—' }}</strong></div><div><small>ALLOWED RADIUS</small><strong>{{ radiusLabel }}</strong></div></div>
            <InZoneMapViewer v-if="validWorkplace && workplace && showMap" inline :is-open="showMap" :latitude="workplace.latitude" :longitude="workplace.longitude" :radius-meters="workplace.radius_meters" :address="companyAddress" :is-exact-pin="true" />
            <div v-else class="empty-map"><IonIcon :icon="mapOutline" /><strong>{{ showMap ? 'Map unavailable' : 'Map preview hidden' }}</strong><p>{{ workplaceError || (showMap ? 'Approved geofence coordinates unavailable.' : 'Show the map to view your workplace.') }}</p></div>
            <div class="map-bottom"><span><IonIcon :icon="informationCircleOutline" /> GPS eligibility is always checked by the backend.</span><button v-if="validWorkplace" class="text-cta" @click="openGeofenceMap">View full geofence <IonIcon :icon="arrowForwardOutline" /></button></div>
          </template>
          <div v-else class="empty-map"><IonIcon :icon="refreshOutline" class="spinning" /><p>Loading workplace...</p></div>
        </section>

        <div class="bottom-head"><div><span class="eyebrow">STUDENT WORKSPACE</span><h2>Make your next move<span>.</span></h2></div><span>Choose a module to continue</span></div>
        <section class="tool-grid">
          <button class="tool" @click="navigate('/student/track')"><div class="tool-top"><span class="tool-icon"><IonIcon :icon="navigateOutline" /></span><span class="tool-index">/01</span></div><strong>Track attendance</strong><p>Time in, time out, and location checks</p><span class="tool-foot">Open attendance <IonIcon :icon="arrowForwardOutline" /></span></button>
          <button class="tool" @click="navigate('/student/profile')"><div class="tool-top"><span class="tool-icon blue"><IonIcon :icon="businessOutline" /></span><span class="tool-index">/02</span></div><strong>OJT profile</strong><p>Company details and training schedule</p><span class="tool-foot">Open profile <IonIcon :icon="arrowForwardOutline" /></span></button>
          <button class="tool" @click="navigate('/student/reports')"><div class="tool-top"><span class="tool-icon violet"><IonIcon :icon="documentTextOutline" /></span><span class="tool-index">/03</span></div><strong>My reports</strong><p>Daily accomplishments and weekly feedback</p><span class="tool-foot">Open reports <IonIcon :icon="arrowForwardOutline" /></span></button>
          <button class="tool" @click="navigate('/student/attendance')"><div class="tool-top"><span class="tool-icon amber"><IonIcon :icon="calendarOutline" /></span><span class="tool-index">/04</span></div><strong>Attendance history</strong><p>Review your recorded OJT shifts</p><span class="tool-foot">Open history <IonIcon :icon="arrowForwardOutline" /></span></button>
        </section>
        <div class="connection-note"><IonIcon :icon="backendStatus === 'online' ? checkmarkCircleOutline : backendStatus === 'offline' ? cloudOfflineOutline : informationCircleOutline" />{{ backendStatus === 'online' ? 'InZone server connected.' : backendStatus === 'offline' ? 'InZone server is currently unreachable.' : 'Checking server connection...' }}</div>
        <footer>INZONE <span>✦</span> OJT ATTENDANCE &amp; MONITORING <span>·</span> Dashboard figures refresh on demand.</footer>
      </main>
    </IonContent>
    <StudentBottomNav />
    <InZoneMapViewer :is-open="showFullMap" title="My Approved Workplace Geofence" :latitude="workplace?.latitude ?? null" :longitude="workplace?.longitude ?? null" :radius-meters="workplace?.radius_meters ?? null" :address="companyAddress" :is-exact-pin="validWorkplace" @close="showFullMap = false" />
  </IonPage>
</template>

<style scoped>
.page{--background:#f0f6f2;--color:#153b2d}.wrap{max-width:1350px;margin:auto;padding:32px clamp(15px,4vw,49px) calc(155px + env(safe-area-inset-bottom,0px))}
button{font:inherit;cursor:pointer}.welcome{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}.overline,.eyebrow{color:#0c8e67;font-size:10px;font-weight:900;letter-spacing:1.5px}.overline{display:flex;align-items:center;gap:8px}.live-dot{width:7px;height:7px;background:#12b886;box-shadow:0 0 0 5px #12b88618;border-radius:50%}.welcome h1{color:#163b2e;margin:10px 0 8px;font-size:clamp(29px,3.6vw,43px);font-weight:850;letter-spacing:-1.5px}.welcome h1 em{color:#098561;font-style:normal}.welcome p,.section-head p{color:#82998a;font-size:12px;margin:0;line-height:1.7}.sync-btn{display:flex;align-items:center;gap:8px;border:1px solid #cde7d7;background:#fff;color:#0e7c5a;border-radius:13px;padding:13px 16px;font-size:11px;font-weight:850;white-space:nowrap;box-shadow:0 8px 23px #173e3010}.sync-btn:disabled{opacity:.55}
.hero{position:relative;isolation:isolate;display:grid;grid-template-columns:1.2fr .8fr;align-items:center;overflow:hidden;min-height:344px;padding:34px clamp(25px,3.6vw,49px);border-radius:26px;color:white;background:linear-gradient(120deg,#07362e 0%,#075441 46%,#0b8c65 100%);box-shadow:0 22px 42px #07583e28}.hero:before,.hero:after{content:"";position:absolute;z-index:-1;border-radius:50%;pointer-events:none}.hero:before{width:410px;height:410px;right:-170px;top:-200px;background:#76f1b422;filter:blur(25px)}.hero:after{width:300px;height:300px;left:25%;bottom:-280px;background:#a2fbc524;filter:blur(40px)}.hero-sheen{position:absolute;inset:0;background:radial-gradient(circle at 81% 70%,#9affbe16,transparent 34%),linear-gradient(110deg,transparent 45%,#ffffff06 55%,transparent 65%);pointer-events:none}.hero-left{position:relative;z-index:2}.hero-kicker{display:inline-flex;align-items:center;gap:8px;color:#b4f8d8;border:1px solid #e2ffe538;padding:9px 12px;border-radius:30px;background:#ffffff12;font-size:9px;letter-spacing:1px;font-weight:850}.hero h2{max-width:600px;margin:18px 0 14px;font-size:clamp(33px,4.2vw,51px);letter-spacing:-2px;line-height:1.09;font-weight:850}.hero h2 span{color:#8aefbf}.hero p{max-width:450px;color:#cde9dc;font-size:12px;line-height:1.85}.hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:22px}.hero-actions button{display:inline-flex;align-items:center;gap:11px;border:0;border-radius:12px;padding:13px 16px;font-size:11px;font-weight:850;transition:transform .18s}.hero-actions button:hover{transform:translateY(-2px)}.hero-primary{background:#e8ffec;color:#07583f}.hero-secondary{background:#ffffff18;color:#e8fff3;border:1px solid #ffffff45!important}.sync-stamp{display:flex;align-items:center;gap:7px;color:#b2dec9;font-size:10px;margin-top:24px}.hero-visual{position:relative;display:grid;place-items:center;min-height:300px}.orbit{position:absolute;border:1px dashed #dcffe549;border-radius:50%}.orbit-one{height:296px;width:296px}.orbit-two{height:253px;width:253px;border-style:solid;border-color:#effff119}.ring,.pulse-ring{--progress:0%;border-radius:50%;background:conic-gradient(#8cf8b7 var(--progress),#ffffff24 var(--progress) 100%);display:grid;place-items:center}.ring{height:215px;width:215px;box-shadow:0 15px 60px #03271e77;transform:rotate(-7deg)}.ring-inner{height:185px;width:185px;border-radius:50%;background:#0a5340;display:flex;align-items:center;justify-content:center;flex-direction:column;transform:rotate(7deg)}.ring-inner small{font-size:9px;letter-spacing:1.5px;color:#b5f3d2;font-weight:850}.ring-inner strong{font-size:48px;line-height:1.2;letter-spacing:-2px}.ring-inner span{font-size:10px;color:#bbe2ce}.orbit-chip{position:absolute;display:flex;align-items:center;gap:7px;background:#ffffffed;color:#0d7050;padding:10px 12px;border-radius:12px;font-size:10px;font-weight:850;box-shadow:0 8px 30px #002e222c}.chip-a{top:20px;right:0}.chip-b{bottom:22px;left:0}
.error{display:flex;gap:10px;align-items:center;background:#fff0eb;border:1px solid #f5cfc4;color:#aa463a;border-radius:12px;padding:13px 16px;margin-top:20px;font-size:12px}.error span{flex:1}.error button{border:0;background:transparent;font-weight:850;color:inherit}.section-head,.bottom-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:35px 0 17px}.section-head h2,.bottom-head h2{color:#173f2f;font-size:clamp(22px,2.3vw,28px);letter-spacing:-.8px;margin:7px 0}.section-head h2 span,.bottom-head h2 span{color:#16ad79}.time-badge{display:flex;align-items:center;gap:6px;font-size:10px;color:#0b8660;background:#ddf4e6;border-radius:20px;padding:9px 11px;font-weight:850;white-space:nowrap}
.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}.metric{--accent:#169b72;--pale:#e0f7ec;position:relative;overflow:hidden;background:#fff;border:1px solid #dfebe2;border-radius:19px;padding:20px 22px;box-shadow:0 9px 28px #104a3310;animation:rise .4s both;animation-delay:calc(var(--i) * 55ms);transition:transform .18s,box-shadow .18s}.metric:hover{transform:translateY(-4px);box-shadow:0 15px 35px #104a331a}.metric.blue{--accent:#537dd7;--pale:#e9efff}.metric.amber{--accent:#b98228;--pale:#fff4db}.metric.violet{--accent:#7c64cb;--pale:#f1edff}.metric-top{display:flex;justify-content:space-between;align-items:flex-start}.metric-icon{display:grid;place-items:center;height:47px;width:47px;border-radius:14px;background:var(--pale);color:var(--accent);font-size:24px}.metric-number{color:#d2e1d7;font-size:11px;font-weight:900}.metric small{display:block;color:#81998b;font-size:11px;font-weight:800;margin-top:21px}.metric strong{display:block;color:#173f30;font-size:clamp(30px,3vw,43px);letter-spacing:-1.5px;line-height:1.2;margin:4px 0}.metric p{color:#91a698;font-size:10px;margin:0 0 17px;min-height:17px}.mini-track{height:5px;border-radius:50px;background:#edf4ee;overflow:hidden}.mini-track div{height:100%;background:var(--accent);border-radius:50px;transition:width .4s}
.visual-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin-top:21px}.panel{background:white;border:1px solid #dfebe2;border-radius:22px;box-shadow:0 12px 35px #104a330a;padding:24px}.panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.panel-head h2{margin:8px 0 5px;font-size:21px;color:#164231;letter-spacing:-.5px}.panel-head p{color:#90a497;font-size:11px;line-height:1.7;margin:0}.panel-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#e8f7ec;color:#118966;font-size:22px}.pulse-body{display:flex;align-items:center;justify-content:center;gap:35px;margin:24px 0}.pulse-ring{width:170px;height:170px;flex-shrink:0;background:conic-gradient(#13b584 var(--progress),#e7f1e9 var(--progress) 100%)}.pulse-ring>div{display:flex;align-items:center;justify-content:center;flex-direction:column;width:136px;height:136px;background:white;border-radius:50%}.pulse-ring strong{font-size:39px;color:#0a8a62;letter-spacing:-1.5px}.pulse-ring small{font-size:11px;color:#8da294}.pulse-legend{flex:1;min-width:145px}.pulse-legend>div{display:flex;align-items:center;gap:9px;margin-bottom:17px;font-size:11px;color:#779283}.pulse-legend>div span:nth-child(2){flex:1}.pulse-legend strong{font-size:16px;color:#174d35}.legend-dot{height:10px;width:10px;border-radius:4px}.mint-dot{background:#13b584}.amber-dot{background:#f5bd60}.navy-dot{background:#265b76}.text-cta{display:flex;align-items:center;gap:8px;border:0;background:#e7f7ee;color:#0b8059;border-radius:10px;padding:11px 12px;font-size:11px;font-weight:850}.insight{display:flex;align-items:center;gap:10px;border:1px solid #dcece2;background:#f6fbf7;padding:14px;border-radius:12px;color:#557765;font-size:11px;line-height:1.6}.insight ion-icon{flex-shrink:0;font-size:19px;color:#0b9b6e}
.count-tag{font-size:10px;padding:9px 12px;border-radius:30px;color:#966220;background:#fff2d8;font-weight:850}.action-list{margin:20px 0}.action{width:100%;display:flex;align-items:center;gap:11px;padding:13px 8px;text-align:left;border:0;border-bottom:1px solid #edf2ec;background:transparent;transition:background .2s}.action:hover{background:#f7fcf8}.action-index{font-size:10px;color:#a7b7ac;font-weight:850}.action-symbol{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:13px;font-size:21px}.action-symbol.amber{background:#fff2dc;color:#b98228}.action-symbol.rose{background:#ffedea;color:#c15c58}.action-symbol.violet{background:#f2eeff;color:#7c64cb}.action-text{flex:1;min-width:0}.action-text strong{display:block;font-size:12px;color:#214d37}.action-text small{display:block;font-size:10px;color:#91a696;line-height:1.5;margin-top:5px}.action-amount{font-size:20px;font-weight:900;color:#25533b}.action-arrow{color:#92ae9c}.action-bottom{display:flex;align-items:center;gap:8px;color:#8a9f91;font-size:10px;padding-top:10px}
.bottom-head{margin-top:34px}.bottom-head>span{color:#90a597;font-size:11px}.tool-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}.tool{display:flex;flex-direction:column;align-items:flex-start;min-width:0;text-align:left;background:#fff;border:1px solid #dfece2;border-radius:19px;padding:22px;transition:transform .2s,box-shadow .2s}.tool:hover{transform:translateY(-4px);box-shadow:0 16px 33px #0b523515}.tool-top{width:100%;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:25px}.tool-icon{display:grid;place-items:center;width:49px;height:49px;border-radius:15px;font-size:24px;background:#e0f7ec;color:#09865d}.tool-icon.blue{background:#e7efff;color:#537dd7}.tool-icon.violet{background:#f1edff;color:#7c64cb}.tool-icon.amber{background:#fff2dc;color:#b98228}.tool-index{font-size:10px;font-weight:900;color:#b3c5b8}.tool strong{color:#194936;font-size:14px}.tool p{font-size:11px;color:#92a697;line-height:1.6;min-height:35px;margin:8px 0 16px}.tool-foot{display:flex;align-items:center;gap:8px;color:#07895e;font-size:10px;font-weight:900}.wrap footer{text-align:center;margin-top:30px;font-size:10px;color:#93a99b;letter-spacing:.4px}.wrap footer span{color:#15ad79;margin:0 5px}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}.spinning{animation:spin .9s linear infinite}
@media(max-width:1050px){.hero{grid-template-columns:1.3fr .7fr}.hero-visual{transform:scale(.85)}.metric-grid,.tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.welcome,.section-head{align-items:flex-start;flex-direction:column}.hero{grid-template-columns:1fr}.hero-visual{min-height:245px;transform:scale(.8);margin:-15px 0 -25px}.visual-grid{grid-template-columns:1fr}.pulse-body{gap:20px}.wrap{padding:25px 15px calc(145px + env(safe-area-inset-bottom,0px))}}@media(max-width:440px){.hero{padding:26px 22px}.hero h2{font-size:34px}.metric-grid{gap:9px}.metric{padding:15px}.metric strong{font-size:31px}.pulse-body{flex-direction:column;align-items:stretch}.pulse-ring{margin:0 auto}.tool-grid{grid-template-columns:1fr}.orbit-chip{font-size:9px}}@media(prefers-reduced-motion:reduce){.metric,.hero-actions button,.tool{transition:none;animation:none}.spinning{animation:none}}

/* Student-specific dashboard adaptations */
.metric .status-value{font-size:clamp(17px,2vw,25px);letter-spacing:-.5px;overflow-wrap:anywhere}.metric .time-value{font-size:clamp(19px,2.2vw,29px);letter-spacing:-.6px}.metric p{line-height:1.5}.approval-pill{font-size:10px;font-weight:850;padding:9px 12px;border-radius:20px;background:#fff3d9;color:#956b24;white-space:nowrap}.approval-pill.approved{background:#e0f6e9;color:#087e5b}.approval-pill.rejected{background:#ffe9e6;color:#ad4e42}.company-block{display:flex;gap:14px;align-items:flex-start;margin:24px 0;padding:18px;border:1px solid #e2eee5;background:#f8fcf9;border-radius:15px}.company-icon{flex-shrink:0;display:grid;place-items:center;width:48px;height:48px;background:#e2f6e9;border-radius:14px;color:#0b8d63;font-size:25px}.company-block>div{min-width:0}.company-block small,.schedule-grid small,.geo-stats small{display:block;color:#81998b;font-size:10px;letter-spacing:.5px;font-weight:850}.company-block strong{display:block;color:#174331;font-size:18px;margin:7px 0;overflow-wrap:anywhere}.company-block p{display:flex;align-items:flex-start;gap:7px;font-size:11px;line-height:1.6;color:#789485;margin:0;overflow-wrap:anywhere}.company-block p ion-icon{flex-shrink:0;margin-top:2px}.schedule-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:17px}.schedule-grid>div{padding:15px;border:1px solid #e4eee6;border-radius:12px}.schedule-grid strong{display:block;margin-top:8px;color:#1b4b36;font-size:13px}.workplace-note{display:flex;align-items:flex-start;gap:9px;background:#f1f9f4;border-radius:12px;padding:13px;color:#557b63;font-size:11px;line-height:1.6}.workplace-note ion-icon{flex-shrink:0;font-size:18px;color:#0c9569}.full-link{display:flex;align-items:center;gap:8px;margin-top:18px;border:0;background:transparent;color:#087e5b;font-weight:850;font-size:12px}.location-label{display:flex;align-items:center;gap:6px;background:#e3f6e9;color:#0b8660;border-radius:20px;padding:9px 12px;font-size:11px;font-weight:850}.bottom-head p{font-size:11px;color:#8ca295;margin:0}.map-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px}.map-top h2{margin:7px 0;color:#173f30;font-size:21px}.map-top p{font-size:11px;color:#8ba393;line-height:1.6;margin:0}.map-toggle{border:1px solid #d8e9de;border-radius:11px;background:#f4faf6;color:#087f59;padding:10px 14px;font-size:11px;font-weight:850;white-space:nowrap}.geo-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:17px}.geo-stats>div{padding:14px;border-radius:12px;background:#f4faf6;border:1px solid #e2eee5;min-width:0}.geo-stats strong{display:block;margin-top:7px;font-size:13px;color:#1d4a35;overflow-wrap:anywhere}.empty-map{min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;background:#f6faf7;border:1px dashed #d2e7d8;border-radius:14px;padding:25px}.empty-map>ion-icon{font-size:30px;color:#0c9a70}.empty-map strong{color:#234f38;font-size:15px}.empty-map p{font-size:12px;color:#829b8b;line-height:1.6;margin:0}.empty-map button{border:0;border-radius:10px;background:#0b8761;color:white;font-size:11px;font-weight:850;padding:11px 15px}.map-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:16px}.map-bottom>span{display:flex;align-items:center;gap:7px;color:#849b8b;font-size:11px}.connection-note{display:flex;align-items:center;gap:8px;margin-top:22px;color:#567c66;font-size:11px}.connection-note ion-icon{font-size:17px}.metric-grid .metric{min-width:0}.overview-panel{min-width:0}
@media(max-width:760px){.map-top{flex-wrap:wrap}.geo-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.geo-stats>div:last-child{grid-column:1/-1}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metric .status-value{font-size:17px}.metric .time-value{font-size:18px}}
@media(max-width:440px){.welcome h1{font-size:29px}.hero-visual{min-height:235px}.metric{padding:15px 12px}.metric small{font-size:10px}.metric .status-value{font-size:15px}.metric .time-value{font-size:16px}.metric strong{font-size:28px}.company-block{padding:12px}.schedule-grid{gap:8px}.schedule-grid>div{padding:11px}.geo-stats strong{font-size:11px}.panel{padding:17px}.pulse-body{flex-direction:column;align-items:stretch}.pulse-legend{width:100%}.map-bottom .text-cta{width:100%;justify-content:center}}
</style>
