
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";

import {
  IonContent,
  IonIcon,
  IonModal,
} from "@ionic/vue";

import {
  arrowBackOutline,
  compassOutline,
  informationCircleOutline,
  layersOutline,
  locationOutline,
  mapOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";

// =====================================
// PROPS
// =====================================

interface Props {
  isOpen: boolean;
  inline?: boolean;
  title?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  address?: string;
  query?: string;
  isExactPin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
  title: "Workplace Geofence",
  latitude: null,
  longitude: null,
  radiusMeters: null,
  address: "",
  query: "",
  isExactPin: true,
});

const emit = defineEmits<{
  (event: "close"): void;
}>();

// =====================================
// GOOGLE MAPS TYPES
// No global google namespace needed
// =====================================

interface MapHandle {
  fitBounds(
    bounds: unknown,
    padding?: number
  ): void;

  setMapTypeId(type: string): void;
  getMapTypeId(): string;

  addListener(
    eventName: string,
    handler: () => void
  ): unknown;
}

interface CircleHandle {
  getBounds(): unknown | null;
  setMap(map: MapHandle | null): void;
}

interface MapsApi {
  Map: new (
    node: HTMLElement,
    options: Record<string, unknown>
  ) => MapHandle;

  Circle: new (
    options: Record<string, unknown>
  ) => CircleHandle;
}

type MapWindow = Window & {
  google?: {
    maps?: MapsApi;
  };

  inzoneMapsReady?: () => void;
  gm_authFailure?: () => void;

  inzoneMapsPromise?: Promise<MapsApi>;
};

// =====================================
// API KEY
// =====================================

const apiKey = String(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
).trim();

const hasKey =
  Boolean(apiKey) &&
  !/YOUR_GOOGLE|ILAGAY_DITO|PLACEHOLDER|DEMO_KEY/i.test(
    apiKey
  );

// =====================================
// SHARED GOOGLE MAPS LOADER
// Important: both inline and full maps
// reuse the same loaded Maps API.
// =====================================

function loadMaps(): Promise<MapsApi> {
  const win = window as MapWindow;

  if (
    win.google?.maps?.Map &&
    win.google.maps.Circle
  ) {
    return Promise.resolve(
      win.google.maps
    );
  }

  if (win.inzoneMapsPromise) {
    return win.inzoneMapsPromise;
  }

  win.inzoneMapsPromise =
    new Promise<MapsApi>(
      (resolve, reject) => {
        const script =
          document.createElement("script");

        let settled = false;

        const timeout = window.setTimeout(
          () => {
            fail("Google Maps timed out.");
          },
          18000
        );

        function fail(message: string) {
          if (settled) return;

          settled = true;
          window.clearTimeout(timeout);

          win.inzoneMapsPromise = undefined;

          script.remove();
          reject(new Error(message));
        }

        win.inzoneMapsReady = () => {
          if (settled) return;

          const maps = win.google?.maps;

          if (!maps?.Map || !maps?.Circle) {
            fail(
              "Google Maps Map/Circle unavailable."
            );
            return;
          }

          settled = true;

          window.clearTimeout(timeout);
          resolve(maps);
        };

        win.gm_authFailure = () => {
          fail(
            "Google Maps API key rejected."
          );
        };

        const params =
          new URLSearchParams({
            key: apiKey,
            v: "weekly",
            loading: "async",
            callback: "inzoneMapsReady",
          });

        script.src =
          "https://maps.googleapis.com/maps/api/js?" +
          params.toString();

        script.async = true;

        script.onerror = () => {
          fail(
            "Unable to load Google Maps."
          );
        };

        document.head.appendChild(script);
      }
    );

  return win.inzoneMapsPromise;
}

// =====================================
// LOCATION VALIDATION
// =====================================

const coordinatesValid = computed(() => {
  const lat = props.latitude;
  const lng = props.longitude;

  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
});

const exactPin = computed(() => {
  return (
    props.isExactPin &&
    coordinatesValid.value
  );
});

