<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon, IonModal, onIonViewWillEnter } from '@ionic/vue';
import {
  documentTextOutline, calendarOutline, peopleOutline, chatbubbleEllipsesOutline,
  timeOutline, searchOutline, refreshOutline, eyeOutline, closeOutline,
  checkmarkCircleOutline, alertCircleOutline, mailOutline, businessOutline,
  imageOutline, chevronBackOutline, chevronForwardOutline, layersOutline,
  todayOutline, filterOutline, arrowForwardOutline, downloadOutline,
  gridOutline, listOutline, sparklesOutline, pulseOutline, shieldCheckmarkOutline,
  analyticsOutline, ribbonOutline, flashOutline, cloudDoneOutline,
} from 'ionicons/icons';
import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

type Id = string | number;
type Tab = 'daily' | 'weekly';
type Evidence = 'accomplishment' | 'time-in';
interface WeeklyReport {
  id: Id; user_id: Id; first_name: string | null; last_name: string | null; email: string | null;
  week_start: string | null; week_end: string | null; report: unknown; status: string | null;
  supervisor_id: Id | null; supervisor_comment: string | null;
  reviewed_at: string | null; created_at: string | null;
}
interface DailyReport {
  id: Id; user_id: Id; first_name: string | null; last_name: string | null; email: string | null;
  company_name: string | null; company_address: string | null; attendance_date: string;
  time_in: string | null; time_out: string | null; time_in_status: string | null;
  time_out_status: string | null; hours_worked: number | string | null;
  accomplishment_uploaded: boolean; time_in_photo_uploaded: boolean;
  accomplishment_uploaded_at: string | null;
}
interface Pagination { page: number; limit: number; total: number; total_pages: number }
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const tab = ref<Tab>('daily');
const weekly = ref<WeeklyReport[]>([]);
const daily = ref<DailyReport[]>([]);
const pagination = ref<Pagination>({ page: 1, limit: 15, total: 0, total_pages: 1 });
const loading = ref(false);
const weeklyLoaded = ref(false);
const error = ref('');
const search = ref('');
const status = ref('ALL');
const date = ref('');
const viewMode = ref<'cards' | 'rows'>('cards');
const sort = ref<'newest' | 'oldest'>('newest');
const selectedDaily = ref<DailyReport | null>(null);
const selectedWeekly = ref<WeeklyReport | null>(null);
const photo = ref('');
const photoLoading = ref(false);
const photoError = ref('');
const photoType = ref<Evidence>('accomplishment');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let photoVersion = 0;
let fetchVersion = 0;

