
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';

import {
  peopleOutline,
  checkmarkCircleOutline,
  timeOutline,
  shieldCheckmarkOutline,
  searchOutline,
  refreshOutline,
  alertCircleOutline,
  closeCircleOutline,
  personOutline,
  mailOutline,
  eyeOutline,
  closeOutline,
  createOutline,
  saveOutline,
  keyOutline,
  arrowBackOutline,
  lockClosedOutline,
} from 'ionicons/icons';

import InZoneTopbar from '@/components/InZoneTopbar.vue';
import AdminBottomNav from './AdminBottomNav.vue';

// =====================================
// TYPES
// =====================================
type Role = 'STUDENT' | 'SUPERVISOR' | 'ADMIN';
type Decision = 'APPROVED' | 'REJECTED';

type PendingAction =
  | { kind: 'status'; value: Decision }
  | { kind: 'role'; value: Role };

interface Account {
  id: string | number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at?: string | null;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  users?: Account[];
  user?: Account;
}

// =====================================
// API AND STATES
// =====================================
const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const loading = ref(true);
const saving = ref(false);

const error = ref('');
const success = ref('');

const accounts = ref<Account[]>([]);

const search = ref('');
const roleFilter = ref('ALL');
const statusFilter = ref('ALL');

const selectedAccount = ref<Account | null>(null);

const editing = ref(false);

const modalError = ref('');
const modalSuccess = ref('');

const selectedRole = ref<Role>('STUDENT');

const pendingAction =
  ref<PendingAction | null>(null);

const editForm = reactive({
  first_name: '',
  last_name: '',
  email: '',
});

// =====================================
// ACCOUNT HELPERS
// =====================================
function nameOf(account: Account): string {
  return (
    [
      account.first_name,
      account.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Unnamed User'
  );
}

function initials(account: Account): string {
  const first =
    account.first_name?.trim().charAt(0) || '';

  const last =
    account.last_name?.trim().charAt(0) || '';

  return (
    `${first}${last}`.toUpperCase() || 'U'
  );
}

function roleOf(account: Account): string {
  return String(
    account.role || 'UNKNOWN'
  ).toUpperCase();
}

function statusOf(account: Account): string {
  return String(
    account.status || 'UNKNOWN'
  ).toUpperCase();
}

function statusIcon(account: Account): string {
  const status = statusOf(account);

  if (status === 'APPROVED') {
    return checkmarkCircleOutline;
  }

  if (status === 'PENDING') {
    return timeOutline;
  }

  return closeCircleOutline;
}

// =====================================
// CURRENT LOGGED-IN ADMIN
// =====================================
function currentAdminId(): string {
  try {
    const raw = sessionStorage.getItem(
      'inzone_user'
    );

    return raw
      ? String(JSON.parse(raw)?.id ?? '')
      : '';
  } catch {
    return '';
  }
}

const isSelf = computed(() => {
  return (
    !!selectedAccount.value &&
    String(selectedAccount.value.id) ===
      currentAdminId()
  );
});

// =====================================
// SEARCH AND FILTER
// =====================================
const filteredAccounts = computed(() => {
  const query = search.value
    .trim()
    .toLowerCase();

  return accounts.value.filter((account) => {
    const searchable = [
      nameOf(account),
      account.email || '',
      String(account.id),
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch =
      !query || searchable.includes(query);

    const matchesRole =
      roleFilter.value === 'ALL' ||
      roleOf(account) === roleFilter.value;

    const matchesStatus =
      statusFilter.value === 'ALL' ||
      statusOf(account) === statusFilter.value;

    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus
    );
  });
});

// =====================================
// SUMMARY COUNTS
// =====================================
const totalApproved = computed(() => {
  return accounts.value.filter(
    (account) =>
      statusOf(account) === 'APPROVED'
  ).length;
});

const totalPending = computed(() => {
  return accounts.value.filter(
    (account) =>
      statusOf(account) === 'PENDING'
  ).length;
});

const totalAdmins = computed(() => {
  return accounts.value.filter(
    (account) =>
      roleOf(account) === 'ADMIN'
  ).length;
});

// =====================================
// CHECK ROLE CHANGE PERMISSION
// =====================================
const canSaveRole = computed(() => {
  const account = selectedAccount.value;

  return (
    !!account &&
    !saving.value &&
    !isSelf.value &&
    selectedRole.value !== roleOf(account) &&
    (
      selectedRole.value !== 'ADMIN' ||
      statusOf(account) === 'APPROVED'
    )
  );
});

// =====================================
// API REQUEST
// =====================================
async function apiFetch(
  path: string,
  method = 'GET',
  body?: Record<string, string>
): Promise<ApiResponse> {
  const token = sessionStorage.getItem(
    'inzone_token'
  );

  if (!token) {
    throw new Error(
      'Your Admin session has expired. Please log in again.'
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body
          ? {
              'Content-Type': 'application/json',
            }
          : {}),
      },
      ...(body
        ? {
            body: JSON.stringify(body),
          }
        : {}),
      cache: 'no-store',
    }
  );

  const data = (await response
    .json()
    .catch(() => ({}))) as ApiResponse;

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        `Unable to complete request (HTTP ${response.status}).`
    );
  }

  return data;
}

