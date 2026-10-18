<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonIcon, IonModal } from '@ionic/vue';
import {
  arrowBackOutline,
  locationOutline,
  mapOutline,
  informationCircleOutline,
  compassOutline,
} from 'ionicons/icons';

interface Props {
  isOpen: boolean;
  title?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  address?: string;
  query?: string;
  isExactPin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Workplace Location',
  latitude: null,
  longitude: null,
  radiusMeters: null,
  address: '',
  query: '',
  isExactPin: true,
});

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const validCoordinates = computed(() => {
  const lat = props.latitude;
  const lon = props.longitude;
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
});

// Exact geofence coordinates are preferred.
// Address-only lookups are a preview, NOT an approved geofence pin.
const mapQuery = computed(() => {
  if (validCoordinates.value) {
    return `${props.latitude},${props.longitude}`;
  }
  return props.query.trim() || props.address.trim();
});

// Google Maps iframe: no API key required for this basic embed URL.
// No external browser tab is created by our own app controls.
const mapUrl = computed(() => {
  if (!mapQuery.value) return '';
  const params = new URLSearchParams({
    q: mapQuery.value,
    z: validCoordinates.value ? '17' : '15',
    output: 'embed',
  });
  return `https://maps.google.com/maps?${params.toString()}`;
});

const showExactPin = computed(() =>
  props.isExactPin && validCoordinates.value
);
</script>

<template>
  <IonModal
    :is-open="isOpen"
    class="inzone-map-modal"
    :backdrop-dismiss="true"
    @didDismiss="emit('close')"
  >
    <IonContent class="inzone-map-content" :fullscreen="true">
      <div class="map-viewer">
        <header class="map-viewer-header">
          <button
            type="button"
            class="map-back"
            aria-label="Close map and return to InZone"
            @click="emit('close')"
          >
            <IonIcon :icon="arrowBackOutline" />
            <span>Back to InZone</span>
          </button>

          <div class="map-viewer-title">
            <div class="title-icon"><IonIcon :icon="mapOutline" /></div>
            <div>
              <span class="eyebrow">INZONE · LOCATION VIEWER</span>
              <h2>{{ title }}</h2>
            </div>
          </div>

          <div v-if="address" class="address-line">
            <IonIcon :icon="locationOutline" />
            <span>{{ address }}</span>
          </div>
        </header>

        <div v-if="mapUrl" class="map-frame">
          <iframe
            :src="mapUrl"
            title="Workplace location on Google Maps"
            loading="eager"
            referrerpolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-forms"
          ></iframe>
        </div>
        <div v-else class="map-unavailable">
          <IonIcon :icon="mapOutline" />
          <strong>Location unavailable</strong>
          <span>No valid workplace address or coordinates were provided.</span>
        </div>

        <div class="map-viewer-footer">
          <div v-if="showExactPin" class="map-coordinates">
            <IonIcon :icon="compassOutline" />
            <span>
              Saved pin: {{ latitude?.toFixed(6) }},
              {{ longitude?.toFixed(6) }}
            </span>
            <span v-if="radiusMeters != null && radiusMeters > 0">
              · Geofence radius: {{ radiusMeters }} m
            </span>
          </div>
          <p v-else class="map-note">
            <IonIcon :icon="informationCircleOutline" />
            This preview searches the saved address. It does not confirm the
            exact assigned geofence center.
          </p>
          <button type="button" class="map-done" @click="emit('close')">
            Done
          </button>
        </div>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.inzone-map-content { --background: #f1f8f4; --color: #164432; }
.map-viewer { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; width: 100%; }
.map-viewer-header { flex-shrink: 0; padding: 16px clamp(16px, 3vw, 30px) 14px; background: #fff; border-bottom: 1px solid #daebe0; }
.map-back { display: inline-flex; align-items: center; gap: 8px; border: 0; background: #e5f5eb; color: #087856; border-radius: 10px; padding: 10px 13px; cursor: pointer; font: inherit; font-weight: 750; font-size: 12px; margin-bottom: 12px; }
.map-back ion-icon { font-size: 18px; }
.map-viewer-title { display: flex; align-items: center; gap: 13px; }
.title-icon { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; background: #e2f6e9; color: #087b5b; font-size: 23px; }
.eyebrow { color: #0b996b; font-size: 9px; font-weight: 850; letter-spacing: 1.2px; }
.map-viewer-title h2 { margin: 4px 0 0; font-size: clamp(17px, 2.5vw, 22px); line-height: 1.2; color: #163e30; overflow-wrap: anywhere; }
.address-line { display: flex; align-items: flex-start; gap: 7px; color: #698476; margin: 12px 0 0; font-size: 12px; line-height: 1.5; }
.address-line ion-icon { flex-shrink: 0; margin-top: 2px; color: #0b8a63; }
.map-frame { flex: 1; min-height: 240px; position: relative; overflow: hidden; background: #e6efe9; }
.map-frame iframe { width: 100%; height: 100%; display: block; border: 0; }
.map-unavailable { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: #708b7b; padding: 24px; }
.map-unavailable ion-icon { font-size: 40px; color: #168d66; }
.map-unavailable strong { color: #184832; }
.map-unavailable span { font-size: 12px; }
.map-viewer-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-shrink: 0; padding: 12px clamp(16px, 3vw, 30px) calc(12px + env(safe-area-inset-bottom, 0px)); background: #fff; border-top: 1px solid #daebe0; }
.map-coordinates, .map-note { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: #557b68; font-size: 11px; line-height: 1.5; margin: 0; }
.map-coordinates ion-icon, .map-note ion-icon { color: #0d8a64; font-size: 17px; flex-shrink: 0; }
.map-done { background: #087957; border: 0; color: #fff; border-radius: 10px; padding: 11px 22px; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
@media (max-width: 600px) { .map-viewer-footer { flex-direction: column; align-items: stretch; } .map-done { width: 100%; } .map-viewer-header { padding-top: 10px; } }
</style>

<style>
/* IonModal is teleported into Ionic's overlay portal. */
ion-content.inzone-map-content::part(scroll) { display: flex; flex-direction: column; min-height: 100%; }
ion-modal.inzone-map-modal {
  --width: min(100vw, 1080px);
  --height: min(94dvh, 920px);
  --border-radius: 20px;
  --box-shadow: 0 24px 65px rgba(10, 56, 39, .24);
}
@media (max-width: 600px) {
  ion-modal.inzone-map-modal { --width: 100%; --height: 100%; --border-radius: 0; }
}
</style>
