<script setup lang="ts">
// =====================================
// OVERTIME REVIEW
// Shows a student's overtime for one day and lets the supervisor
// approve or reject it. Only approved overtime counts toward the
// student's required hours.
// =====================================
import { computed, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { checkmarkOutline, closeOutline, timeOutline } from 'ionicons/icons';
import {
  type Id,
  type OvertimeStatus,
  supervisorRequest,
  errorMessage,
  formatHours,
} from './supervisorApi';

const props = defineProps<{
  attendanceId: Id;
  overtimeHours: number;
  status: OvertimeStatus;
  comment?: string | null;
}>();

const emit = defineEmits<{
  (e: 'updated', value: { status: OvertimeStatus; comment: string | null }): void;
}>();

const currentStatus = ref<OvertimeStatus>(props.status);
const currentComment = ref<string | null>(props.comment ?? null);
const editing = ref(false);
const note = ref('');
const saving = ref(false);
const error = ref('');

watch(
  () => [props.status, props.comment] as const,
  ([status, comment]) => {
    currentStatus.value = status;
    currentComment.value = comment ?? null;
  }
);

const showActions = computed(() => currentStatus.value === 'PENDING' || editing.value);

const label = computed(() => {
  switch (currentStatus.value) {
    case 'APPROVED':
      return 'Approved, counted';
    case 'REJECTED':
      return 'Rejected, not counted';
    default:
      return 'Waiting for your approval';
  }
});

async function decide(decision: 'APPROVED' | 'REJECTED') {
  if (saving.value) return;
  saving.value = true;
  error.value = '';

  try {
    const result = await supervisorRequest<{
      attendance: { overtime_status: OvertimeStatus; overtime_comment: string | null };
    }>(`/api/supervisor/attendance/${encodeURIComponent(String(props.attendanceId))}/overtime`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, comment: note.value.trim() }),
    });

    currentStatus.value = result.attendance.overtime_status;
    currentComment.value = result.attendance.overtime_comment;
    editing.value = false;
    note.value = '';
    emit('updated', { status: currentStatus.value, comment: currentComment.value });
  } catch (err) {
    error.value = errorMessage(err, 'Unable to save the overtime decision.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="ot" :class="currentStatus.toLowerCase()" @click.stop>
    <div class="ot-head">
      <IonIcon :icon="timeOutline" />
      <span><strong>{{ formatHours(overtimeHours) }} overtime</strong> · {{ label }}</span>
      <button
        v-if="!showActions"
        type="button"
        class="sv-link ot-change"
        @click="editing = true"
      >Change</button>
    </div>

    <p v-if="currentComment && !showActions" class="ot-comment">“{{ currentComment }}”</p>

    <div v-if="showActions" class="ot-actions">
      <input
        v-model="note"
        type="text"
        maxlength="1000"
        placeholder="Comment (optional)"
        aria-label="Overtime comment"
        :disabled="saving"
      />
      <button type="button" class="sv-btn soft" :disabled="saving" @click="decide('APPROVED')">
        <IonIcon :icon="checkmarkOutline" /> Approve
      </button>
      <button type="button" class="sv-btn danger-soft" :disabled="saving" @click="decide('REJECTED')">
        <IonIcon :icon="closeOutline" /> Reject
      </button>
      <button v-if="editing" type="button" class="sv-link" :disabled="saving" @click="editing = false">Cancel</button>
    </div>

    <p v-if="error" class="ot-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.ot {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--sv-waiting-soft, #fff3dc);
  color: var(--sv-ink, #173e2e);
  font-size: 12px;
}
.ot.approved { background: var(--sv-primary-soft, #e2f5e9); }
.ot.rejected { background: var(--sv-alert-soft, #fff0ed); }
.ot-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.ot-head ion-icon { font-size: 15px; flex-shrink: 0; }
.ot-change { margin-left: auto; font-size: 12px; }
.ot-comment { margin: 0; color: var(--sv-muted, #5d7867); font-style: italic; overflow-wrap: anywhere; }
.ot-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ot-actions input {
  flex: 1 1 160px;
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid #d9e7dd;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: inherit;
}
.ot-actions .sv-btn { min-width: 0; padding: 9px 12px; font-size: 12px; }
.ot-error { margin: 0; color: var(--sv-alert, #ae3834); }
</style>
