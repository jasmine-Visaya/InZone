<script setup lang="ts">

import { computed, reactive, ref } from 'vue';

import { useRouter } from 'vue-router';

import {

  IonPage,

  IonContent,

  IonIcon,

  onIonViewWillEnter,

} from '@ionic/vue';

import InZoneTopbar from '@/components/InZoneTopbar.vue';

import AdminBottomNav from './AdminBottomNav.vue';
import InZoneMapViewer from '@/components/InZoneMapViewer.vue';
import AdminSupervisorAssign, { type AssignedSupervisor } from './AdminSupervisorAssign.vue';
 

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

  createOutline,

  saveOutline,

  sparklesOutline,
  gridOutline,
  listOutline,
  arrowForwardOutline,
  trendingUpOutline,
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

  supervisor_id?: string | null;
  supervisor_first_name?: string | null;
  supervisor_last_name?: string | null;
  supervisor_email?: string | null;

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

const readyRate = computed(() => summary.value.total ? Math.round(summary.value.approved / summary.value.total * 100) : 0);
const geoConfigured = computed(() => students.value.filter(hasCoordinates).length);
const partnerCompanies = computed(() => new Set(students.value.map(s => (s.company_name || '').trim().toLowerCase()).filter(Boolean)).size);
const studentPercent = (count: number) => summary.value.total ? (count / summary.value.total * 100).toFixed(1) + '%' : '0%';

const search = ref('');

const statusFilter = ref('ALL');
const viewMode = ref<'list' | 'grid'>('list');

const selectedStudent = ref<Student | null>(null);
const mapStudent = ref<Student | null>(null);

// Admin may edit student account identity only (not OJT/geofence records).
const editingStudent = ref(false);

const savingStudent = ref(false);

const editError = ref('');

const editSuccess = ref('');

// OJT profile approval is distinct from student account approval.
type OjtDecision = 'APPROVED' | 'REJECTED';

const reviewAction = ref<OjtDecision | null>(null);

const reviewReason = ref('');

const reviewError = ref('');

const reviewSuccess = ref('');

const reviewing = ref(false);

const editForm = reactive({

  first_name: '',

  last_name: '',

  email: '',

});

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
  mapStudent.value = student;
}

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

// Called after the admin saves a supervisor in the details popup.
function onSupervisorSaved(value: AssignedSupervisor) {
  const current = selectedStudent.value;
  if (!current) return;
  const updated = { ...current, ...value };
  selectedStudent.value = updated;
  students.value = students.value.map((student) =>
    String(student.id) === String(updated.id) ? updated : student
  );
}

function openDetails(student: Student) {

  selectedStudent.value = student;

  editingStudent.value = false;

  editError.value = '';

  editSuccess.value = '';

  reviewAction.value = null;

  reviewReason.value = '';

  reviewError.value = '';

  reviewSuccess.value = '';

}

function closeDetails() {

  if (savingStudent.value || reviewing.value) return;

  selectedStudent.value = null;

  editingStudent.value = false;

  editError.value = '';

  editSuccess.value = '';

  reviewAction.value = null;

  reviewReason.value = '';

  reviewError.value = '';

  reviewSuccess.value = '';

}

function beginEditStudent() {

  const student = selectedStudent.value;

  if (!student) return;

  editForm.first_name = student.first_name ?? '';

  editForm.last_name = student.last_name ?? '';

  editForm.email = student.email ?? '';

  editError.value = '';

  editSuccess.value = '';

  editingStudent.value = true;

}

function cancelEditStudent() {

  if (savingStudent.value) return;

  editingStudent.value = false;

  editError.value = '';

}