// =====================================
// LOAD ALL USERS
// GET /api/admin/users
// =====================================
async function loadAccounts() {
  if (
    loading.value &&
    accounts.value.length > 0
  ) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const data = await apiFetch(
      '/api/admin/users'
    );

    if (!Array.isArray(data.users)) {
      throw new Error(
        'Invalid Users API response.'
      );
    }

    accounts.value = data.users;

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Unable to load users.';

  } finally {
    loading.value = false;
  }
}

// =====================================
// OPEN MANAGE USER MODAL
// =====================================
function openManage(account: Account) {
  selectedAccount.value = account;

  editing.value = false;

  modalError.value = '';
  modalSuccess.value = '';

  pendingAction.value = null;

  const currentRole = roleOf(account);

  selectedRole.value = (
    ['STUDENT', 'SUPERVISOR', 'ADMIN'].includes(
      currentRole
    )
      ? currentRole
      : 'STUDENT'
  ) as Role;

  editForm.first_name =
    account.first_name || '';

  editForm.last_name =
    account.last_name || '';

  editForm.email =
    account.email || '';
}

// =====================================
// CLOSE MODAL
// =====================================
function closeManage() {
  if (
    saving.value ||
    pendingAction.value
  ) {
    return;
  }

  selectedAccount.value = null;

  editing.value = false;

  modalError.value = '';
  modalSuccess.value = '';
}

// =====================================
// START EDITING
// =====================================
function beginEdit() {
  const account = selectedAccount.value;

  if (!account) return;

  editForm.first_name =
    account.first_name || '';

  editForm.last_name =
    account.last_name || '';

  editForm.email =
    account.email || '';

  modalError.value = '';
  modalSuccess.value = '';

  editing.value = true;
}

// =====================================
// CANCEL EDIT
// =====================================
function cancelEdit() {
  if (saving.value) return;

  editing.value = false;
  modalError.value = '';
}

// =====================================
// UPDATE LOCAL ACCOUNT
// =====================================
function updateLocalAccount(
  updated: Account
) {
  accounts.value = accounts.value.map(
    (account) =>
      String(account.id) ===
      String(updated.id)
        ? updated
        : account
  );

  selectedAccount.value = updated;

  const newRole = roleOf(updated);

  if (
    ['STUDENT', 'SUPERVISOR', 'ADMIN'].includes(
      newRole
    )
  ) {
    selectedRole.value = newRole as Role;
  }
}

// =====================================
// SAVE USER INFORMATION
// PATCH /api/admin/users/:userId
// =====================================
async function saveDetails() {
  const account = selectedAccount.value;

  if (!account || saving.value) return;

  modalError.value = '';
  modalSuccess.value = '';

  const first_name =
    editForm.first_name.trim();

  const last_name =
    editForm.last_name.trim();

  const email =
    editForm.email.trim().toLowerCase();

  if (
    !first_name ||
    !last_name ||
    !email
  ) {
    modalError.value =
      'First name, last name, and email are required.';
    return;
  }

  if (
    first_name.length > 100 ||
    last_name.length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    modalError.value =
      'Please enter valid names and email address.';
    return;
  }

  saving.value = true;

  try {
    const data = await apiFetch(
      `/api/admin/users/${encodeURIComponent(
        String(account.id)
      )}`,
      'PATCH',
      {
        first_name,
        last_name,
        email,
      }
    );

    if (!data.user) {
      throw new Error(
        'Updated user was not returned by the server.'
      );
    }

    updateLocalAccount(data.user);

    editing.value = false;

    modalSuccess.value =
      'User information saved successfully.';

  } catch (err) {
    modalError.value =
      err instanceof Error
        ? err.message
        : 'Unable to save changes.';

  } finally {
    saving.value = false;
  }
}

// =====================================
// ACCOUNT APPROVAL
// =====================================
function askStatus(status: Decision) {
  const account = selectedAccount.value;

  if (
    !account ||
    saving.value ||
    isSelf.value ||
    statusOf(account) !== 'PENDING'
  ) {
    return;
  }

  pendingAction.value = {
    kind: 'status',
    value: status,
  };

  modalError.value = '';
  modalSuccess.value = '';
}

// =====================================
// CHANGE USER ROLE
// =====================================
function askRole() {
  if (!canSaveRole.value) return;

  pendingAction.value = {
    kind: 'role',
    value: selectedRole.value,
  };

  modalError.value = '';
  modalSuccess.value = '';
}

