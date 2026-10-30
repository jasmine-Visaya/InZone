<script setup lang="ts">
// =====================================
// SUPERVISOR: MY STUDENTS
// API: GET /api/supervisor/students
// =====================================
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  refreshOutline,
  alertCircleOutline,
  searchOutline,
  personAddOutline,
  chevronForwardOutline,
  documentTextOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  formatDate,
  hoursNumber,
  attendanceLabel,
  attendanceTone,
  type SupervisedStudent,
} from './supervisorApi';

const router = useRouter();

const students = ref<SupervisedStudent[]>([]);
const loaded = ref(false);
const loading = ref(false);
const error = ref('');
const search = ref('');

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return students.value;
  return students.value.filter((s) =>
    [fullName(s), s.email, s.company_name]
      .some((v) => String(v || '').toLowerCase().includes(query))
  );
});

async function loadStudents() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  try {
    const data = await supervisorRequest<{ students: SupervisedStudent[] }>('/api/supervisor/students');
    students.value = Array.isArray(data.students) ? data.students : [];
    loaded.value = true;
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load your students.');
  } finally {
    loading.value = false;
  }
}

onIonViewWillEnter(() => {
  void loadStudents();
});
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="sv-content">
      <InZoneTopbar role="SUPERVISOR" />

      <main class="sv-shell">
        <header class="sv-heading">
          <div>
            <h1>My students</h1>
            <p>OJT students assigned to you, with the hours they have rendered so far.</p>
          </div>
          <button class="sv-refresh" type="button" :disabled="loading" @click="loadStudents">
            <IonIcon :icon="refreshOutline" :class="{ 'sv-spin': loading }" />
            <span>{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </header>

        <div v-if="error" class="sv-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <span>{{ error }}</span>
          <button type="button" @click="loadStudents">Try again</button>
        </div>

        <label v-if="students.length > 3" class="sv-search search">
          <IonIcon :icon="searchOutline" />
          <input v-model="search" type="search" placeholder="Search name, email or company" aria-label="Search students" />
        </label>

        <div v-if="loading && !loaded" class="grid">
          <div v-for="n in 4" :key="n" class="sv-skeleton skeleton-card"></div>
        </div>

        <section v-else-if="loaded && !students.length" class="sv-card">
          <div class="sv-empty">
            <IonIcon :icon="personAddOutline" />
            <h3>No students assigned to you yet</h3>
            <p>Your OJT coordinator assigns students to you after approving their workplace.</p>
          </div>
        </section>

        <section v-else-if="loaded && !filtered.length" class="sv-card">
          <div class="sv-empty">
            <IonIcon :icon="searchOutline" />
            <h3>No matching students</h3>
            <p>Try a different name, email or company.</p>
          </div>
        </section>

        <ul v-else class="grid">
          <li v-for="student in filtered" :key="student.id">
            <button
              type="button"
              class="student-card"
              @click="router.push(`/supervisor/students/${student.id}`)"
            >
              <span class="card-top">
                <span class="sv-avatar">{{ initials(student) }}</span>
                <span class="who">
                  <span class="sv-name">{{ fullName(student) }}</span>
                  <span class="sv-sub">{{ student.company_name || 'No company yet' }}</span>
                </span>
                <IonIcon :icon="chevronForwardOutline" class="arrow" />
              </span>

              <span class="hours">
                <span class="hours-line">
                  <strong>{{ hoursNumber(student.hours_rendered) }}</strong>
                  <span>of {{ student.required_hours || '—' }} hours</span>
                  <em>{{ student.progress_percent }}%</em>
                </span>
                <span class="sv-progress" aria-hidden="true">
                  <span :style="{ width: `${student.progress_percent}%` }"></span>
                </span>
              </span>

              <span class="card-foot">
                <span v-if="student.approval_status !== 'APPROVED'" class="sv-pill waiting">
                  Workplace {{ student.approval_status === 'REJECTED' ? 'rejected' : 'pending approval' }}
                </span>
                <span v-else class="sv-pill" :class="attendanceTone(student.today_status)">
                  Today: {{ attendanceLabel(student.today_status) }}
                </span>
                <span v-if="student.pending_reports" class="reports-badge">
                  <IonIcon :icon="documentTextOutline" />
                  {{ student.pending_reports }} to review
                </span>
                <span v-else class="last-seen">
                  {{ student.last_attendance_date ? `Last in ${formatDate(student.last_attendance_date, false)}` : 'No attendance yet' }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </main>
    </IonContent>

    <SupervisorBottomNav />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
.search {
  margin-bottom: 16px;
  max-width: 420px;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.skeleton-card {
  height: 180px;
  border-radius: 20px;
}

.student-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  padding: 18px;
  border: 1px solid var(--sv-line);
  border-radius: 20px;
  background: #fff;
  text-align: left;
}

.student-card:hover {
  border-color: #bfe0cc;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.who {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.arrow {
  color: #9db5a7;
  font-size: 18px;
  flex-shrink: 0;
}

.hours {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hours-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--sv-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.hours-line strong {
  color: var(--sv-ink);
  font-size: 24px;
  letter-spacing: -0.5px;
}

.hours-line em {
  margin-left: auto;
  font-style: normal;
  color: var(--sv-primary);
  font-weight: 800;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.reports-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--sv-waiting);
  font-size: 12px;
  font-weight: 800;
}

.last-seen {
  color: #9aaca1;
  font-size: 12px;
}

@media (max-width: 400px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
