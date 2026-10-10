<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  navigateOutline,
  shieldCheckmarkOutline,
  schoolOutline,
  personOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  arrowForwardOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';

const router = useRouter();

const isSignup = ref(false);
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const success = ref('');

// You can later configure this in frontend/.env as VITE_API_URL=...
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function setMode(signup: boolean) {
  if (isSignup.value === signup) return;
  isSignup.value = signup;
  error.value = '';
  success.value = '';
  password.value = '';
  confirmPassword.value = '';
  showPassword.value = false;
}

async function handleSubmit() {
  error.value = '';
  success.value = '';

  if (isSignup.value && password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  const endpoint = isSignup.value ? 'register' : 'login';
  const payload = isSignup.value
    ? {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        email: email.value.trim(),
        password: password.value,
      }
    : {
        email: email.value.trim(),
        password: password.value,
      };

  try {
    const response = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Something went wrong. Please try again.');
    }

    if (isSignup.value) {
      isSignup.value = false;
      password.value = '';
      confirmPassword.value = '';
      success.value = 'Registration sent! Please wait for account approval before signing in.';
    } else {
      // Single endpoint; the backend decides the account role.
      const role = String(data.user?.role || '').toUpperCase();
      const destination = role === 'STUDENT'
        ? '/student/dashboard'
        : role === 'SUPERVISOR'
          ? '/supervisor/dashboard'
          : null;

      if (!destination) {
        throw new Error('This portal currently supports Student and Supervisor accounts only.');
      }
      if (!data.token) {
        throw new Error('No login token was returned by the server.');
      }

      // Starter session for this web prototype; backend routes must verify JWT.
      sessionStorage.setItem('inzone_token', data.token);
      sessionStorage.setItem('inzone_user', JSON.stringify(data.user));
      await router.replace(destination);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to connect to the backend.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" class="auth-content">
      <main class="auth-page">
        <div class="auth-shell">
          <aside class="brand-panel">
            <div class="brand-top">
              <div class="brand-name">
                <div class="brand-mark"><IonIcon :icon="locationOutline" /></div>
                <span>InZone<span class="brand-dot">.</span></span>
              </div>
              <span class="portal-chip">STUDENT &amp; SUPERVISOR</span>
            </div>

            <div class="hero-copy">
              <p class="eyebrow"><span class="status-dot"></span> SMART OJT MONITORING</p>
              <h1>Your OJT journey,<br /><em>all in one zone.</em></h1>
              <p class="hero-description">
                One secure space for students to manage OJT progress and supervisors
                to review the internship journey.
              </p>
            </div>

            <div class="geo-visual" aria-hidden="true">
              <div class="geo-grid"></div>
              <div class="geo-ring ring-outer"></div>
              <div class="geo-ring ring-middle"></div>
              <div class="geo-ring ring-inner"></div>
              <span class="geo-dot dot-one"></span>
              <span class="geo-dot dot-two"></span>
              <div class="geo-center"><IonIcon :icon="navigateOutline" /></div>
              <div class="verified-label">
                <IonIcon :icon="checkmarkCircleOutline" />
                <div><strong>Geo-fencing ready</strong><small>Location tools after login</small></div>
              </div>
            </div>

            <p class="brand-footer">One login. The right workspace for every role.</p>
          </aside>

          <section class="form-panel" aria-label="Student and supervisor authentication">
            <div class="form-topline"><IonIcon :icon="schoolOutline" /> ONE ACCOUNT LOGIN · TWO WORKSPACES</div>
            <h2>{{ isSignup ? 'Join InZone' : 'Welcome back!' }}</h2>
            <p class="form-intro">
              {{ isSignup
                ? 'Student registration · supervisor accounts are issued by your coordinator.'
                : 'Students and supervisors sign in here using their approved account.' }}
            </p>

            <div class="mode-switch" role="group" aria-label="Choose login or registration">
              <button type="button" :class="{ active: !isSignup }" :aria-pressed="!isSignup" @click="setMode(false)">Sign in</button>
              <button type="button" :class="{ active: isSignup }" :aria-pressed="isSignup" @click="setMode(true)">Create account</button>
            </div>

            <form class="auth-form" @submit.prevent="handleSubmit">
              <div v-if="isSignup" class="name-grid">
                <div class="field">
                  <label for="firstName">First name</label>
                  <div class="input-wrap">
                    <IonIcon :icon="personOutline" />
                    <input id="firstName" v-model="firstName" placeholder="First name" autocomplete="given-name" required />
                  </div>
                </div>
                <div class="field">
                  <label for="lastName">Last name</label>
                  <div class="input-wrap">
                    <IonIcon :icon="personOutline" />
                    <input id="lastName" v-model="lastName" placeholder="Last name" autocomplete="family-name" required />
                  </div>
                </div>
              </div>

              <div class="field">
                <label for="email">Email address</label>
                <div class="input-wrap">
                  <IonIcon :icon="mailOutline" />
                  <input id="email" v-model="email" type="email" placeholder="you@example.com" autocomplete="email" required />
                </div>
              </div>

              <div class="field">
                <label for="password">Password</label>
                <div class="input-wrap">
                  <IonIcon :icon="lockClosedOutline" />
                  <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="isSignup ? 'new-password' : 'current-password'" placeholder="Enter your password" required />
                  <button class="visibility-btn" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
                    <IonIcon :icon="showPassword ? eyeOffOutline : eyeOutline" />
                  </button>
                </div>
              </div>

              <div v-if="isSignup" class="field">
                <label for="confirmPassword">Confirm password</label>
                <div class="input-wrap">
                  <IonIcon :icon="lockClosedOutline" />
                  <input id="confirmPassword" v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Re-enter your password" required />
                </div>
              </div>

              <div v-if="error" class="feedback feedback-error" role="alert">
                <IonIcon :icon="alertCircleOutline" /><span>{{ error }}</span>
              </div>
              <div v-if="success" class="feedback feedback-success" role="status">
                <IonIcon :icon="checkmarkCircleOutline" /><span>{{ success }}</span>
              </div>

              <IonButton expand="block" type="submit" class="submit-btn" :disabled="loading">
                {{ loading ? 'Please wait...' : isSignup ? 'Create student account' : 'Sign in to InZone' }}
                <IonIcon v-if="!loading" slot="end" :icon="arrowForwardOutline" />
              </IonButton>
            </form>

            <div v-if="isSignup" class="approval-note">
              <IonIcon :icon="shieldCheckmarkOutline" />
              <span>Student registration is pending until approved. Supervisor accounts must be assigned by an administrator.</span>
            </div>

            <p class="form-switch-note">
              {{ isSignup ? 'Already registered?' : 'New to InZone?' }}
              <button type="button" @click="setMode(!isSignup)">{{ isSignup ? 'Sign in' : 'Create an account' }}</button>
            </p>
            <p class="security-footer"><IonIcon :icon="shieldCheckmarkOutline" /> Secure student access · InZone © 2026</p>
          </section>
        </div>
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.auth-content { --background: #edf4f1; --color: #1b3933; }
.auth-page {
  min-height: 100%; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(circle at 8% 10%, #d5ede2 0, transparent 36%),
              radial-gradient(circle at 95% 90%, #daeee7 0, transparent 30%), #edf4f1;
}
.auth-shell {
  width: 100%; max-width: 1100px; min-height: 690px; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
  overflow: hidden; border-radius: 26px; background: white;
  border: 1px solid #d8e7e0; box-shadow: 0 25px 75px rgba(18, 70, 55, .11);
}
.brand-panel {
  position: relative; overflow: hidden; display: flex; flex-direction: column;
  padding: 36px 42px 28px; color: #fff;
  background: linear-gradient(148deg, #075e4b 2%, #064537 55%, #082e2c 100%);
}
.brand-panel::before {
  content: ''; position: absolute; width: 420px; height: 420px; top: -230px;
  right: -180px; border-radius: 50%; background: rgba(120, 236, 185, .1);
}
.brand-panel > * { position: relative; z-index: 1; }
.brand-top, .brand-name { display: flex; align-items: center; }
.brand-top { justify-content: space-between; gap: 12px; }
.brand-name { gap: 10px; font-size: 24px; font-weight: 800; letter-spacing: -.8px; }
.brand-mark { display: grid; place-items: center; width: 41px; height: 41px; border-radius: 13px; background: #e8fff2; color: #087552; font-size: 25px; }
.brand-dot { color: #64e5a6; }
.portal-chip { border: 1px solid rgba(255,255,255,.23); border-radius: 100px; padding: 8px 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #cceee1; white-space: nowrap; }
.hero-copy { margin-top: 62px; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: #9de7c7; font-size: 10px; letter-spacing: 1.8px; font-weight: 800; margin: 0 0 18px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #68e6a6; box-shadow: 0 0 0 4px #68e6a626; }
.hero-copy h1 { margin: 0; font-size: clamp(30px, 3.7vw, 46px); letter-spacing: -1.8px; line-height: 1.14; font-weight: 800; }
.hero-copy h1 em { color: #7ee9b2; font-style: normal; }
.hero-description { font-size: 14px; color: #c5e0d6; line-height: 1.75; max-width: 355px; margin: 18px 0 0; }
.geo-visual { position: relative; height: 226px; margin: 20px 0 14px; flex-shrink: 0; }
.geo-grid { position: absolute; inset: 0; background-image: linear-gradient(#ffffff10 1px, transparent 1px), linear-gradient(90deg, #ffffff10 1px, transparent 1px); background-size: 30px 30px; mask-image: radial-gradient(ellipse, black 35%, transparent 75%); }
.geo-ring { position: absolute; left: 49%; top: 50%; transform: translate(-50%, -50%); border: 1px dashed rgba(128, 239, 186, .42); border-radius: 50%; }
.ring-outer { width: 305px; height: 206px; }
.ring-middle { width: 223px; height: 150px; background: #52de9a0b; }
.ring-inner { width: 130px; height: 90px; border-style: solid; border-color: #7feab44f; background: #6adfa30a; }
.geo-center { position: absolute; left: 49%; top: 50%; transform: translate(-50%, -50%); width: 57px; height: 57px; display: grid; place-items: center; border-radius: 19px; background: #c5ffdf; color: #087758; font-size: 29px; box-shadow: 0 0 0 10px #a3efbf1f; }
.geo-dot { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #87f0b8; box-shadow: 0 0 0 5px #87f0b825; }
.dot-one { left: 18%; top: 28%; } .dot-two { right: 18%; bottom: 30%; }
.verified-label { position: absolute; right: 0; bottom: 2px; display: flex; align-items: center; gap: 8px; background: #fff; color: #155e47; padding: 10px 12px; border-radius: 12px; box-shadow: 0 10px 30px #001b1433; }
.verified-label > ion-icon { font-size: 24px; color: #13a16e; }
.verified-label strong, .verified-label small { display: block; }
.verified-label strong { font-size: 11px; } .verified-label small { color: #738d82; font-size: 9px; margin-top: 2px; }
.brand-footer { margin: auto 0 0; font-size: 10px; color: #9dc6b6; }
.form-panel { min-width: 0; display: flex; flex-direction: column; justify-content: center; padding: 45px clamp(28px, 5vw, 62px); }
.form-topline { color: #148668; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; display: flex; align-items: center; gap: 7px; }
.form-topline ion-icon { font-size: 17px; }
.form-panel h2 { font-size: clamp(26px, 3vw, 34px); font-weight: 800; letter-spacing: -.9px; color: #173d32; margin: 15px 0 6px; }
.form-intro { font-size: 13px; color: #778d83; margin: 0 0 26px; line-height: 1.6; }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; border-radius: 12px; background: #eef5f1; padding: 5px; gap: 4px; margin-bottom: 26px; }
.mode-switch button { border: 0; background: transparent; color: #647c70; min-height: 40px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; }
.mode-switch button.active { color: #086f53; background: #fff; box-shadow: 0 3px 10px #0d5a4018; }
.name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { margin-bottom: 17px; min-width: 0; }
.field label { display: block; font-size: 12px; color: #344f44; font-weight: 700; margin-bottom: 8px; }
.input-wrap { display: flex; align-items: center; gap: 10px; border: 1px solid #dbe7e1; border-radius: 11px; padding: 0 13px; height: 46px; background: #fbfdfb; transition: border-color .15s, box-shadow .15s; }
.input-wrap:focus-within { border-color: #0b9870; box-shadow: 0 0 0 3px #0b987019; }
.input-wrap > ion-icon { font-size: 18px; color: #8da59a; flex-shrink: 0; }
.input-wrap input { width: 100%; min-width: 0; border: 0; outline: none; background: transparent; color: #173d32; font: inherit; font-size: 13px; }
.input-wrap input::placeholder { color: #9aaba3; }
.visibility-btn { display: grid; place-items: center; background: transparent; border: 0; color: #7c978a; cursor: pointer; padding: 4px; flex-shrink: 0; }
.visibility-btn ion-icon { font-size: 19px; }
.submit-btn { margin: 10px 0 0; height: 48px; font-size: 13px; font-weight: 700; text-transform: none; --background: #087957; --background-hover: #086a4f; --background-activated: #086a4f; --border-radius: 11px; --box-shadow: none; }
.submit-btn ion-icon { font-size: 18px; }
.feedback { padding: 11px 12px; display: flex; align-items: flex-start; gap: 8px; border-radius: 9px; line-height: 1.5; font-size: 12px; margin: 3px 0 10px; }
.feedback ion-icon { font-size: 17px; flex-shrink: 0; margin-top: 1px; }
.feedback-error { background: #fff1f0; color: #a32925; } .feedback-success { background: #eaf8ee; color: #166343; }
.approval-note { display: flex; gap: 9px; align-items: flex-start; padding: 12px; border-radius: 10px; background: #f0f7f3; color: #5a7667; font-size: 11px; line-height: 1.5; margin-top: 15px; }
.approval-note ion-icon { font-size: 18px; color: #128965; flex-shrink: 0; }
.form-switch-note { text-align: center; color: #7a8e83; margin: 24px 0 0; font-size: 12px; }
.form-switch-note button { border: 0; color: #067f59; background: none; font-weight: 800; cursor: pointer; padding: 4px; }
.security-footer { display: flex; align-items: center; justify-content: center; gap: 6px; color: #91a59a; font-size: 10px; margin: 32px 0 0; }
.security-footer ion-icon { font-size: 14px; }
@media (max-width: 900px) {
  .auth-page { padding: 14px; }
  .brand-panel { padding: 30px 28px 24px; }
  .form-panel { padding: 34px 26px; }
  .hero-copy { margin-top: 48px; }
  .geo-visual { height: 202px; }
  .ring-outer { width: 260px; }
}
@media (max-width: 700px) {
  .auth-shell { grid-template-columns: 1fr; max-width: 490px; min-height: unset; border-radius: 20px; }
  .brand-panel { padding: 24px 26px 25px; }
  .brand-name { font-size: 21px; }
  .brand-mark { width: 36px; height: 36px; }
  .hero-copy { margin-top: 28px; }
  .hero-copy h1 { font-size: 30px; letter-spacing: -1px; }
  .hero-description { font-size: 12px; margin-top: 12px; }
  .geo-visual, .brand-footer { display: none; }
  .form-panel { padding: 30px 26px; }
  .security-footer { margin-top: 25px; }
}
@media (max-width: 390px) {
  .auth-page { padding: 8px; }
  .brand-panel { padding: 22px 20px; }
  .portal-chip { font-size: 8px; padding: 6px 8px; }
  .hero-copy h1 { font-size: 27px; }
  .form-panel { padding: 27px 19px; }
  .name-grid { grid-template-columns: 1fr; gap: 0; }
}
</style>
