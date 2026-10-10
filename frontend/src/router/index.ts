import { createRouter, createWebHistory } from "@ionic/vue-router";
import type { RouteRecordRaw } from "vue-router";

// One public login page for Student and Supervisor.
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Welcome",
    component: () => import("../views/Welcome.vue"),
  },

  // Older links still work, but open the same shared login page.
  { path: "/home", redirect: "/" },
  { path: "/supervisor/login", redirect: "/" },

  // Student panel
  {
    path: "/student/dashboard",
    name: "StudentDashboard",
    component: () => import("../views/student/StudentDashboard.vue"),
    meta: { requiresAuth: true, role: "STUDENT" },
  },
  {
    path: "/student/profile",
    name: "OJTProfile",
    component: () => import("../views/student/OJTProfile.vue"),
    meta: { requiresAuth: true, role: "STUDENT" },
  },

  {
    path: "/student/attendance",
    name: "StudentAttendance",
    component: () => import("../views/student/StudentAttendance.vue"),
    meta: { requiresAuth: true, role: "STUDENT" },
  },

  // Supervisor panel
  {
    path: "/supervisor/dashboard",
    name: "SupervisorDashboard",
    component: () => import("../views/supervisor/SupervisorDashboard.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;

  const token = sessionStorage.getItem("inzone_token");
  const rawUser = sessionStorage.getItem("inzone_user");
  if (!token || !rawUser) return "/";

  try {
    const user = JSON.parse(rawUser);
    const role = String(user?.role || "").toUpperCase();
    if (role !== String(to.meta.role || "").toUpperCase()) return "/";
    return true;
  } catch {
    sessionStorage.removeItem("inzone_token");
    sessionStorage.removeItem("inzone_user");
    return "/";
  }
});

export default router;
