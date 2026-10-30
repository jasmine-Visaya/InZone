<script setup lang="ts">
// =====================================
// SUPERVISOR WEEKLY REPORTS
// Read, approve or reject weekly reports of assigned students.
// APIs: GET   /api/supervisor/reports
//       PATCH /api/supervisor/reports/:reportId/review
//             body: { status: 'APPROVED' | 'REJECTED', supervisor_comment }
// =====================================
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonModal,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  refreshOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  closeOutline,
  searchOutline,
  documentTextOutline,
  chatbubbleEllipsesOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  ApiError,
  fullName,
  initials,
  formatWeek,
  formatDateTime,
  reportStatus,
  reportLabel,
  reportTone,
  type WeeklyReport,
} from './supervisorApi';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
type Decision = 'APPROVED' | 'REJECTED';

const MAX_COMMENT = 2000;

const route = useRoute();
const router = useRouter();

const reports = ref<WeeklyReport[]>([]);
const loaded = ref(false);
const loading = ref(false);
const error = ref('');
const success = ref('');
const tab = ref<Tab>('PENDING');
const search = ref('');

const selected = ref<WeeklyReport | null>(null);
const comment = ref('');
const confirming = ref<Decision | null>(null);
const submitting = ref(false);
const reviewError = ref('');

const tabs = computed(() => {
  const count = (status: string) =>
    reports.value.filter((r) => reportStatus(r) === status).length;
  return [
    { key: 'PENDING' as Tab, label: 'To review', count: count('PENDING') },
    { key: 'APPROVED' as Tab, label: 'Approved', count: count('APPROVED') },
    { key: 'REJECTED' as Tab, label: 'Rejected', count: count('REJECTED') },
    { key: 'ALL' as Tab, label: 'All', count: reports.value.length },
  ];
});

const visibleReports = computed(() => {
  const query = search.value.trim().toLowerCase();
  return reports.value.filter((report) => {
    if (tab.value !== 'ALL' && reportStatus(report) !== tab.value) return false;
    if (!query) return true;
    return [fullName(report), report.email, report.company_name, report.report]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });
});

const emptyText = computed(() => {
  if (search.value.trim()) {
    return { title: 'No matching reports', body: 'Try a different name or word.' };
  }
  switch (tab.value) {
    case 'PENDING':
      return { title: 'All caught up', body: 'No weekly reports are waiting for your review.' };
    case 'APPROVED':
      return { title: 'No approved reports yet', body: 'Reports you approve will be listed here.' };
    case 'REJECTED':
      return { title: 'No rejected reports', body: 'Reports you send back to students will be listed here.' };
    default:
      return { title: 'No reports yet', body: 'Your students have not submitted any weekly reports.' };
  }
});

const isPending = computed(() => selected.value !== null && reportStatus(selected.value) === 'PENDING');
const trimmedComment = computed(() => comment.value.trim());

async function loadReports() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const data = await supervisorRequest<{ reports: WeeklyReport[] }>('/api/supervisor/reports');
    reports.value = Array.isArray(data.reports) ? data.reports : [];
    loaded.value = true;
    openFromQuery();
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load weekly reports.');
  } finally {
    loading.value = false;
  }
}

// The dashboard and student pages link here with ?open=<reportId>
function openFromQuery() {
  const id = route.query.open;
  if (!id) return;
  const report = reports.value.find((r) => String(r.id) === String(id));
  void router.replace({ path: route.path });
  if (report) {
    tab.value = reportStatus(report) as Tab;
    openReport(report);
  }
}

function openReport(report: WeeklyReport) {
  selected.value = report;
  comment.value = '';
  confirming.value = null;
  reviewError.value = '';
  success.value = '';
}

function closeReport() {
  if (submitting.value) return;
  selected.value = null;
  confirming.value = null;
}

function askConfirm(decision: Decision) {
  reviewError.value = '';
  if (decision === 'REJECTED' && !trimmedComment.value) {
    reviewError.value = 'Add a comment so the student knows what to fix before you reject.';
    return;
  }
  confirming.value = decision;
}