const validRadius = computed(() => {
  return (
    typeof props.radiusMeters === "number" &&
    Number.isFinite(props.radiusMeters) &&
    props.radiusMeters > 0
  );
});

const radiusLabel = computed(() => {
  return validRadius.value
    ? `${props.radiusMeters!.toLocaleString()} m`
    : "Not configured";
});

// =====================================
// FALLBACK MAP
// =====================================

const query = computed(() => {
  if (coordinatesValid.value) {
    return (
      `${props.latitude},${props.longitude}`
    );
  }

  return (
    props.query.trim() ||
    props.address.trim()
  );
});

const fallbackUrl = computed(() => {
  if (!query.value) return "";

  const params = new URLSearchParams({
    q: query.value,
    z: "17",
    output: "embed",
    t: "h",
  });

  return (
    `https://maps.google.com/maps?${params}`
  );
});

// =====================================
// MAP STATE
// =====================================

const modalVisible = ref(false);

const active = computed(() => {
  return (
    props.isOpen &&
    (props.inline || modalVisible.value)
  );
});

const error = ref("");
const loading = ref(false);

const interactive = computed(() => {
  return (
    active.value &&
    exactPin.value &&
    hasKey &&
    !error.value
  );
});

const mapEl =
  ref<HTMLDivElement | null>(null);

const previewEl =
  ref<HTMLDivElement | null>(null);

const mode =
  ref<"hybrid" | "roadmap">("hybrid");

let map: MapHandle | null = null;
let thumbnail: MapHandle | null = null;

let circle: CircleHandle | null = null;
let centerDot: CircleHandle | null = null;

let version = 0;

// =====================================
// CLEANUP
// =====================================

function cleanup() {
  version++;

  circle?.setMap(null);
  centerDot?.setMap(null);

  circle = null;
  centerDot = null;

  map = null;
  thumbnail = null;

  loading.value = false;
}

// =====================================
// SATELLITE / MAP SWITCH
// =====================================

function toggleMode() {
  if (!map) return;

  mode.value =
    mode.value === "hybrid"
      ? "roadmap"
      : "hybrid";

  map.setMapTypeId(mode.value);

  thumbnail?.setMapTypeId(
    mode.value === "hybrid"
      ? "roadmap"
      : "satellite"
  );
}

// =====================================
// DRAW MAP AND GEOFENCE CIRCLE
// =====================================

async function draw() {
  if (!interactive.value) return;

  const myVersion = ++version;

  loading.value = true;

  await nextTick();

  if (
    !mapEl.value ||
    myVersion !== version ||
    !active.value
  ) {
    return;
  }

  try {
    const maps = await loadMaps();

    if (
      !mapEl.value ||
      myVersion !== version ||
      !active.value
    ) {
      return;
    }

    circle?.setMap(null);
    centerDot?.setMap(null);

    const center = {
      lat: props.latitude!,
      lng: props.longitude!,
    };

    // =================================
    // MAIN MAP
    // Satellite view by default
    // =================================

    map = new maps.Map(
      mapEl.value,
      {
        center,
        zoom: 17,

        mapTypeId: "hybrid",

        // Google's Map/Satellite buttons
        // remain available top-left.
        mapTypeControl: true,

        mapTypeControlOptions: {
          mapTypeIds: [
            "roadmap",
            "satellite",
            "hybrid",
          ],
        },

        fullscreenControl: false,
        streetViewControl: false,

        zoomControl: true,

        gestureHandling: "cooperative",
      }
    );

    mode.value = "hybrid";

    // =================================
    // GREEN GEOFENCE CIRCLE
    // Same actual radius from database
    // =================================

    if (validRadius.value) {
      circle = new maps.Circle({
        map,
        center,

        radius: props.radiusMeters!,

        strokeColor: "#00bd81",
        strokeOpacity: 1,
        strokeWeight: 4,

        fillColor: "#19d38c",
        fillOpacity: 0.27,

        clickable: false,
      });

      const bounds =
        circle.getBounds();

      if (bounds) {
        map.fitBounds(bounds, 42);
      }
    }

    // =================================
    // WORKPLACE CENTER POINT
    // =================================

    centerDot = new maps.Circle({
      map,
      center,

      radius: 4,

      strokeColor: "#ffffff",
      strokeOpacity: 1,
      strokeWeight: 3,

      fillColor: "#007a58",
      fillOpacity: 1,

      clickable: false,
    });

    // =================================
    // SMALL MAP THUMBNAIL
    // =================================

    if (previewEl.value) {
      thumbnail = new maps.Map(
        previewEl.value,
        {
          center,
          zoom: 17,

          mapTypeId: "roadmap",

          disableDefaultUI: true,

          gestureHandling: "none",

          clickableIcons: false,
          keyboardShortcuts: false,
        }
      );
    }

    // Keep thumbnail synchronized when
    // using the built-in Google controls.
    map.addListener(
      "maptypeid_changed",
      () => {
        if (!map) return;

        mode.value =
          map.getMapTypeId() === "roadmap"
            ? "roadmap"
            : "hybrid";

        thumbnail?.setMapTypeId(
          mode.value === "hybrid"
            ? "roadmap"
            : "satellite"
        );
      }
    );

    loading.value = false;

  } catch (cause) {
    if (myVersion !== version) {
      return;
    }

    console.error(
      "[InZone Geofence Map]",
      cause
    );

    cleanup();

    error.value =
      "Interactive Google Maps unavailable.";
  }
}