// =====================================
// CONFIRM ACCOUNT ACTION
// =====================================
async function confirmAction() {
  const account = selectedAccount.value;
  const action = pendingAction.value;

  if (
    !account ||
    !action ||
    saving.value
  ) {
    return;
  }

  saving.value = true;

  modalError.value = '';
  modalSuccess.value = '';

  try {
    const path =
      action.kind === 'status'
        ? 'status'
        : 'role';

    // Prevents the previous TypeScript
    // union-object payload error.
    const payload: Record<string, string> = {};

    if (action.kind === 'status') {
      payload.status = action.value;
    } else {
      payload.role = action.value;
    }

    const data = await apiFetch(
      `/api/admin/users/${encodeURIComponent(
        String(account.id)
      )}/${path}`,
      'PATCH',
      payload
    );

    if (!data.user) {
      throw new Error(
        'Updated account was not returned by the server.'
      );
    }

    updateLocalAccount(data.user);

    const message =
      action.kind === 'status'
        ? `Account ${action.value.toLowerCase()} successfully.`
        : 'Role updated successfully. The affected user must log in again.';

    modalSuccess.value = message;
    success.value = message;

    pendingAction.value = null;

  } catch (err) {
    modalError.value =
      err instanceof Error
        ? err.message
        : 'Unable to update account.';

    pendingAction.value = null;

  } finally {
    saving.value = false;
  }
}

// =====================================
// LOAD WHEN ENTERING PAGE
// =====================================
onIonViewWillEnter(() => {
  void loadAccounts();
});
</script>

