<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import {
  shieldCheckmarkOutline, peopleOutline, schoolOutline, documentTextOutline,
  todayOutline, checkmarkCircleOutline, refreshOutline, arrowForwardOutline,
  analyticsOutline, personAddOutline, alertCircleOutline, trendingUpOutline,
  chevronForwardOutline, pulseOutline, flashOutline, cloudDoneOutline, sparklesOutline, calendarOutline,
} from 'ionicons/icons';
import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

interface Overview {
  students: number; supervisors: number; pending_accounts: number;
  daily_total: number; daily_submitted: number; daily_missing: number;
  today_attendance: number; completed_shifts: number;
  weekly_total: number; weekly_pending: number; with_feedback: number;
}
const router = useRouter();
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const overview = ref<Overview | null>(null);
const loading = ref(false);
const error = ref('');
const firstName = ref('Administrator');
const updatedAt = ref<Date | null>(null);
const n = (value: number | undefined) => Number(value ?? 0);
const coverage = computed(() => overview.value && n(overview.value.daily_total) > 0
  ? Math.round(n(overview.value.daily_submitted) / n(overview.value.daily_total) * 100) : 0);
const ratio = (a: number, b: number) => b > 0 ? Math.min(100, Math.max(0, Math.round(a / b * 100))) : 0;
const pendingTotal = computed(() => n(overview.value?.pending_accounts) + n(overview.value?.weekly_pending) + n(overview.value?.daily_missing));
const syncedAt = computed(() => updatedAt.value
  ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(updatedAt.value) : 'Not synced');
