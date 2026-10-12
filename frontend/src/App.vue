<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import InZoneOpeningLoader from '@/components/InZoneOpeningLoader.vue';

const showOpeningLoader = ref(true);

onMounted(() => {
  setTimeout(() => {
    showOpeningLoader.value = false;
  }, 5000);
});
</script>

<template>
  <IonApp>
    <IonRouterOutlet />

    <Transition name="splash-fade">
      <InZoneOpeningLoader
        v-if="showOpeningLoader"
        :visible="true"
      />
    </Transition>
  </IonApp>
</template>

<style>
.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: opacity 0.45s ease;
}

.splash-fade-enter-from,
.splash-fade-leave-to {
  opacity: 0;
}
</style>