async function submitReview() {
  const report = selected.value;
  const decision = confirming.value;
  if (!report || !decision || submitting.value) return;

  submitting.value = true;
  reviewError.value = '';

  try {
    const data = await supervisorRequest<{ message: string; weekly_report: WeeklyReport }>(
      `/api/supervisor/reports/${encodeURIComponent(String(report.id))}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: decision,
          supervisor_comment: trimmedComment.value,
        }),
      }
    );

    // Update the report in the list without reloading everything.
    const updated = data.weekly_report;
    reports.value = reports.value.map((item) =>
      String(item.id) === String(report.id)
        ? {
            ...item,
            status: updated.status,
            supervisor_comment: updated.supervisor_comment,
            supervisor_id: updated.supervisor_id,
            reviewed_at: updated.reviewed_at,
          }
        : item
    );

    success.value =
      decision === 'APPROVED'
        ? `Approved ${fullName(report)}'s report for ${formatWeek(report.week_start, report.week_end)}.`
        : `Rejected ${fullName(report)}'s report. They can read your comment and resubmit.`;

    submitting.value = false;
    closeReport();
  } catch (err) {
    reviewError.value = errorMessage(err, 'Unable to save your review.');
    confirming.value = null;
    // Someone already reviewed it: refresh so the list is accurate.
    if (err instanceof ApiError && err.status === 409) {
      void loadReports();
    }
  } finally {
    submitting.value = false;
  }
}

onIonViewWillEnter(() => {
  void loadReports();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell">
        <header class="sv-heading">
          <div>
            <h1>Weekly reports</h1>
            <p>Read what your students accomplished each week, then approve it or send it back with a comment.</p>
          </div>
          <button class="sv-refresh" type="button" :disabled="loading" @click="loadReports">
            <IonIcon :icon="refreshOutline" :class="{ 'sv-spin': loading }" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </header>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadReports">Try again</button>
        </div>

        <div v-if="success" class="sv-success" role="status">
          <IonIcon :icon="checkmarkCircleOutline" />
          <span>{{ success }}</span>
        </div>

        <section class="sv-card">
          <div class="toolbar">
            <div class="sv-tabs" role="tablist" aria-label="Filter reports">
              <button
                v-for="item in tabs"
                :key="item.key"
                type="button"
                role="tab"
                :aria-selected="tab === item.key"
                :class="{ 'is-active': tab === item.key }"
                @click="tab = item.key"
              >
                {{ item.label }} <span class="count">{{ item.count }}</span>
              </button>
            </div>

            <label class="sv-search">
              <IonIcon :icon="searchOutline" />
              <input v-model="search" type="search" placeholder="Search student or report" aria-label="Search reports" />
            </label>
          </div>

          <div v-if="loading && !loaded" class="list">
            <div v-for="n in 3" :key="n" class="sv-skeleton skeleton-row"></div>
          </div>

          <div v-else-if="loaded && !visibleReports.length" class="sv-empty">
            <IonIcon :icon="documentTextOutline" />
            <h3>{{ emptyText.title }}</h3>
            <p>{{ emptyText.body }}</p>
          </div>

          <ul v-else class="list">
            <li v-for="report in visibleReports" :key="report.id">
              <button type="button" class="report-row" @click="openReport(report)">
                <span class="sv-avatar">{{ initials(report) }}</span>
                <span class="report-main">
                  <span class="report-top">
                    <span class="sv-name">{{ fullName(report) }}</span>
                    <span class="sv-pill" :class="reportTone(reportStatus(report))">
                      {{ reportLabel(reportStatus(report)) }}
                    </span>
                  </span>
                  <span class="sv-sub">
                    Week of {{ formatWeek(report.week_start, report.week_end) }}
                    <template v-if="report.company_name"> · {{ report.company_name }}</template>
                  </span>
                  <span class="snippet">{{ report.report || 'No report text.' }}</span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </main>
    </IonContent>

    <SupervisorBottomNav />

    <!-- REPORT DETAILS + REVIEW -->
    <IonModal
      :is-open="selected !== null"
      class="report-modal"
      :backdrop-dismiss="!submitting"
      @didDismiss="closeReport"
    >
      <div v-if="selected" class="sv-modal modal-shell">
        <header class="modal-header">
          <span class="sv-avatar">{{ initials(selected) }}</span>
          <div class="modal-title">
            <h2>{{ fullName(selected) }}</h2>
            <p>{{ selected.company_name || selected.email }}</p>
          </div>
          <button type="button" class="modal-close" aria-label="Close" :disabled="submitting" @click="closeReport">
            <IonIcon :icon="closeOutline" />
          </button>
        </header>

        <div class="modal-scroll">
          <div class="meta">
            <div><span>Week</span><strong>{{ formatWeek(selected.week_start, selected.week_end) }}</strong></div>
            <div><span>Submitted</span><strong>{{ formatDateTime(selected.created_at) }}</strong></div>
            <div><span>Status</span>
              <strong><span class="sv-pill" :class="reportTone(reportStatus(selected))">{{ reportLabel(reportStatus(selected)) }}</span></strong>
            </div>
            <div v-if="!isPending"><span>Reviewed</span><strong>{{ formatDateTime(selected.reviewed_at) }}</strong></div>
          </div>

          <h3 class="block-title"><IonIcon :icon="documentTextOutline" /> What the student did this week</h3>
          <div class="report-text">{{ selected.report || 'No report text provided.' }}</div>

          <!-- Already reviewed: show the feedback -->
          <template v-if="!isPending">
            <h3 class="block-title"><IonIcon :icon="chatbubbleEllipsesOutline" /> Supervisor comment</h3>
            <div class="report-text comment">{{ selected.supervisor_comment || 'No comment was added.' }}</div>
          </template>

          <!-- Pending: write feedback -->
          <template v-else>
            <label class="block-title" for="review-comment">
              <IonIcon :icon="chatbubbleEllipsesOutline" /> Your comment
            </label>
            <textarea
              id="review-comment"
              v-model="comment"
              rows="4"
              :maxlength="MAX_COMMENT"
              :disabled="submitting"
              placeholder="Optional when approving. Required when rejecting: tell the student what to fix."
            />
            <p class="hint">{{ comment.length }} / {{ MAX_COMMENT }}</p>
          </template>

          <div v-if="reviewError" class="sv-error" role="alert">
            <IonIcon :icon="alertCircleOutline" />
            <span>{{ reviewError }}</span>
          </div>
        </div>

        <footer v-if="isPending" class="modal-footer">
          <template v-if="!confirming">
            <button type="button" class="sv-btn danger-soft" :disabled="submitting" @click="askConfirm('REJECTED')">
              <IonIcon :icon="closeCircleOutline" /> Reject
            </button>
            <button type="button" class="sv-btn primary" :disabled="submitting" @click="askConfirm('APPROVED')">
              <IonIcon :icon="checkmarkCircleOutline" /> Approve
            </button>
          </template>

          <div v-else class="confirm" role="alertdialog" aria-live="assertive">
            <p>
              {{ confirming === 'APPROVED'
                ? 'Approve this report? This cannot be undone.'
                : 'Reject this report? The student will see your comment.' }}
            </p>
            <div class="confirm-actions">
              <button type="button" class="sv-btn ghost" :disabled="submitting" @click="confirming = null">Cancel</button>
              <button
                type="button"
                class="sv-btn"
                :class="confirming === 'APPROVED' ? 'primary' : 'danger'"
                :disabled="submitting"
                @click="submitReview"
              >
                {{ submitting ? 'Saving…' : confirming === 'APPROVED' ? 'Yes, approve' : 'Yes, reject' }}
              </button>
            </div>
          </div>
        </footer>

        <footer v-else class="modal-footer">
          <button type="button" class="sv-btn soft" @click="closeReport">Done</button>
        </footer>
      </div>
    </IonModal>
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: auto minmax(200px, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.skeleton-row {
  height: 92px;
}

.report-row {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  width: 100%;
  padding: 15px;
  border: 1px solid #e6efe9;
  border-radius: 15px;
  background: #fcfefd;
  text-align: left;
}

.report-row:hover {
  border-color: #c7e2d2;
  background: #f8fcf9;
}

.report-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.report-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.snippet {
  margin-top: 8px;
  color: var(--sv-ink-soft);
  font-size: 13px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- modal ---------- */
.report-modal {
  --width: min(640px, calc(100% - 24px));
  --height: min(88vh, 780px);
  --border-radius: 22px;
}

.modal-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  color: var(--sv-ink);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e5eee7;
}

.modal-title {
  flex: 1;
  min-width: 0;
}

.modal-title h2 {
  margin: 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}

.modal-title p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--sv-muted);
  overflow-wrap: anywhere;
}

.modal-close {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 0;
  border-radius: 11px;
  background: #eef6f0;
  color: #557b61;
  font-size: 20px;
}

.modal-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px;
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 20px;
}

.meta > div {
  padding: 11px 12px;
  border: 1px solid #e3eee7;
  border-radius: 12px;
}

.meta > div > span {
  display: block;
  margin-bottom: 5px;
  color: var(--sv-muted);
  font-size: 11px;
}

.meta strong {
  color: var(--sv-ink-soft);
  font-size: 13px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 9px;
  color: var(--sv-ink);
  font-size: 14px;
  font-weight: 800;
}

.block-title ion-icon {
  color: var(--sv-primary);
  font-size: 18px;
}

.report-text {
  margin-bottom: 20px;
  padding: 15px 16px;
  border-radius: 13px;
  background: #f7fbf8;
  border: 1px solid #e3eee7;
  color: #33503f;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 75ch;
}

.report-text.comment {
  background: #fffdf6;
  border-color: #efe3c4;
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 104px;
  padding: 12px 13px;
  border: 1px solid #d5e5da;
  border-radius: 12px;
  background: #fbfdfb;
  color: var(--sv-ink);
  font-size: 14px;
  line-height: 1.55;
}

textarea:focus {
  border-color: var(--sv-primary);
  outline: none;
  box-shadow: 0 0 0 3px #0b795917;
}

.hint {
  margin: 6px 0 14px;
  text-align: right;
  font-size: 11px;
  color: #9aaca1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5eee7;
}

.modal-footer > .sv-btn {
  min-width: 130px;
}

.confirm {
  width: 100%;
}

.confirm p {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--sv-ink);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 760px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 340px) {
  .meta {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .report-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .report-modal {
    --width: 100%;
    --height: 94vh;
  }

  .modal-footer > .sv-btn,
  .confirm-actions .sv-btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