<template>
  <IonPage>

    <IonContent
      :fullscreen="true"
      class="users-content"
    >
      <InZoneTopbar role="ADMIN" />

      <main class="users-container">

        <!-- PAGE HEADER -->
        <header class="page-header">
          <div>
            <span class="section-label">
              <IonIcon
                :icon="shieldCheckmarkOutline"
              />
              ADMIN · PEOPLE
            </span>

            <h1>
              User Management<span>.</span>
            </h1>

            <p>
              Manage InZone user accounts,
              approvals, and access permissions.
            </p>
          </div>

          <button
            type="button"
            class="refresh-button"
            :disabled="loading"
            @click="loadAccounts"
          >
            <IonIcon
              :icon="refreshOutline"
              :class="{ spinning: loading }"
            />
            Refresh
          </button>
        </header>

        <!-- SUMMARY CARDS -->
        <section
          class="summary-grid"
          aria-label="User account summary"
        >

          <article class="summary-card">
            <div class="summary-icon green">
              <IonIcon :icon="peopleOutline" />
            </div>

            <span>Total Users</span>

            <strong>
              {{
                loading
                  ? '—'
                  : accounts.length
              }}
            </strong>

            <small>
              All registered InZone accounts
            </small>
          </article>

          <article class="summary-card">
            <div class="summary-icon blue">
              <IonIcon
                :icon="checkmarkCircleOutline"
              />
            </div>

            <span>Approved Accounts</span>

            <strong>
              {{
                loading
                  ? '—'
                  : totalApproved
              }}
            </strong>

            <small>
              Accounts allowed to log in
            </small>
          </article>

          <article class="summary-card">
            <div class="summary-icon amber">
              <IonIcon :icon="timeOutline" />
            </div>

            <span>Pending Accounts</span>

            <strong>
              {{
                loading
                  ? '—'
                  : totalPending
              }}
            </strong>

            <small>
              Awaiting administrator review
            </small>
          </article>

          <article class="summary-card">
            <div class="summary-icon rose">
              <IonIcon
                :icon="shieldCheckmarkOutline"
              />
            </div>

            <span>Administrators</span>

            <strong>
              {{
                loading
                  ? '—'
                  : totalAdmins
              }}
            </strong>

            <small>
              Accounts with Admin role
            </small>
          </article>

        </section>

        <!-- ERROR -->
        <div
          v-if="error"
          class="error-banner"
          role="alert"
        >
          <IonIcon
            :icon="alertCircleOutline"
          />

          <span>{{ error }}</span>
        </div>

        <!-- SUCCESS -->
        <div
          v-if="success"
          class="success-banner"
          role="status"
        >
          <IonIcon
            :icon="checkmarkCircleOutline"
          />

          <span>{{ success }}</span>
        </div>

        <!-- USER DIRECTORY -->
        <section class="users-panel">

          <div class="panel-heading">
            <div>
              <span class="section-label">
                USER DIRECTORY
              </span>

              <h2>All Users</h2>

              <p>
                Find registered accounts,
                update user information,
                and manage access.
              </p>
            </div>

            <span class="results-label">
              {{
                filteredAccounts.length
              }}
              users
            </span>
          </div>

          <!-- SEARCH AND FILTERS -->
          <div class="toolbar">

            <label class="search-box">
              <IonIcon
                :icon="searchOutline"
              />

              <input
                v-model="search"
                type="search"
                placeholder="Search user name or email..."
                aria-label="Search users"
              />
            </label>

            <select
              v-model="roleFilter"
              class="filter-select"
              aria-label="Filter by role"
            >
              <option value="ALL">
                All Roles
              </option>

              <option value="STUDENT">
                Students
              </option>

              <option value="SUPERVISOR">
                Supervisors
              </option>

              <option value="ADMIN">
                Admins
              </option>
            </select>

            <select
              v-model="statusFilter"
              class="filter-select"
              aria-label="Filter by account status"
            >
              <option value="ALL">
                All Statuses
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="REJECTED">
                Rejected
              </option>
            </select>

          </div>

          <!-- LOADING ANIMATION -->
          <div
            v-if="loading"
            class="empty-state"
            role="status"
            aria-live="polite"
          >
            <IonIcon
              :icon="refreshOutline"
              class="spinning"
            />

            <h3>
              Loading users...
            </h3>

            <p>
              Retrieving account information
              from InZone.
            </p>
          </div>

          <!-- ERROR EMPTY STATE -->
          <div
            v-else-if="
              error &&
              accounts.length === 0
            "
            class="empty-state"
          >
            <IonIcon
              :icon="alertCircleOutline"
            />

            <h3>
              Unable to Load Users
            </h3>

            <p>
              Check your backend connection
              and try Refresh.
            </p>
          </div>

          <!-- NO RESULTS -->
          <div
            v-else-if="
              filteredAccounts.length === 0
            "
            class="empty-state"
          >
            <IonIcon
              :icon="peopleOutline"
            />

            <h3>
              {{
                accounts.length
                  ? 'No Matching Users'
                  : 'No Registered Users'
              }}
            </h3>

            <p>
              {{
                accounts.length
                  ? 'Try another search or filter.'
                  : 'User accounts will appear here when registered.'
              }}
            </p>
          </div>

          <!-- USER LIST -->
          <div
            v-else
            class="user-list"
          >
            <article
              v-for="account in filteredAccounts"
              :key="account.id"
              class="user-row"
            >

              <div class="user-avatar">
                {{ initials(account) }}
              </div>

              <div class="user-main">

                <h3>
                  {{ nameOf(account) }}

                  <small
                    v-if="
                      String(account.id) ===
                      currentAdminId()
                    "
                  >
                    (You)
                  </small>
                </h3>

                <p>
                  <IonIcon
                    :icon="mailOutline"
                  />

                  {{
                    account.email ||
                    'No email registered'
                  }}
                </p>

                <p>
                  <IonIcon
                    :icon="keyOutline"
                  />

                  {{ roleOf(account) }}
                  account
                </p>

              </div>

              <div class="user-status">
                <span
                  class="status-badge"
                  :class="
                    statusOf(account).toLowerCase()
                  "
                >
                  <IonIcon
                    :icon="statusIcon(account)"
                  />

                  {{ statusOf(account) }}
                </span>
              </div>

              <button
                type="button"
                class="details-button"
                @click="openManage(account)"
              >
                <IonIcon
                  :icon="eyeOutline"
                />

                Manage User
              </button>

            </article>
          </div>

        </section>

      </main>
    </IonContent>

    <AdminBottomNav />

    <!-- USER MANAGEMENT MODAL -->
    <div
      v-if="selectedAccount"
      class="modal-overlay"
      @click.self="closeManage"
    >
      <section
        class="user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
      >

        <!-- MODAL HEADER -->
        <div class="modal-header">

          <div class="modal-person">

            <div class="modal-avatar">
              {{ initials(selectedAccount) }}
            </div>

            <div>
              <span>
                USER MANAGEMENT
              </span>

              <h2 id="user-detail-title">
                {{
                  editing
                    ? 'Edit User'
                    : nameOf(selectedAccount)
                }}
              </h2>

              <p>
                {{
                  selectedAccount.email ||
                  'No email'
                }}
              </p>
            </div>

          </div>

          <button
            type="button"
            class="close-button"
            aria-label="Close user details"
            :disabled="saving"
            @click="closeManage"
          >
            <IonIcon
              :icon="closeOutline"
            />
          </button>

        </div>

        <!-- ACCOUNT STATUS -->
        <div class="modal-status-row">

          <span>Account Status</span>

          <span
            class="status-badge"
            :class="
              statusOf(selectedAccount).toLowerCase()
            "
          >
            <IonIcon
              :icon="statusIcon(selectedAccount)"
            />

            {{ statusOf(selectedAccount) }}
          </span>

        </div>

        <!-- MODAL ERROR -->
        <div
          v-if="modalError"
          class="edit-feedback edit-error"
          role="alert"
        >
          <IonIcon
            :icon="alertCircleOutline"
          />

          {{ modalError }}
        </div>

        <!-- MODAL SUCCESS -->
        <div
          v-if="modalSuccess"
          class="edit-feedback edit-success"
          role="status"
        >
          <IonIcon
            :icon="checkmarkCircleOutline"
          />

          {{ modalSuccess }}
        </div>

        <!-- EDIT USER FORM -->
        <form
          v-if="editing"
          class="edit-form"
          @submit.prevent="saveDetails"
        >

          <div class="edit-title">
            <IonIcon
              :icon="personOutline"
            />

            <div>
              <h3>
                Update User Information
              </h3>

              <p>
                Changes will be saved
                to this account.
              </p>
            </div>
          </div>

          <div class="edit-fields">

            <label class="edit-field">
              <span>First name *</span>

              <input
                v-model="editForm.first_name"
                type="text"
                maxlength="100"
                required
                :disabled="saving"
              />
            </label>

            <label class="edit-field">
              <span>Last name *</span>

              <input
                v-model="editForm.last_name"
                type="text"
                maxlength="100"
                required
                :disabled="saving"
              />
            </label>

            <label class="edit-field full">
              <span>Email address *</span>

              <input
                v-model="editForm.email"
                type="email"
                maxlength="254"
                required
                :disabled="saving"
              />
            </label>

          </div>

          <div class="modal-actions">

            <button
              type="button"
              class="secondary-button"
              :disabled="saving"
              @click="cancelEdit"
            >
              <IonIcon
                :icon="arrowBackOutline"
              />
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
              :disabled="saving"
            >
              <IonIcon
                :icon="saveOutline"
              />

              {{
                saving
                  ? 'Saving...'
                  : 'Save Changes'
              }}
            </button>

          </div>
        </form>

        <!-- VIEW USER DETAILS -->
        <template v-else>

          <h3 class="detail-section-title">
            <IonIcon
              :icon="personOutline"
            />

            User Information
          </h3>

          <div class="details-grid">

            <div class="detail-item">
              <span>First name</span>

              <strong>
                {{
                  selectedAccount.first_name ||
                  'Not set'
                }}
              </strong>
            </div>

            <div class="detail-item">
              <span>Last name</span>

              <strong>
                {{
                  selectedAccount.last_name ||
                  'Not set'
                }}
              </strong>
            </div>

            <div class="detail-item full-width">
              <span>Email address</span>

              <strong>
                {{
                  selectedAccount.email ||
                  'Not set'
                }}
              </strong>
            </div>

            <div class="detail-item full-width">
              <span>Current role</span>

              <strong>
                {{ roleOf(selectedAccount) }}
              </strong>
            </div>

          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="primary-button"
              :disabled="saving"
              @click="beginEdit"
            >
              <IonIcon
                :icon="createOutline"
              />

              Edit User
            </button>
          </div>

          <!-- ROLE MANAGEMENT -->
          <h3 class="detail-section-title">
            <IonIcon
              :icon="keyOutline"
            />

            Role & Permissions
          </h3>

          <p class="modal-note">
            Choose a role for this account.
            Role changes take effect on the
            next login.
          </p>

          <div class="role-control">

            <label class="role-field">
              <span>Assign role</span>

              <select
                v-model="selectedRole"
                :disabled="saving || isSelf"
                aria-label="New account role"
              >
                <option value="STUDENT">
                  Student
                </option>

                <option value="SUPERVISOR">
                  Supervisor
                </option>

                <option value="ADMIN">
                  Admin
                </option>
              </select>
            </label>

            <button
              type="button"
              class="secondary-button"
              :disabled="!canSaveRole"
              @click="askRole"
            >
              <IonIcon
                :icon="shieldCheckmarkOutline"
              />

              Change Role
            </button>

          </div>

          <p
            v-if="isSelf"
            class="modal-note"
          >
            You cannot change your own
            Admin role.
          </p>

          <p
            v-else-if="
              selectedRole === 'ADMIN' &&
              statusOf(selectedAccount) !==
                'APPROVED'
            "
            class="modal-note"
          >
            Approve this account before
            assigning the Admin role.
          </p>

          <!-- ACCOUNT APPROVAL -->
          <h3 class="detail-section-title">
            <IonIcon
              :icon="lockClosedOutline"
            />

            Account Approval
          </h3>

          <template
            v-if="
              statusOf(selectedAccount) ===
                'PENDING' &&
              !isSelf
            "
          >
            <p class="modal-note">
              This account is awaiting Admin
              approval. This is separate
              from OJT Profile approval.
            </p>

            <div class="modal-actions">

              <button
                type="button"
                class="primary-button"
                :disabled="saving"
                @click="
                  askStatus('APPROVED')
                "
              >
                <IonIcon
                  :icon="checkmarkCircleOutline"
                />

                Approve Account
              </button>

              <button
                type="button"
                class="danger-button"
                :disabled="saving"
                @click="
                  askStatus('REJECTED')
                "
              >
                <IonIcon
                  :icon="closeCircleOutline"
                />

                Reject Account
              </button>

            </div>
          </template>

          <p
            v-else
            class="modal-note"
          >
            Account status:

            <strong>
              {{ statusOf(selectedAccount) }}
            </strong>

            Only pending accounts can be
            reviewed through this API.
          </p>

        </template>

      </section>
    </div>

    <!-- CONFIRMATION POPUP -->
    <div
      v-if="pendingAction"
      class="confirm-overlay"
    >
      <section
        class="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >

        <div
          class="confirm-icon"
          :class="{
            danger:
              pendingAction.kind === 'status' &&
              pendingAction.value === 'REJECTED'
          }"
        >
          <IonIcon
            :icon="
              pendingAction.kind === 'role'
                ? keyOutline
                : pendingAction.value === 'APPROVED'
                  ? checkmarkCircleOutline
                  : closeCircleOutline
            "
          />
        </div>

        <h3 id="confirm-title">
          {{
            pendingAction.kind === 'role'
              ? 'Confirm Role Change'
              : 'Confirm Account Decision'
          }}
        </h3>

        <p v-if="selectedAccount">
          {{
            pendingAction.kind === 'role'
              ? `Change ${nameOf(selectedAccount)} to ${pendingAction.value}?`
              : `${pendingAction.value === 'APPROVED' ? 'Approve' : 'Reject'} ${nameOf(selectedAccount)}'s account?`
          }}
        </p>

        <p class="modal-note">
          This change will be saved
          to the InZone database.
        </p>

        <div class="modal-actions">

          <button
            type="button"
            class="secondary-button"
            :disabled="saving"
            @click="
              pendingAction = null
            "
          >
            Cancel
          </button>

          <button
            type="button"
            class="primary-button"
            :disabled="saving"
            @click="confirmAction"
          >
            {{
              saving
                ? 'Processing...'
                : 'Confirm'
            }}
          </button>

        </div>

      </section>
    </div>

  </IonPage>
