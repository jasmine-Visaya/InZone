
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

import {
  peopleOutline,
  personOutline,
  businessOutline,
  locationOutline,
  searchOutline,
  refreshOutline,
  checkmarkCircleOutline,
  timeOutline,
  closeCircleOutline,
  alertCircleOutline,
  documentTextOutline,
  calendarOutline,
  eyeOutline,
  closeOutline,
  arrowBackOutline,
  mailOutline,
  shieldCheckmarkOutline,
  openOutline,
} from 'ionicons/icons';

type StudentStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'NOT_SUBMITTED';

interface Student {
  id: string | number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;

  ojt_profile_id: string | number | null;
  company_name: string | null;
  company_address: string | null;
  required_hours: number | string | null;
  start_date: string | null;
  end_date: string | null;
  approval_status: string | null;
  ojt_status: StudentStatus;

  latitude: number | string | null;
  longitude: number | string | null;
  radius_meters: number | string | null;
}

interface StudentSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  not_submitted: number;
}

const router = useRouter();

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const loading = ref(true);
const error = ref('');

const students = ref<Student[]>([]);

const summary = ref<StudentSummary>({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  not_submitted: 0,
});

const search = ref('');
const statusFilter = ref('ALL');
const selectedStudent = ref<Student | null>(null);

/* =====================================
   STUDENT HELPERS
===================================== */

