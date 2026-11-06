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
  documentTextOutline,
  swapVerticalOutline,
  trendingUpOutline,
  pulseOutline,
  hourglassOutline,
  closeOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import SupervisorBottomNav from './SupervisorBottomNav.vue';
import {
  supervisorRequest,
  errorMessage,
  fullName,
  initials,
  avatarTone,
  formatDate,
  hoursNumber,
  attendanceLabel,
  attendanceTone,
  type SupervisedStudent,
} from './supervisorApi';

type Filter = 'ALL' | 'ON_DUTY' | 'REVIEW' | 'NOT_IN';
type Sort = 'NAME' | 'PROGRESS_DESC' | 'PROGRESS_ASC';

const router = useRouter();

const students = ref<SupervisedStudent[]>([]);
const loaded = ref(false);
const loading = ref(false);
const error = ref('');
const search = ref('');
const filter = ref<Filter>('ALL');
const sort = ref<Sort>('NAME');

const filters = computed(() => [
  { key: 'ALL' as const, label: 'All', count: students.value.length },
  { key: 'ON_DUTY' as const, label: 'On duty', count: students.value.filter((s) => s.today_status === 'ON_DUTY').length },
  { key: 'REVIEW' as const, label: 'Has reports', count: students.value.filter((s) => s.pending_reports > 0).length },
  { key: 'NOT_IN' as const, label: 'Not in today', count: students.value.filter((s) => s.today_status === 'NO_RECORD').length },
]);

// Quick numbers for the strip above the cards.
const overview = computed(() => {
  const list = students.value;
  const avg = list.length
    ? Math.round(list.reduce((sum, s) => sum + (Number(s.progress_percent) || 0), 0) / list.length)
    : 0;
  return [
    { label: 'Average progress', value: `${avg}%`, icon: trendingUpOutline, tone: 'green' },
    { label: 'On duty now', value: String(filters.value[1].count), icon: pulseOutline, tone: 'blue' },
    { label: 'Reports to review', value: String(list.reduce((sum, s) => sum + (s.pending_reports || 0), 0)), icon: documentTextOutline, tone: 'amber' },
    { label: 'Hours rendered', value: hoursNumber(list.reduce((sum, s) => sum + (Number(s.hours_rendered) || 0), 0)), icon: hourglassOutline, tone: 'mint' },
  ];
});

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  let list = students.value.filter((s) => {
    if (filter.value === 'ON_DUTY' && s.today_status !== 'ON_DUTY') return false;
    if (filter.value === 'REVIEW' && !s.pending_reports) return false;
    if (filter.value === 'NOT_IN' && s.today_status !== 'NO_RECORD') return false;
    if (!query) return true;
    return [fullName(s), s.email, s.company_name]
      .some((v) => String(v || '').toLowerCase().includes(query));
  });

  list = [...list].sort((a, b) => {
    if (sort.value === 'PROGRESS_DESC') return b.progress_percent - a.progress_percent;
    if (sort.value === 'PROGRESS_ASC') return a.progress_percent - b.progress_percent;
    return fullName(a).localeCompare(fullName(b));
  });
  return list;
});

const isFiltering = computed(() => filter.value !== 'ALL' || search.value.trim() !== '');