</template>

<style scoped>
/* =====================================
   MAIN PAGE
===================================== */

.users-content {
  --background: #f2f8f4;
  --color: #183d30;
}

.users-container {
  max-width: 1190px;
  margin: 0 auto;

  padding:
    16px clamp(16px, 4vw, 46px)
    calc(
      145px +
      env(safe-area-inset-bottom, 0px)
    );
}

button,
input,
select {
  font-family: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* =====================================
   PAGE HEADER
===================================== */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
}

.section-label {
  color: #0c986c;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.4px;

  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.page-header h1 {
  font-size: clamp(30px, 4vw, 43px);
  color: #133e30;
  margin: 12px 0 7px;
  font-weight: 850;
  letter-spacing: -1.2px;
  line-height: 1.15;
}

.page-header h1 span {
  color: #16a576;
}

.page-header p {
  color: #788f81;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 12px 17px;

  background: #ffffff;
  border: 1px solid #d6e8dc;
  border-radius: 12px;

  color: #087b59;
  font-size: 12px;
  font-weight: 800;
}

/* =====================================
   SUMMARY CARDS
===================================== */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));

  gap: 14px;
  margin-bottom: 23px;
}

.summary-card {
  padding: 19px;
  background: #ffffff;
  border: 1px solid #dfebe3;
  border-radius: 17px;

  box-shadow:
    0 7px 23px #164f3509;
}

