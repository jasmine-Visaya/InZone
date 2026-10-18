<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonModal,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  documentTextOutline,
  calendarOutline,
  peopleOutline,
  chatbubbleEllipsesOutline,
  timeOutline,
  searchOutline,
  refreshOutline,
  eyeOutline,
  closeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  mailOutline,
  personOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

type Id = string | number;

interface WeeklyReport {
  id: Id;
  user_id: Id;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  week_start: string | null;
  week_end: string | null;
  report: unknown;
  status: string | null;
  supervisor_id: Id | null;
  supervisor_comment: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

interface ReportsResponse {
  success?: boolean;
  message?: string;
  count?: number;
  reports?: WeeklyReport[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const reports = ref<WeeklyReport[]>([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const statusFilter = ref('ALL');
const selectedReport = ref<WeeklyReport | null>(null);

function reportStatus(report: WeeklyReport): string {
  return String(report.status || 'UNKNOWN').toUpperCase().trim();
}

function studentName(report: WeeklyReport): string {
  const name = [report.first_name, report.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || `Student #${report.user_id}`;
}

function initials(report: WeeklyReport): string {
  return (
    `${report.first_name?.trim()[0] || ''}${report.last_name?.trim()[0] || ''}`
      .toUpperCase() || 'ST'
  );
}

function reportContent(report: WeeklyReport): string {
  if (report.report == null || report.report === '') {
    return 'No report content provided.';
  }
  if (typeof report.report === 'string') return report.report;
  try {
    return JSON.stringify(report.report, null, 2);
  } catch {
    return String(report.report);
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return datePart;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function statusClass(value: string): string {
  const status = value.toUpperCase();
  if (['APPROVED', 'REVIEWED', 'COMPLETED', 'ACCEPTED'].includes(status)) {
    return 'approved';
  }
  if (['REJECTED', 'RETURNED', 'DECLINED'].includes(status)) {
    return 'rejected';
  }
  if (['PENDING', 'SUBMITTED', 'FOR_REVIEW'].includes(status)) {
    return 'pending';
  }
  return 'neutral';
}

const statusOptions = computed(() => {
  return Array.from(new Set(reports.value.map(reportStatus))).sort();
});

const pendingCount = computed(() =>
  reports.value.filter((report) =>
    ['PENDING', 'SUBMITTED', 'FOR_REVIEW'].includes(reportStatus(report))
  ).length
);

const feedbackCount = computed(() =>
  reports.value.filter((report) =>
    Boolean(report.supervisor_comment?.trim())
  ).length
);

const studentCount = computed(() =>
  new Set(reports.value.map((report) => String(report.user_id))).size
);

const filteredReports = computed(() => {
  const query = search.value.toLowerCase().trim();
  return reports.value.filter((report) => {
    if (statusFilter.value !== 'ALL' && reportStatus(report) !== statusFilter.value) {
      return false;
    }
    if (!query) return true;
    return [
      studentName(report),
      report.email || '',
      String(report.id),
      reportStatus(report),
      report.week_start || '',
      report.week_end || '',
      reportContent(report),
    ].some((value) => value.toLowerCase().includes(query));
  });
});

async function loadReports() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const token = sessionStorage.getItem('inzone_token');
    if (!token) throw new Error('Please sign in again as Admin.');

    const response = await fetch(`${API_BASE}/api/admin/reports`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => ({}))) as ReportsResponse;
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Unable to load weekly reports (HTTP ${response.status}).`);
    }
    if (!Array.isArray(data.reports)) {
      throw new Error('The Reports API returned an invalid report list.');
    }

    reports.value = data.reports;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load weekly reports.';
  } finally {
    loading.value = false;
  }
}

function openDetails(report: WeeklyReport) {
  selectedReport.value = report;
}

function closeDetails() {
  selectedReport.value = null;
}

onIonViewWillEnter(() => {
  void loadReports();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="reports-content">
      <InZoneTopbar role="ADMIN" />

      <main class="reports-shell">
        <header class="page-heading">
          <div>
            <span class="eyebrow"><IonIcon :icon="documentTextOutline" /> ADMIN · OJT MONITORING</span>
            <h1>Weekly Reports<span>.</span></h1>
            <p>View submitted OJT reports, monitor review statuses, and read supervisor feedback.</p>
          </div>
          <button class="refresh-button" type="button" :disabled="loading" @click="loadReports">
            <IonIcon :icon="refreshOutline" :class="{ spinning: loading }" />
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </header>

        <section class="summary-grid" aria-label="Weekly reports summary">
          <article class="summary-card">
            <span class="summary-icon green"><IonIcon :icon="documentTextOutline" /></span>
            <small>Total Reports</small>
            <strong>{{ loading ? '—' : reports.length }}</strong>
            <p>All weekly submissions</p>
          </article>
          <article class="summary-card">
            <span class="summary-icon amber"><IonIcon :icon="timeOutline" /></span>
            <small>Pending Review</small>
            <strong>{{ loading ? '—' : pendingCount }}</strong>
            <p>Pending or submitted reports</p>
          </article>
          <article class="summary-card">
            <span class="summary-icon blue"><IonIcon :icon="chatbubbleEllipsesOutline" /></span>
            <small>With Feedback</small>
            <strong>{{ loading ? '—' : feedbackCount }}</strong>
            <p>Reports with supervisor comments</p>
          </article>
          <article class="summary-card">
            <span class="summary-icon mint"><IonIcon :icon="peopleOutline" /></span>
            <small>Reporting Students</small>
            <strong>{{ loading ? '—' : studentCount }}</strong>
            <p>Students with weekly reports</p>
          </article>
        </section>

        <div v-if="error" class="error-banner" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadReports">Try again</button>
        </div>

        <section class="directory-card">
          <div class="directory-heading">
            <div>
              <span class="eyebrow">REPORT DIRECTORY</span>
              <h2>Student Weekly Submissions</h2>
              <p>Browse reports and open a submission to read its full details.</p>
            </div>
            <span class="result-count">{{ filteredReports.length }} reports</span>
          </div>

          <div class="toolbar">
            <label class="search-wrap">
              <IonIcon :icon="searchOutline" />
              <input v-model="search" type="search" placeholder="Search student, email or report..." aria-label="Search weekly reports" />
            </label>
            <select v-model="statusFilter" aria-label="Filter reports by status">
              <option value="ALL">All Statuses</option>
              <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
            </select>
          </div>

          <div v-if="loading && !reports.length" class="empty-state" role="status">
            <IonIcon :icon="refreshOutline" class="spinning" />
            <h3>Loading weekly reports...</h3>
            <p>Fetching the latest student submissions.</p>
          </div>
          <div v-else-if="!loading && !error && !reports.length" class="empty-state">
            <IonIcon :icon="documentTextOutline" />
            <h3>No reports submitted yet</h3>
            <p>Weekly OJT reports will appear here once students submit them.</p>
          </div>
          <div v-else-if="!filteredReports.length" class="empty-state">
            <IonIcon :icon="searchOutline" />
            <h3>No matching reports</h3>
            <p>Try another search or status filter.</p>
          </div>

          <div v-else class="report-list">
            <article v-for="report in filteredReports" :key="report.id" class="report-card">
              <div class="avatar">{{ initials(report) }}</div>
              <div class="report-main">
                <div class="report-topline">
                  <h3>{{ studentName(report) }}</h3>
                  <span class="status-pill" :class="statusClass(reportStatus(report))">{{ reportStatus(report) }}</span>
                </div>
                <p class="email">{{ report.email || 'No email available' }}</p>
                <div class="report-meta">
                  <span><IonIcon :icon="calendarOutline" /> {{ formatDate(report.week_start) }} – {{ formatDate(report.week_end) }}</span>
                  <span><IonIcon :icon="documentTextOutline" /> Report #{{ report.id }}</span>
                  <span v-if="report.supervisor_comment?.trim()" class="has-feedback">
                    <IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor feedback
                  </span>
                </div>
              </div>
              <button class="view-button" type="button" @click="openDetails(report)">
                <IonIcon :icon="eyeOutline" /> View Details
              </button>
            </article>
          </div>
        </section>

        <p class="view-note"><IonIcon :icon="informationCircleOutline" /> Admins can view weekly reports here. Review actions remain with the supervisor workflow.</p>
      </main>
    </IonContent>

    <AdminBottomNav />

    <IonModal
      :is-open="selectedReport !== null"
      class="report-detail-modal"
      @didDismiss="closeDetails"
    >
      <div v-if="selectedReport" class="modal-shell">
        <div class="modal-header">
          <div>
            <span class="eyebrow">WEEKLY OJT REPORT</span>
            <h2>Report #{{ selectedReport.id }}</h2>
          </div>
          <button type="button" class="modal-close" aria-label="Close report details" @click="closeDetails">
            <IonIcon :icon="closeOutline" />
          </button>
        </div>

        <div class="modal-scroll">
          <div class="modal-profile">
            <span class="avatar">{{ initials(selectedReport) }}</span>
            <div>
              <strong>{{ studentName(selectedReport) }}</strong>
              <p><IonIcon :icon="mailOutline" /> {{ selectedReport.email || 'No email available' }}</p>
            </div>
            <span class="status-pill" :class="statusClass(reportStatus(selectedReport))">{{ reportStatus(selectedReport) }}</span>
          </div>

          <div class="detail-grid">
            <div><span>Week Start</span><strong>{{ formatDate(selectedReport.week_start) }}</strong></div>
            <div><span>Week End</span><strong>{{ formatDate(selectedReport.week_end) }}</strong></div>
            <div><span>Submitted</span><strong>{{ formatDateTime(selectedReport.created_at) }}</strong></div>
            <div><span>Reviewed</span><strong>{{ formatDateTime(selectedReport.reviewed_at) }}</strong></div>
          </div>

          <section class="detail-section">
            <h3><IonIcon :icon="documentTextOutline" /> Student's Weekly Report</h3>
            <pre class="report-body">{{ reportContent(selectedReport) }}</pre>
          </section>

          <section class="detail-section">
            <h3><IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor Comments</h3>
            <div class="comment-body">{{ selectedReport.supervisor_comment?.trim() || 'No supervisor comments yet.' }}</div>
            <p v-if="selectedReport.supervisor_id != null" class="reviewer-note">
              <IonIcon :icon="personOutline" /> Supervisor ID: {{ selectedReport.supervisor_id }}
            </p>
          </section>
        </div>
        <div class="modal-footer">
          <button type="button" class="done-button" @click="closeDetails"><IonIcon :icon="checkmarkCircleOutline" /> Done</button>
        </div>
      </div>
    </IonModal>
  </IonPage>
</template>

<style scoped>
.reports-content { --background: #f2f8f5; --color: #163e30; }
.reports-shell { max-width: 1260px; margin: 0 auto; padding: 34px clamp(16px, 4vw, 46px) calc(145px + env(safe-area-inset-bottom, 0px)); }
button, input, select { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .6; }
.page-heading, .directory-heading { display: flex; justify-content: space-between; align-items: center; gap: 15px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #0c8a66; font-size: 10px; font-weight: 850; letter-spacing: 1.1px; }
.page-heading h1 { margin: 9px 0 6px; color: #143f31; font-size: clamp(30px, 4vw, 40px); letter-spacing: -1px; }
.page-heading h1 span { color: #18aa7b; }
.page-heading p, .directory-heading p { color: #84988c; font-size: 13px; line-height: 1.6; margin: 0; }
.refresh-button { display: inline-flex; align-items: center; gap: 8px; padding: 12px 16px; background: #e2f4e9; color: #087653; border: 0; border-radius: 11px; font-size: 12px; font-weight: 800; white-space: nowrap; }
.refresh-button ion-icon { font-size: 17px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin: 28px 0 24px; }
.summary-card { background: #fff; border: 1px solid #deebe3; border-radius: 18px; padding: 22px; box-shadow: 0 8px 25px #164d3508; min-width: 0; }
.summary-icon { width: 45px; height: 45px; display: grid; place-items: center; font-size: 23px; border-radius: 13px; margin-bottom: 18px; }
.summary-icon.green { background: #e5f6ea; color: #0a845d; }
.summary-icon.amber { background: #fff3d8; color: #a8751f; }
.summary-icon.blue { background: #e7f1ff; color: #407db2; }
.summary-icon.mint { background: #e1f4ee; color: #167e71; }
.summary-card small { display: block; color: #759083; font-weight: 750; font-size: 12px; }
.summary-card strong { display: block; color: #173f2e; font-size: 34px; letter-spacing: -.8px; margin: 7px 0; }
.summary-card p { margin: 0; color: #9aaca1; font-size: 11px; }
.error-banner { display: flex; align-items: center; gap: 9px; border-radius: 12px; padding: 15px; background: #fff0ee; color: #a73e35; font-size: 12px; margin-bottom: 20px; }
.error-banner button { border: 0; background: #fff; color: #98392f; border-radius: 8px; padding: 7px 10px; margin-left: auto; }
.directory-card { background: #fff; border-radius: 20px; border: 1px solid #dfece4; padding: clamp(18px, 3vw, 28px); box-shadow: 0 8px 28px #164d3508; }
.directory-heading h2 { font-size: 20px; margin: 8px 0 5px; color: #174330; }
.result-count { color: #0a805b; background: #e8f7ed; font-weight: 800; font-size: 11px; border-radius: 99px; padding: 9px 12px; white-space: nowrap; }
.toolbar { display: grid; grid-template-columns: 1fr 200px; gap: 12px; margin: 24px 0 16px; }
.search-wrap { display: flex; align-items: center; gap: 10px; padding: 0 13px; height: 46px; border: 1px solid #d8e7de; border-radius: 11px; color: #869e8f; background: #fbfdfb; }
.search-wrap:focus-within { border-color: #0b9970; box-shadow: 0 0 0 3px #0a9c7117; }
.search-wrap input { border: 0; background: transparent; outline: 0; width: 100%; min-width: 0; font-size: 12px; color: #17432d; }
.toolbar select { background: #fbfdfb; border: 1px solid #d8e7de; color: #315d47; border-radius: 11px; padding: 0 12px; font-size: 12px; min-height: 46px; }
.report-list { display: flex; flex-direction: column; gap: 11px; }
.report-card { display: flex; align-items: center; gap: 15px; border: 1px solid #e3eee6; border-radius: 14px; padding: 16px; background: #fcfefd; }
.report-card:hover { border-color: #bbdfca; background: #f7fcf8; }
.avatar { display: grid; place-items: center; flex-shrink: 0; width: 48px; height: 48px; border-radius: 14px; background: #e4f6eb; color: #087b58; font-size: 15px; font-weight: 850; }
.report-main { flex: 1; min-width: 0; }
.report-topline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.report-topline h3 { margin: 0; font-size: 14px; color: #193e2d; overflow-wrap: anywhere; }
.email { margin: 5px 0 8px; color: #8b9c90; font-size: 11px; overflow-wrap: anywhere; }
.status-pill { display: inline-flex; align-items: center; border-radius: 99px; padding: 6px 9px; font-size: 10px; font-weight: 850; letter-spacing: .25px; }
.status-pill.approved { color: #087b56; background: #e0f5e7; }
.status-pill.pending { color: #96701d; background: #fff1cd; }
.status-pill.rejected { color: #ad4d41; background: #ffe7e3; }
.status-pill.neutral { color: #607785; background: #eaf1f5; }
.report-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: #81978a; font-size: 11px; }
.report-meta span { display: inline-flex; align-items: center; gap: 5px; }
.report-meta ion-icon { color: #0b9469; font-size: 15px; }
.report-meta .has-feedback { color: #0c8661; }
.view-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex-shrink: 0; color: #0b7858; background: #e4f5e9; border: 0; border-radius: 11px; padding: 12px 13px; font-weight: 800; font-size: 11px; }
.view-button:hover { background: #d3eddd; }
.empty-state { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 11px; min-height: 260px; color: #8ba092; text-align: center; }
.empty-state > ion-icon { font-size: 37px; color: #8bbda0; }
.empty-state h3 { margin: 0; font-size: 16px; color: #305841; }
.empty-state p { margin: 0; font-size: 12px; }
.view-note { display: flex; align-items: center; gap: 8px; margin: 16px 3px; font-size: 11px; color: #81978b; line-height: 1.6; }
.view-note ion-icon { font-size: 17px; flex-shrink: 0; }
.report-detail-modal { --width: min(680px, calc(100% - 28px)); --height: min(85vh, 760px); --border-radius: 23px; --background: #fff; }
.modal-shell { display: flex; flex-direction: column; height: 100%; color: #173f2d; }
.modal-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5eee7; padding: 21px 25px; }
.modal-header h2 { margin: 5px 0 0; font-size: 23px; color: #17432f; }
.modal-close { width: 36px; height: 36px; border: 0; border-radius: 10px; background: #eef6f0; color: #557b61; display: grid; place-items: center; font-size: 19px; }
.modal-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 23px 25px; }
.modal-profile { display: flex; align-items: center; gap: 12px; padding: 15px; background: #f2f9f4; border-radius: 14px; }
.modal-profile > div { min-width: 0; flex: 1; }
.modal-profile strong { font-size: 14px; overflow-wrap: anywhere; }
.modal-profile p { display: flex; align-items: center; gap: 5px; margin: 5px 0 0; font-size: 11px; color: #819689; overflow-wrap: anywhere; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin: 20px 0 26px; }
.detail-grid > div { border: 1px solid #e1eee5; padding: 13px; border-radius: 11px; }
.detail-grid span { display: block; font-size: 10px; color: #87998e; margin-bottom: 8px; }
.detail-grid strong { font-size: 12px; color: #28503a; overflow-wrap: anywhere; }
.detail-section { margin-bottom: 24px; }
.detail-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 14px; color: #1e5039; }
.detail-section h3 ion-icon { font-size: 19px; color: #0b8865; }
.report-body, .comment-body { background: #f8fbf8; padding: 18px; border-radius: 12px; border: 1px solid #e1eee5; color: #4c6755; font: inherit; font-size: 12px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 330px; overflow-y: auto; }
.reviewer-note { display: flex; align-items: center; gap: 6px; color: #8ba092; font-size: 11px; }
.modal-footer { padding: 15px 25px; border-top: 1px solid #e5eee7; display: flex; justify-content: flex-end; }
.done-button { display: inline-flex; align-items: center; gap: 8px; background: #0b7959; color: #fff; border: 0; border-radius: 11px; padding: 12px 22px; font-size: 12px; font-weight: 800; }
.spinning { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .reports-shell { padding: 25px 15px calc(140px + env(safe-area-inset-bottom, 0px)); }
  .page-heading, .directory-heading { align-items: flex-start; flex-direction: column; }
  .refresh-button { align-self: flex-start; }
  .summary-grid { gap: 10px; margin: 22px 0; }
  .summary-card { padding: 15px; }
  .summary-card strong { font-size: 28px; }
  .summary-card p { font-size: 10px; }
  .toolbar { grid-template-columns: 1fr; }
  .report-card { align-items: flex-start; flex-wrap: wrap; gap: 10px; }
  .report-main { flex-basis: calc(100% - 60px); }
  .view-button { width: 100%; }
  .report-detail-modal { --width: calc(100% - 14px); --height: 90vh; --border-radius: 18px; }
  .modal-header, .modal-footer { padding: 17px; }
  .modal-scroll { padding: 16px; }
  .detail-grid { gap: 8px; }
  .modal-profile { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .spinning { animation: none; } }
</style>
