<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import {
  locationOutline,
  gridOutline,
  calendarOutline,
  timeOutline,
  businessOutline,
  documentTextOutline,
  logOutOutline,
  personCircleOutline,
  informationCircleOutline,
  navigateOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
} from 'ionicons/icons';

const router = useRouter();
const firstName = ref('Student');
const backendStatus = ref<'checking' | 'online' | 'offline'>('checking');
const requiredHours = ref<number | null>(null);
const attendanceStatus = ref('—');
const attendanceDetail = ref('Loading attendance...');
const totalOjtHours = ref<number | null>(null);

function getPhilippineDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
async function refreshAttendance() {
  const jwt = sessionStorage.getItem('inzone_token');
  if (!jwt) return;
  try {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const response = await fetch(`${base}/api/attendance/my-history`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) throw new Error('Failed to load attendance');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.attendance)) throw new Error('Attendance data unavailable');
    totalOjtHours.value = Number(data.total_hours) || 0;
    const record = data.attendance.find((item: { attendance_date?: string }) =>
      item.attendance_date?.slice(0, 10) === getPhilippineDate());
    attendanceStatus.value = !record ? 'Not timed in' : record.time_out ? 'Completed' : 'Timed in';
    attendanceDetail.value = !record ? 'No attendance yet today' : record.time_out ? 'Time-in and time-out recorded' : 'Waiting for time-out';
  } catch {
    attendanceStatus.value = '—';
    attendanceDetail.value = 'Attendance could not be loaded';
    totalOjtHours.value = null;
  }
}
onIonViewWillEnter(() => { void refreshAttendance(); });

const today = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date());