.summary-icon {
  display: grid;
  place-items: center;

  width: 43px;
  height: 43px;
  border-radius: 12px;
  font-size: 22px;
}

.summary-icon.green {
  background: #e4f7ea;
  color: #0b825d;
}

.summary-icon.blue {
  background: #e8f2fc;
  color: #2b76a8;
}

.summary-icon.amber {
  background: #fff3db;
  color: #ad7b25;
}

.summary-icon.rose {
  background: #ffeae8;
  color: #ba5148;
}

.summary-card > span {
  display: block;
  font-size: 11px;
  font-weight: 750;
  color: #809687;

  margin: 15px 0 7px;
}

.summary-card > strong {
  display: block;
  font-size: 28px;
  font-weight: 850;
  color: #18432f;
}

.summary-card small {
  display: block;
  color: #9baa9d;
  font-size: 10px;
  margin-top: 7px;
}

/* =====================================
   USER DIRECTORY
===================================== */

.users-panel {
  padding: 23px;
  background: #ffffff;
  border: 1px solid #dfeae3;
  border-radius: 20px;

  box-shadow:
    0 7px 23px #164f3509;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.panel-heading h2 {
  color: #183f30;
  font-size: 21px;
  margin: 7px 0;
}

.panel-heading p {
  color: #879b8b;
  font-size: 12px;
  margin: 0;
}

