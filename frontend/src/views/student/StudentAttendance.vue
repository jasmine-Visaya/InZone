<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon, IonButton } from '@ionic/vue';
import {
  locationOutline,
  arrowBackOutline,
  logOutOutline,
  timeOutline,
  cameraOutline,
  imagesOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  refreshOutline,
  calendarOutline,
  navigateOutline,
  cloudUploadOutline,
  closeOutline,
  timerOutline,
  documentTextOutline,
  eyeOutline,
} from 'ionicons/icons';

type AttendanceRecord = {
  id: number;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  time_in_status?: string | null;
  time_out_status?: string | null;
  hours_worked?: number;
  seconds_worked?: number;
};
type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};
type ApiResult = {
  success?: boolean;
  message?: string;
  attendance?: AttendanceRecord[] | AttendanceRecord;
  count?: number;
  total_hours?: number;
  hours_worked?: { display?: string };
  geofence_check?: { distance_meters?: number; allowed_radius_meters?: number };
  photo_url?: string;
};

const router = useRouter();
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Confirm backend/middleware/uploadMiddleware.js uses upload.single('photo').
// If it uses a different name, change ONLY this value.
const PHOTO_FIELD = 'photo';

const loading = ref(true);
const submitting = ref<'time-in' | 'time-out' | null>(null);
const locating = ref(false);
const fetchingProof = ref<number | null>(null);
const attendance = ref<AttendanceRecord[]>([]);
const totalHours = ref<number | null>(null);
const loadError = ref('');
const error = ref('');
const success = ref('');
const locationMessage = ref('');
const currentLocation = ref<CurrentLocation | null>(null);
const studentName = ref('Student');
const photoFile = ref<File | null>(null);
const photoPreview = ref('');
const cameraInput = ref<HTMLInputElement | null>(null);
const galleryInput = ref<HTMLInputElement | null>(null);
const showAll = ref(false);
const proofUrl = ref('');
const proofAttendanceId = ref<number | null>(null);

function philippineDay(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const today = ref(philippineDay());
const todayRecord = computed(() =>
  attendance.value.find((record) => record.attendance_date?.slice(0, 10) === today.value) || null,
);
const timedIn = computed(() => Boolean(todayRecord.value?.time_in));
const timedOut = computed(() => Boolean(todayRecord.value?.time_out));
const recentHistory = computed(() => showAll.value ? attendance.value : attendance.value.slice(0, 5));

function token(): string | null {
  return sessionStorage.getItem('inzone_token');
}
function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  void router.replace('/');
}
function readableDate(value: string): string {
  if (!value) return '—';
  const day = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(day.getTime()) ? value :
    new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }).format(day);
}
function readableTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' :
    new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}
function hoursLabel(value: number | undefined): string {
  const hours = Number(value);
  return Number.isFinite(hours) ? `${hours.toFixed(2)} hrs` : '—';
}

async function parseResponse(response: Response): Promise<ApiResult> {
  const data = await response.json().catch(() => ({})) as ApiResult;
  if (response.status === 401) {
    logout();
    throw new Error('Your login session expired. Please sign in again.');
  }
  if (!response.ok || !data.success) {
    const extra = response.status === 403 && data.geofence_check?.distance_meters != null
      ? ` You are ${Math.round(data.geofence_check.distance_meters)}m from the assigned location.`
      : '';
    throw new Error(`${data.message || `Request failed (HTTP ${response.status}).`}${extra}`);
  }
  return data;
}

async function loadHistory() {
  const jwt = token();
  if (!jwt) { logout(); return; }
  loading.value = true;
  loadError.value = '';
  today.value = philippineDay();
  try {
    const response = await fetch(`${API_BASE}/api/attendance/my-history`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = await parseResponse(response);
    attendance.value = Array.isArray(data.attendance) ? data.attendance : [];
    totalHours.value = typeof data.total_hours === 'number' ? data.total_hours : null;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Unable to load attendance.';
  } finally {
    loading.value = false;
  }
}

function getLocation(): Promise<CurrentLocation> {
  error.value = '';
  locationMessage.value = '';
  if (!navigator.geolocation) {
    return Promise.reject(new Error('GPS is unavailable in this browser. Use HTTPS or localhost and enable location permissions.'));
  }
  locating.value = true;
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result: CurrentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        currentLocation.value = result;
        locationMessage.value = 'Current GPS location received. The backend will verify your OJT geofence when you submit.';
        locating.value = false;
        resolve(result);
      },
      (geoError) => {
        locating.value = false;
        const msg = geoError.code === 1
          ? 'Location permission denied. Allow location access in your browser settings.'
          : geoError.code === 2
            ? 'Location unavailable. Turn on device GPS and try again.'
            : 'GPS request timed out. Try moving to an area with better GPS signal.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
async function refreshGPS() {
  try { await getLocation(); }
  catch (e) { error.value = e instanceof Error ? e.message : 'Could not get your location.'; }
}

function clearPhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photoPreview.value = '';
  photoFile.value = null;
  if (cameraInput.value) cameraInput.value.value = '';
  if (galleryInput.value) galleryInput.value.value = '';
}
function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = 'Please choose a JPEG, PNG, or WEBP image.';
    input.value = '';
    return;
  }
  clearPhoto();
  photoFile.value = file;
  photoPreview.value = URL.createObjectURL(file);
}

