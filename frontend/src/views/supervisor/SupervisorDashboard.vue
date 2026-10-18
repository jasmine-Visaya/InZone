
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  logOutOutline,
  documentTextOutline,
  checkmarkDoneOutline,
  shieldCheckmarkOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  alertCircleOutline,
  timeOutline,
} from 'ionicons/icons';

const router = useRouter();

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface WeeklyReport {
  id: string | number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  week_start: string;
  week_end: string;
  report: string;
  status: string;
  created_at: string;
}

const user = ref<{
  first_name?: string;
  last_name?: string;
  role?: string;
} | null>(null);

const name = computed(() => user.value?.first_name || 'Supervisor');

const reports = ref<WeeklyReport[]>([]);
const loading = ref(false);
const refreshing = ref(false);
const error = ref('');
const successMessage = ref('');
const reviewingId = ref<string | number | null>(null);
const comments = ref<Record<string, string>>({});

function getToken(): string {
  return sessionStorage.getItem('inzone_token') || '';
}

async function loadPendingReports(isRefresh = false) {
  if (isRefresh) {
    refreshing.value = true;
  } else {
    loading.value = true;
  }

  error.value = '';
  successMessage.value = '';

  try {
    const token = getToken();

    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const response = await fetch(
      `${API_URL}/api/supervisor/reports/pending`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.removeItem('inzone_token');
      sessionStorage.removeItem('inzone_user');
      router.replace('/');
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || `Unable to load reports (${response.status}).`
      );
    }

    reports.value = Array.isArray(data.reports) ? data.reports : [];
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Something went wrong while loading reports.';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

async function reviewReport(
  report: WeeklyReport,
  status: 'APPROVED' | 'REJECTED'
) {
  const comment = (comments.value[String(report.id)] || '').trim();

  if (status === 'REJECTED' && !comment) {
    error.value = 'Please provide a comment explaining why the report was rejected.';
    successMessage.value = '';
    return;
  }

  const action = status === 'APPROVED' ? 'approve' : 'reject';

  if (!window.confirm(`Are you sure you want to ${action} this report?`)) {
    return;
  }

  reviewingId.value = report.id;
  error.value = '';
  successMessage.value = '';

  try {
    const token = getToken();

    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const response = await fetch(
      `${API_URL}/api/supervisor/reports/${report.id}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          supervisor_comment: comment,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.removeItem('inzone_token');
      sessionStorage.removeItem('inzone_user');
      router.replace('/');
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || `Unable to ${action} this report.`
      );
    }

    successMessage.value =
      data.message || `Report ${status.toLowerCase()} successfully.`;

    delete comments.value[String(report.id)];

    // Remove the reviewed report from the pending list.
    reports.value = reports.value.filter(
      item => String(item.id) !== String(report.id)
    );
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Something went wrong while reviewing the report.';
  } finally {
    reviewingId.value = null;
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  router.replace('/');
}

onMounted(() => {
  try {
    const saved = sessionStorage.getItem('inzone_user');
    const parsed = saved ? JSON.parse(saved) : null;

    if (
      !parsed ||
      String(parsed.role).toUpperCase() !== 'SUPERVISOR'
    ) {
      router.replace('/');
      return;
    }

    user.value = parsed;
    loadPendingReports();
  } catch {
    router.replace('/');
  }
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="dashboard-content">
      <div class="layout">
        <header class="header">
          <div class="brand">
            <span class="logo">
              <IonIcon :icon="locationOutline" />
            </span>
            <span>
              InZone<span class="dot">.</span>
              <small>Supervisor</small>
            </span>
          </div>

          <button class="logout" type="button" @click="logout">
            <IonIcon :icon="logOutOutline" />
            Log out
          </button>
        </header>

        <main class="main">
          <div class="heading">
            <span class="eyebrow">
              <IonIcon :icon="shieldCheckmarkOutline" />
              SUPERVISOR WORKSPACE
            </span>

            <h1>Welcome, {{ name }}!</h1>
            <p>Review weekly accomplishments submitted by OJT students.</p>
          </div>

          <section class="intro-card">
            <div>
              <span class="preview">SUPERVISOR DASHBOARD</span>
              <h2>Weekly report review</h2>
              <p>
                Check each student's weekly accomplishments, then approve
                the report or reject it with a comment explaining what
                needs to be improved.
              </p>
            </div>

            <span class="intro-icon">
              <IonIcon :icon="checkmarkDoneOutline" />
            </span>
          </section>

          <section class="reports-section">
            <div class="section-heading">
              <div>
                <h3>Pending Reports</h3>
                <p>Reports waiting for your review.</p>
              </div>

              <button
                class="refresh-button"
                type="button"
                :disabled="loading || refreshing"
                @click="loadPendingReports(true)"
              >
                <IonIcon :icon="refreshOutline" />
                {{ refreshing ? 'Refreshing...' : 'Refresh' }}
              </button>
            </div>

            <div v-if="error" class="message error-message" role="alert">
              <IonIcon :icon="alertCircleOutline" />
              {{ error }}
            </div>

            <div
              v-if="successMessage"
              class="message success-message"
              role="status"
            >
              <IonIcon :icon="checkmarkCircleOutline" />
              {{ successMessage }}
            </div>

            <div v-if="loading" class="empty-state">
              Loading pending reports...
            </div>

            <div
              v-else-if="!error && reports.length === 0"
              class="empty-state"
            >
              <IonIcon :icon="documentTextOutline" />
              <h4>No pending reports</h4>
              <p>New student submissions will appear here.</p>
            </div>

            <article
              v-for="report in reports"
              :key="report.id"
              class="report-card"
            >
              <div class="report-top">
                <div class="student-info">
                  <span class="student-icon">
                    <IonIcon :icon="documentTextOutline" />
                  </span>

                  <div>
                    <h4>
                      {{ report.first_name }} {{ report.last_name }}
                    </h4>
                    <p>{{ report.email }}</p>
                  </div>
                </div>

                <span class="pending-label">
                  <IonIcon :icon="timeOutline" />
                  Pending
                </span>
              </div>

              <div class="report-dates">
                <div>
                  <span>WEEK START</span>
                  <strong>{{ formatDate(report.week_start) }}</strong>
                </div>
                <div>
                  <span>WEEK END</span>
                  <strong>{{ formatDate(report.week_end) }}</strong>
                </div>
                <div>
                  <span>SUBMITTED</span>
                  <strong>{{ formatDate(report.created_at) }}</strong>
                </div>
              </div>

              <div class="report-body">
                <h5>Weekly accomplishments</h5>
                <p>{{ report.report || 'No report text provided.' }}</p>
              </div>

              <div class="review-field">
                <label :for="`comment-${report.id}`">
                  Supervisor comment
                  <span>(required when rejecting)</span>
                </label>

                <textarea
                  :id="`comment-${report.id}`"
                  v-model="comments[String(report.id)]"
                  placeholder="Write feedback or explain what needs to be improved..."
                  rows="3"
                  :disabled="reviewingId === report.id"
                />
              </div>

              <div class="report-actions">
                <button
                  class="reject-button"
                  type="button"
                  :disabled="reviewingId !== null"
                  @click="reviewReport(report, 'REJECTED')"
                >
                  <IonIcon :icon="closeCircleOutline" />
                  {{ reviewingId === report.id ? 'Processing...' : 'Reject' }}
                </button>

                <button
                  class="approve-button"
                  type="button"
                  :disabled="reviewingId !== null"
                  @click="reviewReport(report, 'APPROVED')"
                >
                  <IonIcon :icon="checkmarkCircleOutline" />
                  {{ reviewingId === report.id ? 'Processing...' : 'Approve' }}
                </button>
              </div>
            </article>
          </section>

          <p class="note">
            Attendance review and student monitoring will be added separately.
          </p>
        </main>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.dashboard-content {
  --background: #f1f7f3;
  --color: #163d32;
}

.layout {
  min-height: 100%;
  background: #f1f7f3;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px max(24px, calc((100vw - 1100px) / 2));
  background: #fff;
  border-bottom: 1px solid #e0ebe4;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 23px;
  font-weight: 850;
  letter-spacing: -.8px;
  color: #0c5c45;
}

.logo {
  width: 37px;
  height: 37px;
  background: #0b795b;
  color: white;
  display: grid;
  place-items: center;
  border-radius: 11px;
  font-size: 22px;
}

.dot {
  color: #2ab280;
}

.brand small {
  display: block;
  font-size: 10px;
  letter-spacing: .6px;
  color: #80958b;
  font-weight: 700;
}

.logout,
.refresh-button {
  background: #eef7f1;
  color: #0b7054;
  border: 1px solid #d5e9dc;
  padding: 11px 14px;
  border-radius: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.logout ion-icon,
.refresh-button ion-icon {
  font-size: 17px;
}

button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 38px 24px 70px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #0b8b64;
  font-size: 11px;
  letter-spacing: 1px;
  font-weight: 800;
}

.eyebrow ion-icon {
  font-size: 17px;
}

h1 {
  color: #153e32;
  font-size: clamp(30px, 4vw, 43px);
  letter-spacing: -1.3px;
  margin: 12px 0 6px;
}

.heading > p,
.section-heading p {
  margin: 0;
  color: #788f82;
  font-size: 14px;
}

.intro-card {
  background: linear-gradient(125deg, #076a50, #064b43);
  border-radius: 22px;
  margin: 34px 0 35px;
  padding: 32px 36px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.preview {
  font-size: 10px;
  color: #a6f0ce;
  letter-spacing: 1.5px;
  font-weight: 800;
}

.intro-card h2 {
  margin: 12px 0;
  font-size: 25px;
  letter-spacing: -.6px;
}

.intro-card p {
  max-width: 650px;
  line-height: 1.7;
  color: #cbeadd;
  font-size: 13px;
  margin: 0;
}

.intro-icon {
  display: grid;
  place-items: center;
  background: #ffffff20;
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 23px;
  font-size: 44px;
  color: #b1ffda;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

h3 {
  font-size: 21px;
  color: #153e32;
  margin: 0 0 7px;
}

.empty-state {
  text-align: center;
  background: white;
  border: 1px solid #dceae1;
  border-radius: 18px;
  padding: 38px 20px;
  color: #748b7f;
}

.empty-state > ion-icon {
  font-size: 36px;
  color: #0b8b64;
}

.empty-state h4 {
  color: #1c4637;
  margin-bottom: 8px;
}

.empty-state p {
  margin-bottom: 0;
  font-size: 13px;
}

.report-card {
  padding: 24px;
  margin-bottom: 18px;
  background: white;
  border: 1px solid #dceae1;
  border-radius: 18px;
  box-shadow: 0 9px 25px #164b3710;
}

.report-top,
.student-info,
.report-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.student-info {
  justify-content: flex-start;
}

.student-icon {
  width: 45px;
  height: 45px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #e4f6eb;
  color: #0a8a63;
  font-size: 22px;
}

.student-info h4 {
  color: #1c4637;
  margin: 0 0 5px;
  font-size: 16px;
}

.student-info p {
  color: #748b7f;
  margin: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.pending-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  background: #fff5df;
  color: #926315;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 800;
}

.report-dates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 18px 0;
  margin-top: 18px;
  border-top: 1px solid #edf2ee;
  border-bottom: 1px solid #edf2ee;
}

.report-dates div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.report-dates span {
  color: #84978c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .6px;
}

.report-dates strong {
  color: #315444;
  font-size: 12px;
}

.report-body {
  padding: 18px 0;
}

.report-body h5 {
  margin: 0 0 9px;
  color: #1c4637;
  font-size: 14px;
}

.report-body p {
  margin: 0;
  color: #526c5f;
  line-height: 1.7;
  font-size: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.review-field label {
  display: block;
  color: #315444;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 8px;
}

.review-field label span {
  color: #84978c;
  font-weight: 500;
}

.review-field textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid #d5e5da;
  border-radius: 10px;
  padding: 12px;
  font: inherit;
  font-size: 13px;
  color: #1c4637;
  background: #fbfdfb;
}

.review-field textarea:focus {
  outline: 2px solid #9bd9b9;
  border-color: #0b8b64;
}

.report-actions {
  justify-content: flex-end;
  margin-top: 16px;
}

.approve-button,
.reject-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 10px;
  padding: 11px 15px;
  font-weight: 800;
  cursor: pointer;
}

.approve-button {
  background: #0b795b;
  color: white;
}

.reject-button {
  background: #fff0ef;
  color: #b63838;
  border: 1px solid #f3d5d2;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 13px 15px;
  border-radius: 11px;
  margin: 15px 0;
  font-size: 13px;
  line-height: 1.5;
}

.error-message {
  background: #fff0ef;
  color: #a92f2f;
  border: 1px solid #f3d5d2;
}

.success-message {
  background: #e9f8ef;
  color: #176d47;
  border: 1px solid #ccebd8;
}

.note {
  margin-top: 24px;
  color: #899d92;
  font-size: 12px;
}

@media (max-width: 740px) {
  .header {
    padding: 16px 20px;
  }

  .main {
    padding: 30px 20px 55px;
  }

  .intro-card {
    padding: 26px 22px;
  }

  .intro-icon {
    display: none;
  }

  .report-dates {
    grid-template-columns: 1fr;
  }

  .report-top {
    align-items: flex-start;
  }

  .report-card {
    padding: 18px;
  }

  .student-info {
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .brand {
    font-size: 20px;
  }

  .logout {
    padding: 9px 10px;
  }

  .section-heading {
    align-items: flex-start;
  }

  .report-actions button {
    flex: 1;
  }
}
</style>