.results-label {
  padding: 9px 12px;

  color: #0a7f5e;
  background: #e7f6ec;
  border-radius: 30px;

  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

/* =====================================
   SEARCH AND FILTER
===================================== */

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 21px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 11px;
  flex: 1;
  min-width: 0;

  padding: 0 14px;

  background: #f7fbf8;
  border: 1px solid #d8e8dc;
  border-radius: 12px;
  color: #0b8762;
}

.search-box input {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 45px;

  border: 0;
  outline: 0;
  background: transparent;

  color: #204733;
  font-size: 12px;
}

.filter-select {
  min-width: 135px;
  padding: 12px;

  border: 1px solid #d8e8dc;
  border-radius: 12px;
  outline-color: #0b8762;

  color: #28513c;
  background: #ffffff;
  font-size: 12px;
}

/* =====================================
   USER CARDS
===================================== */

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 16px;

  padding: 17px;

  background: #f9fcfa;
  border: 1px solid #e4eee7;
  border-radius: 14px;
}

.user-avatar,
.modal-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 49px;
  height: 49px;

  border-radius: 15px;
  background: #dff3e8;
  color: #0c7d59;

  font-size: 16px;
  font-weight: 850;
}

.user-main {
  flex: 1;
  min-width: 0;
}

.user-main h3 {
  margin: 0 0 7px;
  color: #1a4933;
  font-size: 15px;
}

.user-main h3 small {
  color: #83998b;
  font-size: 10px;
}

.user-main p {
  display: flex;
  align-items: center;
  gap: 6px;

  font-size: 11px;
  color: #85988b;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}

.user-main p ion-icon {
  flex-shrink: 0;
  color: #0b9870;
}

.user-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;

  border-radius: 30px;
  padding: 8px 11px;

  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;

  background: #edf0ee;
  color: #76897c;
}

.status-badge.approved {
  background: #dcf6e6;
  color: #087b53;
}

.status-badge.pending {
  background: #fff1d9;
  color: #a77524;
}

.status-badge.rejected {
  background: #ffe9e6;
  color: #b64a41;
}

.details-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-shrink: 0;

  padding: 11px 14px;

  background: #e4f5eb;
  color: #087957;

  border: 0;
  border-radius: 10px;

  font-size: 11px;
  font-weight: 800;
}

/* =====================================
   FEEDBACK
===================================== */

.error-banner,
.success-banner {
  display: flex;
  align-items: center;
  gap: 9px;

  margin-bottom: 17px;
  padding: 14px;

  border-radius: 12px;
  font-size: 12px;
}

.error-banner {
  background: #fff0ec;
  color: #b1473e;
}

.success-banner {
  background: #e4f8e9;
  color: #08754f;
}

/* =====================================
   LOADING / EMPTY STATE
===================================== */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  padding: 44px 16px;
  color: #8a9e90;
}

.empty-state > ion-icon {
  font-size: 38px;
  color: #8bb99b;
}

.empty-state h3 {
  margin: 14px 0 8px;
  color: #345c42;
  font-size: 15px;
}

.empty-state p {
  font-size: 12px;
  line-height: 1.6;
}

/* =====================================
   MODAL
===================================== */

.modal-overlay,
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;

  display: grid;
  place-items: center;

  padding: 16px;
  background: #112c2288;
}

.user-modal,
.confirm-modal {
  width: min(100%, 570px);
  max-height: 88vh;
  overflow-y: auto;

  background: #ffffff;
  border-radius: 21px;
  padding: 24px;

  box-shadow:
    0 24px 65px #123b2929;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.modal-person {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.modal-person > div:last-child {
  min-width: 0;
}

.modal-person span {
  color: #0b956c;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1px;
}

.modal-person h2 {
  margin: 6px 0;
  color: #194531;
  font-size: 20px;
}

.modal-person p {
  margin: 0;
  color: #82988a;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.close-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 35px;
  height: 35px;

  background: #edf3ef;
  border: 0;
  border-radius: 9px;

  color: #587661;
  font-size: 20px;
}

.modal-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  padding: 15px;
  margin: 23px 0;

  border-radius: 12px;
  background: #f5f9f6;

  color: #7c9383;
  font-size: 12px;
}

/* =====================================
   MODAL DETAILS
===================================== */

.detail-section-title {
  display: flex;
  align-items: center;
  gap: 9px;

  margin: 24px 0 13px;

  color: #1f4b37;
  font-size: 15px;
}

.detail-section-title ion-icon {
  color: #0b825e;
  font-size: 19px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
}