async function submitAttendance(action: 'time-in' | 'time-out') {
  if (submitting.value || loading.value) return;
  error.value = '';
  success.value = '';
  if (action === 'time-in' && !photoFile.value) {
    error.value = 'Take or upload your photo proof first.';
    return;
  }
  if (action === 'time-in' && timedIn.value) {
    error.value = 'You already timed in today.';
    return;
  }
  if (action === 'time-out' && (!timedIn.value || timedOut.value)) {
    error.value = !timedIn.value ? 'Time in first before attempting time out.' : 'You already timed out today.';
    return;
  }
  const jwt = token();
  if (!jwt) { logout(); return; }
  submitting.value = action;
  try {
    // New, high-accuracy location for EVERY attendance submission.
    const coords = await getLocation();
    let response: Response;
    if (action === 'time-in') {
      const body = new FormData();
      body.append('latitude', String(coords.latitude));
      body.append('longitude', String(coords.longitude));
      body.append(PHOTO_FIELD, photoFile.value!);
      response = await fetch(`${API_BASE}/api/attendance/time-in`, {
        method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body,
      });
    } else {
      response = await fetch(`${API_BASE}/api/attendance/time-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
      });
    }
    const data = await parseResponse(response);
    const resultText = action === 'time-out' && data.hours_worked?.display
      ? ` Hours worked: ${data.hours_worked.display}.` : '';
    success.value = `${data.message || 'Attendance recorded successfully.'}${resultText}`;
    if (action === 'time-in') clearPhoto();
    await loadHistory();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Attendance submission failed.';
    // Keep user photo on failed time-in so it can be retried.
    if (/already timed in|already timed out/i.test(error.value)) await loadHistory();
  } finally {
    submitting.value = null;
  }
}

async function viewPhotoProof(recordId: number) {
  const jwt = token();
  if (!jwt) { logout(); return; }
  error.value = '';
  fetchingProof.value = recordId;
  try {
    const response = await fetch(`${API_BASE}/api/attendance/photo-proof/${recordId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = await parseResponse(response);
    if (!data.photo_url) throw new Error('The server did not return a photo link.');
    proofUrl.value = data.photo_url;
    proofAttendanceId.value = recordId;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to open photo proof.';
  } finally {
    fetchingProof.value = null;
  }
}

onMounted(() => {
  try {
    const raw = sessionStorage.getItem('inzone_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!token() || String(user?.role || '').toUpperCase() !== 'STUDENT') { logout(); return; }
    studentName.value = user?.first_name || 'Student';
  } catch { logout(); return; }
  void loadHistory();
});
onBeforeUnmount(clearPhoto);
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="attendance-content">
      <div class="shell">
        <header class="topbar">
          <button type="button" class="brand" @click="router.push('/student/dashboard')">
            <span class="logo"><IonIcon :icon="locationOutline" /></span>
            <strong>InZone<span>.</span></strong><small>Student Portal</small>
          </button>
          <button class="logout" type="button" @click="logout"><IonIcon :icon="logOutOutline" /> Log out</button>
        </header>

        <main class="content">
          <button class="back" type="button" @click="router.push('/student/dashboard')"><IonIcon :icon="arrowBackOutline" /> Back to Dashboard</button>
          <div class="title-row">
            <div>
              <p class="eyebrow"><IonIcon :icon="shieldCheckmarkOutline" /> STUDENT ATTENDANCE</p>
              <h1>Time-in & Time-out<span>.</span></h1>
              <p class="subtitle">Hi {{ studentName }}! Record your OJT attendance with live GPS verification.</p>
            </div>
            <button type="button" class="refresh-btn" @click="loadHistory" :disabled="loading || !!submitting">
              <IonIcon :icon="refreshOutline" /> Refresh
            </button>
          </div>

          <section class="hero">
            <div class="hero-main">
              <span class="hero-pill"><IonIcon :icon="calendarOutline" /> {{ readableDate(today) }}</span>
              <h2>Make every OJT hour count.</h2>
              <p>Check in from your approved company location, upload photo proof, and record your workday accurately.</p>
            </div>
            <div class="hero-graphic" aria-hidden="true"><div class="orb orb1"></div><div class="orb orb2"></div><IonIcon :icon="navigateOutline" /></div>
          </section>

          <div v-if="error" class="notice notice-error" role="alert"><IonIcon :icon="alertCircleOutline" /><span>{{ error }}</span></div>
          <div v-if="success" class="notice notice-success" role="status"><IonIcon :icon="checkmarkCircleOutline" /><span>{{ success }}</span></div>
          <div v-if="loadError" class="notice notice-error" role="alert"><IonIcon :icon="alertCircleOutline" /><span>{{ loadError }} <button type="button" @click="loadHistory">Try again</button></span></div>

          <section class="summary-grid" aria-label="Attendance summary">
            <div class="stat-card"><span class="stat-icon"><IonIcon :icon="timeOutline" /></span><p>Today's status</p><strong>{{ loading ? 'Loading...' : loadError ? 'Unavailable' : !timedIn ? 'Not timed in' : timedOut ? 'Completed' : 'Timed in' }}</strong><small>Philippine local date</small></div>
            <div class="stat-card"><span class="stat-icon blue"><IonIcon :icon="timerOutline" /></span><p>Time in</p><strong>{{ readableTime(todayRecord?.time_in ?? null) }}</strong><small>Today</small></div>
            <div class="stat-card"><span class="stat-icon amber"><IonIcon :icon="timeOutline" /></span><p>Time out</p><strong>{{ readableTime(todayRecord?.time_out ?? null) }}</strong><small>Today</small></div>
            <div class="stat-card"><span class="stat-icon purple"><IonIcon :icon="documentTextOutline" /></span><p>Total OJT hours</p><strong>{{ totalHours === null ? '—' : `${totalHours.toFixed(2)} hrs` }}</strong><small>From recorded attendance</small></div>
          </section>

          <div class="work-grid">
            <section class="panel gps-panel">
              <div class="panel-heading"><span class="panel-icon"><IonIcon :icon="locationOutline" /></span><div><h3>GPS Location</h3><p>Used to verify your assigned OJT geofence.</p></div></div>
              <div class="location-box">
                <template v-if="currentLocation">
                  <div class="location-pill"><IonIcon :icon="checkmarkCircleOutline" /> GPS acquired — geofence not yet verified</div>
                  <div class="coordinate-grid"><div><small>Latitude</small><strong>{{ currentLocation.latitude.toFixed(6) }}</strong></div><div><small>Longitude</small><strong>{{ currentLocation.longitude.toFixed(6) }}</strong></div></div>
                  <p>GPS accuracy: ±{{ Math.round(currentLocation.accuracy) }} meters</p>
                </template>
                <template v-else><IonIcon :icon="navigateOutline" class="placeholder-icon" /><strong>Location not requested</strong><p>Allow browser location access to get your coordinates.</p></template>
              </div>
              <button class="outline-btn" type="button" :disabled="locating || !!submitting" @click="refreshGPS"><IonIcon :icon="navigateOutline" /> {{ locating ? 'Getting GPS...' : 'Get current location' }}</button>
              <p v-if="locationMessage" class="help-text">{{ locationMessage }}</p>
              <p class="help-text">A fresh GPS location is automatically requested again when submitting time-in or time-out. Your backend decides whether you are inside the geofence.</p>
            </section>

            <section class="panel photo-panel">
              <div class="panel-heading"><span class="panel-icon"><IonIcon :icon="cameraOutline" /></span><div><h3>Time-in Photo Proof</h3><p>Required only when you time in.</p></div></div>
              <div class="upload-box">
                <img v-if="photoPreview" :src="photoPreview" alt="Selected attendance photo preview" class="photo-preview" />
                <template v-else><IonIcon :icon="cloudUploadOutline" /><strong>Add your photo proof</strong><p>JPEG, PNG, or WEBP only</p></template>
              </div>
              <div class="photo-actions">
                <button type="button" class="outline-btn" @click="cameraInput?.click()" :disabled="!!submitting || timedIn"><IonIcon :icon="cameraOutline" /> Take photo</button>
                <button type="button" class="outline-btn" @click="galleryInput?.click()" :disabled="!!submitting || timedIn"><IonIcon :icon="imagesOutline" /> Upload photo</button>
                <button v-if="photoFile" type="button" class="remove-btn" @click="clearPhoto"><IonIcon :icon="closeOutline" /> Remove</button>
              </div>
              <input ref="cameraInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" @change="selectPhoto" />
              <input ref="galleryInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="selectPhoto" />
              <p v-if="photoFile" class="selected-file">Selected: {{ photoFile.name }}</p>
              <p class="help-text">Your image is uploaded securely through the attendance backend. No photo is needed for time-out.</p>
            </section>
          </div>

          <section class="panel action-panel">
            <div class="action-info"><h3>Record today's attendance</h3><p>{{ timedOut ? 'Attendance completed for today.' : timedIn ? 'You have already timed in. Time out when your workday ends.' : 'Ready for your OJT day? Select your photo and time in.' }}</p></div>
            <div class="action-buttons">
              <IonButton class="time-in-btn" :disabled="loading || !!submitting || timedIn || !!loadError" @click="submitAttendance('time-in')"><IonIcon slot="start" :icon="checkmarkCircleOutline" />{{ submitting === 'time-in' ? 'Recording time-in...' : 'Time in' }}</IonButton>
              <IonButton class="time-out-btn" :disabled="loading || !!submitting || !timedIn || timedOut || !!loadError" @click="submitAttendance('time-out')"><IonIcon slot="start" :icon="timeOutline" />{{ submitting === 'time-out' ? 'Recording time-out...' : 'Time out' }}</IonButton>
            </div>
          </section>

          <section class="panel history-panel">
            <div class="history-title"><div><h3>Attendance History</h3><p>Real records from your InZone backend.</p></div><button class="text-btn" type="button" @click="loadHistory" :disabled="loading"><IonIcon :icon="refreshOutline" /> Refresh</button></div>
            <p v-if="loading" class="empty">Loading attendance...</p>
            <p v-else-if="!attendance.length && !loadError" class="empty">No attendance records yet. Your first successful time-in will appear here.</p>
            <div v-else class="history-list">
              <article v-for="record in recentHistory" :key="record.id" class="history-record">
                <div class="record-date"><IonIcon :icon="calendarOutline" /><div><strong>{{ readableDate(record.attendance_date) }}</strong><small>{{ record.time_out ? 'Completed' : 'Timed in' }}</small></div></div>
                <div class="record-times"><span><small>Time in</small><strong>{{ readableTime(record.time_in) }}</strong></span><span><small>Time out</small><strong>{{ readableTime(record.time_out) }}</strong></span><span><small>Hours worked</small><strong>{{ record.time_out ? hoursLabel(record.hours_worked) : '—' }}</strong></span></div>
                <button type="button" class="proof-btn" @click="viewPhotoProof(record.id)" :disabled="fetchingProof === record.id"><IonIcon :icon="eyeOutline" /> {{ fetchingProof === record.id ? 'Loading...' : 'Photo proof' }}</button>
              </article>
              <button v-if="attendance.length > 5" type="button" class="show-btn" @click="showAll = !showAll">{{ showAll ? 'Show less' : `Show all ${attendance.length} records` }}</button>
            </div>
            <div v-if="proofUrl" class="proof-banner"><span>Photo proof link ready (expires after 5 minutes).</span><a :href="proofUrl" target="_blank" rel="noopener noreferrer">Open photo proof</a><button type="button" @click="proofUrl=''; proofAttendanceId=null">Close</button></div>
          </section>
        </main>
        <footer class="footer">InZone © 2026 · OJT Attendance & Monitoring System</footer>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.attendance-content{--background:#f1f8f4;--color:#173e33}
.shell{min-height:100%;background:radial-gradient(circle at 92% 0%,#dceee5,transparent 39%),#f1f8f4}
.topbar{background:#fff;border-bottom:1px solid #dcebe2;padding:17px clamp(18px,4vw,58px);display:flex;align-items:center;justify-content:space-between;gap:14px}
.brand{display:flex;align-items:center;gap:10px;background:none;color:#164e3c;cursor:pointer}
.logo{background:#0c795b;color:white;width:42px;height:42px;display:grid;place-items:center;font-size:23px;border-radius:13px}
.brand strong{font-size:23px;letter-spacing:-.7px}.brand strong span{color:#20b580}.brand small{margin-left:8px;padding-left:16px;border-left:1px solid #dce9e0;color:#799286;font-size:12px;font-weight:700}
.logout{display:flex;align-items:center;gap:8px;background:#ecf7f0;color:#087452;border-radius:10px;padding:12px 14px;cursor:pointer;font-size:13px;font-weight:750}
.content{max-width:1220px;margin:0 auto;padding:29px clamp(16px,4vw,45px) 55px}
.back{display:flex;gap:8px;align-items:center;background:none;padding:0;color:#087d5a;cursor:pointer;font-weight:750;font-size:13px}.back:hover{text-decoration:underline}
.title-row{display:flex;justify-content:space-between;align-items:center;gap:15px;margin:23px 0 24px}.eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:850;letter-spacing:1.5px;color:#0a9269;margin:0 0 10px}
h1{font-size:clamp(28px,3.6vw,43px);color:#123c2d;letter-spacing:-1.3px;margin:0;font-weight:850}h1 span{color:#14a878}.subtitle{color:#6e897c;font-size:14px;margin:9px 0 0;line-height:1.6}
.refresh-btn{display:flex;align-items:center;gap:7px;border-radius:10px;border:1px solid #cfe6d9;background:#fff;color:#087854;padding:11px 14px;cursor:pointer;font-weight:750;white-space:nowrap}
.hero{display:flex;align-items:center;justify-content:space-between;position:relative;overflow:hidden;background:linear-gradient(112deg,#097a5b,#074d3c 70%,#063c34);color:white;border-radius:23px;min-height:190px;padding:34px clamp(25px,4vw,43px);box-shadow:0 16px 35px #175c4420}
.hero-main{position:relative;z-index:1;max-width:580px}.hero-pill{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #ffffff40;border-radius:50px;color:#c1ffdd;font-size:11px}.hero h2{font-size:clamp(25px,3.5vw,38px);margin:17px 0 8px;line-height:1.1}.hero p{font-size:14px;line-height:1.6;color:#d2eadd;margin:0}
.hero-graphic{position:absolute;right:80px;top:42px;width:135px;height:135px;display:grid;place-items:center;color:#9df9c9;font-size:51px}.orb{position:absolute;border:1px dashed #b4edce88;border-radius:50%}.orb1{width:170px;height:170px}.orb2{width:115px;height:115px}
.notice{margin:18px 0 0;border-radius:12px;padding:14px 17px;display:flex;align-items:flex-start;gap:10px;line-height:1.5;font-size:13px}.notice ion-icon{font-size:22px;flex-shrink:0}.notice-error{background:#fff0ed;color:#a53c31}.notice-success{background:#e2f7e9;color:#076b48}.notice button{background:transparent;color:inherit;text-decoration:underline;cursor:pointer}
.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-top:22px}.stat-card,.panel{background:#fff;border:1px solid #dcebe2;border-radius:19px;box-shadow:0 8px 25px #164f3510}.stat-card{min-height:165px;padding:20px}.stat-icon{width:43px;height:43px;display:grid;place-items:center;border-radius:13px;background:#e3f8eb;color:#087e5b;font-size:23px}.stat-icon.blue{background:#e6f2fd;color:#2b76a9}.stat-icon.amber{background:#fff3dd;color:#aa781c}.stat-icon.purple{background:#f3edfe;color:#6e55ae}.stat-card p{font-size:12px;font-weight:750;color:#6a8a78;margin:15px 0 8px}.stat-card strong{font-size:clamp(16px,1.9vw,23px);color:#173b2f;line-height:1.3;display:block}.stat-card small{color:#90a497;display:block;margin-top:6px;font-size:11px}
.work-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}.panel{padding:clamp(20px,3vw,29px)}.panel-heading{display:flex;gap:14px;align-items:center;margin-bottom:22px}.panel-heading h3,.action-info h3,.history-title h3{color:#1b4435;margin:0 0 6px;font-size:18px}.panel-heading p,.action-info p,.history-title p{color:#809588;margin:0;line-height:1.5;font-size:12px}.panel-icon{height:46px;width:46px;display:grid;place-items:center;background:#e7f8ee;color:#0b8564;border-radius:14px;font-size:24px}
.location-box,.upload-box{min-height:190px;border:1px dashed #b5dcca;border-radius:16px;background:#f9fdfa;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;color:#2f5b49}.location-box p,.upload-box p{color:#8aa293;font-size:12px;margin:0}.placeholder-icon,.upload-box>ion-icon{font-size:35px;color:#0c986c}.location-box strong,.upload-box strong{font-size:14px}.location-pill{display:flex;align-items:center;gap:5px;font-size:11px;color:#077653;font-weight:700}.coordinate-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%}.coordinate-grid>div{background:white;border-radius:10px;padding:13px;min-width:0}.coordinate-grid small{display:block;color:#789586;font-size:11px}.coordinate-grid strong{display:block;overflow-wrap:anywhere;margin-top:5px;font-size:14px}
.outline-btn{border:1px solid #badccc;background:#f6fcf8;color:#0b7757;border-radius:11px;display:inline-flex;justify-content:center;align-items:center;gap:8px;padding:12px 14px;font-weight:800;font-size:12px;cursor:pointer}.gps-panel>.outline-btn{margin-top:17px}.help-text{font-size:11px;color:#829989;line-height:1.65;margin:12px 0 0}.photo-preview{width:100%;max-height:220px;object-fit:contain;border-radius:12px}.photo-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.file-input{display:none}.remove-btn{background:#fff0ed;color:#a23f34;border-radius:10px;cursor:pointer;padding:11px;font-weight:700;font-size:12px}.selected-file{font-size:11px;color:#0b7957;overflow-wrap:anywhere}
.action-panel{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px}.action-buttons{display:flex;gap:12px;flex-wrap:wrap}.time-in-btn,.time-out-btn{--border-radius:12px;--box-shadow:none;text-transform:none;font-size:13px;font-weight:800;min-height:49px}.time-in-btn{--background:#0a805e}.time-out-btn{--background:#315c76}
.history-panel{margin-top:19px}.history-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:15px}.text-btn{background:transparent;color:#098362;display:flex;align-items:center;gap:7px;font-weight:750;cursor:pointer}.empty{color:#829688;padding:23px 8px;text-align:center;font-size:13px}.history-list{display:flex;flex-direction:column;gap:11px}.history-record{display:flex;justify-content:space-between;align-items:center;gap:17px;background:#f9fcfa;border:1px solid #e4eee6;border-radius:13px;padding:16px;flex-wrap:wrap}.record-date{display:flex;gap:10px;align-items:center;min-width:170px}.record-date ion-icon{font-size:21px;color:#0b8462}.record-date strong,.record-date small{display:block}.record-date strong{font-size:13px}.record-date small{font-size:11px;color:#81998a;margin-top:4px}.record-times{display:flex;gap:24px;flex-wrap:wrap}.record-times small,.record-times strong{display:block}.record-times small{font-size:10px;color:#8da497;margin-bottom:5px}.record-times strong{font-size:12px;color:#29503f}.proof-btn{display:flex;gap:6px;align-items:center;color:#086e52;background:#e6f4eb;border-radius:9px;padding:10px 12px;cursor:pointer;font-weight:700;font-size:11px}.show-btn{align-self:center;border:0;background:transparent;color:#0b8964;font-weight:750;padding:12px;cursor:pointer}.proof-banner{margin-top:15px;background:#ecf7ee;border-radius:12px;padding:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px}.proof-banner a{color:#006b53;font-weight:800}.proof-banner button{color:#8c3d2b;background:transparent;cursor:pointer;font-weight:700}
.footer{border-top:1px solid #deebe1;color:#9baea0;padding:20px;text-align:center;font-size:11px}
button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1030px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.work-grid{grid-template-columns:1fr}.hero-graphic{right:-20px;opacity:.35}}
@media(max-width:680px){.topbar{padding:14px 16px}.brand small{display:none}.content{padding:25px 15px 40px}.title-row{align-items:flex-start;flex-direction:column}.hero{padding:26px;min-height:185px}.summary-grid{gap:10px}.stat-card{padding:16px;min-height:150px}.stat-card strong{font-size:16px}.action-panel{flex-direction:column;align-items:stretch}.action-buttons{flex-direction:column}.record-times{gap:14px}.history-record{align-items:flex-start}.history-title{align-items:flex-start}.proof-btn{width:100%;justify-content:center}}
@media(max-width:390px){.summary-grid{grid-template-columns:1fr}.coordinate-grid{grid-template-columns:1fr}}
</style>
