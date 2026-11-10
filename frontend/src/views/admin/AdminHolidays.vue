<script setup lang="ts">
// =====================================
// ADMIN: HOLIDAYS
// Non-working days used by the weekly report unlock rule and the
// early time-out rule. Add sudden suspensions here too.
// =====================================
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import {
  calendarOutline, addOutline, trashOutline, createOutline, refreshOutline,
  alertCircleOutline, checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline,
} from 'ionicons/icons';
import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

type HolidayType = 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SUSPENSION' | 'LOCAL';
interface Holiday { id: number | string; date: string; name: string; type: HolidayType }

const TYPES: { value: HolidayType; label: string }[] = [
  { value: 'REGULAR', label: 'Regular holiday' },
  { value: 'SPECIAL_NON_WORKING', label: 'Special non-working day' },
  { value: 'SUSPENSION', label: 'Work suspension' },
  { value: 'LOCAL', label: 'Local holiday' },
];

const router = useRouter();
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const thisYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date()));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const year = ref(thisYear);
const holidays = ref<Holiday[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const editingId = ref<Holiday['id'] | null>(null);
const confirmDeleteId = ref<Holiday['id'] | null>(null);
const form = ref<{ date: string; name: string; type: HolidayType }>({ date: '', name: '', type: 'REGULAR' });

const upcoming = computed(() => holidays.value.filter((h) => h.date >= today));
const past = computed(() => holidays.value.filter((h) => h.date < today));

function typeLabel(type: HolidayType) {
  return TYPES.find((t) => t.value === type)?.label || type;
}

function formatDate(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? day
    : new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('inzone_token');
  if (!token) {
    void router.replace('/');
    throw new Error('Please sign in again.');
  }
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  return data as T;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<{ holidays: Holiday[] }>(`/api/holidays?year=${year.value}`);
    holidays.value = data.holidays;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to load holidays.';
  } finally {
    loading.value = false;
  }
}

function changeYear(step: number) {
  year.value += step;
  cancelEdit();
  void load();
}

function startEdit(holiday: Holiday) {
  editingId.value = holiday.id;
  form.value = { date: holiday.date, name: holiday.name, type: holiday.type };
  success.value = '';
  error.value = '';
}

function cancelEdit() {
  editingId.value = null;
  form.value = { date: '', name: '', type: 'REGULAR' };
}

async function save() {
  if (saving.value) return;
  error.value = '';
  success.value = '';
  if (!form.value.date || !form.value.name.trim()) {
    error.value = 'Please enter the date and name of the holiday.';
    return;
  }
  saving.value = true;
  try {
    const body = JSON.stringify({ holiday_date: form.value.date, name: form.value.name.trim(), type: form.value.type });
    if (editingId.value !== null) {
      await request(`/api/holidays/${editingId.value}`, { method: 'PUT', body });
      success.value = 'Holiday updated.';
    } else {
      await request('/api/holidays', { method: 'POST', body });
      success.value = 'Holiday added.';
    }
    const savedYear = Number(form.value.date.slice(0, 4));
    cancelEdit();
    if (savedYear !== year.value) year.value = savedYear;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to save holiday.';
  } finally {
    saving.value = false;
  }
}

async function remove(holiday: Holiday) {
  if (confirmDeleteId.value !== holiday.id) {
    confirmDeleteId.value = holiday.id;
    return;
  }
  confirmDeleteId.value = null;
  error.value = '';
  success.value = '';
  try {
    await request(`/api/holidays/${holiday.id}`, { method: 'DELETE' });
    success.value = `${holiday.name} removed.`;
    if (editingId.value === holiday.id) cancelEdit();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to remove holiday.';
  }
}

onIonViewWillEnter(() => { void load(); });
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="page">
      <InZoneTopbar role="ADMIN" />
      <main class="wrap">
        <header class="head">
          <div>
            <span class="eyebrow">ATTENDANCE CALENDAR</span>
            <h1>Holidays<span>.</span></h1>
            <p>Non-working days. Weekly reports open earlier when the last working day of the week is a holiday, and students can time out early on these days.</p>
          </div>
          <button class="icon-btn" type="button" :disabled="loading" aria-label="Refresh holidays" @click="load">
            <IonIcon :icon="refreshOutline" :class="{ spinning: loading }" />
          </button>
        </header>

        <section class="card form-card">
          <h2><IonIcon :icon="editingId !== null ? createOutline : addOutline" /> {{ editingId !== null ? 'Edit holiday' : 'Add a holiday or suspension' }}</h2>
          <div class="form-grid">
            <label>Date<input v-model="form.date" type="date" :disabled="saving" /></label>
            <label class="grow">Name<input v-model="form.name" type="text" maxlength="150" placeholder="e.g. Typhoon work suspension" :disabled="saving" /></label>
            <label>Type
              <select v-model="form.type" :disabled="saving">
                <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : editingId !== null ? 'Save changes' : 'Add holiday' }}</button>
            <button v-if="editingId !== null" type="button" class="btn ghost" :disabled="saving" @click="cancelEdit">Cancel</button>
          </div>
          <div v-if="error" class="notice error" role="alert"><IonIcon :icon="alertCircleOutline" />{{ error }}</div>
          <div v-if="success" class="notice success" role="status"><IonIcon :icon="checkmarkCircleOutline" />{{ success }}</div>
        </section>

        <section class="card">
          <div class="year-bar">
            <button type="button" class="icon-btn small" :disabled="loading" aria-label="Previous year" @click="changeYear(-1)"><IonIcon :icon="chevronBackOutline" /></button>
            <strong>{{ year }}</strong>
            <button type="button" class="icon-btn small" :disabled="loading" aria-label="Next year" @click="changeYear(1)"><IonIcon :icon="chevronForwardOutline" /></button>
            <span class="count">{{ holidays.length }} day{{ holidays.length === 1 ? '' : 's' }}</span>
          </div>

          <p v-if="loading && !holidays.length" class="muted">Loading holidays…</p>
          <div v-else-if="!holidays.length" class="empty">
            <IonIcon :icon="calendarOutline" />
            <strong>No holidays for {{ year }}</strong>
            <p>Add the year's holidays once the proclamation is out.</p>
          </div>

          <template v-for="group in [{ title: 'Upcoming', items: upcoming }, { title: 'Past', items: past }]" :key="group.title">
            <h3 v-if="group.items.length" class="group-title">{{ group.title }}</h3>
            <ul v-if="group.items.length" class="list" :class="{ past: group.title === 'Past' }">
              <li v-for="h in group.items" :key="h.id" class="item">
                <span class="date">{{ formatDate(h.date) }}</span>
                <span class="name"><strong>{{ h.name }}</strong><small class="type" :class="h.type.toLowerCase()">{{ typeLabel(h.type) }}</small></span>
                <span class="actions">
                  <button type="button" class="btn ghost small" @click="startEdit(h)"><IonIcon :icon="createOutline" /> Edit</button>
                  <button type="button" class="btn small" :class="confirmDeleteId === h.id ? 'danger' : 'danger-soft'" @click="remove(h)">
                    <IonIcon :icon="trashOutline" /> {{ confirmDeleteId === h.id ? 'Confirm' : 'Remove' }}
                  </button>
                </span>
              </li>
            </ul>
          </template>
        </section>
      </main>
    </IonContent>
    <AdminBottomNav />
  </IonPage>
