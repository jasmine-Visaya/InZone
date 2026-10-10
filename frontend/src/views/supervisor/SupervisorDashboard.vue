<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  logOutOutline,
  peopleOutline,
  documentTextOutline,
  checkmarkDoneOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';

const router = useRouter();
const user = ref<{ first_name?: string; last_name?: string; role?: string } | null>(null);
const name = computed(() => user.value?.first_name || 'Supervisor');

onMounted(() => {
  try {
    const saved = sessionStorage.getItem('inzone_user');
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed || String(parsed.role).toUpperCase() !== 'SUPERVISOR') {
      router.replace('/supervisor/login');
      return;
    }
    user.value = parsed;
  } catch {
    router.replace('/supervisor/login');
  }
});

function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  router.replace('/supervisor/login');
}
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="dashboard-content">
      <div class="layout">
        <header class="header">
          <div class="brand"><span class="logo"><IonIcon :icon="locationOutline" /></span><span>InZone<span class="dot">.</span> <small>Supervisor</small></span></div>
          <button class="logout" type="button" @click="logout"><IonIcon :icon="logOutOutline" /> Log out</button>
        </header>

        <main class="main">
          <div class="heading">
            <span class="eyebrow"><IonIcon :icon="shieldCheckmarkOutline" /> SUPERVISOR WORKSPACE</span>
            <h1>Welcome, {{ name }}!</h1>
            <p>Here's your dedicated overview for student internship supervision.</p>
          </div>

          <div class="intro-card">
            <div>
              <span class="preview">DASHBOARD PREVIEW</span>
              <h2>Your supervisor workspace is ready.</h2>
              <p>Your login and role check are connected. Next we'll hook up real weekly reports, attendance reviews, and student monitoring data.</p>
            </div>
            <span class="intro-icon"><IonIcon :icon="checkmarkDoneOutline" /></span>
          </div>

          <h3>Supervisor features</h3>
          <section class="card-grid" aria-label="Supervisor features coming soon">
            <article class="card"><span class="card-icon"><IonIcon :icon="documentTextOutline" /></span><h4>Pending Reports</h4><p>Review weekly submissions and student accomplishments.</p><span class="coming">Coming next</span></article>
            <article class="card"><span class="card-icon"><IonIcon :icon="timeOutline" /></span><h4>Attendance Review</h4><p>View records and supporting attendance details.</p><span class="coming">Coming next</span></article>
            <article class="card"><span class="card-icon"><IonIcon :icon="peopleOutline" /></span><h4>Student Monitoring</h4><p>Keep track of the students assigned to you.</p><span class="coming">Coming next</span></article>
          </section>
          <p class="note">These are placeholders, not live counts. No student records are displayed until the supervisor APIs are connected.</p>
        </main>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.dashboard-content { --background: #f1f7f3; --color: #163d32; }
.layout { min-height: 100%; background: #f1f7f3; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 18px max(24px, calc((100vw - 1100px) / 2)); background: #fff; border-bottom: 1px solid #e0ebe4; gap: 16px; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 23px; font-weight: 850; letter-spacing: -.8px; color: #0c5c45; }
.logo { width: 37px; height: 37px; background: #0b795b; color: white; display: grid; place-items: center; border-radius: 11px; font-size: 22px; }
.dot { color: #2ab280; }
.brand small { display: block; font-size: 10px; letter-spacing: .6px; color: #80958b; font-weight: 700; }
.logout { background: #eef7f1; color: #0b7054; border: 1px solid #d5e9dc; padding: 11px 14px; border-radius: 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.logout ion-icon { font-size: 17px; }
.main { max-width: 1100px; margin: 0 auto; padding: 38px 24px 70px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #0b8b64; font-size: 11px; letter-spacing: 1px; font-weight: 800; }
.eyebrow ion-icon { font-size: 17px; }
h1 { color: #153e32; font-size: clamp(30px, 4vw, 43px); letter-spacing: -1.3px; margin: 12px 0 6px; }
.heading > p { margin: 0; color: #788f82; font-size: 14px; }
.intro-card { background: linear-gradient(125deg, #076a50, #064b43); border-radius: 22px; margin: 34px 0 35px; padding: 32px 36px; color: white; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.preview { font-size: 10px; color: #a6f0ce; letter-spacing: 1.5px; font-weight: 800; }
.intro-card h2 { margin: 12px 0; font-size: 25px; letter-spacing: -.6px; }
.intro-card p { max-width: 650px; line-height: 1.7; color: #cbeadd; font-size: 13px; margin: 0; }
.intro-icon { display: grid; place-items: center; background: #ffffff20; width: 88px; height: 88px; flex-shrink: 0; border-radius: 23px; font-size: 44px; color: #b1ffda; }
h3 { font-size: 19px; color: #153e32; }
.card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 17px; }
.card { padding: 26px; background: white; border: 1px solid #dceae1; border-radius: 18px; box-shadow: 0 9px 25px #164b3710; }
.card-icon { background: #e4f6eb; display: grid; place-items: center; width: 49px; height: 49px; border-radius: 14px; color: #0a8a63; font-size: 24px; }
.card h4 { color: #1c4637; font-size: 16px; margin: 20px 0 9px; }
.card p { color: #748b7f; font-size: 13px; line-height: 1.7; min-height: 60px; }
.coming { color: #0b805d; font-size: 11px; font-weight: 800; }
.note { margin-top: 24px; color: #899d92; font-size: 12px; }
@media (max-width: 740px) { .card-grid { grid-template-columns: 1fr; } .intro-icon { display: none; } .header { padding: 16px 20px; } .main { padding: 30px 20px 55px; } .card p { min-height: auto; } }
</style>