// =====================================
// MODAL EVENTS
// =====================================

function onPresented() {
  modalVisible.value = true;
}

function onDismissed() {
  modalVisible.value = false;

  cleanup();

  emit("close");
}

// =====================================
// WATCH LOCATION AND VISIBILITY
// =====================================

watch(
  () => [
    active.value,
    props.latitude,
    props.longitude,
    props.radiusMeters,
    props.isExactPin,
  ],
  () => {
    cleanup();

    error.value = "";
    mode.value = "hybrid";

    if (
      active.value &&
      exactPin.value &&
      hasKey
    ) {
      void draw();
    }
  },
  {
    immediate: true,
    flush: "post",
  }
);

onBeforeUnmount(cleanup);
</script>

<template>
  <!-- ==================================
       INLINE MAP
       Student Dashboard
       ================================== -->

  <section
    v-if="inline"
    v-show="isOpen"
    class="zone-embed"
  >
    <div class="map-surface">

      <!-- REAL GOOGLE MAPS -->
      <div
        v-if="interactive"
        ref="mapEl"
        class="map-canvas"
      ></div>

      <!-- FALLBACK -->
      <iframe
        v-else-if="fallbackUrl"
        class="map-canvas"
        :src="fallbackUrl"
        title="Workplace Google Map"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>

      <div
        v-else
        class="map-empty"
      >
        <IonIcon :icon="mapOutline" />
        Location unavailable
      </div>

      <!-- MAP / SATELLITE THUMBNAIL -->
      <button
        v-if="interactive"
        type="button"
        class="map-thumbnail"
        :aria-label="
          mode === 'hybrid'
            ? 'Show normal map'
            : 'Show satellite map'
        "
        @click="toggleMode"
      >
        <div
          ref="previewEl"
          class="thumbnail-image"
          aria-hidden="true"
        ></div>

        <span>
          {{
            mode === "hybrid"
              ? "Map"
              : "Satellite"
          }}
        </span>
      </button>

      <span
        v-if="loading"
        class="map-loading"
      >
        Loading geofence map...
      </span>

    </div>

    <!-- INFORMATION OUTSIDE THE MAP -->
    <div class="map-info">

      <div class="map-radius">
        <IonIcon
          :icon="shieldCheckmarkOutline"
        />

        <span>
          Allowed Radius:
          <strong>{{ radiusLabel }}</strong>
        </span>
      </div>

      <small
        v-if="interactive && validRadius"
      >
        Green circle = attendance boundary
      </small>

      <small
        v-else-if="error"
      >
        {{ error }}
      </small>

      <small v-else>
        Location preview only
      </small>

    </div>
  </section>

  <!-- ==================================
       FULL MAP
       Admin and Student
       ================================== -->

  <IonModal
    v-else
    :is-open="isOpen"
    class="inzone-map-modal"
    @didPresent="onPresented"
    @didDismiss="onDismissed"
  >
    <IonContent
      class="inzone-map-content"
      :fullscreen="true"
    >
      <div class="viewer">

        <!-- HEADER -->
        <header class="viewer-header">

          <button
            class="back"
            type="button"
            @click="emit('close')"
          >
            <IonIcon
              :icon="arrowBackOutline"
            />

            Back to InZone
          </button>

          <div class="header-main">

            <div class="header-icon">
              <IonIcon
                :icon="layersOutline"
              />
            </div>

            <div class="header-copy">
              <span class="eyebrow">
                INZONE · GEOFENCE COVERAGE
              </span>

              <h2>{{ title }}</h2>

              <p v-if="address">
                <IonIcon
                  :icon="locationOutline"
                />

                {{ address }}
              </p>
            </div>
          </div>
        </header>

        <!-- SATELLITE MAP -->
        <div class="map-surface full-surface">

          <div
            v-if="interactive"
            ref="mapEl"
            class="map-canvas"
          ></div>

          <iframe
            v-else-if="fallbackUrl"
            class="map-canvas"
            :src="fallbackUrl"
            title="Google Maps workplace preview"
            loading="eager"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>

          <div
            v-else
            class="map-empty"
          >
            <IonIcon :icon="mapOutline" />
            Location unavailable
          </div>

          <!-- MAP / SATELLITE THUMBNAIL -->
          <button
            v-if="interactive"
            type="button"
            class="map-thumbnail"
            :aria-label="
              mode === 'hybrid'
                ? 'Show normal map'
                : 'Show satellite map'
            "
            @click="toggleMode"
          >
            <div
              ref="previewEl"
              class="thumbnail-image"
              aria-hidden="true"
            ></div>

            <span>
              {{
                mode === "hybrid"
                  ? "Map"
                  : "Satellite"
              }}
            </span>
          </button>

          <span
            v-if="loading"
            class="map-loading"
          >
            Loading satellite map...
          </span>
        </div>

        <!-- RADIUS INFO OUTSIDE THE MAP -->
        <footer class="viewer-footer">

          <div class="footer-info">

            <div class="footer-icon">
              <IonIcon
                :icon="compassOutline"
              />
            </div>

            <div>
              <strong>
                {{ radiusLabel }} allowed radius
              </strong>

              <small v-if="exactPin">
                Center:
                {{ latitude?.toFixed(6) }},
                {{ longitude?.toFixed(6) }}
              </small>

              <small
                v-if="interactive && validRadius"
              >
                Green circle shows the configured
                Time In / Time Out area.
              </small>

              <small v-else-if="error">
                {{ error }}
              </small>

              <small v-else>
                <IonIcon
                  :icon="informationCircleOutline"
                />
                Location preview only.
              </small>
            </div>

          </div>

          <button
            type="button"
            class="done"
            @click="emit('close')"
          >
            Done
          </button>
        </footer>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.inzone-map-content {
  --background: #f1f8f4;
  --color: #173f32;
}