.detail-item {
  padding: 13px;
  border-radius: 10px;
  background: #f5f9f6;
  min-width: 0;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item span {
  display: block;
  margin-bottom: 7px;

  font-size: 10px;
  color: #829687;
}

.detail-item strong {
  color: #25523c;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

/* =====================================
   MODAL BUTTONS
===================================== */

.primary-button,
.secondary-button,
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;

  min-height: 44px;
  padding: 12px;

  border: 0;
  border-radius: 11px;

  font-size: 12px;
  font-weight: 800;
}

.primary-button {
  background: #0b7959;
  color: #ffffff;
}

.secondary-button {
  background: #e6f5eb;
  color: #0b7959;
}

.danger-button {
  background: #fff0ed;
  color: #b54238;
}

.modal-note {
  color: #8da194;
  font-size: 11px;
  line-height: 1.6;
  margin: 10px 0 0;
}

/* =====================================
   EDIT FORM
===================================== */

.edit-form {
  margin-top: 18px;
}

.edit-title {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 8px 0 20px;
}

.edit-title > ion-icon {
  font-size: 26px;
  color: #0b825e;
}

.edit-title h3 {
  margin: 0 0 4px;
  color: #1f4b37;
  font-size: 16px;
}

.edit-title p {
  margin: 0;
  color: #829687;
  font-size: 12px;
  line-height: 1.5;
}

.edit-fields {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: 14px;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.edit-field.full {
  grid-column: 1 / -1;
}

.edit-field span {
  font-size: 12px;
  color: #345743;
  font-weight: 750;
}

.edit-field input,
.role-field select {
  width: 100%;
  min-height: 46px;
  padding: 12px 13px;

  border-radius: 11px;
  background: #f9fcfa;
  color: #173d30;
  border: 1px solid #d8e8dc;

  outline: none;
  font-size: 13px;
}

.edit-field input:focus,
.role-field select:focus {
  border-color: #0c996a;
  box-shadow: 0 0 0 3px #0c996a18;
}

.edit-feedback {
  display: flex;
  gap: 9px;
  align-items: flex-start;

  margin-top: 18px;
  padding: 13px 14px;

  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.edit-feedback ion-icon {
  font-size: 19px;
  flex-shrink: 0;
}

.edit-success {
  color: #076e4c;
  background: #e5f8eb;
}

.edit-error {
  color: #a63731;
  background: #fff0ed;
}

/* =====================================
   ROLE CONTROL
===================================== */

.role-control {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.role-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.role-field span {
  color: #829687;
  font-size: 11px;
}

.role-control .secondary-button {
  flex: 0 0 auto;
}

/* =====================================
   CONFIRMATION MODAL
===================================== */

.confirm-overlay {
  z-index: 6000;
}

.confirm-modal {
  width: min(100%, 390px);
  text-align: center;
}

.confirm-modal h3 {
  color: #194531;
  font-size: 18px;
  margin: 15px 0 9px;
}

.confirm-modal > p {
  color: #6b8575;
  font-size: 13px;
  line-height: 1.6;
}

.confirm-icon {
  display: grid;
  place-items: center;

  margin: 0 auto;

  width: 55px;
  height: 55px;
  border-radius: 15px;

  background: #e0f6e9;
  color: #0b825e;
  font-size: 28px;
}

.confirm-icon.danger {
  background: #ffebe9;
  color: #b64a41;
}

/* =====================================
   TABLET
===================================== */

@media (max-width: 850px) {
  .summary-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .user-row {
    flex-wrap: wrap;
  }

  .user-status {
    margin-left: auto;
  }
}

/* =====================================
   MOBILE
===================================== */

@media (max-width: 600px) {
  .users-container {
    padding-left: 15px;
    padding-right: 15px;
  }

  .page-header {
    align-items: flex-start;
  }

  .refresh-button {
    padding: 12px;
  }

  .users-panel {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
  }

  .filter-select {
    width: 100%;
  }

  .user-row {
    gap: 11px;
    padding: 13px;
  }

  .user-avatar {
    width: 42px;
    height: 42px;
  }

  .user-main h3 {
    font-size: 13px;
  }

  .user-status {
    margin-left: 0;
  }

  .details-button {
    width: 100%;
  }

  .user-modal {
    padding: 20px 16px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .role-control {
    flex-direction: column;
    align-items: stretch;
  }

  .role-control .secondary-button {
    flex: 1;
  }
}

/* =====================================
   SMALL MOBILE
===================================== */

@media (max-width: 370px) {
  .summary-grid {
    gap: 9px;
  }

  .summary-card {
    padding: 13px;
  }

  .summary-card > strong {
    font-size: 23px;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-item.full-width {
    grid-column: auto;
  }

  .edit-fields {
    grid-template-columns: 1fr;
  }

  .edit-field.full {
    grid-column: auto;
  }
}

/* =====================================
   LOADING ANIMATION
===================================== */

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