async function saveStudentDetails() {

  const student = selectedStudent.value;

  if (!student || savingStudent.value) return;

  editError.value = '';

  editSuccess.value = '';

  const first_name = editForm.first_name.trim();

  const last_name = editForm.last_name.trim();

  const email = editForm.email.trim().toLowerCase();

  if (!first_name || !last_name || !email) {

    editError.value = 'First name, last name, and email are required.';

    return;

  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

    editError.value = 'Please enter a valid email address.';

    return;

  }

  const token = sessionStorage.getItem('inzone_token');

  if (!token) {

    editError.value = 'Your session has expired. Please log in again.';

    return;

  }

  savingStudent.value = true;

  try {

    const response = await fetch(

      `${API_URL}/api/admin/students/${encodeURIComponent(String(student.id))}`,

      {

        method: 'PATCH',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({ first_name, last_name, email }),

      }

    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.student) {

      throw new Error(

        data.message || `Unable to update student (HTTP ${response.status}).`

      );

    }

    // Preserve existing OJT/geofence data; only account identity is updated.
    const updated: Student = { ...student, ...data.student };

    students.value = students.value.map((item) =>

      String(item.id) === String(student.id) ? updated : item

    );

    selectedStudent.value = updated;

    editingStudent.value = false;

    editSuccess.value = 'Student details updated successfully.';

  } catch (err) {

    editError.value = err instanceof Error ? err.message : 'Unable to save changes.';

  } finally {

    savingStudent.value = false;

  }

}

function beginOjtReview(action: OjtDecision) {

  const student = selectedStudent.value;

  if (!student || student.ojt_status !== 'PENDING' || !student.ojt_profile_id) return;

  reviewAction.value = action;

  reviewReason.value = '';

  reviewError.value = '';

  reviewSuccess.value = '';

}

function cancelOjtReview() {

  if (reviewing.value) return;

  reviewAction.value = null;

  reviewError.value = '';

  reviewReason.value = '';

}