const insight = computed(() => {
  if (!overview.value) return 'Connect to the backend to see your program insights.';
  if (n(overview.value.daily_total) === 0) return 'Your attendance pipeline is ready. Daily activity will appear when students time in.';
  if (n(overview.value.daily_missing) > 0) return `${overview.value.daily_missing} attendance record(s) still need a daily accomplishment photo.`;
  return 'Great progress! All recorded attendance entries currently have daily accomplishment photos.';
});
const metrics = computed(() => [
  { key: 'students', label: 'Registered students', value: overview.value?.students, icon: schoolOutline, color: 'mint', foot: 'Across the OJT program', fill: ratio(n(overview.value?.students), n(overview.value?.students) + n(overview.value?.supervisors)) },
  { key: 'supervisors', label: 'Active roles · Supervisors', value: overview.value?.supervisors, icon: peopleOutline, color: 'blue', foot: 'Supervisor accounts', fill: ratio(n(overview.value?.supervisors), n(overview.value?.students) + n(overview.value?.supervisors)) },
  { key: 'attendance', label: "Today's check-ins", value: overview.value?.today_attendance, icon: todayOutline, color: 'amber', foot: 'Attendance records today', fill: ratio(n(overview.value?.today_attendance), Math.max(1, n(overview.value?.students))) },
  { key: 'weekly', label: 'Weekly submissions', value: overview.value?.weekly_total, icon: documentTextOutline, color: 'violet', foot: `${n(overview.value?.with_feedback)} with supervisor feedback`, fill: ratio(n(overview.value?.with_feedback), n(overview.value?.weekly_total)) },
]);
const alerts = computed(() => [
  { id: 'accounts', title: 'Account approvals', desc: 'Student accounts waiting for access', value: overview.value?.pending_accounts ?? 0, to: '/admin/users', icon: personAddOutline, tone: 'amber' },
  { id: 'daily', title: 'Missing daily evidence', desc: 'Attendance without accomplishment photos', value: overview.value?.daily_missing ?? 0, to: '/admin/reports', icon: todayOutline, tone: 'rose' },
  { id: 'weekly', title: 'Weekly review queue', desc: 'Reports awaiting supervisor review', value: overview.value?.weekly_pending ?? 0, to: '/admin/reports', icon: documentTextOutline, tone: 'violet' },
]);
const tools = [
  { title: 'Student directory', body: 'Profiles, companies and geofences', icon: schoolOutline, to: '/admin/students', tone: 'mint' },
  { title: 'OJT approvals', body: 'Review workplace requests', icon: shieldCheckmarkOutline, to: '/admin/ojt-approvals', tone: 'blue' },
  { title: 'Reports center', body: 'Daily photos and weekly reflections', icon: analyticsOutline, to: '/admin/reports', tone: 'violet' },
  { title: 'User management', body: 'Account access and roles', icon: peopleOutline, to: '/admin/users', tone: 'amber' },
  { title: 'Holidays', body: 'Non-working days and suspensions', icon: calendarOutline, to: '/admin/holidays', tone: 'blue' },
];
function go(to: string) {
  if (router.resolve(to).matched.length) void router.push(to);
}
async function load() {
  if (loading.value) return;
  try {
    const raw = sessionStorage.getItem('inzone_user');
    const user = raw ? JSON.parse(raw) : null;
    if (String(user?.role ?? '').toUpperCase() !== 'ADMIN') { void router.replace('/'); return; }
    firstName.value = String(user.first_name || 'Administrator');
  } catch { void router.replace('/'); return; }
  loading.value = true; error.value = '';
  try {
    const token = sessionStorage.getItem('inzone_token');
    if (!token) throw new Error('Please sign in again.');
    const response = await fetch(`${API}/api/admin/reports/overview`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.overview) throw new Error(data.message || `Unable to load overview (HTTP ${response.status}).`);
    overview.value = data.overview as Overview;
    updatedAt.value = new Date();
  } catch (e) { error.value = e instanceof Error ? e.message : 'Unable to refresh dashboard.'; }
  finally { loading.value = false; }
}
onIonViewWillEnter(() => { void load(); });
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="page">
      <InZoneTopbar role="ADMIN" />
      <main class="wrap">
        <header class="welcome">
          <div>
            <div class="overline"><span class="live-dot" /> INZONE / ADMINISTRATOR WORKSPACE</div>
            <h1>Good to see you, <em>{{ firstName }}.</em></h1>
            <p>Your mission control for people, attendance, and every OJT milestone.</p>
          </div>
          <button class="sync-btn" :disabled="loading" @click="load"><IonIcon :icon="refreshOutline" :class="{ spinning: loading }" /> {{ loading ? 'Syncing data…' : 'Refresh dashboard' }}</button>
        </header>

        <section class="hero" aria-label="OJT program snapshot">
          <div class="hero-sheen" aria-hidden="true" />
          <div class="hero-left">
            <span class="hero-kicker"><IonIcon :icon="sparklesOutline" /> YOUR OJT OPERATIONS, REIMAGINED</span>
            <h2>Stay ahead of <span>every milestone.</span></h2>
            <p>One beautifully connected view of your students, training activity, and reports that need attention.</p>
            <div class="hero-actions">
              <button class="hero-primary" @click="go('/admin/reports')">Explore reports <IonIcon :icon="arrowForwardOutline" /></button>
              <button class="hero-secondary" @click="go('/admin/students')">Manage students <IonIcon :icon="chevronForwardOutline" /></button>
            </div>
            <div class="sync-stamp"><IonIcon :icon="cloudDoneOutline" /> Last synced: {{ syncedAt }} · Refresh to update</div>
          </div>
          <div class="hero-visual" aria-label="Daily reporting coverage">
            <div class="orbit orbit-one" /><div class="orbit orbit-two" />
            <div class="ring" :style="{ '--progress': `${coverage}%` }">
              <div class="ring-inner"><small>REPORT COVERAGE</small><strong>{{ overview ? `${coverage}%` : '—' }}</strong><span>Daily photo evidence</span></div>
            </div>
            <span class="orbit-chip chip-a"><IonIcon :icon="pulseOutline" /> OJT monitoring</span>
            <span class="orbit-chip chip-b"><IonIcon :icon="checkmarkCircleOutline" /> {{ overview?.daily_submitted ?? '—' }} submitted</span>
          </div>
        </section>

        <div v-if="error" class="error"><IonIcon :icon="alertCircleOutline" /><span>{{ error }}</span><button @click="load">Try again</button></div>
        <section class="section-head">
          <div><span class="eyebrow">THE BIG PICTURE</span><h2>Everything at a glance<span>.</span></h2><p>Actual data from your InZone backend, updated when you refresh.</p></div>
          <span class="time-badge"><IonIcon :icon="pulseOutline" /> {{ overview ? 'Data loaded' : 'Awaiting data' }}</span>
        </section>

        <section class="metric-grid" aria-label="Key statistics">
          <article v-for="(m, i) in metrics" :key="m.key" class="metric" :class="m.color" :style="{ '--i': i }">
            <div class="metric-top"><span class="metric-icon"><IonIcon :icon="m.icon" /></span><span class="metric-number">0{{ i + 1 }}</span></div>
            <small>{{ m.label }}</small><strong>{{ m.value ?? '—' }}</strong><p>{{ m.foot }}</p>
            <div class="mini-track"><div :style="{ width: `${m.fill}%` }" /></div>
          </article>
        </section>

        <div class="visual-grid">
          <section class="spotlight panel">
            <div class="panel-head"><div><span class="eyebrow">REPORTING HEALTH</span><h2>Daily evidence pulse</h2><p>How many attendance records have submitted photo evidence?</p></div><span class="panel-icon"><IonIcon :icon="trendingUpOutline" /></span></div>
            <div class="pulse-body">
              <div class="pulse-ring" :style="{ '--progress': `${coverage}%` }"><div><strong>{{ overview ? `${coverage}%` : '—' }}</strong><small>coverage</small></div></div>
              <div class="pulse-legend">
                <div><span class="legend-dot mint-dot" /><span>Submitted</span><strong>{{ overview?.daily_submitted ?? '—' }}</strong></div>
                <div><span class="legend-dot amber-dot" /><span>Missing photo</span><strong>{{ overview?.daily_missing ?? '—' }}</strong></div>
                <div><span class="legend-dot navy-dot" /><span>Completed shifts</span><strong>{{ overview?.completed_shifts ?? '—' }}</strong></div>
                <button class="text-cta" @click="go('/admin/reports')">Open daily reports <IonIcon :icon="arrowForwardOutline" /></button>
              </div>
            </div>
            <div class="insight"><IonIcon :icon="flashOutline" /><span>{{ insight }}</span></div>
          </section>

          <section class="action-panel panel">
            <div class="panel-head"><div><span class="eyebrow">ACTION BOARD</span><h2>Your priority queue</h2><p>Items your administration team should keep an eye on.</p></div><span class="count-tag">{{ overview ? pendingTotal : '—' }} items</span></div>
            <div class="action-list">
              <button v-for="(a, i) in alerts" :key="a.id" class="action" @click="go(a.to)">
                <span class="action-index">0{{ i + 1 }}</span><span class="action-symbol" :class="a.tone"><IonIcon :icon="a.icon" /></span>
                <span class="action-text"><strong>{{ a.title }}</strong><small>{{ a.desc }}</small></span><span class="action-amount">{{ overview ? a.value : '—' }}</span><IonIcon class="action-arrow" :icon="chevronForwardOutline" />
              </button>
            </div>
            <div class="action-bottom"><IonIcon :icon="shieldCheckmarkOutline" /> Weekly review decisions remain with supervisors.</div>
          </section>
        </div>

        <div class="bottom-head"><div><span class="eyebrow">WORKSPACE SHORTCUTS</span><h2>Make your next move<span>.</span></h2></div><span>Choose a module to continue</span></div>
        <section class="tool-grid">
          <button v-for="(t, i) in tools" :key="t.to" class="tool" @click="go(t.to)">
            <div class="tool-top"><span class="tool-icon" :class="t.tone"><IonIcon :icon="t.icon" /></span><span class="tool-index">/0{{ i + 1 }}</span></div>
            <strong>{{ t.title }}</strong><p>{{ t.body }}</p><span class="tool-foot">Open workspace <IonIcon :icon="arrowForwardOutline" /></span>
          </button>
        </section>
        <footer>INZONE <span>✦</span> OJT ATTENDANCE & MONITORING <span>·</span> Dashboard figures are refreshed on demand.</footer>
      </main>
    </IonContent>
    <AdminBottomNav />
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
.bottom-head{margin-top:34px}.bottom-head>span{color:#90a597;font-size:11px}.tool-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:15px}.tool{display:flex;flex-direction:column;align-items:flex-start;min-width:0;text-align:left;background:#fff;border:1px solid #dfece2;border-radius:19px;padding:22px;transition:transform .2s,box-shadow .2s}.tool:hover{transform:translateY(-4px);box-shadow:0 16px 33px #0b523515}.tool-top{width:100%;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:25px}.tool-icon{display:grid;place-items:center;width:49px;height:49px;border-radius:15px;font-size:24px;background:#e0f7ec;color:#09865d}.tool-icon.blue{background:#e7efff;color:#537dd7}.tool-icon.violet{background:#f1edff;color:#7c64cb}.tool-icon.amber{background:#fff2dc;color:#b98228}.tool-index{font-size:10px;font-weight:900;color:#b3c5b8}.tool strong{color:#194936;font-size:14px}.tool p{font-size:11px;color:#92a697;line-height:1.6;min-height:35px;margin:8px 0 16px}.tool-foot{display:flex;align-items:center;gap:8px;color:#07895e;font-size:10px;font-weight:900}.wrap footer{text-align:center;margin-top:30px;font-size:10px;color:#93a99b;letter-spacing:.4px}.wrap footer span{color:#15ad79;margin:0 5px}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}.spinning{animation:spin .9s linear infinite}
@media(max-width:1050px){.hero{grid-template-columns:1.3fr .7fr}.hero-visual{transform:scale(.85)}.metric-grid,.tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.welcome,.section-head{align-items:flex-start;flex-direction:column}.hero{grid-template-columns:1fr}.hero-visual{min-height:245px;transform:scale(.8);margin:-15px 0 -25px}.visual-grid{grid-template-columns:1fr}.pulse-body{gap:20px}.wrap{padding:25px 15px calc(145px + env(safe-area-inset-bottom,0px))}}@media(max-width:440px){.hero{padding:26px 22px}.hero h2{font-size:34px}.metric-grid{gap:9px}.metric{padding:15px}.metric strong{font-size:31px}.pulse-body{flex-direction:column;align-items:stretch}.pulse-ring{margin:0 auto}.tool-grid{grid-template-columns:1fr}.orbit-chip{font-size:9px}}@media(prefers-reduced-motion:reduce){.metric,.hero-actions button,.tool{transition:none;animation:none}.spinning{animation:none}}
</style>
