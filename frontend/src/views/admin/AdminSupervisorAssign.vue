<script setup lang="ts">
// =====================================
// ADMIN: ASSIGN A COMPANY SUPERVISOR TO A STUDENT
// Used inside the student details popup (AdminStudents.vue).
// APIs: GET   /api/admin/users?role=SUPERVISOR&status=APPROVED
//       PATCH /api/ojt/review/:profileId/supervisor  { supervisor_id }
// =====================================
import { computed, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  personCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';

interface Supervisor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface AssignedSupervisor {
  supervisor_id: string | null;
  supervisor_first_name: string | null;
  supervisor_last_name: string | null;
  supervisor_email: string | null;
}

const props = defineProps<{
  profileId: string | number | null;
  currentSupervisorId: string | null;
  companyName?: string | null;
}>();

const emit = defineEmits<{ (event: 'saved', value: AssignedSupervisor): void }>();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const supervisors = ref<Supervisor[]>([]);
const selectedId = ref(props.currentSupervisorId || '');
const loadingList = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');

const changed = computed(() => selectedId.value !== (props.currentSupervisorId || ''));

function label(s: Supervisor): string {
  const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed';
  return s.email ? `${name} (${s.email})` : name;
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${sessionStorage.getItem('inzone_token') || ''}` };
}

async function loadSupervisors() {
  loadingList.value = true;
  error.value = '';
  try {
    const response = await fetch(
      `${API_URL}/api/admin/users?role=SUPERVISOR&status=APPROVED`,
      { headers: headers(), cache: 'no-store' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Unable to load supervisors (HTTP ${response.status}).`);
    }
    supervisors.value = Array.isArray(data.users) ? data.users : [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load supervisors.';
  } finally {
    loadingList.value = false;
  }
}

async function save() {
  if (props.profileId === null || saving.value) return;
  saving.value = true;
  error.value = '';
  success.value = '';

  try {
    const response = await fetch(
      `${API_URL}/api/ojt/review/${encodeURIComponent(String(props.profileId))}/supervisor`,
      {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisor_id: selectedId.value || null }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Unable to save (HTTP ${response.status}).`);
    }

    success.value = data.message || 'Supervisor saved.';
    emit('saved', {
      supervisor_id: data.supervisor?.id ?? null,
      supervisor_first_name: data.supervisor?.first_name ?? null,
      supervisor_last_name: data.supervisor?.last_name ?? null,
      supervisor_email: data.supervisor?.email ?? null,
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to save the supervisor.';
  } finally {
    saving.value = false;
  }
}

// Keep the dropdown in sync with the saved supervisor.
watch(
  () => props.currentSupervisorId,
  (value) => {
    selectedId.value = value || '';
  }
);

// Another student was opened: clear old messages.
watch(
  () => props.profileId,
  () => {
    error.value = '';
    success.value = '';
  }
);

onMounted(loadSupervisors);
</script>

<template>
  <div class="assign">
    <p v-if="profileId === null" class="assign-note">
      This student has not submitted an OJT profile yet. Assign a supervisor after they add their workplace.
    </p>

    <template v-else>
      <label class="assign-label" for="assign-supervisor">
        Supervisor at {{ companyName || 'the company' }}
      </label>
      <div class="assign-row">
        <div class="select-wrap">
          <IonIcon :icon="personCircleOutline" />
          <select
            id="assign-supervisor"
            v-model="selectedId"
            :disabled="loadingList || saving"
          >
            <option value="">{{ loadingList ? 'Loading supervisors…' : 'No supervisor yet' }}</option>
            <option v-for="s in supervisors" :key="s.id" :value="s.id">{{ label(s) }}</option>
          </select>
        </div>
        <button type="button" class="assign-save" :disabled="!changed || saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>

      <p v-if="!loadingList && !supervisors.length && !error" class="assign-note">
        There are no active supervisor accounts yet. In User Management, change a user's role to Supervisor first.
      </p>
      <p v-else class="assign-note">
        The supervisor sees this student's attendance and reviews their weekly reports.
      </p>
    </template>

    <p v-if="error" class="assign-msg is-error" role="alert">
      <IonIcon :icon="alertCircleOutline" /> {{ error }}
    </p>
    <p v-if="success" class="assign-msg" role="status">
      <IonIcon :icon="checkmarkCircleOutline" /> {{ success }}
    </p>
  </div>
</template>

<style scoped>
.assign {
  padding: 14px;
  border: 1px solid #e1eee5;
  border-radius: 14px;
  background: #fbfdfb;
}

.assign-label {
  display: block;
  margin-bottom: 8px;
  color: #315444;
  font-size: 12px;
  font-weight: 800;
}

.assign-row {
  display: flex;
  gap: 8px;
}

.select-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  min-height: 46px;
  border: 1px solid #d8e7de;
  border-radius: 11px;
  background: #fff;
  color: #7d988a;
}

.select-wrap ion-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.select-wrap select {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1c4637;
  font: inherit;
  font-size: 13px;
}

.select-wrap:focus-within {
  border-color: #0b8b64;
  box-shadow: 0 0 0 3px #0a9c7117;
}

.assign-save {
  flex-shrink: 0;
  min-width: 82px;
  border: 0;
  border-radius: 11px;
  background: #0b7959;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.assign-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.assign-note {
  margin: 9px 0 0;
  color: #81978b;
  font-size: 11px;
  line-height: 1.55;
}

.assign-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 9px 0 0;
  color: #176d47;
  font-size: 12px;
}

.assign-msg.is-error {
  color: #a92f2f;
}

@media (max-width: 420px) {
  .assign-row {
    flex-direction: column;
  }

  .assign-save {
    min-height: 44px;
  }
}
</style>