/* INLINE STUDENT PREVIEW */

.zone-embed {
  overflow: hidden;
  border: 1px solid #d3e8db;
  border-radius: 17px;
  background: #ffffff;
}

.zone-embed .map-surface {
  height: 330px;
}

/* SHARED MAP */

.map-surface {
  position: relative;
  min-height: 230px;
  overflow: hidden;
  background: #e5efe8;
}

.map-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.map-empty {
  height: 100%;
  display: grid;
  place-items: center;
  gap: 8px;
  color: #647e6d;
}

.map-empty ion-icon {
  font-size: 28px;
}

/* SATELLITE / MAP THUMBNAIL */
/* Raised to avoid Google attribution */

.map-thumbnail {
  position: absolute;
  z-index: 3;
  left: 12px;
  bottom: 53px;

  width: 96px;
  height: 88px;
  padding: 4px;

  border: 2px solid #ffffff;
  border-radius: 12px;
  overflow: hidden;

  box-shadow: 0 5px 20px #00000055;
  background: #ffffff;

  cursor: pointer;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  border-radius: 7px;
  pointer-events: none;
}

.map-thumbnail > span {
  position: absolute;
  left: 50%;
  bottom: 7px;

  transform: translateX(-50%);

  padding: 4px 9px;
  border-radius: 7px;

  background: #173e32e6;
  color: #ffffff;

  font-size: 11px;
  font-weight: 800;

  pointer-events: none;
}

