import { createRouter, createWebHistory } from "@ionic/vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Welcome",
    component: () => import("../views/Welcome.vue"),
  },
  { path: "/home", redirect: "/" },
  { path: "/supervisor/login", redirect: "/" },
  { path: "/admin/login", redirect: "/" },

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
  {
    path: "/student/track",
    name: "StudentTrack",
    component: () => import("../views/student/TrackPage.vue"),
    meta: { requiresAuth: true, role: "STUDENT" },
  },
  {
    path: "/student/reports",
    name: "StudentReports",
    component: () => import("../views/student/StudentReports.vue"),
    meta: { requiresAuth: true, role: "STUDENT" },
  },

  // Supervisor panel
  {
    path: "/supervisor/dashboard",
        name: "SupervisorDashboard",
    component: () => import("../views/supervisor/SupervisorDashboard.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
  {
    path: "/supervisor/students",
    name: "SupervisorStudents",
    component: () => import("../views/supervisor/SupervisorStudents.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
  {
    path: "/supervisor/students/:studentId",
    name: "SupervisorStudentDetail",
    component: () => import("../views/supervisor/SupervisorStudentDetail.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
  {
    path: "/supervisor/reports",
    name: "SupervisorReports",
    component: () => import("../views/supervisor/SupervisorReports.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
  {
    path: "/supervisor/attendance",
    name: "SupervisorAttendance",
    component: () => import("../views/supervisor/SupervisorAttendance.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR" },
  },
  {
    path: "/supervisor/profile",
    name: "SupervisorProfile",
    component: () => import("../views/supervisor/SupervisorProfile.vue"),
    meta: { requiresAuth: true, role: "SUPERVISOR"},
  },

  // Admin panel
  {
    path: "/admin/dashboard",
    name: "AdminDashboard",
    component: () => import("../views/admin/AdminDashboard.vue"),
    meta: { requiresAuth: true, role: "ADMIN" },
  },
  {
    path: "/admin/ojt-approvals",
    name: "AdminOJTApprovals",
    component: () => import("../views/admin/OJTApprovals.vue"),
    meta: { requiresAuth: true, role: "ADMIN" },
  },
  {
    path: "/admin/students",
    name: "AdminStudents",
    // Preserves the existing filename in YOUR router.
    component: () => import("../views/admin/AdminStudents.vue"),
    meta: { requiresAuth: true, role: "ADMIN" },
  },
  {
    path: "/admin/users",
    name: "AdminUsers",
    component: () => import("../views/admin/UserManagement.vue"),
    meta: { requiresAuth: true, role: "ADMIN" },
  },

  {
    path: "/admin/reports",
    name: "AdminReports",
    component: () => import("../views/admin/AdminReports.vue"),
    meta: {
      requiresAuth: true,
      role: "ADMIN",
    },
  },

  {
    path: "/admin/profile",
    name: "AdminProfile",
    component: () => import("../views/admin/AdminProfile.vue"),
    meta: {
      requiresAuth: true,
      role: "ADMIN",
    },
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