</template>

<style scoped>
.page { --background: #f4f8f5; --color: #173e2e; }
.wrap { max-width: 900px; margin: auto; padding: 24px 18px calc(140px + env(safe-area-inset-bottom, 0px)); }
button, input, select { font: inherit; }
button { cursor: pointer; }
button:disabled { opacity: .55; cursor: not-allowed; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 18px; }
.eyebrow { font-size: 10px; letter-spacing: 1.2px; color: #0b946c; font-weight: 850; }
.head h1 { font-size: clamp(28px, 4vw, 38px); letter-spacing: -1px; margin: 6px 0; color: #173e2e; }
.head h1 span { color: #13a676; }
.head p { margin: 0; max-width: 560px; font-size: 13px; line-height: 1.6; color: #7c9484; }
.icon-btn { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; border: 1px solid #dcebe1; border-radius: 12px; background: #fff; color: #087a58; font-size: 20px; }
.icon-btn.small { width: 34px; height: 34px; font-size: 16px; border-radius: 10px; }
.card { background: #fff; border: 1px solid #e0ebe3; border-radius: 18px; padding: 20px; margin-bottom: 16px; box-shadow: 0 8px 26px #124c3510; }
.card h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 16px; color: #173e2e; }
.card h2 ion-icon { color: #0b946c; }
.form-grid { display: grid; grid-template-columns: 170px minmax(0, 1fr) 200px; gap: 10px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 800; color: #315541; min-width: 0; }
.form-grid input, .form-grid select { width: 100%; box-sizing: border-box; padding: 11px 12px; background: #fbfdfb; border: 1px solid #d9e7dd; border-radius: 11px; color: #254936; font-size: 13px; font-weight: 500; outline: none; }
.form-grid input:focus, .form-grid select:focus { border-color: #0b946c; }
.form-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 11px; padding: 11px 16px; font-size: 13px; font-weight: 800; }
.btn.small { padding: 7px 10px; font-size: 12px; border-radius: 9px; }
.btn.primary { background: #0b7959; color: #fff; }
.btn.ghost { background: #eef6f0; color: #39674b; }
.btn.danger-soft { background: #fff0ee; color: #ae3834; }
.btn.danger { background: #b83d3d; color: #fff; }
.notice { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 11px 13px; border-radius: 11px; font-size: 12px; }
.notice.error { background: #fff0ed; color: #a64138; }
.notice.success { background: #e5f6eb; color: #087e5b; }
.year-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.year-bar strong { font-size: 18px; color: #173e2e; }
.year-bar .count { margin-left: auto; font-size: 12px; color: #7c9484; }
.group-title { margin: 16px 0 8px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #7c9484; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.list.past { opacity: .7; }
.item { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #e3eee7; border-radius: 13px; background: #fcfefd; }
.date { font-size: 13px; font-weight: 800; color: #234835; }
.name { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.name strong { font-size: 13px; color: #234835; overflow-wrap: anywhere; }
.type { align-self: flex-start; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; background: #e2f5e9; color: #087a58; }
.type.special_non_working { background: #e7f2ff; color: #28649a; }
.type.suspension { background: #fff3dc; color: #966e20; }
.type.local { background: #f1edff; color: #6c55c0; }
.actions { display: flex; gap: 6px; }
.muted { font-size: 12px; color: #7c9484; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 12px; text-align: center; color: #879d8f; font-size: 13px; }
.empty ion-icon { font-size: 30px; color: #9abdab; }
.empty strong { color: #355a43; }
.empty p { margin: 0; font-size: 12px; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 680px) {
  .wrap { padding: 18px 15px calc(130px + env(safe-area-inset-bottom, 0px)); }
  .form-grid { grid-template-columns: 1fr; }
  .item { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .actions { justify-content: flex-end; }
}
</style>