function clearFilters() {
  filter.value = 'ALL';
  search.value = '';
}

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
            <span class="sv-eyebrow">Your interns</span>
            <h1>My <em>students.</em></h1>
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

        <!-- QUICK NUMBERS -->
        <section v-if="students.length" class="overview" aria-label="Overview">
          <div
            v-for="(item, i) in overview"
            :key="item.label"
            class="overview-item sv-rise"
            :class="item.tone"
            :style="{ '--i': i }"
          >
            <span class="overview-icon"><IonIcon :icon="item.icon" /></span>
            <span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.label }}</small>
            </span>
          </div>
        </section>

        <!-- TOOLBAR -->
        <div v-if="students.length" class="toolbar">
          <div class="sv-chips" role="tablist" aria-label="Filter students">
            <button
              v-for="item in filters"
              :key="item.key"
              type="button"
              role="tab"
              class="sv-chip"
              :class="{ 'is-active': filter === item.key }"
              :aria-selected="filter === item.key"
              @click="filter = item.key"
            >
              {{ item.label }} <b>{{ item.count }}</b>
            </button>
          </div>

          <div class="toolbar-right">
            <label class="sv-search search">
              <IonIcon :icon="searchOutline" />
              <input v-model="search" type="search" placeholder="Search name, email or company" aria-label="Search students" />
            </label>
            <label class="sort">
              <IonIcon :icon="swapVerticalOutline" />
              <select v-model="sort" aria-label="Sort students">
                <option value="NAME">Name A–Z</option>
                <option value="PROGRESS_DESC">Most progress</option>
                <option value="PROGRESS_ASC">Least progress</option>
              </select>
            </label>
          </div>
        </div>

        <div v-if="loading && !loaded" class="grid">
          <div v-for="i in 4" :key="i" class="sv-skeleton skeleton-card"></div>
        </div>

        <section v-else-if="loaded && !students.length" class="sv-card sv-rise">
          <div class="sv-empty">
            <IonIcon :icon="personAddOutline" />
            <h3>No students assigned to you yet</h3>
            <p>Your OJT coordinator assigns students to you after approving their workplace.</p>
          </div>
        </section>

        <section v-else-if="loaded && !visible.length" class="sv-card sv-rise">
          <div class="sv-empty">
            <IonIcon :icon="searchOutline" />
            <h3>No matching students</h3>
            <p>Try a different name, or clear the filters.</p>
            <button v-if="isFiltering" type="button" class="sv-link clear" @click="clearFilters">
              <IonIcon :icon="closeOutline" /> Clear filters
            </button>
          </div>
        </section>

        <TransitionGroup v-else tag="ul" name="cards" class="grid">
          <li v-for="(student, i) in visible" :key="student.id" class="sv-rise" :style="{ '--i': Math.min(i, 8) }">
            <button
              type="button"
              class="student-card sv-lift"
              @click="router.push(`/supervisor/students/${student.id}`)"
            >
              <span class="card-top">
                <span class="sv-avatar" :class="avatarTone(student.id)">{{ initials(student) }}</span>
                <span class="who">
                  <span class="sv-name">{{ fullName(student) }}</span>
                  <span class="sv-sub">{{ student.company_name || 'No company yet' }}</span>
                </span>
                <span
                  class="sv-ring"
                  :style="{ '--p': student.progress_percent }"
                  :aria-label="`${student.progress_percent}% complete`"
                >
                  <b>{{ student.progress_percent }}%</b>
                </span>
              </span>

              <span class="hours">
                <span class="hours-line">
                  <strong>{{ hoursNumber(student.hours_rendered) }}</strong>
                  <span>of {{ student.required_hours || '—' }} hours</span>
                  <em>{{ hoursNumber(student.remaining_hours) }}h left</em>
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
        </TransitionGroup>
      </main>
    </IonContent>

    <SupervisorBottomNav />
  </IonPage>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
/* ---------- quick numbers ---------- */
.overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.overview-item {
  --accent: #09865d;
  --pale: #e0f7ec;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--sv-line);
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--sv-shadow);
}

.overview-item.blue { --accent: #3f7fb0; --pale: #e5f1f8; }
.overview-item.amber { --accent: #b98228; --pale: #fff4db; }
.overview-item.mint { --accent: #167e71; --pale: #e1f4ee; }

.overview-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--pale);
  color: var(--accent);
  font-size: 19px;
}

.overview-item strong {
  display: block;
  color: var(--sv-ink);
  font-size: 22px;
  letter-spacing: -0.6px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.overview-item small {
  display: block;
  color: var(--sv-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- toolbar ---------- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar .sv-chips {
  min-width: 0;
}

.toolbar-right {
  display: flex;
  gap: 10px;
  flex: 1 1 360px;
  justify-content: flex-end;
}

.search {
  flex: 1;
  max-width: 340px;
}

.sort {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 46px;
  padding: 0 10px 0 12px;
  border: 1px solid #d8e7de;
  border-radius: 13px;
  background: #fbfdfb;
  color: var(--sv-muted);
}

.sort select {
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--sv-ink);
  font-size: 13px;
  font-weight: 700;
}

.clear {
  margin-top: 8px;
}

/* ---------- cards ---------- */
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.skeleton-card {
  height: 190px;
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
  box-shadow: var(--sv-shadow);
  text-align: left;
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

.sv-ring b {
  font-size: 11px;
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
  font-size: 26px;
  letter-spacing: -0.8px;
}

.hours-line em {
  margin-left: auto;
  font-style: normal;
  color: var(--sv-primary);
  font-size: 12px;
  font-weight: 800;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px dashed #e3eee7;
}

.reports-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 99px;
  background: var(--sv-waiting-soft);
  color: var(--sv-waiting);
  font-size: 11px;
  font-weight: 800;
}

.last-seen {
  color: #9aaca1;
  font-size: 12px;
}

/* filter animation */
.cards-enter-active,
.cards-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cards-enter-from,
.cards-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (max-width: 960px) {
  .overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-right {
    justify-content: stretch;
  }

  .search {
    max-width: none;
  }
}

@media (max-width: 400px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .overview {
    gap: 9px;
  }

  .overview-item {
    padding: 12px;
  }
}
</style>