/* LOADING */

.map-loading {
  position: absolute;
  top: 14px;
  left: 50%;
  z-index: 4;

  transform: translateX(-50%);

  padding: 9px 13px;
  border-radius: 18px;

  background: #ffffff;
  color: #087957;

  font-size: 12px;
  box-shadow: 0 5px 20px #00000022;
}

/* INLINE MAP INFORMATION */

.map-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;

  padding: 12px 16px;
  gap: 7px;

  background: #ffffff;
}

.map-radius {
  display: flex;
  align-items: center;
  gap: 7px;

  color: #12694e;
  font-size: 12px;
}

.map-radius ion-icon {
  font-size: 20px;
}

.map-info small {
  font-size: 10px;
  color: #788f80;
}

/* FULL MAP */

.viewer {
  display: flex;
  flex-direction: column;

  width: 100%;
  height: 100%;
  min-height: 0;
}

.viewer-header {
  flex-shrink: 0;

  padding: 14px clamp(16px, 3vw, 28px);

  background: #ffffff;
  border-bottom: 1px solid #dcebe2;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  margin-bottom: 12px;
  padding: 11px 14px;

  border: 0;
  border-radius: 11px;

  background: #e4f6eb;
  color: #087957;

  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  display: grid;
  place-items: center;

  flex: 0 0 42px;
  height: 42px;

  border-radius: 12px;
  background: #e2f6e9;
  color: #087957;

  font-size: 23px;
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  color: #118660;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1px;
}

.header-copy h2 {
  margin: 4px 0;
  color: #194734;
  font-size: clamp(18px, 3vw, 25px);
}

.header-copy p {
  margin: 3px 0 0;
  color: #768e7d;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.full-surface {
  flex: 1;
  min-height: 260px;
}

/* FOOTER — LEGEND NO LONGER
   COVERS MAP/SATELLITE CONTROLS */

.viewer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;

  flex-shrink: 0;

  padding:
    13px clamp(16px, 3vw, 28px)
    calc(13px + env(safe-area-inset-bottom, 0px));

  background: #ffffff;
  border-top: 1px solid #dcebe2;
}

.footer-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.footer-icon {
  display: grid;
  place-items: center;

  flex: 0 0 38px;
  height: 38px;

  border-radius: 10px;
  background: #e2f6e9;
  color: #087957;

  font-size: 20px;
}

.footer-info strong,
.footer-info small {
  display: block;
}

.footer-info strong {
  color: #20573e;
  font-size: 12px;
}

.footer-info small {
  margin-top: 4px;
  color: #7e9686;
  font-size: 10px;
  line-height: 1.5;
}

.done {
  flex-shrink: 0;

  padding: 11px 22px;

  border: 0;
  border-radius: 11px;

  background: #087957;
  color: #ffffff;

  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 600px) {
  .zone-embed .map-surface {
    height: 265px;
  }

  .map-thumbnail {
    left: 10px;
    bottom: 50px;
    width: 83px;
    height: 80px;
  }

  .viewer-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .done {
    width: 100%;
  }
}
</style>

<style>
ion-content.inzone-map-content::part(scroll) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

ion-modal.inzone-map-modal {
  --width: min(100vw, 1080px);
  --height: min(94dvh, 920px);
  --border-radius: 18px;
  --box-shadow: 0 24px 65px #0d4b352e;
}

@media (max-width: 600px) {
  ion-modal.inzone-map-modal {
    --width: 100%;
    --height: 100%;
    --border-radius: 0;
  }
}
</style>