function nameOf(v: { first_name: string | null; last_name: string | null; user_id: Id }) {
  return [v.first_name, v.last_name].filter(Boolean).join(' ') || `Student #${v.user_id}`;
}
function initials(v: { first_name: string | null; last_name: string | null }) {
  return ((v.first_name?.[0] || '') + (v.last_name?.[0] || '')).toUpperCase() || 'ST';
}
function dateText(value?: string | null) {
  if (!value) return '—';
  const str = String(value).slice(0, 10);
  const d = new Date(`${str}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? str : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}
function timeText(value?: string | null) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}
function reportBody(v: WeeklyReport) {
  if (v.report == null || v.report === '') return 'No report content provided.';
  return typeof v.report === 'string' ? v.report : JSON.stringify(v.report, null, 2);
}
function statusOf(v: WeeklyReport) { return String(v.status || 'UNKNOWN').toUpperCase(); }
function colorOf(s: string) {
  if (['APPROVED', 'REVIEWED', 'ACCEPTED', 'COMPLETED'].includes(s)) return 'good';
  if (['REJECTED', 'DECLINED', 'RETURNED', 'MISSING'].includes(s)) return 'bad';
  return 'waiting';
}
const weeklyFiltered = computed(() => weekly.value.filter(v => {
  if (status.value !== 'ALL' && statusOf(v) !== status.value) return false;
  const q = search.value.trim().toLowerCase();
  return !q || [nameOf(v), v.email || '', String(v.id), reportBody(v)].some(x => x.toLowerCase().includes(q));
}).sort((a, b) => sort.value === 'newest'
  ? new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  : new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()));
const dailyVisible = computed(() => sort.value === 'newest' ? daily.value : [...daily.value].reverse());
const weeklyStatuses = computed(() => [...new Set(weekly.value.map(statusOf))].sort());
const weeklyPending = computed(() => weekly.value.filter(v => ['PENDING', 'SUBMITTED', 'FOR_REVIEW'].includes(statusOf(v))).length);
const weeklyFeedback = computed(() => weekly.value.filter(v => Boolean(v.supervisor_comment?.trim())).length);
const weeklyStudents = computed(() => new Set(weekly.value.map(v => String(v.user_id))).size);
const dailySubmitted = computed(() => daily.value.filter(v => v.accomplishment_uploaded).length);
const dailyMissing = computed(() => daily.value.filter(v => !v.accomplishment_uploaded).length);
const dailyCompleted = computed(() => daily.value.filter(v => Boolean(v.time_out)).length);
const currentPercent = computed(() => {
  if (tab.value === 'daily') return daily.value.length ? Math.round(dailySubmitted.value / daily.value.length * 100) : 0;
  return weekly.value.length ? Math.round(weeklyFeedback.value / weekly.value.length * 100) : 0;
});
const totalInView = computed(() => tab.value === 'daily' ? pagination.value.total : weeklyFiltered.value.length);
const currentRows = computed(() => tab.value === 'daily' ? dailyVisible.value.length : weeklyFiltered.value.length);
const currentCaption = computed(() => tab.value === 'daily' ? 'Photo coverage · current page' : 'Supervisor feedback · all weekly reports');
const currentStats = computed(() => tab.value === 'daily'
  ? [
      { label: 'Matching records', value: pagination.value.total, icon: layersOutline, tone: 'mint', subtitle: 'Across matching pages' },
      { label: 'Daily evidence', value: dailySubmitted.value, icon: checkmarkCircleOutline, tone: 'blue', subtitle: 'Photos on this page' },
      { label: 'Needs evidence', value: dailyMissing.value, icon: timeOutline, tone: 'amber', subtitle: 'Missing photos on this page' },
      { label: 'Completed shifts', value: dailyCompleted.value, icon: cloudDoneOutline, tone: 'violet', subtitle: 'Time-outs on this page' },
    ]
  : [
      { label: 'Weekly submissions', value: weekly.value.length, icon: documentTextOutline, tone: 'mint', subtitle: 'All available reports' },
      { label: 'Awaiting review', value: weeklyPending.value, icon: timeOutline, tone: 'amber', subtitle: 'Supervisor review queue' },
      { label: 'With feedback', value: weeklyFeedback.value, icon: chatbubbleEllipsesOutline, tone: 'blue', subtitle: 'Supervisor comments added' },
      { label: 'Reporting students', value: weeklyStudents.value, icon: peopleOutline, tone: 'violet', subtitle: 'Unique student accounts' },
    ]);

async function request(path: string) {
  const token = sessionStorage.getItem('inzone_token');
  if (!token) throw new Error('Please sign in again as Administrator.');
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  return data;
}
async function load(force = false) {
  if (tab.value === 'weekly' && weeklyLoaded.value && !force) return;
  const version = ++fetchVersion;
  const currentTab = tab.value;
  loading.value = true; error.value = '';
  try {
    if (currentTab === 'weekly') {
      const data = await request('/api/admin/reports');
      if (!Array.isArray(data.reports)) throw new Error('Invalid weekly report response.');
      if (version === fetchVersion) { weekly.value = data.reports; weeklyLoaded.value = true; }
    } else {
      const query = new URLSearchParams({ page: String(pagination.value.page), status: status.value });
      if (search.value.trim()) query.set('search', search.value.trim());
      if (date.value) query.set('date', date.value);
      const data = await request(`/api/admin/reports/daily?${query}`);
      if (!Array.isArray(data.records)) throw new Error('Invalid daily report response.');
      if (version === fetchVersion) { daily.value = data.records; pagination.value = data.pagination; }
    }
  } catch (e) { if (version === fetchVersion) error.value = e instanceof Error ? e.message : 'Unable to load reports.'; }
  finally { if (version === fetchVersion) loading.value = false; }
}
function changeTab(next: Tab) {
  if (tab.value === next) return;
  if (searchTimer) clearTimeout(searchTimer);
  tab.value = next; search.value = ''; status.value = 'ALL'; date.value = ''; sort.value = 'newest';
  pagination.value.page = 1; error.value = '';
  fetchVersion++;
  loading.value = false;
  void load();
}
function filterChanged() {
  if (tab.value === 'weekly') return;
  pagination.value.page = 1;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { void load(true); }, 350);
}
function clearFilters() {
  search.value = ''; status.value = 'ALL'; date.value = ''; sort.value = 'newest';
  if (searchTimer) clearTimeout(searchTimer);
  if (tab.value === 'daily') { pagination.value.page = 1; void load(true); }
}
function changePage(page: number) {
  if (page < 1 || page > pagination.value.total_pages || loading.value) return;
  pagination.value.page = page; void load(true);
}
function openWeekly(v: WeeklyReport) { selectedWeekly.value = v; }
function closeWeekly() { selectedWeekly.value = null; }
function closeDaily() { selectedDaily.value = null; photo.value = ''; photoError.value = ''; photoVersion++; }
async function showPhoto(kind: Evidence) {
  if (!selectedDaily.value) return;
  const id = selectedDaily.value.id;
  const version = ++photoVersion;
  photoType.value = kind; photo.value = ''; photoError.value = ''; photoLoading.value = true;
  try {
    const data = await request(`/api/admin/reports/daily/${encodeURIComponent(String(id))}/photo/${kind}`);
    if (version === photoVersion) photo.value = String(data.photo_url || '');
    if (!data.photo_url) throw new Error('Photo not available.');
  } catch (e) { if (version === photoVersion) photoError.value = e instanceof Error ? e.message : 'Unable to show photo.'; }
  finally { if (version === photoVersion) photoLoading.value = false; }
}
function openDaily(v: DailyReport) {
  selectedDaily.value = v; photo.value = ''; photoError.value = '';
  if (v.accomplishment_uploaded) void showPhoto('accomplishment');
  else if (v.time_in_photo_uploaded) void showPhoto('time-in');
}
function csvCell(value: unknown) {
  let content = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/^[\s]*[=+@-]/.test(content)) content = `'${content}`;
  return `"${content.replace(/"/g, '""')}"`;
}
function exportCsv() {
  const header = tab.value === 'daily'
    ? ['Student', 'Email', 'Workplace', 'Attendance date', 'Time in', 'Time out', 'Hours', 'Daily photo']
    : ['Student', 'Email', 'Week start', 'Week end', 'Status', 'Report', 'Supervisor feedback'];
  const entries: unknown[][] = tab.value === 'daily'
    ? dailyVisible.value.map(v => [nameOf(v), v.email, v.company_name, dateText(v.attendance_date), timeText(v.time_in), timeText(v.time_out), v.hours_worked, v.accomplishment_uploaded ? 'Submitted' : 'Missing'])
    : weeklyFiltered.value.map(v => [nameOf(v), v.email, dateText(v.week_start), dateText(v.week_end), statusOf(v), reportBody(v), v.supervisor_comment]);
  if (!entries.length) return;
  const csv = [header, ...entries].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `inzone-${tab.value}-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
onIonViewWillEnter(() => { void load(true); });
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer); fetchVersion++; photoVersion++; });
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="page">
      <InZoneTopbar role="ADMIN" />
      <main class="wrap">
        <header class="top-head">
          <div><div class="overline"><IonIcon :icon="sparklesOutline" /> ADMIN / REPORT INTELLIGENCE</div><h1>Reports, <em>reimagined.</em></h1><p>Turn daily evidence and weekly updates into a clear picture of OJT progress.</p></div>
          <button class="refresh" :disabled="loading" @click="load(true)"><IonIcon :icon="refreshOutline" :class="{ spin: loading }" /> {{ loading ? 'Syncing…' : 'Refresh data' }}</button>
        </header>

        <section class="hero">
          <div class="hero-content"><span class="hero-kicker"><IonIcon :icon="shieldCheckmarkOutline" /> YOUR STUDENT REPORTING WORKSPACE</span><h2>Every update tells<br /><span>a bigger story.</span></h2><p>Follow attendance evidence, explore student reflections, and review supervisor feedback—all in one place.</p><span class="hero-note"><IonIcon :icon="pulseOutline" /> Connected to InZone reports API</span></div>
          <div class="hero-side" aria-hidden="true"><div class="hero-circle"><IonIcon :icon="analyticsOutline" /></div><div class="floating-chip chip-top"><IonIcon :icon="todayOutline" /> DAILY ACTIVITY</div><div class="floating-chip chip-bottom"><IonIcon :icon="ribbonOutline" /> WEEKLY PROGRESS</div></div>
        </section>

        <div class="report-switch" role="tablist" aria-label="Choose report category">
          <button class="switch-card" role="tab" :aria-selected="tab === 'daily'" :class="{ active: tab === 'daily' }" @click="changeTab('daily')">
            <span class="switch-icon"><IonIcon :icon="todayOutline" /></span><span class="switch-copy"><strong>Daily accomplishments</strong><small>Attendance, time logs & photo proof</small></span><span class="switch-arrow"><IonIcon :icon="arrowForwardOutline" /></span>
          </button>
          <button class="switch-card" role="tab" :aria-selected="tab === 'weekly'" :class="{ active: tab === 'weekly' }" @click="changeTab('weekly')">
            <span class="switch-icon"><IonIcon :icon="calendarOutline" /></span><span class="switch-copy"><strong>Weekly reflections</strong><small>Submissions, status & supervisor notes</small></span><span class="switch-arrow"><IonIcon :icon="arrowForwardOutline" /></span>
          </button>
        </div>

        <div v-if="error" class="error"><IonIcon :icon="alertCircleOutline" /><span>{{ error }}</span><button @click="load(true)">Retry</button></div>

        <div class="section-head"><div><div class="overline">{{ tab === 'daily' ? 'DAILY ACTIVITY PULSE' : 'WEEKLY REVIEW PULSE' }}</div><h2>What the numbers say<span>.</span></h2></div><span class="count-tag">{{ totalInView }} matching records</span></div>
        <section class="stat-grid" aria-label="Report statistics">
          <article v-for="(item, i) in currentStats" :key="item.label" class="stat" :class="item.tone" :style="{ '--i': i }"><div class="stat-top"><span class="stat-icon"><IonIcon :icon="item.icon" /></span><span class="stat-num">0{{ i + 1 }}</span></div><small>{{ item.label }}</small><strong>{{ item.value }}</strong><p>{{ item.subtitle }}</p></article>
        </section>

        <div class="content-grid">
          <section class="directory">
            <div class="dir-head"><div><span class="overline">THE REPORT DIRECTORY</span><h2>{{ tab === 'daily' ? 'Student daily activity' : 'Weekly submissions' }}</h2><p>{{ tab === 'daily' ? 'Photos, workplace information and attendance time logs' : 'Progress reflections with supervisor feedback' }}</p></div><button class="export" :disabled="!currentRows" @click="exportCsv"><IonIcon :icon="downloadOutline" /> Export {{ tab === 'daily' ? 'page' : 'filtered' }} CSV</button></div>
            <div class="toolbar">
              <label class="search"><IonIcon :icon="searchOutline" /><input v-model="search" type="search" :placeholder="tab === 'daily' ? 'Search student or company…' : 'Search student or report…'" aria-label="Search reports" @input="filterChanged" /></label>
              <label class="filter"><IonIcon :icon="filterOutline" /><select v-model="status" aria-label="Filter by status" @change="filterChanged"><option value="ALL">All statuses</option><template v-if="tab === 'daily'"><option value="SUBMITTED">Submitted</option><option value="MISSING">Missing evidence</option></template><option v-for="s in tab === 'weekly' ? weeklyStatuses : []" :key="s" :value="s">{{ s }}</option></select></label>
              <label v-if="tab === 'daily'" class="date-filter"><input v-model="date" type="date" aria-label="Filter by attendance date" @change="filterChanged" /></label>
            </div>
            <div class="utility-row"><div class="utility-left"><span><IonIcon :icon="layersOutline" /> {{ currentRows }} shown</span><button @click="clearFilters">Clear filters</button></div><div class="utility-right"><select v-model="sort" aria-label="Sort records"><option value="newest">Newest first</option><option value="oldest">Oldest first (current page)</option></select><div class="view-toggle"><button :class="{ selected: viewMode === 'cards' }" aria-label="Card view" :aria-pressed="viewMode === 'cards'" @click="viewMode = 'cards'"><IonIcon :icon="gridOutline" /></button><button :class="{ selected: viewMode === 'rows' }" aria-label="List view" :aria-pressed="viewMode === 'rows'" @click="viewMode = 'rows'"><IonIcon :icon="listOutline" /></button></div></div></div>
            <div v-if="loading" class="state"><IonIcon :icon="refreshOutline" class="spin" /><h3>Getting the latest submissions</h3><p>Loading report data from your InZone backend.</p></div>
            <template v-else-if="tab === 'daily'"><div class="record-grid" :class="{ compact: viewMode === 'rows' }">
              <article v-for="v in dailyVisible" :key="v.id" class="record"><div class="record-top"><span class="avatar">{{ initials(v) }}</span><span class="status" :class="v.accomplishment_uploaded ? 'good' : 'bad'"><span class="status-dot" />{{ v.accomplishment_uploaded ? 'Evidence submitted' : 'Needs evidence' }}</span></div><h3>{{ nameOf(v) }}</h3><p class="company"><IonIcon :icon="businessOutline" /> {{ v.company_name || 'No workplace specified' }}</p><div class="record-divider" /><div class="record-detail"><span><IonIcon :icon="calendarOutline" /> {{ dateText(v.attendance_date) }}</span><span><IonIcon :icon="timeOutline" /> {{ v.hours_worked == null ? 'Shift in progress' : `${v.hours_worked} hours` }}</span><span><IonIcon :icon="imageOutline" /> {{ v.time_in_photo_uploaded ? 'Time-in photo available' : 'No time-in photo' }}</span></div><button class="record-action" @click="openDaily(v)"><IonIcon :icon="eyeOutline" /> View daily report <IonIcon :icon="arrowForwardOutline" /></button></article>
            </div><div v-if="!dailyVisible.length" class="state"><IonIcon :icon="todayOutline" /><h3>No daily reports found</h3><p>Try another student, date or status filter.</p></div><div v-if="pagination.total_pages > 1" class="pagination"><button :disabled="loading || pagination.page <= 1" @click="changePage(pagination.page - 1)"><IonIcon :icon="chevronBackOutline" /> Previous</button><span>Page {{ pagination.page }} / {{ pagination.total_pages }}</span><button :disabled="loading || pagination.page >= pagination.total_pages" @click="changePage(pagination.page + 1)">Next <IonIcon :icon="chevronForwardOutline" /></button></div></template>
            <template v-else><div class="record-grid" :class="{ compact: viewMode === 'rows' }"><article v-for="v in weeklyFiltered" :key="v.id" class="record"><div class="record-top"><span class="avatar">{{ initials(v) }}</span><span class="status" :class="colorOf(statusOf(v))"><span class="status-dot" />{{ statusOf(v) }}</span></div><h3>{{ nameOf(v) }}</h3><p class="company"><IonIcon :icon="mailOutline" /> {{ v.email || 'Email unavailable' }}</p><div class="record-divider" /><div class="record-detail"><span><IonIcon :icon="calendarOutline" /> {{ dateText(v.week_start) }} – {{ dateText(v.week_end) }}</span><span><IonIcon :icon="chatbubbleEllipsesOutline" /> {{ v.supervisor_comment ? 'Has supervisor feedback' : 'No feedback yet' }}</span><span><IonIcon :icon="documentTextOutline" /> Weekly reflection</span></div><button class="record-action" @click="openWeekly(v)"><IonIcon :icon="eyeOutline" /> Read weekly report <IonIcon :icon="arrowForwardOutline" /></button></article></div><div v-if="!weeklyFiltered.length" class="state"><IonIcon :icon="documentTextOutline" /><h3>No weekly reports found</h3><p>Try changing your search or status filter.</p></div></template>
          </section>

          <aside class="insights">
            <div class="insights-head"><span class="overline">REPORT QUALITY</span><h2>{{ tab === 'daily' ? 'Evidence health' : 'Feedback health' }}</h2><p>{{ currentCaption }}</p></div>
            <div class="insight-ring" :style="{ '--progress': `${currentPercent}%` }"><div><strong>{{ currentPercent }}%</strong><small>{{ tab === 'daily' ? 'with photos' : 'with feedback' }}</small></div></div>
            <div class="insight-legend"><div><span class="legend green" /> {{ tab === 'daily' ? 'Photos attached' : 'Feedback available' }} <strong>{{ tab === 'daily' ? dailySubmitted : weeklyFeedback }}</strong></div><div><span class="legend peach" /> {{ tab === 'daily' ? 'Missing photos' : 'Pending supervisor review' }} <strong>{{ tab === 'daily' ? dailyMissing : weeklyPending }}</strong></div></div>
            <div class="insight-note"><IonIcon :icon="flashOutline" /><span>{{ tab === 'daily' ? 'Daily percentages use the attendance records shown on the current page.' : 'Weekly percentages use all currently loaded weekly reports.' }}</span></div>
            <div class="insight-footer"><IonIcon :icon="shieldCheckmarkOutline" /><p>Administrators can view reports. Weekly review decisions remain with assigned supervisors.</p></div>
          </aside>
        </div>
        <footer>INZONE <span>✦</span> OJT REPORT INTELLIGENCE <span>·</span> Export contains the records currently displayed or filtered.</footer>
      </main>
    </IonContent>
    <AdminBottomNav />

    <IonModal :is-open="selectedDaily !== null" class="detail-modal" @didDismiss="closeDaily">
      <div v-if="selectedDaily" class="detail-shell"><div class="modal-hero"><span class="overline">DAILY ACCOMPLISHMENT DETAILS</span><div class="modal-head"><div><h2>{{ nameOf(selectedDaily) }}</h2><p>{{ selectedDaily.company_name || 'Workplace not specified' }}</p></div><button aria-label="Close daily report" @click="closeDaily"><IonIcon :icon="closeOutline" /></button></div></div><div class="detail-scroll"><div class="detail-highlights"><div><small>Attendance date</small><strong>{{ dateText(selectedDaily.attendance_date) }}</strong></div><div><small>Hours worked</small><strong>{{ selectedDaily.hours_worked == null ? 'In progress' : `${selectedDaily.hours_worked} hours` }}</strong></div><div><small>Time in</small><strong>{{ timeText(selectedDaily.time_in) }}</strong></div><div><small>Time out</small><strong>{{ timeText(selectedDaily.time_out) }}</strong></div></div><section class="detail-panel"><h3><IonIcon :icon="businessOutline" /> Workplace</h3><p>{{ selectedDaily.company_name || 'No workplace provided' }}<span v-if="selectedDaily.company_address"> · {{ selectedDaily.company_address }}</span></p></section><section class="detail-panel"><h3><IonIcon :icon="imageOutline" /> Submitted evidence</h3><div class="photo-switch"><button v-if="selectedDaily.accomplishment_uploaded" :class="{ selected: photoType === 'accomplishment' }" @click="showPhoto('accomplishment')">Daily accomplishment</button><button v-if="selectedDaily.time_in_photo_uploaded" :class="{ selected: photoType === 'time-in' }" @click="showPhoto('time-in')">Time-in proof</button></div><div v-if="photoLoading" class="photo-state"><IonIcon :icon="refreshOutline" class="spin" /> Loading secure photo…</div><div v-else-if="photoError" class="photo-state">{{ photoError }}</div><img v-else-if="photo" :src="photo" alt="Student submitted attendance evidence" class="photo" referrerpolicy="no-referrer" /><div v-else class="photo-state">No photo available for this record.</div></section></div><div class="modal-footer"><button @click="closeDaily">Close details</button></div></div>
    </IonModal>
    <IonModal :is-open="selectedWeekly !== null" class="detail-modal" @didDismiss="closeWeekly">
      <div v-if="selectedWeekly" class="detail-shell"><div class="modal-hero"><span class="overline">WEEKLY REPORT DETAILS</span><div class="modal-head"><div><h2>{{ nameOf(selectedWeekly) }}</h2><p>{{ selectedWeekly.email || 'Student weekly reflection' }}</p></div><button aria-label="Close weekly report" @click="closeWeekly"><IonIcon :icon="closeOutline" /></button></div></div><div class="detail-scroll"><div class="detail-highlights"><div><small>Week start</small><strong>{{ dateText(selectedWeekly.week_start) }}</strong></div><div><small>Week end</small><strong>{{ dateText(selectedWeekly.week_end) }}</strong></div><div><small>Submitted</small><strong>{{ timeText(selectedWeekly.created_at) }}</strong></div><div><small>Status</small><strong>{{ statusOf(selectedWeekly) }}</strong></div></div><section class="detail-panel"><h3><IonIcon :icon="documentTextOutline" /> Student weekly reflection</h3><pre class="report-text">{{ reportBody(selectedWeekly) }}</pre></section><section class="detail-panel"><h3><IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor feedback</h3><p>{{ selectedWeekly.supervisor_comment || 'No supervisor comments yet.' }}</p></section></div><div class="modal-footer"><button @click="closeWeekly">Close details</button></div></div>
    </IonModal>
  </IonPage>
</template>

<style scoped>
.page{--background:#f0f6f2;--color:#163d30}.wrap{max-width:1350px;margin:auto;padding:32px clamp(15px,4vw,49px) calc(155px + env(safe-area-inset-bottom,0px))}button{font:inherit;cursor:pointer}.overline{display:flex;align-items:center;gap:7px;color:#0b9068;font-size:10px;font-weight:900;letter-spacing:1.45px}.top-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}.top-head h1{color:#143e2e;letter-spacing:-1.7px;font-size:clamp(32px,4vw,44px);margin:10px 0 8px}.top-head h1 em{font-style:normal;color:#0d9b6d}.top-head p{color:#859d8d;font-size:12px;line-height:1.7;margin:0}.refresh{border:1px solid #d6eadb;background:white;color:#0e7c5a;border-radius:13px;padding:13px 16px;display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:11px;font-weight:850;box-shadow:0 7px 22px #14523510}.refresh:disabled{opacity:.5}
.hero{position:relative;isolation:isolate;display:grid;grid-template-columns:1.25fr .75fr;align-items:center;overflow:hidden;min-height:278px;border-radius:24px;padding:30px clamp(25px,3vw,42px);color:white;background:linear-gradient(115deg,#0a3830,#075943 58%,#0a9b6f);box-shadow:0 20px 37px #0b5d401f}.hero:before{content:"";position:absolute;width:420px;height:420px;border-radius:50%;background:#baffce1b;filter:blur(45px);right:-180px;top:-200px}.hero-content{position:relative;z-index:1}.hero-kicker{display:inline-flex;align-items:center;gap:8px;font-size:9px;letter-spacing:1px;color:#b7f2d6;border:1px solid #f1fff03a;background:#ffffff12;padding:8px 11px;border-radius:30px;font-weight:850}.hero h2{margin:18px 0 12px;font-size:clamp(30px,3.7vw,45px);letter-spacing:-1.6px;line-height:1.12}.hero h2 span{color:#86ebbd}.hero p{color:#d0eadd;font-size:12px;line-height:1.8;max-width:460px}.hero-note{display:inline-flex;align-items:center;gap:7px;font-size:10px;color:#b6e9ce;margin-top:12px}.hero-side{min-height:220px;display:grid;place-items:center;position:relative}.hero-circle{height:182px;width:182px;display:grid;place-items:center;border-radius:43px;transform:rotate(-8deg);font-size:87px;color:#e6fff0;border:1px solid #ffffff5d;background:#ffffff15;box-shadow:0 0 0 28px #ffffff08,0 0 0 56px #ffffff06}.hero-circle ion-icon{transform:rotate(8deg)}.floating-chip{position:absolute;background:#ffffffef;color:#0c7654;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:.7px;font-weight:850;box-shadow:0 7px 30px #092d2440}.chip-top{top:0;right:8%}.chip-bottom{bottom:0;left:0}
.report-switch{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:21px 0 27px}.switch-card{display:flex;gap:15px;align-items:center;min-width:0;text-align:left;border-radius:18px;border:1px solid #dcebe2;background:#fff;padding:20px 22px;box-shadow:0 9px 28px #124b350a;transition:.2s}.switch-card:hover{transform:translateY(-2px);border-color:#abdac4}.switch-card.active{background:#e7f8ef;border-color:#55cda2;box-shadow:0 9px 25px #0a966018}.switch-icon{display:grid;place-items:center;flex-shrink:0;width:52px;height:52px;border-radius:15px;background:#f0f5f0;color:#819889;font-size:25px}.active .switch-icon{color:#fff;background:linear-gradient(130deg,#0b976c,#0c785a)}.switch-copy{flex:1;min-width:0}.switch-copy strong{display:block;color:#1c4d36;font-size:13px}.switch-copy small{display:block;color:#8ca293;font-size:11px;line-height:1.5;margin-top:5px}.switch-arrow{color:#96b2a0;font-size:18px}.active .switch-arrow{color:#0b9a6d}
.error{display:flex;align-items:center;gap:10px;border-radius:12px;padding:13px;background:#fff1ed;color:#a8453b;font-size:12px;margin-bottom:20px}.error span{flex:1}.error button{border:0;background:transparent;color:inherit;font-weight:850}.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:12px 0 16px}.section-head h2{color:#183f30;font-size:25px;letter-spacing:-.7px;margin:7px 0}.section-head h2 span{color:#0ea376}.count-tag{font-size:10px;font-weight:850;background:#e3f7eb;color:#0c8561;border-radius:50px;padding:9px 12px;white-space:nowrap}.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat{--accent:#0a996b;--pale:#e0f7ea;min-width:0;border-radius:19px;border:1px solid #dfece3;background:white;padding:19px 21px;box-shadow:0 9px 27px #104a330c;animation:rise .45s both;animation-delay:calc(var(--i) * 65ms)}.stat.blue{--accent:#4a7fd1;--pale:#e9f0ff}.stat.amber{--accent:#b98529;--pale:#fff1d7}.stat.violet{--accent:#785fc6;--pale:#f1eaff}.stat-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.stat-icon{display:grid;place-items:center;height:45px;width:45px;border-radius:13px;color:var(--accent);background:var(--pale);font-size:23px}.stat-num{font-size:10px;font-weight:900;color:#c2d7ca}.stat small{display:block;color:#859c8e;font-size:11px;font-weight:850}.stat strong{display:block;font-size:34px;letter-spacing:-1px;color:#194733;margin:4px 0;line-height:1.2}.stat p{font-size:10px;color:#96a89b;margin:3px 0 0}
.content-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;gap:17px;margin-top:21px}.directory,.insights{border:1px solid #dfece3;border-radius:22px;background:#fff;box-shadow:0 10px 30px #114c3410}.directory{padding:24px}.dir-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.dir-head h2{color:#194733;letter-spacing:-.6px;font-size:23px;margin:8px 0 5px}.dir-head p{font-size:11px;color:#8da394;line-height:1.6;margin:0}.export{display:flex;align-items:center;gap:7px;border:1px solid #d3eadb;background:#e9f8ee;color:#0c805a;border-radius:11px;padding:11px 13px;white-space:nowrap;font-size:10px;font-weight:850}.export:disabled{opacity:.45;cursor:default}.toolbar{display:flex;gap:9px;margin:23px 0 12px}.search,.filter,.date-filter{display:flex;align-items:center;gap:8px;min-height:45px;border:1px solid #dceae1;border-radius:11px;background:#fafdfb;color:#8aa490;padding:0 12px}.search{flex:1;min-width:95px}.search input{min-width:0;width:100%;border:0;outline:none;background:transparent;color:#224b37;font:inherit;font-size:11px}.filter select,.date-filter input{border:0;outline:none;background:transparent;color:#4a6956;font:inherit;font-size:10px;max-width:100%}.utility-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.utility-left,.utility-right{display:flex;align-items:center;gap:9px}.utility-left span{display:flex;align-items:center;gap:6px;font-size:10px;color:#91a79a}.utility-left button{border:0;background:transparent;color:#0d936b;font-size:10px;font-weight:850}.utility-right>select{border:0;background:transparent;color:#6c8a77;font:inherit;font-size:10px;outline:0}.view-toggle{display:flex;border:1px solid #dcece2;border-radius:9px;padding:3px;gap:2px}.view-toggle button{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:6px;color:#94a99b;background:transparent}.view-toggle button.selected{color:#0a825c;background:#e6f6eb}.record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.record{min-width:0;border:1px solid #e1ece4;background:linear-gradient(170deg,#fff,#f9fcfa);border-radius:16px;padding:17px;transition:transform .2s,border-color .2s,box-shadow .2s}.record:hover{transform:translateY(-3px);border-color:#addcc2;box-shadow:0 11px 28px #12543b12}.record-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.avatar{display:grid;place-items:center;width:48px;height:48px;flex-shrink:0;border-radius:14px;background:linear-gradient(140deg,#cdf3dc,#eafbf0);color:#087950;font-size:14px;font-weight:900}.status{display:flex;align-items:center;gap:6px;font-size:9px;padding:7px 9px;border-radius:50px;font-weight:900;line-height:1.2}.status-dot{height:6px;width:6px;border-radius:50%;background:currentColor}.status.good{background:#def7e9;color:#087a55}.status.bad{background:#fff0e6;color:#b76b32}.status.waiting{background:#fff2d8;color:#946c2a}.record h3{font-size:15px;letter-spacing:-.2px;color:#204b36;margin:15px 0 5px;overflow-wrap:anywhere}.company{display:flex;align-items:flex-start;gap:6px;min-height:16px;font-size:10px;color:#8da395;line-height:1.5;overflow-wrap:anywhere}.company ion-icon{flex-shrink:0;margin-top:1px}.record-divider{height:1px;background:#e7eee8;margin:15px 0 13px}.record-detail{display:flex;flex-direction:column;gap:10px;min-height:72px}.record-detail span{display:flex;align-items:center;gap:7px;font-size:10px;color:#688c76;line-height:1.5}.record-detail ion-icon{flex-shrink:0;color:#0c9a6c;font-size:15px}.record-action{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;border:0;border-radius:10px;background:#e4f6eb;color:#0a805b;min-height:42px;font-size:11px;font-weight:850}.record-action:hover{background:#d2f0de}.record-action ion-icon:last-child{margin-left:auto}.record-grid.compact{grid-template-columns:1fr}.record-grid.compact .record{display:grid;grid-template-columns:55px 1fr auto;gap:0 13px;align-items:center}.record-grid.compact .record-top{grid-column:1;grid-row:1/4}.record-grid.compact .status,.record-grid.compact .record-divider,.record-grid.compact .record-detail{display:none}.record-grid.compact .record h3{margin:0;grid-column:2}.record-grid.compact .company{grid-column:2}.record-grid.compact .record-action{width:auto;margin:0;grid-column:3;grid-row:1/4;padding:0 14px}.pagination{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:20px;font-size:11px;color:#819989}.pagination button{display:flex;align-items:center;gap:5px;border:0;border-radius:9px;background:#e7f6eb;color:#0d805d;padding:10px 12px;font-size:10px;font-weight:850}.pagination button:disabled{opacity:.4;cursor:default}.state{text-align:center;padding:48px 15px;color:#91a798}.state>ion-icon{color:#14a675;font-size:34px}.state h3{color:#224c39;font-size:16px}.state p{font-size:11px}.insights{padding:23px;position:sticky;top:15px}.insights-head h2{font-size:21px;margin:9px 0 5px;color:#204b37}.insights-head p{color:#8fa596;font-size:11px;line-height:1.6}.insight-ring{--progress:0%;height:192px;width:192px;display:grid;place-items:center;margin:25px auto;background:conic-gradient(#0ab482 var(--progress),#e9f2eb var(--progress) 100%);border-radius:50%}.insight-ring>div{height:158px;width:158px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:white;border-radius:50%}.insight-ring strong{font-size:43px;letter-spacing:-2px;color:#0c855f}.insight-ring small{font-size:11px;color:#87a28f}.insight-legend>div{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:1px solid #edf2ec;font-size:10px;color:#678674}.insight-legend strong{margin-left:auto;color:#204c37;font-size:14px}.legend{width:10px;height:10px;border-radius:3px}.legend.green{background:#0ab482}.legend.peach{background:#f1b565}.insight-note{display:flex;align-items:flex-start;gap:9px;background:#eff9f2;border-radius:11px;padding:13px;margin-top:18px;font-size:10px;line-height:1.6;color:#678d74}.insight-note ion-icon{flex-shrink:0;color:#0a9567;font-size:18px}.insight-footer{display:flex;align-items:flex-start;gap:9px;margin-top:18px;font-size:10px;line-height:1.7;color:#91a89a}.insight-footer ion-icon{flex-shrink:0;font-size:17px;color:#0a9669}.insight-footer p{margin:0}.wrap footer{text-align:center;margin:26px 0 0;color:#9bafa0;font-size:10px;letter-spacing:.4px}.wrap footer span{color:#0c9f73;margin:0 4px}
.detail-modal{--width:min(820px,calc(100% - 24px));--height:min(89vh,870px);--border-radius:22px;--background:#fff}.detail-shell{display:flex;flex-direction:column;height:100%;color:#1d4b36}.modal-hero{position:relative;overflow:hidden;flex-shrink:0;padding:24px;background:linear-gradient(115deg,#0c674d,#0b916b);color:white}.modal-hero .overline{color:#b7f5d9}.modal-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.modal-head h2{color:white;font-size:26px;margin:10px 0 5px;letter-spacing:-.7px}.modal-head p{color:#d5eddf;font-size:11px;margin:0}.modal-head button{height:37px;width:37px;border:1px solid #ffffff40;border-radius:10px;background:#ffffff24;color:white;font-size:21px}.detail-scroll{flex:1;overflow:auto;padding:24px}.detail-highlights{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.detail-highlights>div{padding:14px;border:1px solid #dfece2;border-radius:12px;background:#f8fbf9}.detail-highlights small{display:block;color:#8ba393;font-size:10px;margin-bottom:9px}.detail-highlights strong{font-size:11px;color:#214f38;overflow-wrap:anywhere}.detail-panel{margin-top:20px}.detail-panel h3{display:flex;align-items:center;gap:9px;color:#194b35;font-size:14px}.detail-panel h3 ion-icon{color:#0c9970;font-size:19px}.detail-panel p,.report-text{display:block;width:100%;font:inherit;font-size:12px;line-height:1.85;color:#5f806b;background:#f7fbf8;border:1px solid #dfece2;padding:17px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}.report-text{max-height:390px;overflow:auto}.photo-switch{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0}.photo-switch button{border:1px solid #d6e8db;border-radius:9px;padding:10px 13px;color:#6d8777;background:#f7fbf8;font-size:11px;font-weight:850}.photo-switch button.selected{border-color:#0e966a;color:#fff;background:#0b8963}.photo{width:100%;max-height:490px;object-fit:contain;border-radius:13px;background:#edf3ed;border:1px solid #deece1}.photo-state{display:grid;place-items:center;gap:8px;min-height:150px;border:1px dashed #cbded1;border-radius:12px;color:#819a89;font-size:11px;background:#f7faf7}.modal-footer{padding:16px 24px;flex-shrink:0;border-top:1px solid #e4efe6;text-align:right}.modal-footer button{background:#0a815e;color:white;border:0;padding:12px 20px;border-radius:10px;font-size:11px;font-weight:850}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.spin{animation:spin .9s linear infinite}
@media(max-width:1120px){.content-grid{grid-template-columns:1fr}.insights{position:static;display:grid;grid-template-columns:1fr 210px;gap:10px 20px;align-items:center}.insight-ring{grid-column:2;grid-row:1/4;margin:0 auto}.insight-legend,.insight-note,.insight-footer{grid-column:1}}@media(max-width:870px){.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-side{opacity:.5}.record-grid{grid-template-columns:1fr}}@media(max-width:700px){.top-head{flex-direction:column;align-items:flex-start}.hero{grid-template-columns:1fr;padding:26px 23px}.hero-side{display:none}.report-switch{gap:8px}.switch-card{padding:14px;gap:9px}.switch-icon{height:39px;width:39px;font-size:19px}.switch-copy strong{font-size:11px}.switch-copy small{font-size:9px}.toolbar{flex-wrap:wrap}.search{flex-basis:100%}.filter,.date-filter{flex:1}.dir-head{align-items:flex-start;flex-direction:column}.directory{padding:16px}.insights{display:block}.insight-ring{margin:21px auto}.detail-highlights{grid-template-columns:repeat(2,minmax(0,1fr))}.wrap{padding:25px 15px calc(145px + env(safe-area-inset-bottom,0px))}}@media(max-width:450px){.report-switch{grid-template-columns:1fr}.utility-row{align-items:flex-start;flex-direction:column}.record-grid.compact .record{grid-template-columns:50px 1fr}.record-grid.compact .record-action{grid-column:1/3;grid-row:auto;margin-top:12px}.stat-grid{gap:9px}.stat{padding:15px}.stat strong{font-size:29px}.section-head{align-items:flex-start;flex-direction:column}.detail-scroll{padding:15px}.detail-highlights{gap:7px}}@media(prefers-reduced-motion:reduce){.stat,.record,.switch-card{animation:none;transition:none}.spin{animation:none}}
</style>
