<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  shieldCheckmarkOutline,
  peopleOutline,
  personAddOutline,
  briefcaseOutline,
  barChartOutline,
  logOutOutline,
  lockClosedOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

const router = useRouter();
const firstName = ref('Administrator');
const accountEmail = ref('');

onMounted(() => {
  try {
    const user = JSON.parse(sessionStorage.getItem('inzone_user') || 'null');
    if (String(user?.role || '').toUpperCase() !== 'ADMIN') {
      void router.replace('/');
      return;
    }
    firstName.value = user.first_name || 'Administrator';
    accountEmail.value = user.email || '';
  } catch {
    void router.replace('/');
  }
});

function logout() {
  sessionStorage.removeItem('inzone_token');
  sessionStorage.removeItem('inzone_user');
  void router.replace('/');
}

// Display-only modules: no Admin APIs have been supplied yet.
const modules = [
  {
    title: 'User approvals',
    description: 'Review pending student registrations and account statuses.',
    icon: personAddOutline,
  },
  {
    title: 'User management',
    description: 'Manage student, supervisor, and administrator accounts.',
    icon: peopleOutline,
  },
  {
    title: 'OJT assignments',
    description: 'Coordinate company placements and supervisor assignments.',
    icon: briefcaseOutline,
  },
  {
    title: 'System reports',
    description: 'Review overall attendance, progress, and activity.',
    icon: barChartOutline,
  },
];
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="admin-content">
      <div class="admin-page">
        <header class="topbar">
          <div class="brand">
            <span class="logo"><IonIcon :icon="locationOutline" /></span>
            <span class="brand-name">InZone<span>.</span></span>
            <span class="portal-label">ADMIN PORTAL</span>
          </div>
          <button type="button" class="logout" @click="logout">
            <IonIcon :icon="logOutOutline" /> Log out
          </button>
        </header>

        <main class="main">
          <section class="intro">
            <div>
              <p class="eyebrow"><IonIcon :icon="shieldCheckmarkOutline" /> SYSTEM ADMINISTRATION</p>
              <h1>Welcome back, <span>{{ firstName }}.</span></h1>
              <p class="intro-text">Your InZone administration workspace is ready to build.</p>
            </div>
            <div class="account-chip">
              <IonIcon :icon="checkmarkCircleOutline" />
              <div><strong>Admin session</strong><small>{{ accountEmail || 'Signed in as administrator' }}</small></div>
            </div>
          </section>

          <section class="hero">
            <div class="hero-copy">
              <span class="hero-label"><IonIcon :icon="lockClosedOutline" /> ROLE-BASED ACCESS</span>
              <h2>One platform. Better OJT oversight.</h2>
              <p>
                This is the Admin Dashboard foundation. Account approval, user management,
                and reporting controls will be activated when your backend team provides
                authorized Admin API endpoints.
              </p>
            </div>
            <div class="hero-symbol" aria-hidden="true"><IonIcon :icon="shieldCheckmarkOutline" /></div>
          </section>

          <section class="modules-section" aria-labelledby="modules-title">
            <div class="section-heading">
              <div>
                <p class="section-kicker">ADMINISTRATOR WORKSPACE</p>
                <h2 id="modules-title">Management modules</h2>
              </div>
              <span class="pending">Backend integration pending</span>
            </div>
            <div class="modules-grid">
              <article v-for="module in modules" :key="module.title" class="module-card">
                <div class="module-icon"><IonIcon :icon="module.icon" /></div>
                <h3>{{ module.title }}</h3>
                <p>{{ module.description }}</p>
                <span class="module-status">Coming after Admin API setup</span>
              </article>
            </div>
          </section>

          <div class="info-note">
            <IonIcon :icon="informationCircleOutline" />
            <p>
              The login uses your existing <code>POST /api/auth/login</code> endpoint.
              Admin accounts must be provisioned by authorized staff with an
              <strong>ADMIN</strong> role and <strong>APPROVED</strong> status.
              Protected Admin actions must also check permissions on the backend.
            </p>
          </div>
        </main>
        <footer class="footer">InZone © 2026 · OJT Attendance & Monitoring System</footer>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.admin-content { --background: #f0f7f3; --color: #183d32; }
.admin-page { min-height: 100%; background: radial-gradient(circle at 95% 0%, #daeee3, transparent 40%), #f0f7f3; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px clamp(18px, 5vw, 65px); background: #fff; border-bottom: 1px solid #dcebe2; }
.brand { display: flex; align-items: center; gap: 11px; }
.logo { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; background: #087858; color: #fff; font-size: 25px; }
.brand-name { color: #154638; font-size: 24px; font-weight: 850; letter-spacing: -.7px; }
.brand-name span { color: #20b47e; }
.portal-label { color: #0a8060; font-size: 10px; font-weight: 850; letter-spacing: 1px; background: #e7f7ed; border-radius: 100px; padding: 8px 10px; }
.logout { display: inline-flex; align-items: center; gap: 8px; background: #eaf6ef; color: #086e54; border: 0; border-radius: 11px; padding: 12px 15px; font-weight: 800; cursor: pointer; }
.logout:hover { background: #dceee4; }
.main { max-width: 1240px; margin: 0 auto; padding: 42px clamp(18px, 5vw, 46px) 65px; }
.intro { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
.eyebrow { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; color: #0c8663; font-size: 11px; letter-spacing: 1.3px; font-weight: 850; }
h1 { margin: 0; color: #174334; font-weight: 850; letter-spacing: -1.5px; font-size: clamp(30px, 4.2vw, 46px); }
h1 span { color: #079469; }
.intro-text { color: #738f7c; font-size: 14px; margin: 12px 0 0; }
.account-chip { min-width: 200px; display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #dceae1; border-radius: 15px; padding: 15px; box-shadow: 0 8px 25px #1c614110; }
.account-chip > ion-icon { color: #10a471; font-size: 24px; flex-shrink: 0; }
.account-chip strong, .account-chip small { display: block; }
.account-chip strong { color: #1a5e47; font-size: 12px; }
.account-chip small { color: #829c8b; margin-top: 4px; font-size: 11px; overflow-wrap: anywhere; }
.hero { display: flex; align-items: center; justify-content: space-between; position: relative; overflow: hidden; color: #fff; border-radius: 25px; padding: 38px 44px; background: linear-gradient(120deg, #087e60, #075441 65%, #064038); box-shadow: 0 15px 36px #0b5d4023; }
.hero-copy { max-width: 720px; z-index: 1; }
.hero-label { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #ffffff40; color: #a7f9d5; padding: 8px 12px; border-radius: 99px; font-size: 11px; font-weight: 850; letter-spacing: 1px; }
.hero h2 { font-size: clamp(26px, 3.4vw, 40px); line-height: 1.15; letter-spacing: -1px; margin: 17px 0 14px; }
.hero p { color: #d8f1e5; font-size: 14px; line-height: 1.8; margin: 0; }
.hero-symbol { font-size: 158px; line-height: 1; opacity: .12; transform: rotate(-12deg); margin-left: 20px; }
.modules-section { margin-top: 37px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
.section-kicker { font-size: 10px; letter-spacing: 1.5px; color: #0b9470; font-weight: 850; margin: 0 0 8px; }
.section-heading h2 { margin: 0; color: #184334; font-size: 24px; letter-spacing: -.4px; }
.pending { background: #e2f3e9; color: #23785a; padding: 10px 13px; border-radius: 100px; font-size: 11px; font-weight: 700; }
.modules-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 17px; }
.module-card { background: #fff; border: 1px solid #deebe3; border-radius: 19px; padding: 24px 20px; box-shadow: 0 8px 28px #164d350b; }
.module-icon { background: #e7f7ec; color: #0b9069; width: 48px; height: 48px; border-radius: 13px; display: grid; place-items: center; font-size: 25px; }
.module-card h3 { color: #1e513e; font-size: 16px; margin: 21px 0 10px; }
.module-card p { color: #7d9284; font-size: 12px; line-height: 1.75; margin: 0; min-height: 68px; }
.module-status { display: inline-block; margin-top: 20px; padding: 8px 10px; border-radius: 9px; color: #8b8055; background: #fcf6e8; font-size: 10px; font-weight: 750; }
.info-note { display: flex; align-items: flex-start; gap: 12px; margin-top: 26px; border-radius: 16px; background: #e3f2e9; color: #3c765b; padding: 20px 22px; }
.info-note ion-icon { font-size: 23px; flex-shrink: 0; }
.info-note p { margin: 0; font-size: 12px; line-height: 1.8; }
.info-note code { font-size: 11px; }
.footer { border-top: 1px solid #deebe3; padding: 24px 15px; text-align: center; color: #8ba398; font-size: 11px; }
@media (max-width: 1000px) { .modules-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .intro { align-items: flex-start; } }
@media (max-width: 650px) { .topbar { padding: 15px 17px; } .portal-label { display: none; } .logout { padding: 10px; font-size: 12px; } .main { padding: 25px 16px 45px; } .intro { flex-direction: column; align-items: stretch; } .hero { padding: 27px 23px; } .hero-symbol { display: none; } .section-heading { flex-direction: column; align-items: flex-start; } .modules-grid { grid-template-columns: 1fr; gap: 13px; } .module-card p { min-height: auto; } .info-note { padding: 16px; } }
</style>