async function submitOjtReview() {

  const student = selectedStudent.value;

  const action = reviewAction.value;

  if (!student || !action || reviewing.value || !student.ojt_profile_id ||

      student.ojt_status !== 'PENDING') return;

  reviewError.value = '';

  if (action === 'APPROVED' && !hasCoordinates(student)) {

    reviewError.value = 'Cannot approve without valid workplace geofence coordinates.';

    return;

  }

  if (action === 'REJECTED' && !reviewReason.value.trim()) {

    reviewError.value = 'Please provide a reason for rejection.';

    return;

  }

  const token = sessionStorage.getItem('inzone_token');

  if (!token) {

    reviewError.value = 'Your Admin session has expired. Please log in again.';

    return;

  }

  reviewing.value = true;

  try {

    // Existing OJT review API (same as OJTApprovals.vue).
    const response = await fetch(

      `${API_URL}/api/ojt/review/${encodeURIComponent(String(student.ojt_profile_id))}`,

      {

        method: 'PATCH',

        headers: {

          Authorization: `Bearer ${token}`,

          'Content-Type': 'application/json',

        },

        body: JSON.stringify({

          status: action,

          ...(action === 'REJECTED' ? { rejection_reason: reviewReason.value.trim() } : {}),

        }),

      }

    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {

      throw new Error(data.message || `Unable to review OJT profile (HTTP ${response.status}).`);

    }

    // The backend confirmed the update. Refresh the directory to get authoritative statuses.
    reviewSuccess.value = `${fullName(student)}'s OJT profile ${action.toLowerCase()} successfully.`;

    reviewAction.value = null;

    reviewReason.value = '';

    const updated = { ...student, approval_status: action, ojt_status: action };

    selectedStudent.value = updated;

    students.value = students.value.map(s => String(s.id) === String(student.id) ? updated : s);

    await loadStudents();

    const refreshed = students.value.find(s => String(s.id) === String(student.id));

    if (refreshed) selectedStudent.value = refreshed;

  } catch (err) {

    reviewError.value = err instanceof Error ? err.message : 'Unable to submit review.';

  } finally {

    reviewing.value = false;

  }

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

              View registered students, edit their accounts, and review

              pending OJT profiles.

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

        <section class="premium-hero" aria-label="OJT student readiness">
          <div>
            <span class="premium-eyebrow"><IonIcon :icon="sparklesOutline" /> OJT STUDENT INTELLIGENCE</span>
            <h2>From registration<br/><em>to workplace ready.</em></h2>
            <p>Manage every student's OJT journey, spot records that need attention, and inspect workplace locations directly inside InZone.</p>
            <div class="premium-actions">
              <button type="button" class="premium-action primary" @click="statusFilter='PENDING';search=''">
                <IonIcon :icon="timeOutline" /> Review pending <strong>{{ summary.pending }}</strong> <IonIcon :icon="arrowForwardOutline" />
              </button>
              <button type="button" class="premium-action" @click="statusFilter='ALL';search=''">
                <IonIcon :icon="peopleOutline" /> All students
              </button>
            </div>
          </div>
          <div class="premium-visual">
            <div class="premium-ring" :style="{background:`conic-gradient(#7df2bd 0 ${readyRate}%, #ffffff30 ${readyRate}% 100%)`}">
              <div class="premium-ring-inside"><strong>{{ loading ? '—' : `${readyRate}%` }}</strong><span>OJT approved</span></div>
            </div>
            <div class="premium-visual-bottom">
              <span><strong>{{ geoConfigured }}</strong> geofences set</span>
              <span><strong>{{ partnerCompanies }}</strong> workplaces listed</span>
            </div>
            <p class="premium-caption">Approved OJT profiles / total student accounts</p>
          </div>
        </section>
        <section class="premium-insight" aria-label="OJT readiness distribution">
          <div class="premium-insight-head"><strong>OJT readiness pipeline</strong><small>Latest submitted profile per student</small></div>
          <div class="premium-stack" aria-hidden="true">
            <span :style="{width:studentPercent(summary.approved), background:'#11a87b'}" />
            <span :style="{width:studentPercent(summary.pending), background:'#e9b552'}" />
            <span :style="{width:studentPercent(summary.rejected), background:'#e17876'}" />
            <span :style="{width:studentPercent(summary.not_submitted), background:'#afbfaf'}" />
          </div>
          <div class="premium-legend">
            <span><i style="background:#11a87b"/>Approved {{ summary.approved }}</span>
            <span><i style="background:#e9b552"/>Pending {{ summary.pending }}</span>
            <span><i style="background:#e17876"/>Rejected {{ summary.rejected }}</span>
            <span><i style="background:#afbfaf"/>Not submitted {{ summary.not_submitted }}</span>
          </div>
        </section>

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

            <span>Approved OJT Profiles</span>

            <strong>{{ loading ? '—' : summary.approved }}</strong>

            <small>Verified OJT workplaces</small>

          </article>

          <article class="summary-card">

            <div class="summary-icon amber">

              <IonIcon :icon="timeOutline" />

            </div>

            <span>Pending OJT Profiles</span>

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

                Find a student, inspect their registered workplace, and review pending OJT profiles.

              </p>

            </div>

            <span class="results-label">

              {{ filteredStudents.length }} students

            </span>

          </div>

          <div class="premium-strip" aria-label="Quick OJT status filters">
            <button type="button" class="premium-pill" :class="{active:statusFilter==='ALL'}" @click="statusFilter='ALL'">All <strong>{{ summary.total }}</strong></button>
            <button type="button" class="premium-pill" :class="{active:statusFilter==='APPROVED'}" @click="statusFilter='APPROVED'">Approved <strong>{{ summary.approved }}</strong></button>
            <button type="button" class="premium-pill" :class="{active:statusFilter==='PENDING'}" @click="statusFilter='PENDING'">Pending <strong>{{ summary.pending }}</strong></button>
            <button type="button" class="premium-pill" :class="{active:statusFilter==='REJECTED'}" @click="statusFilter='REJECTED'">Rejected <strong>{{ summary.rejected }}</strong></button>
            <button type="button" class="premium-pill" :class="{active:statusFilter==='NOT_SUBMITTED'}" @click="statusFilter='NOT_SUBMITTED'">No profile <strong>{{ summary.not_submitted }}</strong></button>
            <div class="premium-mode-controls" role="group" aria-label="Student directory layout">
              <button type="button" :class="{active:viewMode==='list'}" :aria-pressed="viewMode==='list'" aria-label="List view" @click="viewMode='list'"><IonIcon :icon="listOutline" /></button>
              <button type="button" :class="{active:viewMode==='grid'}" :aria-pressed="viewMode==='grid'" aria-label="Grid view" @click="viewMode='grid'"><IonIcon :icon="gridOutline" /></button>
            </div>
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

          <div v-else class="student-list" :class="{'premium-grid-view':viewMode==='grid'}">

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

        <!-- STUDENT DETAILS / EDIT MODAL -->

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

                <div class="modal-avatar">{{ initials(selectedStudent) }}</div>

                <div>

                  <span>STUDENT MANAGEMENT</span>

                  <h2 id="student-detail-title">

                    {{ editingStudent ? 'Edit Student' : fullName(selectedStudent) }}

                  </h2>

                  <p>{{ selectedStudent.email || 'No email' }}</p>

                </div>

              </div>

              <button

                type="button"

                class="close-button"

                aria-label="Close student details"

                :disabled="savingStudent"

                @click="closeDetails"

              >

                <IonIcon :icon="closeOutline" />

              </button>

            </div>

            <div class="modal-status-row">

              <span>OJT Profile Status (not account status)</span>

              <span

                class="status-badge"

                :class="selectedStudent.ojt_status.toLowerCase()"

              >

                {{ statusLabel(selectedStudent.ojt_status) }}

              </span>

            </div>

            <div v-if="editSuccess" class="edit-feedback edit-success" role="status">

              <IonIcon :icon="checkmarkCircleOutline" />

              <span>{{ editSuccess }}</span>

            </div>

            <!-- Only account details can be updated using the supplied API. -->

            <form v-if="editingStudent" class="edit-form" @submit.prevent="saveStudentDetails">

              <div class="edit-title">

                <IonIcon :icon="personOutline" />

                <div>

                  <h3>Update Student Information</h3>

                  <p>Changes will be saved to the student account.</p>

                </div>

              </div>

              <div class="edit-fields">

                <label class="edit-field">

                  <span>First name <b>*</b></span>

                  <input v-model="editForm.first_name" type="text" maxlength="100"

                    autocomplete="off" placeholder="First name" required :disabled="savingStudent" />

                </label>

                <label class="edit-field">

                  <span>Last name <b>*</b></span>

                  <input v-model="editForm.last_name" type="text" maxlength="100"

                    autocomplete="off" placeholder="Last name" required :disabled="savingStudent" />

                </label>

                <label class="edit-field full">

                  <span>Email address <b>*</b></span>

                  <input v-model="editForm.email" type="email" maxlength="254"

                    autocomplete="off" placeholder="student@example.com" required :disabled="savingStudent" />

                </label>

              </div>

              <div v-if="editError" class="edit-feedback edit-error" role="alert">

                <IonIcon :icon="alertCircleOutline" />

                <span>{{ editError }}</span>

              </div>

              <p class="modal-note">

                This form edits only the student's name and email. OJT profile

                approvals and geofence settings are managed separately.

              </p>

              <div class="modal-actions">

                <button type="button" class="secondary-button"

                  :disabled="savingStudent" @click="cancelEditStudent">

                  <IonIcon :icon="arrowBackOutline" /> Cancel

                </button>

                <button type="submit" class="primary-button" :disabled="savingStudent">

                  <IonIcon :icon="saveOutline" />

                  {{ savingStudent ? 'Saving changes...' : 'Save Changes' }}

                </button>

              </div>

            </form>

            <template v-else>

              <h3 class="detail-section-title">

                <IonIcon :icon="personOutline" /> Student Account

              </h3>

              <div class="details-grid">

                <div class="detail-item">

                  <span>First name</span>

                  <strong>{{ selectedStudent.first_name || 'Not set' }}</strong>

                </div>

                <div class="detail-item">

                  <span>Last name</span>

                  <strong>{{ selectedStudent.last_name || 'Not set' }}</strong>

                </div>

                <div class="detail-item full-width">

                  <span>Email address</span>

                  <strong>{{ selectedStudent.email || 'Not set' }}</strong>

                </div>

              </div>

              <h3 class="detail-section-title">

                <IonIcon :icon="businessOutline" /> OJT Company

              </h3>

              <div class="details-grid">

                <div class="detail-item">

                  <span>Company Name</span>

                  <strong>{{ selectedStudent.company_name || 'Not assigned' }}</strong>

                </div>

                <div class="detail-item">

                  <span>Required Hours</span>

                  <strong>{{ hoursLabel(selectedStudent.required_hours) }}</strong>

                </div>

                <div class="detail-item full-width">

                  <span>Company Address</span>

                  <strong>{{ selectedStudent.company_address || 'Not provided' }}</strong>

                </div>

                <div class="detail-item">

                  <span>OJT Start Date</span>

                  <strong>{{ formatDate(selectedStudent.start_date) }}</strong>

                </div>

                <div class="detail-item">

                  <span>OJT End Date</span>

                  <strong>{{ formatDate(selectedStudent.end_date) }}</strong>

                </div>

              </div>

               <h3 class="detail-section-title">
 
                <IonIcon :icon="personOutline" /> Company Supervisor
 
              </h3>
 
              <AdminSupervisorAssign
                :profile-id="selectedStudent.ojt_profile_id"
                :current-supervisor-id="selectedStudent.supervisor_id ?? null"
                :company-name="selectedStudent.company_name"
                @saved="onSupervisorSaved"
              />

              <h3 class="detail-section-title">

                <IonIcon :icon="locationOutline" /> Registered Geofence

              </h3>

              <div class="details-grid">

                <div class="detail-item">

                  <span>Latitude</span>

                  <strong>{{ coordinateLabel(selectedStudent.latitude) }}</strong>

                </div>

                <div class="detail-item">

                  <span>Longitude</span>

                  <strong>{{ coordinateLabel(selectedStudent.longitude) }}</strong>

                </div>

                <div class="detail-item full-width">

                  <span>Allowed Radius</span>

                  <strong>

                    {{ selectedStudent.radius_meters != null

                      ? `${selectedStudent.radius_meters} m`

                      : 'Not configured' }}

                  </strong>

                </div>

              </div>

              <div class="modal-actions">

                <button type="button" class="primary-button" @click="beginEditStudent">

                  <IonIcon :icon="createOutline" /> Edit Student

                </button>

                <button type="button" class="secondary-button"

                  :disabled="!hasCoordinates(selectedStudent)"

                  @click="openMap(selectedStudent)">

                  <IonIcon :icon="openOutline" /> View Workplace Map

                </button>

                <button v-if="selectedStudent.ojt_status === 'PENDING'"

                  type="button" class="primary-button" :disabled="reviewing || !hasCoordinates(selectedStudent)"

                  @click="beginOjtReview('APPROVED')">

                  <IonIcon :icon="checkmarkCircleOutline" /> Approve OJT

                </button>

                <button v-if="selectedStudent.ojt_status === 'PENDING'"

                  type="button" class="secondary-button reject-ojt-button" :disabled="reviewing"

                  @click="beginOjtReview('REJECTED')">

                  <IonIcon :icon="closeCircleOutline" /> Reject OJT

                </button>

                <button v-if="selectedStudent.ojt_status === 'PENDING'"

                  type="button" class="secondary-button" :disabled="reviewing" @click="goToApprovals">

                  <IonIcon :icon="shieldCheckmarkOutline" /> Full Review Page

                </button>

              </div>

              <div v-if="reviewSuccess" class="edit-feedback edit-success" role="status">

                <IonIcon :icon="checkmarkCircleOutline" /> {{ reviewSuccess }}

              </div>

              <form v-if="reviewAction" class="inline-review-card"

                    @submit.prevent="submitOjtReview">

                <h3>{{ reviewAction === 'APPROVED' ? 'Confirm OJT Profile Approval' : 'Reject OJT Profile' }}</h3>

                <p>

                  {{ reviewAction === 'APPROVED'

                    ? 'Verify the company and saved geofence before you approve. This decision affects attendance access.'

                    : 'Tell the student what needs to be corrected before resubmitting.' }}

                </p>

                <label v-if="reviewAction === 'REJECTED'" class="review-reason-label">

                  Rejection reason *

                  <textarea v-model="reviewReason" rows="3" maxlength="2000"

                    placeholder="Explain why the workplace profile was rejected" :disabled="reviewing" required />

                </label>

                <div v-if="reviewError" class="edit-feedback edit-error" role="alert">

                  <IonIcon :icon="alertCircleOutline" /> {{ reviewError }}

                </div>

                <div class="modal-actions">

                  <button type="button" class="secondary-button" :disabled="reviewing" @click="cancelOjtReview">Cancel</button>

                  <button type="submit" class="primary-button" :disabled="reviewing || (reviewAction === 'REJECTED' && !reviewReason.trim())">

                    {{ reviewing ? 'Submitting...' : reviewAction === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection' }}

                  </button>

                </div>

              </form>

              <p class="modal-note">

                Account approval and OJT profile approval are different processes.

                This section reviews the OJT profile; account-status approval uses the Admin account API.

              </p>

            </template>

          </section>

        </div>

      </main>

    </IonContent>

    <AdminBottomNav />
    <InZoneMapViewer
      :is-open="mapStudent !== null"
      :title="mapStudent?.company_name || 'Student Workplace Map'"
      :latitude="mapStudent?.latitude == null ? null : Number(mapStudent.latitude)"
      :longitude="mapStudent?.longitude == null ? null : Number(mapStudent.longitude)"
      :radius-meters="mapStudent?.radius_meters == null ? null : Number(mapStudent.radius_meters)"
      :address="mapStudent?.company_address || ''"
      @close="mapStudent = null"
    />

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

/* Student account editing form */

.edit-form { margin-top: 18px; }

.edit-title { display: flex; align-items: center; gap: 11px; margin: 8px 0 20px; }

.edit-title > ion-icon { font-size: 26px; color: #0b825e; }

.edit-title h3 { margin: 0 0 4px; color: #1f4b37; font-size: 16px; }

.edit-title p { margin: 0; color: #829687; font-size: 12px; line-height: 1.5; }

.edit-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }

.edit-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.edit-field.full { grid-column: 1 / -1; }

.edit-field span { font-size: 12px; color: #345743; font-weight: 750; }

.edit-field b { color: #be483e; }

.edit-field input {

  width: 100%; min-height: 46px; padding: 12px 13px; border-radius: 11px;

  background: #f9fcfa; color: #173d30; border: 1px solid #d8e8dc;

  outline: none; font-size: 13px;

}

.edit-field input:focus { border-color: #0c996a; box-shadow: 0 0 0 3px #0c996a18; }

.edit-feedback { display: flex; gap: 9px; align-items: flex-start; margin-top: 18px;

  padding: 13px 14px; border-radius: 10px; font-size: 12px; line-height: 1.5; }

.edit-feedback ion-icon { font-size: 19px; flex-shrink: 0; }

.edit-success { color: #076e4c; background: #e5f8eb; }

.edit-error { color: #a63731; background: #fff0ed; }

@media (max-width: 450px) {

  .edit-fields { grid-template-columns: 1fr; }

  .edit-field.full { grid-column: auto; }

}

/* Inline OJT approval controls in Student Management */

.reject-ojt-button { background: #fff0ed; color: #b64a41; }

.inline-review-card {

  margin-top: 18px; padding: 18px; background: #f5f9f6;

  border: 1px solid #cee7d5; border-radius: 14px;

}

.inline-review-card h3 { margin: 0 0 8px; font-size: 15px; color: #194531; }

.inline-review-card p { margin: 0 0 14px; color: #607965; font-size: 12px; line-height: 1.6; }

.review-reason-label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; font-weight: 750; color: #345743; }

.review-reason-label textarea { width: 100%; padding: 12px; resize: vertical;

  background: #fff; color: #173d30; border: 1px solid #d8e8dc; border-radius: 10px; font: inherit; }

.review-reason-label textarea:focus { outline: 2px solid #0c996a; outline-offset: 1px; }


/* PREMIUM INZONE ADMIN WORKSPACE - responsive visual layer */

/* Premium component system: visual upgrades only; existing API logic remains intact. */
.premium-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(250px,.8fr);align-items:center;gap:24px;min-height:280px;margin:0 0 21px;padding:clamp(25px,3.6vw,40px);border:1px solid #ffffff24;border-radius:26px;background:linear-gradient(116deg,#086f56 0%,#064637 63%,#092e2b 100%);color:#fff;box-shadow:0 24px 52px rgba(8,72,52,.17)}
.premium-hero:before{content:"";position:absolute;z-index:-1;inset:-70% -14% auto auto;width:440px;height:440px;border-radius:50%;border:1px solid #baffdc25;box-shadow:0 0 0 53px #ddffe609,0 0 0 105px #ddffe606;pointer-events:none}
.premium-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:850;letter-spacing:1.45px;color:#a0f6cf}.premium-eyebrow ion-icon{font-size:17px}
.premium-hero h2{color:#fff!important;margin:18px 0 12px;font-size:clamp(28px,3.6vw,43px);letter-spacing:-1.25px;line-height:1.12;font-weight:850}
.premium-hero h2 em{font-style:normal;color:#78edb4}
.premium-hero p{max-width:570px;margin:0;color:#cbe8dc;font-size:12px;line-height:1.8}
.premium-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:23px}
.premium-action{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:11px 16px;border:1px solid #ffffff45;border-radius:12px;background:#ffffff1d;color:#fff;font-size:11px;font-weight:850;cursor:pointer;transition:transform .2s,background .2s}
.premium-action.primary{background:#f3fff9;color:#086b50;border-color:#f3fff9}
.premium-action:hover{transform:translateY(-2px);background:#ffffff36}.premium-action.primary:hover{background:white}
.premium-visual{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:205px;padding:18px 20px;border:1px solid #ffffff32;border-radius:22px;background:linear-gradient(155deg,#ffffff20,#ffffff0b);backdrop-filter:blur(8px)}
.premium-ring{display:grid;place-items:center;width:156px;height:156px;padding:12px;border-radius:50%;box-shadow:0 0 36px #84ffc121;transition:background .25s}
.premium-ring-inside{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:#084c3d;text-align:center;box-shadow:inset 0 8px 22px #072e2d25}
.premium-ring strong{font-size:33px;letter-spacing:-1px;line-height:1.1;color:#fff}.premium-ring span{margin-top:4px;font-size:10px;color:#bfe9d5;font-weight:650}
.premium-visual-bottom{display:flex;justify-content:space-between;gap:16px;width:100%;font-size:11px;color:#c5e8d6}.premium-visual-bottom strong{color:white;font-size:12px}
.premium-caption{margin:0!important;font-size:10px!important;color:#bfe8d3!important;text-align:center}
.premium-strip{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0 23px}
.premium-pill{display:inline-flex;gap:8px;align-items:center;justify-content:center;min-height:36px;border:1px solid #d9eade;border-radius:100px;background:#fff;color:#658776;padding:9px 13px;font-size:11px;font-weight:800;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}
.premium-pill:hover{border-color:#9fddba;transform:translateY(-1px)}.premium-pill.active{border-color:#087957;background:#e0f6e8;color:#087957}
.premium-pill strong{display:inline-grid;place-items:center;min-width:20px;min-height:20px;padding:0 5px;border-radius:20px;background:#e8f1ec;font-size:10px}.premium-pill.active strong{background:#baf0ce}
.premium-insight{border:1px solid #dbeee2;border-radius:20px;background:#fff;box-shadow:0 13px 28px #10412d0a;padding:19px 21px;margin:0 0 24px}
.premium-insight-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}
.premium-insight-head strong{color:#194d39;font-size:13px}.premium-insight-head small{color:#7e9a89;font-size:10px}
.premium-stack{display:flex;width:100%;height:11px;overflow:hidden;border-radius:40px;background:#edf5ef}
.premium-stack>span{min-width:0;transition:width .25s;display:block;height:100%}
.premium-legend{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;color:#738e7c;font-size:10px}
.premium-legend>span{display:inline-flex;align-items:center;gap:7px}
.premium-legend i{display:inline-block;width:8px;height:8px;border-radius:50%}
.premium-grid-view{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
.premium-grid-view>article{align-items:flex-start!important;min-width:0!important;flex-wrap:wrap!important;min-height:177px!important;border-radius:17px!important;margin:0!important}
.premium-mode-controls{display:flex;gap:6px;align-items:center;border:1px solid #dcebe1;border-radius:11px;padding:4px;background:#f5faf6}
.premium-mode-controls button{border:0;cursor:pointer;display:grid;place-items:center;min-width:34px;height:32px;border-radius:8px;background:transparent;color:#779385}
.premium-mode-controls button.active{background:#fff;color:#078258;box-shadow:0 3px 9px #275c4016}
.premium-mode-controls button ion-icon{font-size:17px}
.premium-mini-label{display:inline-flex;align-items:center;gap:6px;font-weight:800;letter-spacing:1px;font-size:10px;color:#0b855e}
@media(max-width:850px){.premium-hero{grid-template-columns:1fr}.premium-visual{flex-direction:row;min-height:0}.premium-ring{width:124px;height:124px;flex-shrink:0}.premium-ring strong{font-size:27px}.premium-visual-bottom{flex:1;flex-direction:column;gap:8px}}
@media(max-width:640px){.premium-hero{padding:25px 21px;border-radius:20px}.premium-hero h2{font-size:29px}.premium-grid-view{grid-template-columns:1fr!important}.premium-visual{flex-direction:column}.premium-visual-bottom{flex-direction:row}.premium-insight{padding:16px}.premium-legend{gap:10px}.premium-actions .premium-action{flex:1}}
@media(prefers-reduced-motion:reduce){.premium-action,.premium-pill,.premium-stack>span{transition:none}}

.students-content{--background:#eff7f2}.students-container{max-width:1320px}.page-header{padding-bottom:4px}
.summary-card{position:relative;overflow:hidden;border:1px solid #dceee2!important;box-shadow:0 14px 30px #184e340b!important;transition:transform .2s}.summary-card:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#0c9b70,#80ddad)}.summary-card:hover{transform:translateY(-3px)}
.students-panel{border:1px solid #dcebe1!important;box-shadow:0 20px 50px #12412a0c!important;border-radius:23px!important}
.student-row{transition:transform .15s,box-shadow .15s!important}.student-row:hover{transform:translateY(-2px);box-shadow:0 12px 27px #14543812!important}
@media(max-width:640px){.summary-card:hover,.student-row:hover{transform:none}}

</style>
