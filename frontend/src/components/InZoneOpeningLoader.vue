
<script setup lang="ts">
withDefaults(
  defineProps<{
    visible?: boolean;
  }>(),
  {
    visible: true,
  }
);
</script>

<template>
  <div
    v-if="visible"
    class="opening-loader"
    role="status"
    aria-label="Opening InZone application"
  >
    <!-- Animated city map background -->
    <div class="city-map" aria-hidden="true">
      <svg
        class="map-svg"
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="cityGrid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="80"
              height="80"
              fill="#0a604c"
            />
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#19745d"
              stroke-width="2"
            />
          </pattern>
        </defs>

        <rect
          width="800"
          height="800"
          fill="url(#cityGrid)"
        />

        <!-- City blocks / buildings -->
        <g fill="#0d7055" stroke="#328b71" stroke-width="2">
          <rect x="60" y="70" width="125" height="100" rx="12" />
          <rect x="225" y="65" width="110" height="120" rx="12" />
          <rect x="545" y="60" width="155" height="110" rx="12" />

          <rect x="60" y="255" width="140" height="100" rx="12" />
          <rect x="265" y="260" width="130" height="100" rx="12" />
          <rect x="570" y="250" width="150" height="110" rx="12" />

          <rect x="50" y="465" width="140" height="135" rx="12" />
          <rect x="255" y="475" width="125" height="115" rx="12" />
          <rect x="575" y="455" width="145" height="130" rx="12" />

          <rect x="75" y="680" width="130" height="85" rx="12" />
          <rect x="290" y="665" width="160" height="95" rx="12" />
          <rect x="565" y="675" width="135" height="90" rx="12" />
        </g>

        <!-- Parks -->
        <g fill="#218866" opacity=".8">
          <rect x="410" y="75" width="95" height="95" rx="18" />
          <rect x="85" y="385" width="115" height="48" rx="15" />
          <rect x="600" y="390" width="110" height="48" rx="15" />
        </g>

        <!-- Road outlines -->
        <g
          fill="none"
          stroke="#073e33"
          stroke-width="50"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M 0 210 H 800" />
          <path d="M 0 635 H 800" />
          <path d="M 225 0 V 800" />
          <path d="M 525 0 V 800" />
          <path d="M -60 760 L 830 -40" />
        </g>

        <!-- Roads -->
        <g
          fill="none"
          stroke="#389176"
          stroke-width="36"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M 0 210 H 800" />
          <path d="M 0 635 H 800" />
          <path d="M 225 0 V 800" />
          <path d="M 525 0 V 800" />
          <path d="M -60 760 L 830 -40" />
        </g>

        <!-- Road center markings -->
        <g
          fill="none"
          stroke="#b0ead1"
          stroke-width="2"
          stroke-dasharray="12 18"
          opacity=".42"
        >
          <path d="M 0 210 H 800" />
          <path d="M 0 635 H 800" />
          <path d="M 225 0 V 800" />
          <path d="M 525 0 V 800" />
          <path d="M -60 760 L 830 -40" />
        </g>

        <!-- Animated navigation route -->
        <path
          class="route-path"
          d="M 225 740 V 635 H 525 V 210 H 400"
          fill="none"
          stroke="#b6ffdc"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <!-- Background dark overlay -->
    <div class="map-shade"></div>

    <!-- Center animation -->
    <div class="loader-center">

      <div class="location-stage">
        <div class="location-pulse pulse-one"></div>
        <div class="location-pulse pulse-two"></div>

        <div class="destination">
          <span></span>
        </div>

        <!-- Dropping pin -->
        <div class="pin-drop">
          <svg
            class="pin-icon"
            viewBox="0 0 80 100"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="pinGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stop-color="#b5ffdc" />
                <stop offset="100%" stop-color="#25d294" />
              </linearGradient>
            </defs>

            <path
              d="M40 3 C19 3 4 19 4 40
                 C4 66 40 96 40 96
                 C40 96 76 66 76 40
                 C76 19 61 3 40 3Z"
              fill="url(#pinGradient)"
              stroke="#e8fff3"
              stroke-width="3"
            />

            <circle
              cx="40"
              cy="39"
              r="15"
              fill="#07513f"
            />

            <circle
              cx="40"
              cy="39"
              r="6"
              fill="#a9ffda"
            />
          </svg>
        </div>
      </div>

      <!-- Branding -->
      <div class="brand-reveal">
        <h1>InZone<span>.</span></h1>

        <p>OJT Geo-Fencing &amp; Attendance Monitoring</p>

        <div class="loading-line">
          <span></span>
        </div>

        <div class="loading-label">
          <span class="status-dot"></span>
          Preparing your workspace
        </div>
      </div>

    </div>

    <div class="bottom-label">
      LOCATION-POWERED ATTENDANCE
    </div>
  </div>
</template>

<style scoped>
.opening-loader {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;

  background: #064b3b;
  color: #ffffff;
}

/* =========================
   CITY MAP BACKGROUND
========================= */

.city-map {
  position: absolute;
  inset: -20%;
  z-index: -3;
  transform: rotate(-13deg) scale(1.1);

  animation: mapEntrance 2.5s ease-out both;
}

.map-svg {
  width: 100%;
  height: 100%;
}

.map-shade {
  position: absolute;
  inset: 0;
  z-index: -2;

  background:
    radial-gradient(
      circle at center,
      rgba(5, 54, 42, 0.28) 0%,
      rgba(3, 38, 29, 0.65) 65%,
      rgba(2, 28, 22, 0.86) 100%
    );
}