function fullName(student: Student): string {
  const name = [
    student.first_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || `Student #${student.id}`;
}

function initials(student: Student): string {
  const first = student.first_name?.trim()?.[0] || '';
  const last = student.last_name?.trim()?.[0] || '';

  return `${first}${last}`.toUpperCase() || 'ST';
}

function statusLabel(status: StudentStatus): string {
  const labels: Record<StudentStatus, string> = {
    APPROVED: 'Approved',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    NOT_SUBMITTED: 'No OJT Profile',
  };

  return labels[status] || 'Unknown';
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) return datePart;

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function hoursLabel(value: number | string | null): string {
  if (value == null) return 'Not set';

  const hours = Number(value);

  return Number.isFinite(hours)
    ? `${hours.toLocaleString()} hrs`
    : 'Not set';
}

function coordinateLabel(
  value: number | string | null
): string {
  if (value == null) return 'Not available';

  const num = Number(value);

  return Number.isFinite(num)
    ? num.toFixed(6)
    : 'Not available';
}

function hasCoordinates(student: Student): boolean {
  if (
    student.latitude == null ||
    student.longitude == null
  ) {
    return false;
  }

  const lat = Number(student.latitude);
  const lon = Number(student.longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function openMap(student: Student) {
  if (!hasCoordinates(student)) return;

  const lat = Number(student.latitude);
  const lon = Number(student.longitude);

  window.open(
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
    '_blank',
    'noopener,noreferrer'
  );
}

/* =====================================
   STUDENT FILTERING
===================================== */

const filteredStudents = computed(() => {
  const query = search.value.trim().toLowerCase();

  return students.value.filter((student) => {
    const matchesStatus =
      statusFilter.value === 'ALL' ||
      student.ojt_status === statusFilter.value;

    const searchable = [
      fullName(student),
      student.email || '',
      student.company_name || '',
      student.company_address || '',
      String(student.id),
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch =
      !query || searchable.includes(query);

    return matchesStatus && matchesSearch;
  });
});

/* =====================================
   LOAD STUDENTS
===================================== */

async function loadStudents() {
  const token = sessionStorage.getItem('inzone_token');

  loading.value = true;
  error.value = '';

  if (!token) {
    error.value = 'Please log in as Admin.';
    loading.value = false;
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/admin/students`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        `Unable to load students (HTTP ${response.status}).`
      );
    }

    if (!Array.isArray(data.students)) {
      throw new Error('Invalid students response.');
    }

    students.value = data.students;

    summary.value = data.summary ?? {
      total: data.students.length,
      approved: data.students.filter(
        (s: Student) => s.ojt_status === 'APPROVED'
      ).length,
      pending: data.students.filter(
        (s: Student) => s.ojt_status === 'PENDING'
      ).length,
      rejected: data.students.filter(
        (s: Student) => s.ojt_status === 'REJECTED'
      ).length,
      not_submitted: data.students.filter(
        (s: Student) => s.ojt_status === 'NOT_SUBMITTED'
      ).length,
    };
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to load students.';
  } finally {
    loading.value = false;
  }
}

/* =====================================
   DETAILS
===================================== */

function openDetails(student: Student) {
  selectedStudent.value = student;
}

function closeDetails() {
  selectedStudent.value = null;
}

function goToApprovals() {
  closeDetails();
  void router.push('/admin/ojt-approvals');
}

onIonViewWillEnter(() => {
  void loadStudents();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="students-content"> 
        <InZoneTopbar role="ADMIN" />
      <main class="students-container">

        <!-- PAGE HEADER -->
        <header class="page-header">
          <div>

            <h1>Student Management<span>.</span></h1>

            <p>
              View registered students and monitor
              their OJT profile status.
            </p>
          </div>

          <button
            type="button"
            class="refresh-button"
            :disabled="loading"
            @click="loadStudents"
          >
            <IonIcon
              :icon="refreshOutline"
              :class="{ spinning: loading }"
            />
            Refresh
          </button>
        </header>

        <!-- SUMMARY -->
        <section class="summary-grid">
          <article class="summary-card">
            <div class="summary-icon green">
              <IonIcon :icon="peopleOutline" />
            </div>
            <span>Total Students</span>
            <strong>{{ loading ? '—' : summary.total }}</strong>
            <small>Registered student accounts</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon blue">
              <IonIcon :icon="checkmarkCircleOutline" />
            </div>
            <span>Approved</span>
            <strong>{{ loading ? '—' : summary.approved }}</strong>
            <small>Verified OJT workplaces</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon amber">
              <IonIcon :icon="timeOutline" />
            </div>
            <span>Pending</span>
            <strong>{{ loading ? '—' : summary.pending }}</strong>
            <small>Awaiting profile review</small>
          </article>

          <article class="summary-card">
            <div class="summary-icon rose">
              <IonIcon :icon="alertCircleOutline" />
            </div>
            <span>Needs Attention</span>
            <strong>
              {{
                loading
                  ? '—'
                  : summary.rejected + summary.not_submitted
              }}
            </strong>
            <small>Rejected or no OJT profile</small>
          </article>
        </section>

        <!-- ERROR -->
        <div v-if="error" class="error-banner" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
        </div>

        <!-- STUDENT LIST -->
        <section class="students-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">STUDENT DIRECTORY</span>
              <h2>All Students</h2>
              <p>
                Find a student and inspect their registered
                OJT company.
              </p>
            </div>

            <span class="results-label">
              {{ filteredStudents.length }} students
            </span>
          </div>

          <!-- SEARCH AND FILTER -->
          <div class="toolbar">
            <label class="search-box">
              <IonIcon :icon="searchOutline" />

              <input
                v-model="search"
                type="search"
                placeholder="Search student, email, company..."
                aria-label="Search students"
              />
            </label>

            <select
              v-model="statusFilter"
              class="filter-select"
              aria-label="Filter students by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="NOT_SUBMITTED">
                No OJT Profile
              </option>
            </select>
          </div>

          <!-- LOADING -->
          <div v-if="loading" class="empty-state">
            <IonIcon
              :icon="refreshOutline"
              class="spinning"
            />
            <h3>Loading students...</h3>
            <p>Retrieving student information from InZone.</p>
          </div>

          <!-- EMPTY -->
          <div
            v-else-if="filteredStudents.length === 0"
            class="empty-state"
          >
            <IonIcon :icon="peopleOutline" />

            <h3>
              {{
                students.length === 0
                  ? 'No Students Registered'
                  : 'No Matching Students'
              }}
            </h3>

            <p>
              {{
                students.length === 0
                  ? 'Student accounts will appear here when registered.'
                  : 'Try a different search or status filter.'
              }}
            </p>
          </div>

          <!-- STUDENT CARDS -->
          <div v-else class="student-list">
            <article
              v-for="student in filteredStudents"
              :key="student.id"
              class="student-row"
            >
              <div class="student-avatar">
                {{ initials(student) }}
              </div>

              <div class="student-main">
                <h3>{{ fullName(student) }}</h3>

                <p class="student-email">
                  <IonIcon :icon="mailOutline" />
                  {{ student.email || 'No email registered' }}
                </p>

                <p class="student-company">
                  <IonIcon :icon="businessOutline" />
                  {{
                    student.company_name ||
                    'No OJT company assigned'
                  }}
                </p>
              </div>

              <div class="student-status">
                <span
                  class="status-badge"
                  :class="student.ojt_status.toLowerCase()"
                >
                  <IonIcon
                    :icon="
                      student.ojt_status === 'APPROVED'
                        ? checkmarkCircleOutline
                        : student.ojt_status === 'PENDING'
                          ? timeOutline
                          : student.ojt_status === 'REJECTED'
                            ? closeCircleOutline
                            : alertCircleOutline
                    "
                  />
                  {{ statusLabel(student.ojt_status) }}
                </span>
              </div>

              <button
                type="button"
                class="details-button"
                @click="openDetails(student)"
              >
                <IonIcon :icon="eyeOutline" />
                View Details
              </button>
            </article>
          </div>
        </section>

        <!-- STUDENT DETAILS MODAL -->
        <div
          v-if="selectedStudent"
          class="modal-overlay"
          @click.self="closeDetails"
        >
          <section
            class="student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-detail-title"
          >
            <div class="modal-header">
              <div class="modal-person">
                <div class="modal-avatar">
                  {{ initials(selectedStudent) }}
                </div>

                <div>
                  <span>STUDENT DETAILS</span>

                  <h2 id="student-detail-title">
                    {{ fullName(selectedStudent) }}
                  </h2>

                  <p>
                    {{ selectedStudent.email || 'No email' }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="close-button"
                aria-label="Close student details"
                @click="closeDetails"
              >
                <IonIcon :icon="closeOutline" />
              </button>
            </div>

            <div class="modal-status-row">
              <span>OJT Profile Status</span>

              <span
                class="status-badge"
                :class="selectedStudent.ojt_status.toLowerCase()"
              >
                {{ statusLabel(selectedStudent.ojt_status) }}
              </span>
            </div>

            <h3 class="detail-section-title">
              <IonIcon :icon="businessOutline" />
              OJT Company
            </h3>

            <div class="details-grid">
              <div class="detail-item">
                <span>Company Name</span>
                <strong>
                  {{
                    selectedStudent.company_name ||
                    'Not assigned'
                  }}
                </strong>
              </div>

              <div class="detail-item">
                <span>Required Hours</span>
                <strong>
                  {{ hoursLabel(selectedStudent.required_hours) }}
                </strong>
              </div>

              <div class="detail-item full-width">
                <span>Company Address</span>
                <strong>
                  {{
                    selectedStudent.company_address ||
                    'Not provided'
                  }}
                </strong>
              </div>

              <div class="detail-item">
                <span>OJT Start Date</span>
                <strong>
                  {{ formatDate(selectedStudent.start_date) }}
                </strong>
              </div>

              <div class="detail-item">
                <span>OJT End Date</span>
                <strong>
                  {{ formatDate(selectedStudent.end_date) }}
                </strong>
              </div>
            </div>

            <h3 class="detail-section-title">
              <IonIcon :icon="locationOutline" />
              Registered Geofence
            </h3>

            <div class="details-grid">
              <div class="detail-item">
                <span>Latitude</span>
                <strong>
                  {{ coordinateLabel(selectedStudent.latitude) }}
                </strong>
              </div>

              <div class="detail-item">
                <span>Longitude</span>
                <strong>
                  {{ coordinateLabel(selectedStudent.longitude) }}
                </strong>
              </div>

              <div class="detail-item full-width">
                <span>Allowed Radius</span>
                <strong>
                  {{
                    selectedStudent.radius_meters != null
                      ? `${selectedStudent.radius_meters} m`
                      : 'Not configured'
                  }}
                </strong>
              </div>
            </div>

            <div class="modal-actions">
              <button
                type="button"
                class="secondary-button"
                :disabled="!hasCoordinates(selectedStudent)"
                @click="openMap(selectedStudent)"
              >
                <IonIcon :icon="openOutline" />
                View Workplace Map
              </button>

              <button
                v-if="selectedStudent.ojt_status === 'PENDING'"
                type="button"
                class="primary-button"
                @click="goToApprovals"
              >
                <IonIcon :icon="shieldCheckmarkOutline" />
                Review Profile
              </button>
            </div>

            <p class="modal-note">
              This page is read-only. Profile approvals
              are handled in the Approvals section.
            </p>
          </section>
        </div>

      </main>
    </IonContent>

    <AdminBottomNav />
  </IonPage>
</template>

<style scoped>
.students-content {
  --background: #f2f8f4;
  --color: #183d30;
}

.students-container {
  max-width: 1190px;
  margin: 0 auto;
  padding: 16px clamp(16px, 4vw, 46px)
    calc(145px + env(safe-area-inset-bottom, 0px));
}

button,
input,
select {
  font-family: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* HEADER */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 21px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0b8560;
  font-size: 12px;
  font-weight: 750;
}

.eyebrow,
.section-label {
  color: #0c986c;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.4px;
}

.page-header h1 {
  font-size: clamp(30px, 4vw, 43px);
  color: #133e30;
  margin: 12px 0 7px;
  font-weight: 850;
  letter-spacing: -1.2px;
  line-height: 1.15;
}

.page-header h1 span {
  color: #16a576;
}

.page-header p {
  color: #788f81;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 17px;
  background: #ffffff;
  border: 1px solid #d6e8dc;
  border-radius: 12px;
  color: #087b59;
  font-size: 12px;
  font-weight: 800;
}

/* SUMMARY */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 23px;
}

.summary-card {
  padding: 19px;
  background: #ffffff;
  border: 1px solid #dfebe3;
  border-radius: 17px;
  box-shadow: 0 7px 23px #164f3509;
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 12px;
  font-size: 22px;
}

.summary-icon.green {
  background: #e4f7ea;
  color: #0b825d;
}

.summary-icon.blue {
  background: #e8f2fc;
  color: #2b76a8;
}

.summary-icon.amber {
  background: #fff3db;
  color: #ad7b25;
}

.summary-icon.rose {
  background: #ffeae8;
  color: #ba5148;
}

.summary-card > span {
  display: block;
  font-size: 11px;
  font-weight: 750;
  color: #809687;
  margin: 15px 0 7px;
}

.summary-card > strong {
  display: block;
  font-size: 28px;
  font-weight: 850;
  color: #18432f;
}

.summary-card small {
  display: block;
  color: #9baa9d;
  font-size: 10px;
  margin-top: 7px;
}

/* PANEL */

.students-panel {
  padding: 23px;
  background: #ffffff;
  border: 1px solid #dfeae3;
  border-radius: 20px;
  box-shadow: 0 7px 23px #164f3509;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.panel-heading h2 {
  color: #183f30;
  font-size: 21px;
  margin: 7px 0;
}

.panel-heading p {
  color: #879b8b;
  font-size: 12px;
  margin: 0;
}

.results-label {
  padding: 9px 12px;
  color: #0a7f5e;
  background: #e7f6ec;
  border-radius: 30px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

/* SEARCH */

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 21px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 11px;
  flex: 1;
  min-width: 0;
  padding: 0 14px;
  background: #f7fbf8;
  border: 1px solid #d8e8dc;
  border-radius: 12px;
  color: #0b8762;
}

.search-box input {
  flex: 1;
  width: 100%;
  min-height: 45px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #204733;
  font-size: 12px;
}

.filter-select {
  min-width: 155px;
  padding: 12px;
  border: 1px solid #d8e8dc;
  border-radius: 12px;
  outline-color: #0b8762;
  color: #28513c;
  background: #ffffff;
  font-size: 12px;
}

/* STUDENT LIST */

.student-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 17px;
  background: #f9fcfa;
  border: 1px solid #e4eee7;
  border-radius: 14px;
}

.student-avatar,
.modal-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 49px;
  height: 49px;
  border-radius: 15px;
  background: #dff3e8;
  color: #0c7d59;
  font-size: 16px;
  font-weight: 850;
}

.student-main {
  flex: 1;
  min-width: 0;
}

.student-main h3 {
  margin: 0 0 7px;
  color: #1a4933;
  font-size: 15px;
}

.student-main p {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #85988b;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}

.student-main p ion-icon {
  flex-shrink: 0;
  color: #0b9870;
}

.student-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  border-radius: 30px;
  padding: 8px 11px;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.status-badge.approved {
  background: #dcf6e6;
  color: #087b53;
}

.status-badge.pending {
  background: #fff1d9;
  color: #a77524;
}

.status-badge.rejected {
  background: #ffe9e6;
  color: #b64a41;
}

.status-badge.not_submitted {
  background: #edf0ee;
  color: #76897c;
}

.details-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-shrink: 0;
  padding: 11px 14px;
  background: #e4f5eb;
  color: #087957;
  border: 0;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 800;
}

/* ERROR & EMPTY */

.error-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 17px;
  padding: 14px;
  border-radius: 12px;
  background: #fff0ec;
  color: #b1473e;
  font-size: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 44px 16px;
  color: #8a9e90;
}

.empty-state > ion-icon {
  font-size: 38px;
  color: #8bb99b;
}

.empty-state h3 {
  margin: 14px 0 8px;
  color: #345c42;
  font-size: 15px;
}

.empty-state p {
  font-size: 12px;
  line-height: 1.6;
}

/* MODAL */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #112c2288;
}

.student-modal {
  width: min(100%, 570px);
  max-height: 88vh;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 21px;
  padding: 24px;
  box-shadow: 0 24px 65px #123b2929;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.modal-person {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-person span {
  color: #0b956c;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1px;
}

.modal-person h2 {
  margin: 6px 0;
  color: #194531;
  font-size: 20px;
}

.modal-person p {
  margin: 0;
  color: #82988a;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.close-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 35px;
  height: 35px;
  background: #edf3ef;
  border: 0;
  border-radius: 9px;
  color: #587661;
  font-size: 20px;
}

.modal-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px;
  margin: 23px 0;
  border-radius: 12px;
  background: #f5f9f6;
  color: #7c9383;
  font-size: 12px;
}

.detail-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 24px 0 13px;
  color: #1f4b37;
  font-size: 15px;
}

.detail-section-title ion-icon {
  color: #0b825e;
  font-size: 19px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
}

.detail-item {
  padding: 13px;
  border-radius: 10px;
  background: #f5f9f6;
  min-width: 0;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item span {
  display: block;
  margin-bottom: 7px;
  font-size: 10px;
  color: #829687;
}

.detail-item strong {
  color: #25523c;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  min-height: 44px;
  padding: 12px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.primary-button {
  background: #0b7959;
  color: #ffffff;
}

.secondary-button {
  background: #e6f5eb;
  color: #0b7959;
}

.modal-note {
  color: #8da194;
  font-size: 11px;
  line-height: 1.6;
  margin: 19px 0 0;
}

/* RESPONSIVE */

@media (max-width: 850px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .student-row {
    flex-wrap: wrap;
  }

  .student-status {
    margin-left: auto;
  }
}

@media (max-width: 600px) {
  .students-container {
    padding-left: 15px;
    padding-right: 15px;
  }

  .page-header {
    align-items: flex-start;
  }

  .refresh-button {
    padding: 12px;
    font-size: 0;
  }

  .refresh-button ion-icon {
    font-size: 21px;
  }

  .students-panel {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
  }

  .filter-select {
    width: 100%;
  }

  .student-row {
    gap: 11px;
    padding: 13px;
  }

  .student-avatar {
    width: 42px;
    height: 42px;
  }

  .student-main h3 {
    font-size: 13px;
  }

  .student-status {
    margin-left: 0;
  }

  .details-button {
    width: 100%;
  }

  .student-modal {
    padding: 20px 16px;
  }

  .modal-person h2 {
    font-size: 16px;
  }

  .modal-actions {
    flex-direction: column;
  }
}

@media (max-width: 370px) {
  .summary-grid {
    gap: 9px;
  }

  .summary-card {
    padding: 13px;
  }

  .summary-card > strong {
    font-size: 23px;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-item.full-width {
    grid-column: auto;
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