onMounted(async () => {
  // Prototype-only route check. Backend authorization must still protect APIs.
  const token = sessionStorage.getItem('inzone_token');
  if (!token) {
    await router.replace('/');
    return;
  }

  try {
    const rawUser = sessionStorage.getItem('inzone_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (String(user?.role || '').toUpperCase() !== 'STUDENT') {
        signOut();
        return;
      }
      firstName.value = typeof user?.first_name === 'string' && user.first_name.trim()
        ? user.first_name.trim()
        : 'Student';
    }
  } catch {
    firstName.value = 'Student';
  }

  try {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const response = await fetch(`${base}/api/health`);
    backendStatus.value = response.ok ? 'online' : 'offline';
  } catch {
    backendStatus.value = 'offline';
  }

  // Load real required hours; all other summary metrics stay empty until their APIs are connected.
  try {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const response = await fetch(`${base}/api/ojt/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      const hours = Number(data.profile?.required_hours);
      if (data.success && Number.isFinite(hours) && hours > 0) requiredHours.value = hours;
    }
  } catch {
    // The page stays usable when the profile has not been created yet.
  }
});

function openAttendance() {
  void router.push('/student/attendance');
}

function openProfile() {
  void router.push('/student/profile');
}

function signOut() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  void router.replace('/');
}
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="dashboard-content">
      <div class="dashboard-shell">
        <header class="topbar">
          <div class="brand">
            <span class="brand-icon"><IonIcon :icon="locationOutline" /></span>
            <span class="brand-title">InZone<span>.</span></span>
            <span class="brand-divider"></span>
            <span class="brand-subtitle">Student Portal</span>
          </div>
          <div class="top-actions">
            <span class="student-label"><IonIcon :icon="personCircleOutline" /> Student account</span>
            <button class="logout-button" type="button" @click="signOut">
              <IonIcon :icon="logOutOutline" /> <span>Log out</span>
            </button>
          </div>
        </header>

        <main class="main-content">
          <div class="section-eyebrow"><IonIcon :icon="gridOutline" /> STUDENT WORKSPACE</div>
          <section class="welcome-panel">
            <div class="welcome-copy">
              <div class="date-text"><IonIcon :icon="calendarOutline" /> {{ today }}</div>
              <h1>Welcome back, <span>{{ firstName }}!</span></h1>
              <p>Manage your OJT attendance, required hours, and weekly accomplishments in one place.</p>
              <div class="welcome-note"><IonIcon :icon="shieldCheckmarkOutline" /> Attendance and total OJT hours are pulled from the InZone backend.</div>
            </div>
            <div class="welcome-illustration" aria-hidden="true">
              <div class="orbit orbit-outer"></div><div class="orbit orbit-inner"></div>
              <div class="location-core"><IonIcon :icon="navigateOutline" /></div>
              <span class="orbit-ping ping-one"></span><span class="orbit-ping ping-two"></span>
            </div>
          </section>

          <div class="section-heading">
            <div><h2>OJT Overview</h2><p>Your internship activity at a glance</p></div>
            <span class="demo-label"><IonIcon :icon="informationCircleOutline" /> Attendance API connected</span>
          </div>

          <section class="stat-grid" aria-label="OJT overview">
            <article class="stat-card"><span class="stat-icon teal"><IonIcon :icon="calendarOutline" /></span><p>Today's attendance</p><strong>{{ attendanceStatus }}</strong><small>{{ attendanceDetail }}</small></article>
            <article class="stat-card"><span class="stat-icon blue"><IonIcon :icon="timeOutline" /></span><p>Total OJT hours</p><strong>{{ totalOjtHours === null ? '—' : totalOjtHours.toFixed(2) }}</strong><small>Hours from attendance history</small></article>
            <article class="stat-card"><span class="stat-icon amber"><IonIcon :icon="businessOutline" /></span><p>Required hours</p><strong>{{ requiredHours === null ? '—' : requiredHours }}</strong><small>{{ requiredHours === null ? 'From your OJT profile' : 'Hours from your OJT profile' }}</small></article>
            <article class="stat-card"><span class="stat-icon violet"><IonIcon :icon="documentTextOutline" /></span><p>Weekly reports</p><strong>—</strong><small>Not loaded yet</small></article>
          </section>

          <div class="section-heading next-heading"><div><h2>Student Features</h2><p>Manage your OJT profile and attendance</p></div></div>
          <section class="feature-grid" aria-label="Upcoming student pages">
            <button class="feature-card feature-link" type="button" @click="openProfile"><span class="feature-icon"><IonIcon :icon="businessOutline" /></span><h3>OJT Profile</h3><p>Company name, address, target hours, and training dates.</p><span class="feature-stage">OPEN PROFILE →</span></button>
            <button class="feature-card feature-link" type="button" @click="openAttendance"><span class="feature-icon"><IonIcon :icon="locationOutline" /></span><h3>Time-in & Time-out</h3><p>GPS validation, photo proof, and hours worked.</p><span class="feature-stage">OPEN ATTENDANCE →</span></button>
            <button class="feature-card feature-link" type="button" @click="openAttendance"><span class="feature-icon"><IonIcon :icon="calendarOutline" /></span><h3>Attendance History</h3><p>Review attendance dates, time-in, time-out, and hours.</p><span class="feature-stage">VIEW HISTORY →</span></button>
            <article class="feature-card"><span class="feature-icon"><IonIcon :icon="documentTextOutline" /></span><h3>Weekly Reports</h3><p>Submit accomplishments and track report status.</p><span class="feature-stage">UPCOMING</span></article>
          </section>

          <div class="connection-note" role="status">
            <IonIcon :icon="backendStatus === 'online' ? checkmarkCircleOutline : backendStatus === 'offline' ? cloudOfflineOutline : informationCircleOutline" />
            <span>{{ backendStatus === 'online' ? 'Backend server is reachable.' : backendStatus === 'offline' ? 'Backend server cannot be reached. Check npm run dev.' : 'Checking backend connection...' }}</span>
            <small>This does not verify attendance data.</small>
          </div>
        </main>
        <footer class="page-footer">InZone © 2026 · OJT Attendance & Monitoring</footer>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.dashboard-content { --background: #f2f8f5; --color: #163c33; }
.dashboard-shell { min-height: 100%; background: radial-gradient(circle at 95% 0%, #ddf1e8, transparent 40%), #f2f8f5; }
.topbar { min-height: 86px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px clamp(20px, 4vw, 64px); background: #fff; border-bottom: 1px solid #e0ece6; }
.brand, .top-actions { display: flex; align-items: center; gap: 12px; }
.brand-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px; background: #0b775b; color: white; font-size: 24px; }
.brand-title { font-size: 23px; font-weight: 850; letter-spacing: -.8px; color: #124d3c; }
.brand-title span { color: #17ab7b; }
.brand-divider { height: 24px; width: 1px; background: #dce8e2; }
.brand-subtitle { font-size: 13px; font-weight: 700; color: #728c80; }
.student-label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #607e70; }
.student-label ion-icon { font-size: 21px; }
.logout-button { display: flex; align-items: center; gap: 7px; padding: 11px 14px; border-radius: 11px; background: #edf5f0; color: #0b775b; font-size: 13px; font-weight: 750; cursor: pointer; }
.logout-button:hover { background: #dcefe5; }
.main-content { max-width: 1260px; margin: 0 auto; padding: 36px clamp(18px, 4vw, 48px) 44px; }
.section-eyebrow { color: #0a8663; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 850; letter-spacing: 1.4px; margin-bottom: 17px; }
.section-eyebrow ion-icon { font-size: 16px; }
.welcome-panel { display: flex; min-height: 260px; position: relative; overflow: hidden; border-radius: 26px; padding: clamp(25px, 4vw, 45px); background: linear-gradient(115deg, #0b775b, #064938 70%, #073a34); color: #fff; box-shadow: 0 18px 45px #0d594026; }
.welcome-copy { position: relative; z-index: 1; max-width: 690px; }
.date-text { display: flex; align-items: center; gap: 7px; color: #b6eed5; font-size: 12px; font-weight: 650; }
.welcome-panel h1 { margin: 16px 0 10px; font-size: clamp(29px, 4vw, 46px); line-height: 1.12; font-weight: 850; letter-spacing: -1.5px; }
.welcome-panel h1 span { color: #91f2c0; }
.welcome-panel p { max-width: 590px; margin: 0; color: #d9f0e6; line-height: 1.7; font-size: 15px; }
.welcome-note { display: inline-flex; gap: 8px; align-items: center; margin-top: 22px; color: #d4eee1; font-size: 12px; }
.welcome-illustration { position: absolute; width: 290px; height: 290px; right: 36px; top: -10px; opacity: .75; }
.orbit { position: absolute; border: 1px dashed #b8f2d566; border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.orbit-outer { width: 260px; height: 260px; } .orbit-inner { width: 180px; height: 180px; }
.location-core { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ceffe1; color: #08765a; width: 80px; height: 80px; display: grid; place-items: center; border-radius: 24px; font-size: 38px; box-shadow: 0 0 0 15px #ffffff18; }
.orbit-ping { position: absolute; background: #7ff4b6; height: 10px; width: 10px; border-radius: 50%; box-shadow: 0 0 0 6px #80e6b039; }
.ping-one { top: 32px; left: 89px; } .ping-two { right: 32px; bottom: 56px; }
.section-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 36px 0 19px; }
.section-heading h2 { margin: 0; color: #173f33; font-size: 22px; font-weight: 820; letter-spacing: -.5px; }
.section-heading p { margin: 6px 0 0; color: #80958a; font-size: 13px; }
.demo-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #8b6b2f; background: #fff6e3; border: 1px solid #f4e4bd; padding: 9px 11px; border-radius: 999px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
.stat-card, .feature-card { background: #fff; border: 1px solid #e0ede6; border-radius: 20px; box-shadow: 0 8px 30px #14563d09; }
.stat-card { padding: 21px; min-height: 185px; }
.stat-icon { width: 43px; height: 43px; border-radius: 13px; display: grid; place-items: center; font-size: 22px; }
.stat-icon.teal { color: #078665; background: #e5f8ee; } .stat-icon.blue { color: #2876ae; background: #eaf4fe; } .stat-icon.amber { color: #b47b1d; background: #fff4df; } .stat-icon.violet { color: #7754b2; background: #f2ecff; }
.stat-card p { margin: 19px 0 8px; font-size: 13px; color: #5f7c6e; font-weight: 700; }
.stat-card strong { display: block; line-height: 1; font-size: 31px; color: #123e32; }
.stat-card small { display: block; margin-top: 9px; color: #94a69b; font-size: 11px; }
.next-heading { margin-top: 40px; }
.feature-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
.feature-card { padding: 23px 20px; }
.feature-link { cursor: pointer; text-align: left; width: 100%; font: inherit; color: inherit; transition: transform .2s, border-color .2s; }
.feature-link:hover { transform: translateY(-3px); border-color: #6ccba3; }
.feature-link:focus-visible { outline: 3px solid #15966f; outline-offset: 3px; }
.feature-icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #e6f6ed; color: #088362; font-size: 24px; }
.feature-card h3 { margin: 20px 0 8px; font-size: 16px; color: #193e33; }
.feature-card p { min-height: 61px; margin: 0; line-height: 1.65; color: #71887b; font-size: 12px; }
.feature-stage { display: inline-flex; margin-top: 18px; border-radius: 6px; padding: 6px 8px; font-size: 9px; font-weight: 850; letter-spacing: 1px; color: #0e795b; background: #ecf8f0; }
.connection-note { display: flex; align-items: center; gap: 9px; margin-top: 32px; color: #436c5c; background: #eaf6ef; padding: 14px 17px; border: 1px solid #d1e7d9; border-radius: 13px; font-size: 13px; }
.connection-note ion-icon { font-size: 18px; } .connection-note small { margin-left: auto; color: #79958a; }
.page-footer { padding: 20px; text-align: center; color: #94a99d; border-top: 1px solid #dce9e1; font-size: 11px; }
@media (max-width: 1050px) { .stat-grid, .feature-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .welcome-illustration { right: -65px; opacity: .3; } }
@media (max-width: 600px) { .topbar { padding: 16px 18px; min-height: 72px; } .brand-subtitle, .brand-divider, .student-label { display: none; } .brand-title { font-size: 21px; } .main-content { padding: 24px 16px 36px; } .welcome-panel { border-radius: 19px; padding: 26px 22px; min-height: 300px; } .welcome-panel h1 { font-size: 31px; } .welcome-panel p { font-size: 13px; } .welcome-illustration { opacity: .13; right: -100px; } .section-heading { align-items: flex-start; flex-direction: column; } .stat-grid, .feature-grid { grid-template-columns: 1fr 1fr; gap: 10px; } .stat-card { padding: 16px; min-height: 162px; } .stat-card p { font-size: 12px; } .feature-card { padding: 17px 15px; } .feature-card h3 { font-size: 14px; } .feature-card p { font-size: 11px; min-height: 92px; } .connection-note { flex-wrap: wrap; } .connection-note small { margin: 0; width: 100%; } }
@media (max-width: 375px) { .stat-grid, .feature-grid { grid-template-columns: 1fr; } .feature-card p { min-height: 0; } }
</style>
