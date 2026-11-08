
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonModal,
  onIonViewWillEnter,
} from '@ionic/vue';

import {
  documentTextOutline,
  peopleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  timeOutline,
  eyeOutline,
  closeOutline,
  refreshOutline,
  searchOutline,
  calendarOutline,
  businessOutline,
  chevronBackOutline,
  chevronForwardOutline,
  imageOutline,
  logInOutline,
  logOutOutline,
  clipboardOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';

// =====================================
// API CONFIGURATION
// =====================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '');

function getToken(): string {
  return sessionStorage.getItem('inzone_token') || '';
}

// =====================================
// TYPES
// =====================================

interface ReportRecord {
  id: string | number;
  user_id: string | number;

  student_name: string;
  first_name: string;
  last_name: string;

  company_name: string;
  company_address?: string;

  attendance_date: string;

  time_in: string | null;
  time_out: string | null;

  time_in_status?: string;
  time_out_status?: string;

  hours_worked: number | string | null;

  accomplishment_uploaded: boolean;
  accomplishment_uploaded_at: string | null;
  accomplishment_text?: string | null;
  review_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  supervisor_comment?: string | null;
  reviewed_at?: string | null;
}

interface Summary {
  total: number;
  submitted: number;
  missing: number;
  completed: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface ListResponse {
  success: boolean;
  records: ReportRecord[];
  summary: Summary;
  pagination: Pagination;
}

interface PhotoResponse {
  success?: boolean;
  photo_url?: string;
  signed_url?: string;
  url?: string;
  photos?: Array<{ photo_url?: string; signed_url?: string; url?: string }>;
  accomplishment_text?: string | null;
}

// =====================================
// REPORTS STATE
// =====================================

const records = ref<ReportRecord[]>([]);

const summary = ref<Summary>({
  total: 0,
  submitted: 0,
  missing: 0,
  completed: 0,
});

const pagination = ref<Pagination>({
  page: 1,
  limit: 12,
  total: 0,
  total_pages: 1,
});

const loading = ref(false);
const error = ref('');

// =====================================
// FILTER STATE
// =====================================

const search = ref('');
const status = ref('ALL');
const selectedDate = ref('');

// =====================================
// PHOTO PREVIEW STATE
// =====================================

const selectedRecord = ref<ReportRecord | null>(null);
const previewPhoto = ref('');
const previewPhotos = ref<string[]>([]);
const previewText = ref('');
const previewLoading = ref(false);
const previewError = ref('');
// Daily review state (mirrors Weekly Reports)
type ReviewDecision = 'APPROVED' | 'REJECTED';
const reviewComment = ref('');
const reviewDecision = ref<ReviewDecision | null>(null);
const reviewSaving = ref(false);
const reviewError = ref('');
const reviewSuccess = ref('');
function dailyReviewStatus(record: ReportRecord): string {
  return record.review_status || 'PENDING';
}
function requestDailyReview(decision: ReviewDecision) {
  reviewError.value = '';
  if (decision === 'REJECTED' && !reviewComment.value.trim()) {
    reviewError.value = 'Please add a comment explaining what the student needs to fix.';
    return;
  }
  reviewDecision.value = decision;
}
async function saveDailyReview() {
  const record = selectedRecord.value;
  const decision = reviewDecision.value;
  if (!record || !decision || reviewSaving.value) return;
  reviewSaving.value = true;
  reviewError.value = '';
  try {
    const token = getToken();
    if (!token) throw new Error('Session expired. Please log in again.');
    const response = await fetch(
      `${API_URL}/api/supervisor/accomplishments/${encodeURIComponent(String(record.id))}/review`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: decision,
          supervisor_comment: reviewComment.value.trim(),
        }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Review could not be saved (${response.status}).`);
    const updated = data.record || data.attendance || {};
    records.value = records.value.map((item) => String(item.id) === String(record.id)
      ? { ...item, review_status: updated.review_status || decision,
          supervisor_comment: updated.supervisor_comment ?? reviewComment.value.trim(),
          reviewed_at: updated.reviewed_at || new Date().toISOString() }
      : item);
    reviewSuccess.value = decision === 'APPROVED' ? 'Daily report approved.' : 'Daily report rejected.';
    reviewSaving.value = false;
    closePreview();
    void loadReports(pagination.value.page);
  } catch (err) {
    reviewError.value = err instanceof Error ? err.message : 'Unable to save review.';
    reviewDecision.value = null;
  } finally {
    reviewSaving.value = false;
  }
}


let listRequestId = 0;
let photoRequestId = 0;

// =====================================
// API HELPER
// =====================================

async function apiGet<T>(
  endpoint: string
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error(
      'Session expired. Please log in again.'
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Request failed (${response.status}).`
    );
  }

  return data as T;
}

// =====================================
// LOAD DAILY REPORTS
// =====================================

async function loadReports(page = 1) {
  const requestId = ++listRequestId;

  loading.value = true;
  error.value = '';

  try {
    const params = new URLSearchParams();

    params.set('page', String(page));
    params.set('status', status.value);

    if (search.value.trim()) {
      params.set('search', search.value.trim());
    }

    if (selectedDate.value) {
      params.set('date', selectedDate.value);
    }

    const response = await apiGet<ListResponse>(
      `/api/supervisor/accomplishments?${params.toString()}`
    );

    if (requestId !== listRequestId) return;

    records.value = Array.isArray(response.records)
      ? response.records
      : [];

    summary.value = response.summary || {
      total: 0,
      submitted: 0,
      missing: 0,
      completed: 0,
    };

    pagination.value = response.pagination || {
      page: 1,
      limit: 12,
      total: 0,
      total_pages: 1,
    };

  } catch (cause) {
    if (requestId !== listRequestId) return;

    error.value =
      cause instanceof Error
        ? cause.message
        : 'Unable to retrieve reports.';

  } finally {
    if (requestId === listRequestId) {
      loading.value = false;
    }
  }
}

// =====================================
// FILTER FUNCTIONS
// =====================================

function applyFilters() {
  void loadReports(1);
}

function resetFilters() {
  search.value = '';
  status.value = 'ALL';
  selectedDate.value = '';

  void loadReports(1);
}

function changePage(page: number) {
  if (
    loading.value ||
    page < 1 ||
    page > pagination.value.total_pages
  ) {
    return;
  }

  void loadReports(page);
}

// =====================================
// DATE AND TIME HELPERS
// =====================================

function formatDate(value: string): string {
  if (!value) return '--';

  const dateOnly = value.slice(0, 10);
  const date = new Date(
    `${dateOnly}T12:00:00+08:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTime(
  value: string | null
): string {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatDateTime(
  value: string | null
): string {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatHours(
  record: ReportRecord
): string {
  if (!record.time_out) {
    return 'Ongoing';
  }

  if (
    record.hours_worked === null ||
    record.hours_worked === undefined
  ) {
    return '--';
  }

  const hours = Number(record.hours_worked);

  if (!Number.isFinite(hours)) {
    return '--';
  }

  return `${hours.toFixed(2)} hrs`;
}

function studentInitials(
  record: ReportRecord
): string {
  const first = record.first_name?.charAt(0) || '';
  const last = record.last_name?.charAt(0) || '';

  return `${first}${last}`.toUpperCase() || 'ST';
}

// =====================================
// PHOTO PREVIEW
// =====================================

async function openPhoto(
  record: ReportRecord
) {
  if (!record.accomplishment_uploaded) {
    return;
  }

  const requestId = ++photoRequestId;

  selectedRecord.value = record;
  reviewComment.value = '';
  reviewDecision.value = null;
  reviewError.value = '';
  reviewSuccess.value = '';
  previewPhoto.value = '';
  previewPhotos.value = [];
  previewText.value = record.accomplishment_text || '';
  previewError.value = '';
  previewLoading.value = true;

  try {
    const response = await apiGet<PhotoResponse>(
      `/api/attendance/accomplishment/${encodeURIComponent(
        String(record.id)
      )}`
    );

    if (requestId !== photoRequestId) return;

    const photoUrl =
      response.photo_url ||
      response.signed_url ||
      response.url ||
      '';

    if (!photoUrl) {
      throw new Error(
        'The accomplishment photo is unavailable.'
      );
    }

    previewPhoto.value = photoUrl;
    previewPhotos.value = Array.isArray(response.photos)
      ? response.photos.map(p => p.photo_url || p.signed_url || p.url || '').filter(Boolean)
      : [photoUrl];
    previewText.value = response.accomplishment_text ?? record.accomplishment_text ?? '';

  } catch (cause) {
    if (requestId !== photoRequestId) return;

    previewError.value =
      cause instanceof Error
        ? cause.message
        : 'Unable to load the photo.';

  } finally {
    if (requestId === photoRequestId) {
      previewLoading.value = false;
    }
  }
}

function closePreview() {
  if (reviewSaving.value) return;
  reviewDecision.value = null;
  reviewError.value = '';
  photoRequestId++;

  selectedRecord.value = null;
  previewPhoto.value = '';
  previewPhotos.value = [];
  previewText.value = '';
  previewLoading.value = false;
  previewError.value = '';
}

// =====================================
// PAGE LIFECYCLE
// =====================================

onIonViewWillEnter(() => {
  void loadReports(1);
});

onUnmounted(() => {
  listRequestId++;
  closePreview();
});
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="accomplishment-content"
    >
      <!-- SUPERVISOR TOPBAR -->
      <InZoneTopbar role="SUPERVISOR" />

      <main class="accomplishment-container">

        <!-- PAGE HEADER -->
        <header class="page-header">
          <div class="header-text">
            <span class="eyebrow">
              PHOTO EVIDENCE
            </span>

            <h1>
              Daily
              <span>accomplishments.</span>
            </h1>

            <p>
              Monitor student attendance, track
              report submissions, and review
              accomplishment photos.
            </p>
          </div>

          <button
            type="button"
            class="refresh-button"
            :disabled="loading"
            @click="loadReports(pagination.page)"
          >
            <IonIcon
              :icon="refreshOutline"
              :class="{ spinning: loading }"
            />

            Refresh
          </button>
        </header>

        <!-- SUMMARY CARDS -->
        <section
          class="stats-grid"
          aria-label="Report statistics"
        >
          <!-- TOTAL -->
          <div class="stat-card">
            <div class="stat-icon neutral">
              <IonIcon :icon="peopleOutline" />
            </div>

            <span>Total Records</span>
            <strong>{{ summary.total }}</strong>
            <small>Assigned attendance</small>
          </div>

          <!-- SUBMITTED -->
          <div class="stat-card">
            <div class="stat-icon success">
              <IonIcon
                :icon="checkmarkCircleOutline"
              />
            </div>

            <span>Submitted</span>
            <strong>{{ summary.submitted }}</strong>
            <small>Reports uploaded</small>
          </div>

          <!-- MISSING -->
          <div class="stat-card">
            <div class="stat-icon warning">
              <IonIcon
                :icon="alertCircleOutline"
              />
            </div>

            <span>Missing Reports</span>
            <strong>{{ summary.missing }}</strong>
            <small>Pending submissions</small>
          </div>

          <!-- COMPLETED -->
          <div class="stat-card">
            <div class="stat-icon complete">
              <IonIcon :icon="timeOutline" />
            </div>

            <span>Completed</span>
            <strong>{{ summary.completed }}</strong>
            <small>Attendance with Time Out</small>
          </div>
        </section>

        <!-- FILTER PANEL -->
        <section class="filter-panel">
          <div class="section-heading">
            <div>
              <h2>Student Reports</h2>

              <p>
                Browse daily accomplishment and
                attendance records.
              </p>
            </div>

            <span class="records-count">
              {{ pagination.total }} Results
            </span>
          </div>

          <form
            class="filter-grid"
            @submit.prevent="applyFilters"
          >
            <!-- SEARCH -->
            <label class="filter-field search-field">
              <span>Search Student or Company</span>

              <div class="input-wrap">
                <IonIcon :icon="searchOutline" />

                <input
                  v-model="search"
                  type="search"
                  placeholder="Search name or company"
                />
              </div>
            </label>

            <!-- STATUS -->
            <label class="filter-field">
              <span>Report Status</span>

              <select
                v-model="status"
                @change="applyFilters"
              >
                <option value="ALL">
                  All Reports
                </option>

                <option value="SUBMITTED">
                  Submitted
                </option>

                <option value="MISSING">
                  Missing
                </option>
              </select>
            </label>

            <!-- DATE -->
            <label class="filter-field">
              <span>Attendance Date</span>

              <div class="input-wrap">
                <IonIcon :icon="calendarOutline" />

                <input
                  v-model="selectedDate"
                  type="date"
                  @change="applyFilters"
                />
              </div>
            </label>

            <!-- ACTIONS -->
            <div class="filter-actions">
              <button
                type="submit"
                class="search-button"
              >
                Search
              </button>

              <button
                type="button"
                class="clear-button"
                @click="resetFilters"
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        <!-- ERROR MESSAGE -->
        <div
          v-if="error"
          class="error-message"
          role="alert"
        >
          <IonIcon :icon="alertCircleOutline" />

          <span>{{ error }}</span>

          <button
            type="button"
            @click="loadReports(pagination.page)"
          >
            Retry
          </button>
        </div>

        <!-- LOADING -->
        <div
          v-if="loading"
          class="empty-state"
        >
          <IonSpinner name="crescent" />

          <h3>Loading Reports</h3>

          <p>
            Retrieving student attendance
            and accomplishment records...
          </p>
        </div>

        <!-- EMPTY STATE -->
        <div
          v-else-if="!error && records.length === 0"
          class="empty-state"
        >
          <IonIcon
            :icon="clipboardOutline"
            class="empty-icon"
          />

          <h3>No Reports Found</h3>

          <p>
            No attendance reports match
            your current filters.
          </p>

          <button
            type="button"
            class="clear-button"
            @click="resetFilters"
          >
            Reset Filters
          </button>
        </div>

        <!-- REPORTS -->
        <section
          v-else-if="!error"
          class="reports-grid"
        >
          <article
            v-for="record in records"
            :key="record.id"
            class="report-card"
          >
            <!-- STUDENT INFORMATION -->
            <div class="report-top">
              <div class="student-info">
                <div class="student-avatar">
                  {{ studentInitials(record) }}
                </div>

                <div class="student-details">
                  <h3>
                    {{ record.student_name }}
                  </h3>

                  <p>
                    <IonIcon
                      :icon="businessOutline"
                    />

                    {{ record.company_name }}
                  </p>
                </div>
              </div>

              <span
                class="status-pill"
                :class="
                  record.accomplishment_uploaded
                    ? 'submitted'
                    : 'missing'
                "
              >
                <IonIcon
                  :icon="
                    record.accomplishment_uploaded
                      ? checkmarkCircleOutline
                      : alertCircleOutline
                  "
                />

                {{
                  record.accomplishment_uploaded
                    ? 'Submitted'
                    : 'Missing'
                }}
              </span>
            </div>

            <!-- DATE -->
            <div class="report-date">
              <IonIcon
                :icon="calendarOutline"
              />

              {{
                formatDate(
                  record.attendance_date
                )
              }}
            </div>

            <!-- ATTENDANCE INFORMATION -->
            <div class="attendance-grid">
              <!-- TIME IN -->
              <div class="attendance-tile">
                <IonIcon
                  :icon="logInOutline"
                />

                <span>Time In</span>

                <strong>
                  {{ formatTime(record.time_in) }}
                </strong>
              </div>

              <!-- TIME OUT -->
              <div class="attendance-tile">
                <IonIcon
                  :icon="logOutOutline"
                />

                <span>Time Out</span>

                <strong>
                  {{ formatTime(record.time_out) }}
                </strong>
              </div>

              <!-- HOURS -->
              <div class="attendance-tile">
                <IonIcon
                  :icon="timeOutline"
                />

                <span>Hours Worked</span>

                <strong>
                  {{ formatHours(record) }}
                </strong>
              </div>
            </div>

            <!-- REPORT PHOTO SECTION -->
            <div class="report-bottom">
              <div class="report-file-info">
                <IonIcon
                  :icon="
                    record.accomplishment_uploaded
                      ? imageOutline
                      : documentTextOutline
                  "
                />

                <div>
                  <strong>
                    {{
                      record.accomplishment_uploaded
                        ? 'Report photo available'
                        : 'Awaiting accomplishment'
                    }}
                  </strong>

                  <p>
                    {{
                      record.accomplishment_uploaded
                        ? formatDateTime(
                            record.accomplishment_uploaded_at
                          )
                        : 'No photo submitted yet.'
                    }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="preview-button"
                :disabled="
                  !record.accomplishment_uploaded
                "
                @click="openPhoto(record)"
              >
                <IonIcon :icon="eyeOutline" />

                View Report
              </button>
            </div>
          </article>
        </section>

        <!-- PAGINATION -->
        <div
          v-if="
            !loading &&
            !error &&
            pagination.total > 0
          "
          class="pagination"
        >
          <button
            type="button"
            :disabled="
              pagination.page <= 1
            "
            @click="
              changePage(
                pagination.page - 1
              )
            "
          >
            <IonIcon
              :icon="chevronBackOutline"
            />

            Previous
          </button>

          <span>
            Page {{ pagination.page }}
            of {{ pagination.total_pages }}
          </span>

          <button
            type="button"
            :disabled="
              pagination.page >=
              pagination.total_pages
            "
            @click="
              changePage(
                pagination.page + 1
              )
            "
          >
            Next

            <IonIcon
              :icon="chevronForwardOutline"
            />
          </button>
        </div>

      </main>
    </IonContent>

    <!-- WEEKLY-STYLE DAILY REPORT DETAILS -->
    <IonModal
      :is-open="selectedRecord !== null"
      class="daily-weekly-modal"
      :backdrop-dismiss="!reviewSaving"
      @didDismiss="closePreview"
    >
      <div v-if="selectedRecord" class="weekly-modal-shell">
        <header class="weekly-modal-header">
          <span class="weekly-avatar">{{ studentInitials(selectedRecord) }}</span>
          <div class="weekly-modal-title">
            <h2>{{ selectedRecord.student_name }}</h2>
            <p>{{ selectedRecord.company_name }}</p>
          </div>
          <button type="button" class="weekly-modal-close" aria-label="Close report"
            :disabled="reviewSaving" @click="closePreview"><IonIcon :icon="closeOutline" /></button>
        </header>

        <div class="weekly-modal-scroll">
          <div class="weekly-meta">
            <div><span>Date</span><strong>{{ formatDate(selectedRecord.attendance_date) }}</strong></div>
            <div><span>Time in</span><strong>{{ formatTime(selectedRecord.time_in) }}</strong></div>
            <div><span>Time out</span><strong>{{ formatTime(selectedRecord.time_out) }}</strong></div>
            <div><span>Status</span><strong class="weekly-status" :class="dailyReviewStatus(selectedRecord).toLowerCase()">
              {{ dailyReviewStatus(selectedRecord) === 'PENDING' ? 'To review' : dailyReviewStatus(selectedRecord) }}
            </strong></div>
          </div>
          <h3 class="weekly-block-title"><IonIcon :icon="timeOutline" /> Hours worked</h3>
          <div class="weekly-report-text">{{ formatHours(selectedRecord) }}</div>
          <h3 class="weekly-block-title"><IonIcon :icon="documentTextOutline" /> What the student accomplished</h3>
          <div class="weekly-report-text">{{ previewText || selectedRecord.accomplishment_text || 'No description provided.' }}</div>
          <h3 class="weekly-block-title"><IonIcon :icon="imageOutline" /> Daily accomplishment photos</h3>
          <div v-if="previewLoading" class="weekly-photo-note"><IonSpinner name="crescent" /> Loading photos…</div>
          <div v-else-if="previewError" class="weekly-photo-note" role="alert">
            {{ previewError }} <button type="button" @click="openPhoto(selectedRecord)">Retry</button>
          </div>
          <div v-else-if="previewPhotos.length" class="weekly-photo-grid">
            <a v-for="(photo, index) in previewPhotos" :key="index" :href="photo" target="_blank"
              rel="noopener noreferrer" :aria-label="`View daily accomplishment photo ${index + 1}`">
              <img :src="photo" :alt="`Daily accomplishment photo ${index + 1}`" loading="lazy" />
            </a>
          </div>
          <p v-else class="weekly-photo-note">No photos available.</p>

          <template v-if="dailyReviewStatus(selectedRecord) !== 'PENDING'">
            <h3 class="weekly-block-title"><IonIcon :icon="clipboardOutline" /> Supervisor comment</h3>
            <div class="weekly-report-text weekly-comment">{{ selectedRecord.supervisor_comment || 'No comment was added.' }}</div>
          </template>
          <template v-else>
            <label class="weekly-block-title" for="daily-comment"><IonIcon :icon="clipboardOutline" /> Your comment</label>
            <textarea id="daily-comment" v-model="reviewComment" rows="4" maxlength="2000"
              :disabled="reviewSaving"
              placeholder="Optional when approving. Required when rejecting: tell the student what to fix." />
            <p class="weekly-hint">{{ reviewComment.length }} / 2000</p>
          </template>
          <div v-if="reviewError" class="weekly-error" role="alert">{{ reviewError }}</div>
        </div>

        <footer class="weekly-modal-footer">
          <template v-if="dailyReviewStatus(selectedRecord) === 'PENDING'">
            <template v-if="!reviewDecision">
              <button type="button" class="weekly-btn danger-soft" :disabled="reviewSaving"
                @click="requestDailyReview('REJECTED')"><IonIcon :icon="alertCircleOutline" /> Reject</button>
              <button type="button" class="weekly-btn primary" :disabled="reviewSaving"
                @click="requestDailyReview('APPROVED')"><IonIcon :icon="checkmarkCircleOutline" /> Approve</button>
            </template>
            <div v-else class="weekly-confirm" role="alertdialog" aria-live="assertive">
              <p>{{ reviewDecision === 'APPROVED' ? 'Approve this daily report?' : 'Reject this daily report? The student will see your comment.' }}</p>
              <div>
                <button type="button" class="weekly-btn ghost" :disabled="reviewSaving" @click="reviewDecision = null">Cancel</button>
                <button type="button" class="weekly-btn" :class="reviewDecision === 'APPROVED' ? 'primary' : 'danger'"
                  :disabled="reviewSaving" @click="saveDailyReview">
                  {{ reviewSaving ? 'Saving…' : reviewDecision === 'APPROVED' ? 'Yes, approve' : 'Yes, reject' }}
                </button>
              </div>
            </div>
          </template>
          <button v-else type="button" class="weekly-btn soft" @click="closePreview">Done</button>
        </footer>
      </div>
    </IonModal>

    <!-- IMPORTANT: SUPERVISOR BOTTOM NAV -->
    <SupervisorBottomNav />

  </IonPage>
</template>

<style scoped>

/* Daily details styled to match the Supervisor Weekly Reports review modal */
.daily-weekly-modal { --width: min(640px, calc(100% - 24px)); --height: min(88vh, 780px); --border-radius: 22px; }
.weekly-modal-shell { display:flex; flex-direction:column; height:100%; background:#fff; color:#173e2e; }
.weekly-modal-header { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid #e5eee7; }
.weekly-avatar { width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border-radius:13px; background:#e3f4e8; color:#0d7b59; font-size:14px; font-weight:850; }
.weekly-modal-title { flex:1; min-width:0; }
.weekly-modal-title h2 { margin:0; font-size:18px; overflow-wrap:anywhere; font-weight:800; }
.weekly-modal-title p { margin:3px 0 0; font-size:12px; color:#82988a; overflow-wrap:anywhere; }
.weekly-modal-close { display:grid; place-items:center; width:38px; height:38px; flex-shrink:0; border:0; border-radius:11px; background:#eef6f0; color:#557b61; font-size:20px; cursor:pointer; }
.weekly-modal-scroll { flex:1; min-height:0; overflow-y:auto; padding:18px 20px; }
.weekly-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-bottom:20px; }
.weekly-meta > div { padding:11px 12px; border:1px solid #e3eee7; border-radius:12px; min-width:0; }
.weekly-meta span { display:block; margin-bottom:5px; color:#83978a; font-size:11px; }
.weekly-meta strong { color:#33503f; font-size:13px; overflow-wrap:anywhere; }
.weekly-status { display:inline-block; border-radius:20px; padding:5px 9px; background:#fff3db; color:#9b6c12!important; }
.weekly-status.approved { background:#e0f5e9; color:#08784b!important; }
.weekly-status.rejected { background:#ffe9e7; color:#ae3834!important; }
.weekly-block-title { display:flex; align-items:center; gap:7px; margin:0 0 9px; color:#173e2e; font-size:14px; font-weight:800; }
.weekly-block-title ion-icon { color:#0b7959; font-size:18px; }
.weekly-report-text { margin-bottom:20px; padding:15px 16px; border-radius:13px; background:#f7fbf8; border:1px solid #e3eee7; color:#33503f; font-size:14px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
.weekly-comment { background:#fffdf6; border-color:#efe3c4; }
.weekly-photo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(115px,1fr)); gap:10px; margin:0 0 20px; }
.weekly-photo-grid a { display:block; border-radius:12px; overflow:hidden; border:1px solid #e3eee7; aspect-ratio:1; }
.weekly-photo-grid img { display:block; width:100%; height:100%; object-fit:cover; }
.weekly-photo-note { color:#657d70; font-size:13px; margin:0 0 20px; }
.weekly-photo-note button { margin-left:8px; color:#0a8060; font-weight:700; }
.weekly-modal-scroll textarea { display:block; width:100%; box-sizing:border-box; resize:vertical; min-height:104px; padding:12px 13px; border:1px solid #d5e5da; border-radius:12px; background:#fbfdfb; color:#173e2e; font:inherit; font-size:14px; line-height:1.55; }
.weekly-modal-scroll textarea:focus { border-color:#0b7959; outline:none; box-shadow:0 0 0 3px #0b795917; }
.weekly-hint { margin:6px 0 14px; text-align:right; font-size:11px; color:#9aaca1; }
.weekly-error { margin:10px 0; padding:12px; border-radius:10px; background:#fff0ee; color:#ae3834; font-size:13px; }
.weekly-modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px)); border-top:1px solid #e5eee7; }
.weekly-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-width:130px; padding:11px 16px; border:0; border-radius:11px; font-size:13px; font-weight:800; cursor:pointer; }
.weekly-btn:disabled { opacity:.55; cursor:wait; }
.weekly-btn.primary { background:#0b7959; color:#fff; }
.weekly-btn.danger-soft { background:#fff0ee; color:#ae3834; }
.weekly-btn.danger { background:#b83d3d; color:#fff; }
.weekly-btn.ghost,.weekly-btn.soft { background:#eef6f0; color:#39674b; }
.weekly-confirm { width:100%; }
.weekly-confirm p { margin:0 0 10px; font-size:13px; font-weight:700; color:#173e2e; }
.weekly-confirm > div { display:flex; justify-content:flex-end; gap:10px; }
@media(max-width:520px) { .daily-weekly-modal { --width:100%; --height:94vh; } .weekly-modal-footer > .weekly-btn,.weekly-confirm .weekly-btn { flex:1; min-width:0; } }
@media(max-width:340px) { .weekly-meta { grid-template-columns:1fr; } }
.daily-review-toast { margin: 12px auto; max-width: 1180px; padding: 13px 18px; border-radius: 12px; background: #e4f7eb; color: #12613e; font-weight: 700; }
.daily-review-panel { margin-top: 24px; padding: 20px; background: #fff; border: 1px solid #e2ede6; border-radius: 17px; }
.daily-review-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.daily-review-heading h3 { margin: 0; font-size: 17px; font-weight: 800; color: #173e2f; }
.daily-review-badge { border-radius: 100px; padding: 7px 11px; font-size: 11px; font-weight: 800; background: #fff3db; color: #9b6c12; }
.daily-review-badge.approved { background: #e0f5e9; color: #08784b; }
.daily-review-badge.rejected { background: #ffe9e7; color: #ae3834; }
.daily-review-panel label { display: block; margin-bottom: 9px; color: #365846; font-size: 13px; font-weight: 750; }
.daily-review-panel textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 95px; padding: 13px 14px; border: 1px solid #d9e7de; border-radius: 12px; background: #f9fcfa; color: #234a35; font: inherit; font-size: 13px; line-height: 1.6; outline: none; }
.daily-review-panel textarea:focus { border-color: #16966d; }
.daily-review-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.daily-btn { border: 0; border-radius: 11px; padding: 12px 17px; font-weight: 800; font-size: 13px; cursor: pointer; }
.daily-btn:disabled { opacity: .6; cursor: wait; }
.daily-btn.approve { background: #087c58; color: #fff; }
.daily-btn.danger { background: #c64040; color: #fff; }
.daily-btn.danger-outline { background: #fff0ee; color: #b33e3e; }
.daily-btn.secondary { background: #eef4ef; color: #43604f; }
.daily-review-confirm { margin-top: 14px; padding: 14px; background: #f6faf7; border: 1px solid #e2ede6; border-radius: 12px; }
.daily-review-confirm p { margin: 0; color: #355744; font-size: 13px; }
.daily-review-error { color: #b33e3e; font-size: 12px; margin-top: 9px; }
.daily-reviewed-feedback { padding: 14px; border-radius: 12px; background: #f6faf7; }
.daily-reviewed-feedback span { color: #72877a; font-size: 11px; font-weight: 700; }
.daily-reviewed-feedback p { color: #254936; margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.daily-reviewed-feedback small { color: #82958a; }
@media (max-width: 520px) { .daily-review-panel { padding: 14px; } .daily-review-actions { flex-direction: column-reverse; } .daily-review-actions .daily-btn { width: 100%; } }
/* Daily report details: same clean review style as Weekly Reports */
.daily-report-details { width: 100%; min-width: 0; padding: 20px; box-sizing: border-box; }
.daily-meta { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; margin-bottom: 22px; }
.daily-meta > div { padding: 12px 14px; border: 1px solid #e3eee7; border-radius: 12px; background: #fff; min-width: 0; }
.daily-meta span { display: block; margin-bottom: 6px; color: #82958a; font-size: 11px; font-weight: 600; }
.daily-meta strong { color: #244c39; font-size: 13px; overflow-wrap: anywhere; }
.daily-block-title { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: #193e31; font-size: 14px; font-weight: 800; }
.daily-block-title ion-icon { color: #0b8060; font-size: 18px; }
.daily-description { margin-bottom: 22px; padding: 15px 16px; border: 1px solid #e3eee7; border-radius: 13px; background: #f7fbf8; color: #33503f; font-size: 14px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.daily-photo-count { margin-left: auto; border-radius: 20px; background: #e8f6ed; color: #0b8260; padding: 4px 9px; font-size: 11px; }
.daily-photo-gallery { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.daily-photo-gallery a { display: flex; flex-direction: column; min-width: 0; padding: 7px; gap: 8px; border: 1px solid #e3eee7; border-radius: 14px; background: #fff; text-decoration: none; overflow: hidden; }
.daily-photo-gallery a:hover { border-color: #9bd2b6; }
.daily-photo-gallery img { display: block; width: 100%; height: 180px; object-fit: contain; border-radius: 9px; background: #f2f7f3; }
.daily-photo-gallery a span { color: #527461; font-size: 11px; font-weight: 700; padding: 0 5px 5px; }
@media(max-width: 520px) { .daily-report-details { padding: 14px; } .daily-meta { gap: 7px; } .daily-meta > div { padding: 10px; } .daily-photo-gallery { grid-template-columns: 1fr; } .daily-photo-gallery img { height: 220px; } }
/* =====================================
   PAGE
===================================== */

.accomplishment-content {
  --background: radial-gradient(circle at 95% 0%, #ddf1e8, transparent 38%), #f2f8f5;
}

.accomplishment-container {
  max-width: 1180px;
  margin: 0 auto;

  padding:
    32px 22px
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

  gap: 20px;
  margin-bottom: 28px;
}

.header-text {
  min-width: 0;
}

.eyebrow {
  color: #0a9872;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.page-header h1 {
  margin: 10px 0;

  font-size: clamp(26px, 4vw, 38px);
  font-weight: 850;
  letter-spacing: -1.2px;
  line-height: 1.2;

  color: #153e30;
}

.page-header h1 span {
  color: #16a576;
}

.page-header p {
  margin: 0;

  max-width: 600px;

  color: #81958a;
  font-size: 13px;
  line-height: 1.7;
}

.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;

  gap: 8px;
  flex-shrink: 0;

  padding: 12px 17px;

  border-radius: 12px;
  border: 1px solid #dcebe2;

  background: white;
  color: #0c795c;

  font-size: 12px;
  font-weight: 800;

  cursor: pointer;
}

.refresh-button ion-icon {
  font-size: 17px;
}

/* =====================================
   STATISTICS
===================================== */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;

  margin-bottom: 26px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;

  min-width: 0;
  padding: 19px;

  background: white;

  border: 1px solid #e2ece5;
  border-radius: 20px;

  box-shadow:
    0 5px 20px rgba(10, 80, 50, 0.035);
}

.stat-icon {
  display: grid;
  place-items: center;

  width: 39px;
  height: 39px;

  margin-bottom: 4px;

  border-radius: 12px;
  font-size: 21px;
}

.stat-icon.neutral {
  background: #e5f3eb;
  color: #0b7c5e;
}

.stat-icon.success {
  background: #ddf7e9;
  color: #0a9569;
}

.stat-icon.warning {
  background: #fff0d9;
  color: #c38a29;
}

.stat-icon.complete {
  background: #e8eefb;
  color: #5474b2;
}

.stat-card > span {
  color: #81968a;
  font-size: 12px;
  font-weight: 600;
}

.stat-card strong {
  color: #183f31;
  font-size: 29px;
  line-height: 1.1;
}

.stat-card small {
  color: #9ba9a1;
  font-size: 10px;
}

/* =====================================
   FILTER PANEL
===================================== */

.filter-panel {
  padding: 21px;
  margin-bottom: 22px;

  background: white;
  border: 1px solid #e2ece5;
  border-radius: 20px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;
  margin-bottom: 21px;
}

.section-heading h2 {
  margin: 0 0 6px;

  color: #193e31;
  font-size: 18px;
}

.section-heading p {
  margin: 0;

  color: #81958a;
  font-size: 12px;
  line-height: 1.6;
}

.records-count {
  flex-shrink: 0;

  padding: 8px 12px;

  border-radius: 30px;

  background: #e8f6ed;
  color: #0b8260;

  font-size: 11px;
  font-weight: 800;
}

/* =====================================
   FILTER FORM
===================================== */

.filter-grid {
  display: grid;
  grid-template-columns:
    minmax(190px, 1.4fr)
    minmax(140px, 1fr)
    minmax(160px, 1fr)
    auto;

  gap: 12px;
  align-items: end;
}

.filter-field {
  display: flex;
  flex-direction: column;

  gap: 9px;
  min-width: 0;
}

.filter-field > span {
  color: #677e70;
  font-size: 11px;
  font-weight: 750;
}

.input-wrap {
  position: relative;

  display: flex;
  align-items: center;
}

.input-wrap ion-icon {
  position: absolute;
  left: 12px;

  font-size: 17px;
  color: #9bad9f;

  pointer-events: none;
}

.input-wrap input,
.filter-field select {
  width: 100%;
  min-width: 0;
  height: 44px;

  box-sizing: border-box;

  border: 1px solid #dce9df;
  border-radius: 11px;

  background: #f9fbf9;
  color: #264b39;

  outline: none;
  font: inherit;
  font-size: 12px;
}

.input-wrap input {
  padding: 0 12px 0 38px;
}

.filter-field select {
  padding: 0 12px;
}

.input-wrap input:focus,
.filter-field select:focus {
  border-color: #17a77b;
}

.filter-actions {
  display: flex;
  gap: 7px;
}

.search-button,
.clear-button {
  min-height: 44px;
  padding: 0 15px;

  border: 0;
  border-radius: 11px;

  font-size: 12px;
  font-weight: 800;

  cursor: pointer;
}

.search-button {
  background: #0a8060;
  color: white;
}

.clear-button {
  background: #edf4ef;
  color: #39745b;
}

/* =====================================
   REPORTS GRID
===================================== */

.reports-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 17px;
}

.report-card {
  min-width: 0;
  padding: 20px;

  background: white;
  border: 1px solid #e0ebe3;
  border-radius: 20px;

  box-shadow:
    0 6px 22px rgba(10, 80, 50, 0.035);
}

/* =====================================
   STUDENT INFORMATION
===================================== */

.report-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 10px;
}

.student-info {
  display: flex;
  align-items: center;

  gap: 11px;
  min-width: 0;
}

.student-details {
  min-width: 0;
}

.student-avatar {
  display: grid;
  place-items: center;

  width: 45px;
  height: 45px;

  flex-shrink: 0;

  border-radius: 14px;

  background: #e3f4e8;
  color: #0d7b59;

  font-size: 14px;
  font-weight: 850;
}

.student-details h3 {
  margin: 0 0 6px;

  color: #173f30;
  font-size: 14px;
  font-weight: 850;

  overflow-wrap: anywhere;
}

.student-details p {
  display: flex;
  align-items: center;

  gap: 5px;
  margin: 0;

  color: #8b9e90;
  font-size: 11px;

  overflow-wrap: anywhere;
}

.student-details p ion-icon {
  flex-shrink: 0;
}

/* =====================================
   REPORT STATUS
===================================== */

.status-pill {
  display: inline-flex;
  align-items: center;

  gap: 5px;
  padding: 8px 10px;

  border-radius: 30px;

  font-size: 10px;
  font-weight: 800;

  white-space: nowrap;
}

.status-pill.submitted {
  color: #0a8c5d;
  background: #e2f7e8;
}

.status-pill.missing {
  color: #ae802d;
  background: #fff2dc;
}

.report-date {
  display: flex;
  align-items: center;
  gap: 7px;

  margin: 20px 0 13px;

  color: #718a78;
  font-size: 11px;
  font-weight: 750;
}

.report-date ion-icon {
  font-size: 15px;
}

/* =====================================
   ATTENDANCE DETAILS
===================================== */

.attendance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 9px;
  margin-bottom: 18px;
}

.attendance-tile {
  display: flex;
  flex-direction: column;

  gap: 8px;
  min-width: 0;
  padding: 13px 10px;

  border-radius: 12px;
  background: #f5f9f6;
}

.attendance-tile ion-icon {
  font-size: 17px;
  color: #128b66;
}

.attendance-tile span {
  color: #82988a;
  font-size: 10px;
}

.attendance-tile strong {
  color: #244d39;
  font-size: 12px;

  overflow-wrap: anywhere;
}

/* =====================================
   REPORT BOTTOM
===================================== */

.report-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;
  padding-top: 15px;

  border-top: 1px solid #edf2ee;
}

.report-file-info {
  display: flex;
  align-items: center;

  gap: 10px;
  min-width: 0;
}

.report-file-info > ion-icon {
  flex-shrink: 0;

  color: #19966f;
  font-size: 22px;
}

.report-file-info strong {
  display: block;

  margin-bottom: 5px;

  color: #28523b;
  font-size: 11px;
}

.report-file-info p {
  margin: 0;

  color: #8c9d91;
  font-size: 10px;
  line-height: 1.5;
}

.preview-button {
  display: flex;
  align-items: center;
  justify-content: center;

  gap: 6px;
  flex-shrink: 0;

  padding: 11px 13px;

  border: 0;
  border-radius: 11px;

  background: #e5f5ec;
  color: #0a805e;

  font-size: 11px;
  font-weight: 800;

  cursor: pointer;
}

.preview-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* =====================================
   PAGINATION
===================================== */

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;

  gap: 20px;
  margin-top: 27px;
}

.pagination button {
  display: flex;
  align-items: center;

  gap: 5px;
  padding: 10px 15px;

  border: 1px solid #dce9e0;
  border-radius: 10px;

  background: white;
  color: #0c7859;

  font-size: 12px;
  font-weight: 800;

  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination span {
  color: #74877b;
  font-size: 12px;
}

/* =====================================
   ERROR MESSAGE
===================================== */

.error-message {
  display: flex;
  align-items: center;

  gap: 10px;
  margin-bottom: 18px;
  padding: 15px;

  border: 1px solid #f5d0cc;
  border-radius: 12px;

  background: #fff0ee;
  color: #b44742;

  font-size: 12px;
}

.error-message > ion-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.error-message button {
  margin-left: auto;

  padding: 8px 12px;

  border: 0;
  border-radius: 9px;

  background: white;
  color: #b44742;

  font-size: 11px;
  font-weight: 800;

  cursor: pointer;
}

/* =====================================
   EMPTY AND LOADING STATES
===================================== */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  padding: 70px 22px;

  border: 1px solid #e2ece5;
  border-radius: 20px;

  background: white;

  text-align: center;
}

.empty-state > ion-spinner {
  width: 32px;
  height: 32px;
  color: #0c9169;
}

.empty-icon {
  font-size: 42px;
  color: #9db6a6;
}

.empty-state h3 {
  margin: 16px 0 8px;

  color: #254a37;
  font-size: 17px;
}

.empty-state p {
  max-width: 300px;

  color: #83978a;
  font-size: 12px;
  line-height: 1.7;
}

/* =====================================
   PHOTO PREVIEW OVERLAY
===================================== */

.preview-overlay {
  position: fixed;
  inset: 0;

  z-index: 9000;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;
  box-sizing: border-box;

  background: rgba(8, 32, 20, 0.72);
}

.preview-modal {
  display: flex;
  flex-direction: column;

  width: 100%;
  max-width: 640px;
  max-height: 88vh;

  overflow: hidden;

  border-radius: 22px;
  background: white;
}

/* =====================================
   PHOTO PREVIEW HEADER
===================================== */

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 15px;
  padding: 21px;

  border-bottom: 1px solid #edf1ed;
}

.preview-header span {
  color: #0d946b;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1px;
}

.preview-header h2 {
  margin: 7px 0;

  color: #173d2e;
  font-size: 19px;
}

.preview-header p {
  margin: 0;

  color: #84988a;
  font-size: 12px;
}

.close-preview {
  display: grid;
  place-items: center;

  width: 36px;
  height: 36px;

  border: 0;
  border-radius: 11px;

  background: #f1f6f2;
  color: #315f46;

  cursor: pointer;
}

.close-preview ion-icon {
  font-size: 21px;
}

/* =====================================
   PHOTO PREVIEW BODY
===================================== */

.preview-body {
  display: flex;
  align-items: stretch;
  justify-content: flex-start;

  min-height: 240px;

  overflow-y: auto;

  background: #ffffff;
}

.preview-loading {
  padding: 50px;

  color: #648573;
  text-align: center;
}

.preview-loading ion-icon {
  font-size: 28px;
}

.preview-loading p {
  font-size: 12px;
  line-height: 1.6;
}

.report-full-image {
  display: block;

  width: auto;
  height: auto;

  max-width: 100%;
  max-height: 65vh;

  object-fit: contain;
}

/* =====================================
   PHOTO PREVIEW FOOTER
===================================== */

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 15px;
  padding: 15px 21px;
}

.preview-footer > span {
  display: flex;
  align-items: center;

  gap: 7px;

  color: #728a79;
  font-size: 12px;
}

.preview-footer button {
  padding: 10px 20px;

  border: 0;
  border-radius: 10px;

  background: #0b7959;
  color: white;

  cursor: pointer;
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
   TABLET
===================================== */

@media (max-width: 950px) {
  .stats-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .filter-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

/* =====================================
   MOBILE
===================================== */

@media (max-width: 680px) {
  .accomplishment-container {
    padding:
      20px 14px
      calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .page-header {
    align-items: flex-start;
  }

  .page-header h1 {
    font-size: 27px;
  }

  .refresh-button {
    padding: 12px;
  }

  .refresh-button ion-icon {
    font-size: 20px;
  }

  .stats-grid {
    gap: 10px;
  }

  .stat-card {
    padding: 15px;
  }

  .filter-grid,
  .reports-grid {
    grid-template-columns: 1fr;
  }

  .report-card {
    padding: 15px;
  }

  .report-top,
  .report-bottom {
    flex-wrap: wrap;
  }

  .preview-button {
    width: 100%;
  }

  .pagination {
    gap: 9px;
  }

  .pagination button {
    padding: 10px;
  }

  .preview-overlay {
    padding: 10px;
  }

  .preview-modal {
    max-height: 94vh;
  }

  .preview-footer {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
