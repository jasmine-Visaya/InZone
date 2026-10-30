<script setup lang="ts">
// Shows the selfie a student took when timing in.
// Uses the existing endpoint GET /api/attendance/photo-proof/:attendanceId,
// which returns a temporary link (valid for 5 minutes).
import { ref, watch } from 'vue';
import { IonIcon, IonModal } from '@ionic/vue';
import { closeOutline, imageOutline, alertCircleOutline } from 'ionicons/icons';
import { supervisorRequest, errorMessage, type Id } from './supervisorApi';

const props = defineProps<{
  attendanceId: Id | null;
  title: string;
  subtitle?: string;
}>();

const emit = defineEmits<{ (event: 'close'): void }>();

const loading = ref(false);
const error = ref('');
const photoUrl = ref('');

async function loadPhoto(id: Id) {
  loading.value = true;
  error.value = '';
  photoUrl.value = '';

  try {
    const data = await supervisorRequest<{ photo_url: string }>(
      `/api/attendance/photo-proof/${encodeURIComponent(String(id))}`
    );
    photoUrl.value = data.photo_url;
  } catch (err) {
    error.value = errorMessage(err, 'Unable to load the photo.');
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.attendanceId,
  (id) => {
    if (id !== null && id !== undefined) void loadPhoto(id);
  },
  { immediate: true }
);
</script>

<template>
  <IonModal
    :is-open="attendanceId !== null"
    class="photo-modal"
    @didDismiss="emit('close')"
  >
    <div class="sv-modal photo-shell">
      <header class="photo-header">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="close" aria-label="Close photo" @click="emit('close')">
          <IonIcon :icon="closeOutline" />
        </button>
      </header>

      <div class="photo-body">
        <div v-if="loading" class="photo-state">
          <IonIcon :icon="imageOutline" />
          <p>Loading photo…</p>
        </div>
        <div v-else-if="error" class="photo-state is-error" role="alert">
          <IonIcon :icon="alertCircleOutline" />
          <p>{{ error }}</p>
          <button
            v-if="attendanceId !== null"
            type="button"
            class="retry"
            @click="loadPhoto(attendanceId)"
          >
            Try again
          </button>
        </div>
        <img v-else-if="photoUrl" :src="photoUrl" :alt="`Time-in photo: ${title}`" />
      </div>

      <p class="photo-note">This link expires after 5 minutes. Close and reopen to view it again.</p>
    </div>
  </IonModal>
</template>

<style scoped src="./supervisor.css"></style>
<style scoped>
.photo-modal {
  --width: min(520px, calc(100% - 24px));
  --height: min(82vh, 720px);
  --border-radius: 22px;
}

.photo-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.photo-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid #e5eee7;
}

.photo-header h2 {
  margin: 0;
  font-size: 17px;
  color: #163e30;
}

.photo-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7e9488;
}

.close {
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

.photo-body {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #f5f9f6;
}

.photo-body img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 14px;
  object-fit: contain;
}

.photo-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #7e9488;
  font-size: 13px;
  text-align: center;
}

.photo-state ion-icon {
  font-size: 34px;
}

.photo-state.is-error {
  color: #8f3328;
}

.retry {
  border: 0;
  border-radius: 10px;
  padding: 9px 14px;
  background: #fff;
  color: #8f3328;
  font-weight: 800;
}

.photo-note {
  margin: 0;
  padding: 12px 20px 16px;
  font-size: 11px;
  color: #8a9a91;
}
</style>