.route-path {
  stroke-dasharray: 850;
  stroke-dashoffset: 850;
  filter: drop-shadow(0 0 6px #b1ffda);

  animation: drawRoute 1.7s ease-in-out 0.15s forwards;
}

/* =========================
   CENTER
========================= */

.loader-center {
  position: relative;
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;

  width: min(94vw, 560px);
  padding: 24px;
}

.location-stage {
  position: relative;
  width: 200px;
  height: 210px;

  display: grid;
  place-items: center;
}

/* =========================
   LOCATION TARGET
========================= */

.destination {
  position: absolute;
  bottom: 33px;
  left: 50%;
  transform: translateX(-50%);

  width: 48px;
  height: 15px;
  border-radius: 50%;
  background: #b8ffda55;

  box-shadow:
    0 0 22px #9cffc677,
    0 0 55px #38df9c44;

  opacity: 0;
  animation: targetAppear .4s ease .9s forwards;
}

.destination span {
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  border-radius: 50%;
  background: #b5ffdc;
  transform: translateY(-1px);
}

.location-pulse {
  position: absolute;
  left: 50%;
  bottom: 14px;

  width: 100px;
  height: 100px;
  margin-left: -50px;
  border: 2px solid #9dffd1;
  border-radius: 50%;

  opacity: 0;
  transform: scale(.4) rotateX(65deg);

  animation: pulseLocation 2s ease-out 1.2s infinite;
}

.pulse-two {
  animation-delay: 1.7s;
}

/* =========================
   PIN DROP
========================= */

.pin-drop {
  position: absolute;
  left: 50%;
  bottom: 45px;
  width: 80px;
  height: 100px;

  margin-left: -40px;

  opacity: 0;
  transform: translateY(-160px) scale(.8);

  animation: dropPin .85s cubic-bezier(.2,.8,.25,1.2)
    .55s forwards;
}

.pin-icon {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 12px 16px #00261b88);
}

/* =========================
   INZONE BRAND
========================= */

.brand-reveal {
  opacity: 0;
  transform: translateY(20px);

  animation: revealBrand .65s ease 1.45s forwards;
}

.brand-reveal h1 {
  margin: 0;
  font-size: clamp(42px, 7vw, 64px);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -2px;
  color: #ffffff;
}

.brand-reveal h1 span {
  color: #9cffcb;
}

.brand-reveal p {
  margin: 12px auto 0;
  max-width: 340px;

  font-size: 13px;
  line-height: 1.7;
  letter-spacing: .2px;
  color: #d3f2e4;
}

.loading-line {
  width: 175px;
  height: 5px;

  margin: 25px auto 17px;
  overflow: hidden;

  border-radius: 999px;
  background: #ffffff33;
}

.loading-line span {
  display: block;
  height: 100%;
  width: 40%;

  border-radius: inherit;
  background: #b2ffd7;

  animation: loadingMove 1.2s ease-in-out infinite;
}

.loading-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  font-size: 11px;
  font-weight: 600;
  letter-spacing: .4px;
  color: #b7e3cb;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a9ffd4;
  box-shadow: 0 0 10px #9cffcb;

  animation: statusPulse 1s ease-in-out infinite;
}

.bottom-label {
  position: absolute;
  bottom: calc(29px + env(safe-area-inset-bottom, 0px));
  left: 0;
  right: 0;

  text-align: center;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 2.5px;
  color: #a9dbc4;

  opacity: 0;
  animation: targetAppear .5s ease 1.8s forwards;
}

/* =========================
   ANIMATIONS
========================= */

@keyframes mapEntrance {
  from {
    opacity: 0;
    transform: rotate(-13deg) scale(1.35);
  }

  to {
    opacity: 1;
    transform: rotate(-13deg) scale(1.1);
  }
}

@keyframes drawRoute {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes targetAppear {
  to {
    opacity: 1;
  }
}

@keyframes dropPin {
  0% {
    opacity: 0;
    transform: translateY(-160px) scale(.8);
  }

  65% {
    opacity: 1;
    transform: translateY(10px) scale(1.05);
  }

  82% {
    transform: translateY(-7px) scale(.97);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pulseLocation {
  0% {
    opacity: .8;
    transform: scale(.35) rotateX(65deg);
  }

  100% {
    opacity: 0;
    transform: scale(2) rotateX(65deg);
  }
}

@keyframes revealBrand {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes loadingMove {
  from {
    transform: translateX(-110%);
  }

  to {
    transform: translateX(370%);
  }
}

@keyframes statusPulse {
  50% {
    opacity: .4;
    transform: scale(.8);
  }
}

/* =========================
   MOBILE
========================= */

@media (max-width: 600px) {
  .city-map {
    inset: -35%;
  }

  .location-stage {
    width: 165px;
    height: 190px;
  }

  .pin-drop {
    width: 70px;
    height: 88px;
    margin-left: -35px;
  }

  .brand-reveal h1 {
    font-size: 45px;
  }

  .brand-reveal p {
    font-size: 12px;
    max-width: 270px;
  }

  .bottom-label {
    letter-spacing: 1.5px;
  }
}

/* =========================
   REDUCED MOTION
========================= */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
  }

  .city-map {
    opacity: 1;
    transform: rotate(-13deg) scale(1.1);
  }

  .route-path {
    stroke-dashoffset: 0;
  }

  .pin-drop {
    opacity: 1;
    transform: none;
  }

  .destination,
  .brand-reveal,
  .bottom-label {
    opacity: 1;
    transform: none;
  }

  .location-pulse {
    display: none;
  }
}
</style>
