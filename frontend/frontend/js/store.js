const STORAGE_KEY = "remindme-state-v1";
const REMEMBERED_ACCOUNTS_KEY = "remindme-remembered-accounts";

export const initialState = {
  profile: {
   name: "",
    email: "",
    studentNumber: "",
    age: "",
    address: "",
    course: "",
    yearLevel: "",
    semester: ""
  },
  classrooms: [],
   schedule: [],
  tasks: [],
  notes: [],
  announcements: [],
  members: []
};

export const emptyStudentState = {
  ...structuredClone(initialState),
  schedule: [],
  tasks: [],
  notes: [],
  announcements: [],
  members: [],
  classrooms: []
};

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(initialState);
  try {
    return { ...structuredClone(initialState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(initialState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadRememberedAccounts() {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_ACCOUNTS_KEY)) || [];
  } catch {
    return [];
  }
}

export function rememberAccount(account) {
  const accounts = loadRememberedAccounts().filter((item) => item.email !== account.email && !item.deleted);
  accounts.unshift({ email: account.email, name: account.name || account.email, deleted: false });
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 4)));
}

export function forgetAccount(email) {
  const accounts = loadRememberedAccounts().map((item) => item.email === email ? { ...item, deleted: true } : item);
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function addRecord(state, collection, record) {
  state[collection].push({ id: crypto.randomUUID(), ...record });
  saveState(state);
}

export function updateRecord(state, collection, id, patch) {
  const item = state[collection].find((record) => record.id === id);
  if (item) Object.assign(item, patch);
  saveState(state);
}
