import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "./src/theme";
import { clearAuthToken, getAdminDashboard, getAdminUsers, getMobileWorkspace, isApiConfigured, loginUser, registerUser, saveMobileWorkspace, setClassPresident, updateAccountStatus, verifySession } from "./src/services/api";
import { scheduleTaskReminder } from "./src/services/notifications";
import { saveGeneratedSchedule, uploadAndAnalyzeSchedule, uploadClassFile } from "./src/services/fileUpload";
import { addToSyncQueue, processSyncQueue } from "./src/services/offlineSyncService";
import { parseQRCode } from "./src/services/qrCodeService";

const logo = require("./assets/remindme-logo.png");

const initialSubjects = [];
const initialSchedule = [];
const initialTasks = [];
const initialNotes = [];
const initialAnnouncements = [];
const initialFiles = [];

const navItems = [
  { id: "home", label: "Home", icon: "H" },
  { id: "workspace", label: "Classroom", icon: "C" },
  { id: "schedule", label: "Schedule", icon: "S" },
  { id: "subjects", label: "Subjects", icon: "B" },
  { id: "notifications", label: "Notifications", icon: "N" },
  { id: "calendar", label: "Calendar", icon: "D" },
  { id: "profile", label: "Profile", icon: "P" },
  { id: "about", label: "About App", icon: "A" },
  { id: "logout", label: "Log Out", icon: "L" }
];

function navigationFor(user) {
  const student = [
    { id: "home", label: "Dashboard", icon: "H" },
    { id: "workspace", label: "My Classrooms", icon: "C" },
    { id: "schedule", label: "Schedule", icon: "S" },
    { id: "subjects", label: "Tasks & Activities", icon: "T" },
    { id: "calendar", label: "Calendar", icon: "D" },
    { id: "notifications", label: "Notifications", icon: "N" },
    { id: "profile", label: "Profile", icon: "P" },
    { id: "logout", label: "Log Out", icon: "L" }
  ];
  if (user.role === "admin") return [
    { id: "home", label: "Dashboard", icon: "H" },
    { id: "adminUsers", label: "Users", icon: "U" },
    { id: "adminApprovals", label: "Approvals", icon: "A" },
    { id: "adminPresidents", label: "Class Presidents", icon: "P" },
    { id: "adminClassrooms", label: "Classrooms", icon: "C" },
    { id: "notifications", label: "Alerts", icon: "N" },
    { id: "profile", label: "Profile", icon: "P" },
    { id: "logout", label: "Log Out", icon: "L" }
  ];
  // Faculty and Class Presidents share the academic navigation. Creator-only
  // actions remain protected inside the classroom and subject views.
  return student;
}

const allowedUploadExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".png", ".jpg", ".jpeg", ".webp", ".gif"];
const ACCOUNTS_KEY = "remindme-accounts";
const DATA_KEY_PREFIX = "remindme-app-data";
const THEME_KEY = "remindme-theme";

function generateClassCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

const defaultUser = {
  name: "",
  email: "",
  studentNumber: "2026-0001",
  age: "",
  address: "",
  course: "",
  yearLevel: "",
  semester: ""
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [showWelcome, setShowWelcome] = useState(true);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeScreen, setActiveScreen] = useState("home");
  const [selectedSubjectId, setSelectedSubjectId] = useState("programming");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [uploadedScheduleName, setUploadedScheduleName] = useState("");
  const [rememberedAccount, setRememberedAccount] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [user, setUser] = useState(defaultUser);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [files, setFiles] = useState(initialFiles);
  const [attendance, setAttendance] = useState({
    members: []
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    role: "student",
    studentNumber: "",
    facultyId: "",
    name: "",
    password: "",
    confirmPassword: ""
  });
  const [hasLoadedAccountData, setHasLoadedAccountData] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    title: "",
    instructor: "",
    room: "",
    day: "Monday",
    start: "8:00",
    end: "10:00"
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    subject: "Programming",
    dueDate: "Tomorrow",
    priority: "Medium",
    difficulty: "Medium",
    workload: "2",
    status: "Pending"
  });
  const [noteForm, setNoteForm] = useState({ title: "", subject: "Programming", content: "" });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", date: "July 25", message: "" });
  const [classroomForm, setClassroomForm] = useState({ name: "", section: "", subject: "", room: "", schoolYear: "2026-2027", semester: "1st Semester", description: "" });
  const [joinClassroomForm, setJoinClassroomForm] = useState({ code: "" });
  const [memberForm, setMemberForm] = useState({ name: "", email: "" });
  const [adminData, setAdminData] = useState({ counts: {}, pendingApprovals: [], recentUsers: [], activities: [] });
  const [adminUsers, setAdminUsers] = useState([]);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({ studentNumber: "", email: "", password: "", confirmPassword: "" });

  useEffect(() => {
    AsyncStorage.getItem("remindme-last-account").then((value) => {
      if (value) setRememberedAccount(JSON.parse(value));
    });
    AsyncStorage.getItem(THEME_KEY).then((value) => setIsDarkMode(value === "dark"));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user.email || !hasLoadedAccountData) return;
    const snapshot = {
      user,
      // Keep the web client's field names too, so both clients use one
      // workspace document instead of silently splitting account data.
      profile: user,
      classroom,
      classrooms: classroom ? [classroom] : [],
      subjects,
      schedule,
      tasks,
      notes,
      announcements,
      files,
      attendance,
      members: attendance.members || [],
      uploadedScheduleName,
      selectedSubjectId
    };
    AsyncStorage.setItem(accountDataKey(user.email), JSON.stringify(snapshot)).catch((error) => {
      console.warn("Unable to save RemindMe data", error);
    });
    if (isApiConfigured() && !isOffline) {
      saveMobileWorkspace(snapshot).catch(async () => {
        setIsOffline(true);
        await addToSyncQueue({ type: "WORKSPACE_SNAPSHOT", payload: snapshot, accountEmail: user.email });
      });
    }
  }, [
    announcements,
    attendance,
    classroom,
    files,
    hasLoadedAccountData,
    isAuthenticated,
    isOffline,
    notes,
    schedule,
    selectedSubjectId,
    subjects,
    tasks,
    uploadedScheduleName,
    user
  ]);

  useEffect(() => {
    if (!isAuthenticated || !user.email) return undefined;
    const retrySync = () => {
      processSyncQueue(async (action) => {
        if (action.type !== "WORKSPACE_SNAPSHOT") return null;
        return saveMobileWorkspace(action.payload);
      }, (action) => !action.accountEmail || action.accountEmail === user.email).then((results) => {
        setIsOffline(results.some((result) => !result.success));
      }).catch(() => setIsOffline(true));
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retrySync();
    });
    retrySync();
    return () => subscription.remove();
  }, [isAuthenticated, user.email]);

  useEffect(() => {
    if (isAuthenticated && user.role === "admin") refreshAdminData();
  }, [isAuthenticated, user.role]);

  const palette = isDarkMode ? darkPalette : lightPalette;
  const isFaculty = user.role === "faculty";
  const isClassPresident = user.role === "student" && user.isClassPresident === true;
  const isAdmin = user.role === "admin";
  const canCreateClassroom = isFaculty || isClassPresident;
  const isClassroomOwner = canCreateClassroom && classroom?.createdBy === user.email;
  const availableNavItems = navigationFor(user);
  const selectedSubject = classroom ? subjects.find((subject) => subject.id === selectedSubjectId) || subjects[0] || null : null;
  const selectedSubjectTitle = selectedSubject?.title || "General";
  const priorityTasks = useMemo(() => buildPriorityPlan(tasks), [tasks]);
  const notifications = useMemo(() => buildNotifications(tasks, announcements), [tasks, announcements]);
  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return [
      ...tasks.map((item) => ({ type: "Assignment", title: item.title, detail: item.subject })),
      ...notes.map((item) => ({ type: "Note", title: item.title, detail: item.subject })),
      ...announcements.map((item) => ({ type: "Announcement", title: item.title, detail: item.date })),
      ...subjects.map((item) => ({ type: "Subject", title: item.title, detail: item.instructor })),
      ...files.map((item) => ({ type: "File", title: item.name, detail: item.subject }))
    ].filter((item) => `${item.type} ${item.title} ${item.detail}`.toLowerCase().includes(query));
  }, [announcements, files, notes, searchText, subjects, tasks]);

  function toggleTheme() {
    setIsDarkMode((current) => {
      const next = !current;
      AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light").catch(() => {});
      return next;
    });
  }

  async function loadAccountData(email, fallbackUser = {}) {
    const saved = await AsyncStorage.getItem(accountDataKey(email));
    let data = saved ? JSON.parse(saved) : {};

    if (isApiConfigured()) {
      try {
        const remoteData = await getMobileWorkspace();
        if (remoteData) data = remoteData;
        setIsOffline(false);
      } catch (error) {
        setIsOffline(true);
      }
    } else {
      setIsOffline(true);
    }
    // Website workspaces use `profile`, `classrooms`, and `members`; mobile
    // used `user`, `classroom`, and `attendance`. Accept both representations.
    data = normalizeWorkspace(data);
    const accountUser = {
      ...defaultUser,
      ...fallbackUser,
      ...(data.user || {}),
      email
    };

    setUser(accountUser);
    setClassroom(data.classroom || null);
    setSubjects(data.subjects || []);
    setSchedule(data.schedule || []);
    setTasks(data.tasks || []);
    setNotes(data.notes || []);
    setAnnouncements(data.announcements || []);
    setFiles(data.files || []);
    setAttendance(data.attendance || { members: [] });
    setUploadedScheduleName(data.uploadedScheduleName || "");
    setSelectedSubjectId(data.selectedSubjectId || data.subjects?.[0]?.id || "");
    setHasLoadedAccountData(true);
    return accountUser;
  }

  async function rememberAccount(account) {
    const accounts = JSON.parse(await AsyncStorage.getItem(ACCOUNTS_KEY)) || [];
    const nextAccounts = [account, ...accounts.filter((item) => item.email !== account.email)];
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    await AsyncStorage.setItem("remindme-last-account", JSON.stringify(account));
    setRememberedAccount(account);
  }

  async function login() {
    if (!loginForm.email || !loginForm.password) {
      Alert.alert("Login required", "Enter your school email and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email.trim())) {
      Alert.alert("Invalid email", "Enter your school email address, for example name@bisu.edu.ph. Do not enter your name.");
      return;
    }
    setHasLoadedAccountData(false);
    try {
      const result = await loginUser({ ...loginForm, email: loginForm.email.trim().toLowerCase() });
      const session = await verifySession();
      const accountUser = await loadAccountData(result.user.email, { ...result.user, ...session.user });
      await rememberAccount({ email: result.user.email, name: accountUser.name || result.user.name });
      setIsAuthenticated(true);
    } catch (error) { Alert.alert("Sign in failed", error.message); }
  }

  function loginWithRememberedAccount(email) {
    setLoginForm((current) => ({ ...current, email }));
    Alert.alert("Password required", "Enter the password for this account to sign in.");
  }

  async function register() {
    if (!registerForm.email || !registerForm.name || !registerForm.password) {
      Alert.alert("Missing details", "Please complete your account details.");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      Alert.alert("Password mismatch", "Confirm password must match your password.");
      return;
    }
    if (registerForm.role === "student" && !/^\d{4}-\d{6}$/.test(registerForm.studentNumber.trim())) {
      Alert.alert("Invalid Student ID", "Use YYYY-NNNNNN, for example 2024-321873.");
      return;
    }
    if (registerForm.role === "faculty" && !/^[A-Za-z]{3}-\d{6}$/.test(registerForm.facultyId.trim())) {
      Alert.alert("Invalid Faculty ID", "Use AAA-NNNNNN, for example HES-345876.");
      return;
    }
    try {
      const result = await registerUser(registerForm);
      if (result.user.accountStatus === "pending") {
        await clearAuthToken();
        setAuthMode("login");
        Alert.alert("Registration submitted", "Your account is pending administrator approval. You will be able to sign in after it is approved.");
        return;
      }
      const registeredUser = { ...defaultUser, ...result.user, role: registerForm.role, studentNumber: registerForm.studentNumber, facultyId: registerForm.facultyId };
      setHasLoadedAccountData(false);
      setUser(registeredUser); setSubjects([]); setSchedule([]); setTasks([]); setNotes([]); setAnnouncements([]); setFiles([]); setClassroom(null); setAttendance({ members: [] }); setUploadedScheduleName(""); setSelectedSubjectId("");
      await rememberAccount({ email: registeredUser.email, name: registeredUser.name });
      setHasLoadedAccountData(true);
      setIsAuthenticated(true);
    } catch (error) { Alert.alert("Registration failed", error.message); }
  }

  function addSubject() {
    if (!isClassroomOwner) { Alert.alert("Creator only", "Only the creator of this classroom can manage subjects and schedules."); return; }
    if (!classroom) {
      Alert.alert("Classroom required", "Create or join a classroom before adding subjects or schedules.");
      setModal(null);
      setActiveScreen("workspace");
      return;
    }
    if (!subjectForm.title.trim()) {
      Alert.alert("Subject required", "Enter the subject name first.");
      return;
    }
    const id = normalizeId(subjectForm.title);
    const subject = {
      id,
      title: subjectForm.title,
      instructor: subjectForm.instructor || "Instructor TBA",
      room: subjectForm.room || "Room TBA",
      color: randomSubjectColor(subjects.length)
    };
    setSubjects((current) => [...current, subject]);
    setSchedule((current) => [
      ...current,
      {
        id: `s${Date.now()}`,
        subjectId: id,
        subject: subject.title,
        day: subjectForm.day,
        start: subjectForm.start,
        end: subjectForm.end,
        room: subject.room
      }
    ]);
    setAttendance((current) => ({ ...current, [subject.title]: { Present: 0, Late: 0, Absent: 0, Excused: 0 } }));
    setSelectedSubjectId(id);
    setSubjectForm({ title: "", instructor: "", room: "", day: "Monday", start: "8:00", end: "10:00" });
    setModal(null);
  }

  function addTask() {
    if (!isClassroomOwner) { Alert.alert("Creator only", "Only the creator of this classroom can create assignments."); return; }
    if (!selectedSubject) {
      Alert.alert("Subject required", "Create or generate a subject before adding assignments.");
      return;
    }
    if (!taskForm.title.trim()) {
      Alert.alert("Title required", "Enter an assignment title.");
      return;
    }
    const newTask = {
      id: `t${Date.now()}`,
      ...taskForm,
      subject: selectedSubjectTitle,
      workload: Number(taskForm.workload || 1)
    };
    setTasks((current) => [newTask, ...current]);
    scheduleTaskReminder(newTask).catch(() => {});
    setTaskForm({
      title: "",
      description: "",
      subject: selectedSubject?.title || "Programming",
      dueDate: "Tomorrow",
      priority: "Medium",
      difficulty: "Medium",
      workload: "2",
      status: "Pending"
    });
    setModal(null);
  }

  function addNote() {
    if (!selectedSubject) {
      Alert.alert("Subject required", "Create or generate a subject before adding notes.");
      return;
    }
    if (!noteForm.title.trim()) {
      Alert.alert("Title required", "Enter a note title.");
      return;
    }
    setNotes((current) => [{ id: `n${Date.now()}`, ...noteForm, subject: selectedSubjectTitle, shared: isClassroomOwner, author: user.name || user.email }, ...current]);
    setNoteForm({ title: "", subject: selectedSubject?.title || "Programming", content: "" });
    setModal(null);
  }

  function addAnnouncement() {
    if (!isClassroomOwner) { Alert.alert("Creator only", "Only the creator of this classroom can publish announcements."); return; }
    if (!announcementForm.title.trim()) {
      Alert.alert("Title required", "Enter an announcement title.");
      return;
    }
    setAnnouncements((current) => [{ id: `a${Date.now()}`, ...announcementForm, subject: selectedSubject?.title || "" }, ...current]);
    setAnnouncementForm({ title: "", date: "July 25", message: "" });
    setModal(null);
  }

  function openSubjectScopedModal(nextModal) {
    if (!selectedSubject) {
      Alert.alert("Subject required", "Open a created or generated subject first.");
      return;
    }
    if (nextModal === "task") {
      setTaskForm((current) => ({ ...current, subject: selectedSubjectTitle }));
    }
    if (nextModal === "note") {
      setNoteForm((current) => ({ ...current, subject: selectedSubjectTitle }));
    }
    setModal(nextModal);
  }

  function createClassroom() {
    if (!canCreateClassroom) { Alert.alert("Appointment required", "Only faculty or a student appointed as Class President can create a classroom."); return; }
    if (!classroomForm.name.trim()) {
      Alert.alert("Name required", "Enter a classroom name.");
      return;
    }
    const newClassroom = {
      id: `classroom-${Date.now()}`,
      ...classroomForm,
      createdBy: user.email,
      members: [{ name: user.name || "Class Creator", email: user.email, role: isClassPresident ? "Class President" : "Creator" }],
      createdAt: new Date().toISOString(),
      inviteCode: generateClassCode(),
      joiningEnabled: true,
      archived: false,
      inviteLink: `remindme://join/classroom-${Date.now()}`,
      schedules: schedule,
      notes,
      announcements
    };
    setClassroom(newClassroom);
    setAttendance({ members: [{ email: user.email, name: user.name || "Class Creator", status: "Unmarked" }] });
    setClassroomForm({ name: "", section: "", subject: "", room: "", schoolYear: "2026-2027", semester: "1st Semester", description: "" });
    setModal(null);
    Alert.alert("Classroom Created", `Class code: ${newClassroom.inviteCode}`);
    setActiveScreen("workspace");
  }

  function joinClassroom() {
    const code = joinClassroomForm.code.trim().toUpperCase();
    if (!code) {
      Alert.alert("Code required", "Enter the classroom code.");
      return;
    }
    if (code.length < 6) {
      Alert.alert("Invalid code", "Enter the six-character class code shared by your teacher.");
      return;
    }
    const joined = {
      id: code,
      name: `Joined Class ${code.slice(0, 6)}`,
      section: "Shared",
      description: "Joined from QR/link code.",
      createdBy: "classroom-owner",
      members: [{ name: user.name || "Student", email: user.email, role: "Member" }],
      inviteCode: code,
      joiningEnabled: true,
      inviteLink: `remindme://join/${code}`,
      createdAt: new Date().toISOString(),
      schedules: [],
      notes: [],
      announcements: []
    };
    setClassroom(joined);
    setAttendance({ members: [{ email: user.email, name: user.name || "Student", status: "Unmarked" }] });
    Alert.alert("Joined!", "You've successfully joined the classroom.");
    setJoinClassroomForm({ code: "" });
    setModal(null);
  }

  async function refreshAdminData() {
    try {
      const [dashboard, users] = await Promise.all([getAdminDashboard(), getAdminUsers()]);
      setAdminData(dashboard); setAdminUsers(users);
    } catch (error) { Alert.alert("Admin data unavailable", error.message); }
  }

  async function changeStatus(identifier, accountStatus) {
    try { await updateAccountStatus(identifier, accountStatus); await refreshAdminData(); }
    catch (error) { Alert.alert("Account update failed", error.message); }
  }

  async function changePresident(identifier, isClassPresident) {
    try { await setClassPresident(identifier, isClassPresident); await refreshAdminData(); }
    catch (error) { Alert.alert("Class President update failed", error.message); }
  }

  function addClassroomMember() {
    if (!isClassroomOwner) return;
    const name = memberForm.name.trim();
    const email = memberForm.email.trim().toLowerCase();
    if (!name || !email) {
      Alert.alert("Member details required", "Enter the student's name and school email.");
      return;
    }
    if ((classroom.members || []).some((member) => member.email.toLowerCase() === email)) {
      Alert.alert("Already a member", "That student is already in this classroom.");
      return;
    }
    const member = { name, email, role: "Member" };
    setClassroom((current) => ({ ...current, members: [...(current.members || []), member] }));
    setAttendance((current) => ({ ...current, members: [...(current.members || []), { name, email, status: "Unmarked" }] }));
    setMemberForm({ name: "", email: "" });
    setModal(null);
  }

  function toggleClassroomJoining() {
    if (!isClassroomOwner) return;
    setClassroom((current) => current ? { ...current, joiningEnabled: current.joiningEnabled === false } : current);
  }

  function regenerateClassroomCode() {
    if (!isClassroomOwner) return;
    Alert.alert("Regenerate class code?", "The previous code will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", style: "destructive", onPress: () => setClassroom((current) => current ? { ...current, inviteCode: generateClassCode(), joiningEnabled: true } : current) }
    ]);
  }

  async function openQrScanner() {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Camera permission required", "Allow camera access to scan a classroom QR code.");
        return;
      }
    }
    setIsQrScannerOpen(true);
  }

  function handleQrScan({ data }) {
    const parsed = parseQRCode(data);
    if (!parsed?.classroomId) {
      Alert.alert("Invalid classroom QR", "This QR code is not a RemindMe classroom invitation.");
      return;
    }
    setJoinClassroomForm({ code: parsed.classroomId });
    setIsQrScannerOpen(false);
  }

  async function pickScheduleImage() {
    if (!classroom) {
      Alert.alert("Classroom required", "Create or join a classroom before uploading a schedule photo.");
      setActiveScreen("workspace");
      return;
    }
    if (isOffline) {
      Alert.alert("Offline", "Schedule images cannot be uploaded while offline.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    let analysis = null;
    try {
      analysis = await uploadAndAnalyzeSchedule(classroom.id, asset.uri, asset.name, asset.mimeType || "image/jpeg");
    } catch (error) {
      analysis = { rows: analyzeScheduleUpload(asset.name), uploaded: { url: asset.uri }, usedLocalFallback: true };
    }
    setUploadedScheduleName(asset.name);
    setFiles((current) => [
      { id: `f${Date.now()}`, name: asset.name, type: "Schedule Image", subject: "Classroom", url: analysis.uploaded?.url || "" },
      ...current
    ]);
    let detectedRows = analysis.rows || [];
    if (!detectedRows.length) detectedRows = analyzeScheduleUpload(asset.name);
    setSubjects((current) => {
      const existingIds = new Set(current.map((subject) => subject.id));
      const newSubjects = detectedRows
        .filter((row) => !existingIds.has(row.subjectId))
        .map((row, index) => ({ id: row.subjectId, title: row.subject, instructor: "Instructor TBA", room: row.room, color: randomSubjectColor(current.length + index) }));
      return [...current, ...newSubjects];
    });
    setSchedule((current) => [...current.filter((item) => !item.fromUpload), ...detectedRows]);
    await Promise.all(detectedRows.map((row) => saveGeneratedSchedule(row).catch(() => null)));
    setSelectedSubjectId(detectedRows[0]?.subjectId || selectedSubjectId);
    Alert.alert(
      analysis.usedLocalFallback ? "Schedule saved locally" : "Schedule uploaded",
      analysis.usedLocalFallback
        ? "The backend was unavailable, so RemindMe saved the photo reference and generated a local schedule draft."
        : "The image was stored in the backend and a schedule draft was created for review."
    );
  }

  async function pickFile() {
    if (!classroom) {
      Alert.alert("Classroom required", "Create or join a classroom before uploading files.");
      setActiveScreen("workspace");
      return;
    }
    if (isOffline) {
      Alert.alert("Offline", "Files cannot be uploaded while offline. Your local data still works and will sync later.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: allowedDocumentTypes(), copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!isAllowedUpload(asset.name)) {
      Alert.alert("Unsupported file", "Upload PDF, DOCX, PPT/PPTX, ZIP, or image files only.");
      return;
    }
    let url = asset.uri;
    try {
      url = await uploadClassFile(classroom.id, asset.uri, asset.name, asset.mimeType || "application/octet-stream");
    } catch (error) {
      Alert.alert("Saved locally", "The backend was unavailable, so this file will stay visible from local app storage.");
    }
    setFiles((current) => [
      { id: `f${Date.now()}`, name: asset.name, type: guessFileType(asset.name), subject: selectedSubject?.title || "General", url },
      ...current
    ]);
  }

  function updateAttendance(email, status) {
    setAttendance((current) => ({
      members: (current.members || []).map((member) => member.email === email ? { ...member, status } : member)
    }));
  }

  function resetPassword() {
    if (!forgotPasswordForm.studentNumber.trim() || !forgotPasswordForm.email.trim()) {
      Alert.alert("Missing details", "Enter your student number and school email.");
      return;
    }
    if (forgotPasswordForm.password !== forgotPasswordForm.confirmPassword) {
      Alert.alert("Password mismatch", "The new password and confirm password must match exactly.");
      return;
    }
    const validStudent = forgotPasswordForm.studentNumber.trim() === (user.studentNumber || "").trim();
    const validEmail = forgotPasswordForm.email.trim().toLowerCase() === (user.email || "").trim().toLowerCase();
    if (!validStudent || !validEmail) {
      Alert.alert("Verification failed", "The student number and school email do not match this account.");
      return;
    }
    setUser((current) => ({ ...current, password: forgotPasswordForm.password }));
    setForgotPasswordForm({ studentNumber: "", email: "", password: "", confirmPassword: "" });
    setModal(null);
    Alert.alert("Password updated", "Your password has been changed successfully.");
  }

  async function deleteLocalAccount() {
    const email = user.email;
    await clearAuthToken();
    setSubjects([]);
    setSchedule([]);
    setTasks([]);
    setNotes([]);
    setAnnouncements([]);
    setFiles([]);
    setClassroom(null);
    setAttendance({ members: [] });
    setUploadedScheduleName("");
    setSelectedSubjectId("");
    setUser(defaultUser);
    setHasLoadedAccountData(false);
    setRememberedAccount(null);
    const accounts = JSON.parse(await AsyncStorage.getItem(ACCOUNTS_KEY)) || [];
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter((account) => account.email !== email)));
    await AsyncStorage.multiRemove(["remindme-last-account", accountDataKey(email)]);
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    if (showWelcome) {
      return (
        <WelcomeScreen
          palette={palette}
          onLogin={() => { setAuthMode("login"); setShowWelcome(false); }}
          onRegister={() => { setAuthMode("register"); setShowWelcome(false); }}
        />
      );
    }
    return authMode === "login" ? (
      <AuthScreen
        mode="login"
        form={loginForm}
        setForm={setLoginForm}
        onSubmit={login}
        onSwitch={() => setAuthMode("register")}
        onForgotPassword={() => setModal("forgotPassword")}
        palette={palette}
        isDarkMode={isDarkMode}
        rememberedAccount={rememberedAccount}
        onRememberedAccount={loginWithRememberedAccount}
        onBack={() => setShowWelcome(true)}
      />
    ) : (
      <AuthScreen
        mode="register"
        form={registerForm}
        setForm={setRegisterForm}
        onSubmit={register}
        onSwitch={() => setAuthMode("login")}
        onForgotPassword={() => setModal("forgotPassword")}
        palette={palette}
        isDarkMode={isDarkMode}
        rememberedAccount={rememberedAccount}
        onRememberedAccount={loginWithRememberedAccount}
        onBack={() => setShowWelcome(true)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <LinearGradient colors={activeScreen === "home" ? [palette.background, palette.background] : palette.headerGradient} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => {
            if (activeScreen === "home") {
              setIsAppMenuOpen(true);
            } else {
              setActiveScreen("home");
            }
          }}>
            <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.headerEyebrow, { color: activeScreen === "home" ? palette.muted : "rgba(255,255,255,0.8)" }]}>RemindMe</Text>
            <Text style={[styles.headerTitle, { color: activeScreen === "home" ? palette.ink : "white" }]}>{screenTitle(activeScreen, availableNavItems)}</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Open notifications" style={[styles.headerIconButton, activeScreen === "home" && { backgroundColor: palette.softSurface }]} onPress={() => setActiveScreen("notifications")}><Text style={[styles.headerIconText, { color: activeScreen === "home" ? palette.ink : "white" }]}>●</Text></TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Open profile" style={[styles.headerIconButton, activeScreen === "home" && { backgroundColor: palette.softSurface }]} onPress={() => setActiveScreen("profile")}><Text style={[styles.headerIconText, { color: activeScreen === "home" ? palette.ink : "white" }]}>P</Text></TouchableOpacity>
          {isAuthenticated ? (
            <TouchableOpacity accessibilityLabel="Toggle light and dark mode" style={styles.headerIconButton} onPress={toggleTheme}>
              <Text style={[styles.headerIconText, { color: activeScreen === "home" ? palette.ink : "white" }]}>{isDarkMode ? "☾" : "☀"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {activeScreen !== "home" ? <Text style={styles.headerSubcopy}>{isOffline ? "Offline mode enabled. Changes will sync later." : "Organize. Study. Succeed."}</Text> : null}
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeScreen !== "profile" && activeScreen !== "profileSettings" && (
          <View style={styles.searchShell}>
            {isSearchOpen ? (
              <Field label="Search" value={searchText} onChangeText={setSearchText} palette={palette} placeholder="Search subjects, notes, tasks, files..." />
            ) : null}
            <TouchableOpacity style={[styles.searchIconButton, { backgroundColor: palette.surface, borderColor: palette.line }]} onPress={() => setIsSearchOpen((current) => !current)}>
              <Text style={[styles.searchIconText, { color: palette.blue }]}>⌕</Text>
            </TouchableOpacity>
          </View>
        )}
        {renderScreen()}
      </ScrollView>

      {isAppMenuOpen && (
        <Modal visible={isAppMenuOpen} transparent animationType="fade" onRequestClose={() => setIsAppMenuOpen(false)}>
          <TouchableOpacity style={styles.appMenuOverlay} onPress={() => setIsAppMenuOpen(false)} activeOpacity={1}>
            <View style={styles.appMenuPanel}>
              <View style={styles.appMenuHeader}>
                <Text style={styles.appMenuTitle}>RemindMe</Text>
                <TouchableOpacity onPress={() => setIsAppMenuOpen(false)}>
                  <Text style={styles.appMenuClose}>x</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.appMenuContent}>
                {availableNavItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.appMenuItem}
                    onPress={() => {
                      if (item.id === "logout") {
                        clearAuthToken();
                        setIsAuthenticated(false);
                        setIsAppMenuOpen(false);
                        return;
                      }
                      setActiveScreen(item.id);
                      setIsAppMenuOpen(false);
                    }}
                  >
                    <Text style={styles.appMenuItemIcon}>{item.icon}</Text>
                    <Text style={styles.appMenuItemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {isQrScannerOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsQrScannerOpen(false)}>
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerPanel}>
              <Text style={styles.scannerTitle}>Scan classroom QR</Text>
              <Text style={styles.scannerSubtitle}>Point your camera at the invitation code.</Text>
              <View style={styles.cameraFrame}>
                <CameraView style={styles.camera} facing="back" onBarcodeScanned={handleQrScan} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
              </View>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsQrScannerOpen(false)}>
                <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {renderModal()}
    </SafeAreaView>
  );

  function renderScreen() {
    switch (activeScreen) {
      case "home":
        if (isAdmin) return <AdminDashboard palette={palette} data={adminData} onRefresh={refreshAdminData} onUsers={() => setActiveScreen("adminUsers")} onApprovals={() => setActiveScreen("adminApprovals")} />;
        return <AcademicDashboard palette={palette} user={user} classroom={classroom} schedule={schedule} tasks={tasks} announcements={announcements} attendance={attendance} isFaculty={isFaculty} isClassPresident={isClassPresident} onCreate={() => setModal("createClassroom")} onJoin={() => setModal("joinClassroom")} onWorkspace={() => setActiveScreen("workspace")} onSchedule={() => setActiveScreen("schedule")} onTasks={() => setActiveScreen("subjects")} onCalendar={() => setActiveScreen("calendar")} />;
      case "adminUsers":
        return <AdminUsersScreen palette={palette} users={adminUsers} onRefresh={refreshAdminData} onStatus={changeStatus} onPresident={changePresident} />;
      case "adminApprovals":
        return <AdminUsersScreen palette={palette} title="Account Approvals" users={adminData.pendingApprovals || []} onRefresh={refreshAdminData} onStatus={changeStatus} onPresident={changePresident} />;
      case "adminPresidents":
        return <AdminUsersScreen palette={palette} title="Class Presidents" users={adminUsers.filter((item) => item.isClassPresident || item.role === "student")} onRefresh={refreshAdminData} onStatus={changeStatus} onPresident={changePresident} presidentOnly />;
      case "adminClassrooms":
        return <AdminClassroomsScreen palette={palette} data={adminData} />;
      case "schedule":
        return (
          <Screen title="Schedule" subtitle="Today’s and upcoming class meetings." palette={palette}>
            {isClassroomOwner ? <ActionGrid palette={palette} actions={[{ label: "Add Subject & Schedule", onPress: () => setModal("subject") }]} /> : null}
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <View key={day}><Section title={day} palette={palette} />
              {schedule.filter((item) => item.day === day).map((item) => <ListItem key={item.id} title={item.subject} subtitle={`${item.start || "Time TBA"} – ${item.end || "Time TBA"} · ${item.room || "Room TBA"}`} palette={palette} />)}
              {!schedule.filter((item) => item.day === day).length ? <EmptyText text="No class scheduled." palette={palette} /> : null}
            </View>)}
          </Screen>
        );
      /* Legacy home implementation retained below for reference.
        if (!classroom) {
          return (
            <Screen title="Schedule" subtitle="Create or join a classroom before adding subjects or uploading a schedule photo." palette={palette}>
              <ActionGrid palette={palette} actions={[...(canCreateClassroom ? [{ label: "Create Classroom", onPress: () => setModal("createClassroom") }] : []), { label: "Join Class", onPress: () => setModal("joinClassroom") }]} />
              <EmptyText text="Schedules are shown after subjects are created or generated inside a classroom." palette={palette} />
            </Screen>
          );
        }
        if (!subjects.length && !schedule.length && !tasks.length && !classroom) {
          return (
            <Screen title="Schedule" subtitle="Start by adding a schedule or joining a class." palette={palette}>
              <TouchableOpacity style={[styles.emptyStart, { backgroundColor: palette.softSurface, borderColor: palette.line }]} onPress={() => setModal("subject")}>
                <Text style={[styles.emptyPlus, { color: palette.blue }]}>+</Text>
              </TouchableOpacity>
              <ActionGrid palette={palette} actions={[{ label: "Upload Schedule Image", onPress: pickScheduleImage }, { label: "Join Class", onPress: () => setModal("joinClassroom") }]} />
            </Screen>
          );
        }
        return (
          <Screen title="Schedule" subtitle="Generated class schedule from your uploaded or manually added subjects." palette={palette}>
            {isFaculty ? <ActionGrid palette={palette} actions={[{ label: "Add Subject", onPress: () => setModal("subject") }, { label: "Upload Schedule Image", onPress: pickScheduleImage }]} /> : null}
            {uploadedScheduleName ? <PreviewBox label={uploadedScheduleName} palette={palette} /> : null}
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
              <View key={day}>
                <Section title={day} palette={palette} />
                {schedule.filter((item) => item.day === day).length ? (
                  schedule.filter((item) => item.day === day).map((item) => (
                    <TouchableOpacity key={item.id} onPress={() => { setSelectedSubjectId(item.subjectId || normalizeId(item.subject)); setSearchText(item.subject); setActiveScreen("subjectDetail"); }}>
                      <ListItem title={item.subject} subtitle={`${item.start}-${item.end} - ${item.room}`} palette={palette} />
                    </TouchableOpacity>
                  ))
                ) : <EmptyText text="No class scheduled." palette={palette} />}
              </View>
            ))}
          </Screen>
        ); */
      case "subjects":
        return (
          <Screen title="Subjects" subtitle="Open a subject to see its notes, assignments, announcements, and files." palette={palette}>
            {classroom ? (
              isClassroomOwner ? <TouchableOpacity style={[styles.addCard, { borderColor: palette.line, backgroundColor: palette.softSurface }]} onPress={() => setModal("subject")}>
                <Text style={[styles.addCardText, { color: palette.blue }]}>+ Add Subject</Text>
              </TouchableOpacity> : null
            ) : (
              <ActionGrid palette={palette} actions={[...(canCreateClassroom ? [{ label: "Create Classroom", onPress: () => setModal("createClassroom") }] : []), { label: "Join Class", onPress: () => setModal("joinClassroom") }]} />
            )}
            <View style={styles.subjectGrid}>
              {(classroom ? subjects : []).map((subject) => (
                <TouchableOpacity key={subject.id} style={[styles.subjectCard, { backgroundColor: palette.surface, borderColor: palette.line }]} onPress={() => { setSelectedSubjectId(subject.id); setActiveScreen("subjectDetail"); }}>
                  <View style={[styles.subjectColor, { backgroundColor: subject.color }]} />
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>{subject.title}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{subject.instructor}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{subject.room}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{subjectSummary(subject.title, notes, tasks, announcements)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!(classroom ? subjects : []).length ? <EmptyText text={classroom ? "No created or generated subjects yet." : "Subjects appear here after you create or join a classroom."} palette={palette} /> : null}
          </Screen>
        );
      case "subjectDetail":
        return (
          <Screen title={selectedSubjectTitle} subtitle="Subject notes, assignments, announcements, and uploaded files." palette={palette}>
            <Card palette={palette}>
              <Text style={[styles.cardTitle, { color: palette.ink }]}>{selectedSubjectTitle}</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>Instructor: {selectedSubject?.instructor || "Instructor TBA"}</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>Schedule: {subjectScheduleLabel(selectedSubjectTitle, schedule)}</Text>
            </Card>
            <ActionGrid palette={palette} actions={[{ label: "Add Personal Note", onPress: () => openSubjectScopedModal("note") }, ...(isClassroomOwner ? [{ label: "Add Assignment", onPress: () => openSubjectScopedModal("task") }, { label: "Post Announcement", onPress: () => setModal("announcement") }, { label: "Upload File", onPress: pickFile }] : [])]} />
            <Section title="Notes and Files" palette={palette} />
            {notes.filter((note) => note.subject === selectedSubjectTitle && (note.shared !== false || note.author === user.name || note.author === user.email)).map((note) => <ListItem key={note.id} title={note.title} subtitle={note.content || "No content"} palette={palette} />)}
            {files.filter((file) => file.subject === selectedSubjectTitle).map((file) => <ListItem key={file.id} title={file.name} subtitle={file.type} palette={palette} />)}
            {!notes.filter((note) => note.subject === selectedSubjectTitle).length && !files.filter((file) => file.subject === selectedSubjectTitle).length ? <EmptyText text="No notes or files yet." palette={palette} /> : null}
            <Section title="Assignments" palette={palette} />
            {tasks.filter((task) => task.subject === selectedSubjectTitle).map((task) => <ListItem key={task.id} title={task.title} subtitle={`${task.description || "No description"} - Due ${task.dueDate}`} badge={task.status} palette={palette} />)}
            <Section title="Announcements" palette={palette} />
            {announcements.filter((item) => !item.subject || item.subject === selectedSubjectTitle).map((item) => <ListItem key={item.id} title={item.title} subtitle={item.message || "No description"} badge={item.date} palette={palette} />)}
          </Screen>
        );
      case "workspace":
        return (
          <Screen title="Classroom" subtitle={classroom ? "Shared schedule, invite, attendance, and class announcements." : "Create or join a classroom."} palette={palette}>
            {!classroom ? (
              <>
                <ActionGrid palette={palette} actions={[...(canCreateClassroom ? [{ label: "Create Classroom", onPress: () => setModal("createClassroom") }] : []), { label: "Join Classroom", onPress: () => setModal("joinClassroom") }]} />
                <EmptyText text="No classroom yet. Create or join one to begin." palette={palette} />
              </>
            ) : (
              <>
                <Card palette={palette}>
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>{classroom.name}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom.subject || "Subject TBA"} · {classroom.section || "Class section"} · {classroom.room || "Room TBA"}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom.schoolYear || "School year TBA"} · {classroom.semester || "Semester TBA"} · {(classroom.members || []).length} member(s)</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom.description || "No description"}</Text>
                </Card>
                <Section title="Class Enrollment" palette={palette} />
                <Card palette={palette}>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>CLASS CODE</Text>
                  <Text style={[styles.enrollmentCode, { color: palette.blue }]}>{classroom.inviteCode || classroom.id}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom.joiningEnabled === false ? "Joining is paused by the teacher." : "Students can join with this code."}</Text>
                  {isClassroomOwner ? <ActionGrid palette={palette} actions={[{ label: classroom.joiningEnabled === false ? "Enable Joining" : "Pause Joining", onPress: toggleClassroomJoining }, { label: "Regenerate Code", onPress: regenerateClassroomCode }]} /> : null}
                </Card>
                {isClassroomOwner ? <><Section title="Class QR / Link" palette={palette} />
                <Card palette={palette}>
                  <View style={[styles.qrBox, { borderColor: palette.line }]}>{Array.from({ length: 49 }, (_, index) => <View key={index} style={[styles.qrPixel, { backgroundColor: index % 3 === 0 || index % 5 === 0 ? palette.blue : palette.softSurface }]} />)}</View>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom.inviteLink}</Text>
                </Card></> : null}
                <Section title="Class Schedule" palette={palette} />
                {isClassroomOwner ? <ActionGrid palette={palette} actions={[{ label: "Upload Schedule Image", onPress: pickScheduleImage }, { label: "Add Subject Manually", onPress: () => setModal("subject") }]} /> : null}
                <PreviewBox label={uploadedScheduleName || "No uploaded schedule image yet"} palette={palette} />
                <Section title="Attendance" palette={palette} />
                {isClassroomOwner ? <ActionGrid palette={palette} actions={[{ label: "Add Member", onPress: () => setModal("addMember") }]} /> : null}
                {(attendance.members || []).map((member) => (
                  <Card key={member.email} palette={palette}>
                    <Text style={[styles.cardTitle, { color: palette.ink }]}>{member.name}</Text>
                    <Text style={[styles.cardMeta, { color: palette.muted }]}>{member.email} - {member.status}</Text>
                    {isClassroomOwner ? <ActionGrid palette={palette} actions={["Present", "Late", "Absent", "Excused"].map((status) => ({ label: status, onPress: () => updateAttendance(member.email, status) }))} /> : null}
                  </Card>
                ))}
                <Section title="Class Announcements" action={isClassroomOwner ? "Post" : ""} onAction={isClassroomOwner ? () => setModal("announcement") : undefined} palette={palette} />
                {announcements.map((item) => <ListItem key={item.id} title={item.title} subtitle={item.message || "No description"} badge={item.date} palette={palette} />)}
              </>
            )}
          </Screen>
        );
      case "calendar":
        return (
          <Screen title="Calendar" subtitle="July 2026 academic overview." palette={palette}>
            <CalendarGrid palette={palette} />
            <Section title="Legend" palette={palette} />
            <Legend palette={palette} />
            <Section title="Today's Events" palette={palette} />
            {tasks.slice(0, 3).map((task) => <ListItem key={task.id} title={task.title} subtitle={`${task.subject} - ${task.dueDate}`} palette={palette} />)}
          </Screen>
        );
      case "notifications":
        return (
          <Screen title="Notifications" subtitle="Reminders, invitations, and announcements." palette={palette}>
            {notifications.length ? notifications.map((notification) => <ListItem key={notification.id} title={notification.title} subtitle={notification.detail} badge={notification.when} palette={palette} />) : <EmptyText text="No notifications yet." palette={palette} />}
          </Screen>
        );
      case "about":
        return (
          <Screen title="About App" subtitle="RemindMe application details, contact information, and developers." palette={palette}>
            <Card palette={palette}>
              <Text style={[styles.cardTitle, { color: palette.ink }]}>RemindMe</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>RemindMe helps students organize classroom schedules, subjects, notes, assignments, announcements, files, reminders, and attendance in one mobile app.</Text>
            </Card>
            <Section title="App Contact" palette={palette} />
            <ListItem title="Email" subtitle="remindme.app@gmail.com" palette={palette} />
            <Section title="Developers" palette={palette} />
            <ListItem title="ANGEL O. BOHANGIN" subtitle="BS in COMPUTER SCIENCE - bohangin.angel@gmail.com" palette={palette} />
            <ListItem title="AICELLE A. SARONG" subtitle="BS in COMPUTER SCIENCE - aicelle.sarong@gmail.com" palette={palette} />
            <ListItem title="JOHN XAVIER B. BAGOLOS" subtitle="BS in COMPUTER SCIENCE - johnxavierbagolos03@gmail.com" palette={palette} />
          </Screen>
        );
      case "profile":
        return (
          <Screen title="Profile" subtitle="Your account and academic information." palette={palette}>
            <TouchableOpacity style={[styles.settingsButton, { backgroundColor: palette.softSurface, borderColor: palette.line }]} onPress={() => setIsProfileMenuOpen((current) => !current)}>
              <Text style={[styles.settingsButtonText, { color: palette.blue }]}>⋮</Text>
            </TouchableOpacity>
            {isProfileMenuOpen ? <Card palette={palette}><ActionGrid palette={palette} actions={[{ label: "Edit Profile", onPress: () => { setIsProfileMenuOpen(false); setActiveScreen("profileSettings"); } }, { label: "Forgot Password", onPress: () => { setIsProfileMenuOpen(false); setModal("forgotPassword"); } }, { label: "Delete Account", onPress: deleteLocalAccount }]} /></Card> : null}
            <Card palette={palette}>
              <View style={styles.profileHeader}>
                <Image source={logo} style={styles.profilePhoto} />
                <View>
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>{user.name || "Full name not set"}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{user.email}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{user.course || "No course assigned"}</Text>
                </View>
              </View>
            </Card>
            <Section title="Academic Information" palette={palette} />
            <ListItem title="Full Name" subtitle={user.name || "Not set"} palette={palette} />
            <ListItem title="Age" subtitle={user.age || "Not set"} palette={palette} />
            <ListItem title="Address" subtitle={user.address || "Not set"} palette={palette} />
            <ListItem title="Course" subtitle={user.course || "Not set"} palette={palette} />
            <ListItem title="Year Level" subtitle={user.yearLevel || "Not set"} palette={palette} />
            <ListItem title="Semester" subtitle={user.semester || "Not set"} palette={palette} />
            <PrimaryButton title="Logout" onPress={async () => { await clearAuthToken(); setIsAuthenticated(false); }} />
          </Screen>
        );
      case "profileSettings":
        return (
          <Screen title="Edit Profile" subtitle="Name and email are locked to this account." palette={palette}>
            <Card palette={palette}>
              <Text style={[styles.cardTitle, { color: palette.ink }]}>Full Name</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>{user.name}</Text>
              <Text style={[styles.cardTitle, { color: palette.ink, marginTop: 12 }]}>Email</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>{user.email}</Text>
            </Card>
            <Field label="Age" value={user.age} onChangeText={(age) => setUser((current) => ({ ...current, age }))} palette={palette} />
            <Field label="Address" value={user.address} onChangeText={(address) => setUser((current) => ({ ...current, address }))} palette={palette} multiline />
            <Field label="Course" value={user.course} onChangeText={(course) => setUser((current) => ({ ...current, course }))} palette={palette} />
            <Field label="Year Level" value={user.yearLevel} onChangeText={(yearLevel) => setUser((current) => ({ ...current, yearLevel }))} palette={palette} />
            <Field label="Semester" value={user.semester} onChangeText={(semester) => setUser((current) => ({ ...current, semester }))} palette={palette} />
            <PrimaryButton title="Save Profile" onPress={() => setActiveScreen("profile")} />
            <TouchableOpacity onPress={deleteLocalAccount}><Text style={[styles.linkText, { color: colors.red }]}>Delete Account</Text></TouchableOpacity>
          </Screen>
        );
      default:
        return null;
    }
  }
  function renderModal() {
    const modalTitle = {
      subject: "Add Subject",
      task: "New Assignment",
      note: "Add Note",
      announcement: "Post Announcement",
      createClassroom: "Create Classroom",
      addMember: "Add Classroom Member",
      joinClassroom: "Join Classroom",
      forgotPassword: "Reset Password"
    }[modal];

    if (!modal) return null;

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>{modalTitle}</Text>
            {modal === "subject" && (
              <>
                <Field label="Subject" value={subjectForm.title} onChangeText={(title) => setSubjectForm((current) => ({ ...current, title }))} palette={palette} />
                <Field label="Instructor" value={subjectForm.instructor} onChangeText={(instructor) => setSubjectForm((current) => ({ ...current, instructor }))} palette={palette} />
                <Field label="Room" value={subjectForm.room} onChangeText={(room) => setSubjectForm((current) => ({ ...current, room }))} palette={palette} />
                <Field label="Day" value={subjectForm.day} onChangeText={(day) => setSubjectForm((current) => ({ ...current, day }))} palette={palette} />
                <Field label="Start Time" value={subjectForm.start} onChangeText={(start) => setSubjectForm((current) => ({ ...current, start }))} palette={palette} />
                <Field label="End Time" value={subjectForm.end} onChangeText={(end) => setSubjectForm((current) => ({ ...current, end }))} palette={palette} />
                <PrimaryButton title="Create Subject" onPress={addSubject} />
              </>
            )}
            {modal === "task" && (
              <>
                <Card palette={palette}>
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>Subject</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{selectedSubjectTitle}</Text>
                </Card>
                <Field label="Title" value={taskForm.title} onChangeText={(title) => setTaskForm((current) => ({ ...current, title }))} palette={palette} />
                <Field label="Description" value={taskForm.description} onChangeText={(description) => setTaskForm((current) => ({ ...current, description }))} palette={palette} multiline />
                <Field label="Due Date" value={taskForm.dueDate} onChangeText={(dueDate) => setTaskForm((current) => ({ ...current, dueDate }))} palette={palette} />
                <Field label="Priority" value={taskForm.priority} onChangeText={(priority) => setTaskForm((current) => ({ ...current, priority }))} palette={palette} />
                <PrimaryButton title="Create Assignment" onPress={addTask} />
              </>
            )}
            {modal === "note" && (
              <>
                <Card palette={palette}>
                  <Text style={[styles.cardTitle, { color: palette.ink }]}>Subject</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{selectedSubjectTitle}</Text>
                </Card>
                <Field label="Title" value={noteForm.title} onChangeText={(title) => setNoteForm((current) => ({ ...current, title }))} palette={palette} />
                <Field label="Content" value={noteForm.content} onChangeText={(content) => setNoteForm((current) => ({ ...current, content }))} palette={palette} multiline />
                <PrimaryButton title="Save Note" onPress={addNote} />
              </>
            )}
            {modal === "announcement" && (
              <>
                <Field label="Title" value={announcementForm.title} onChangeText={(title) => setAnnouncementForm((current) => ({ ...current, title }))} palette={palette} />
                <Field label="Date" value={announcementForm.date} onChangeText={(date) => setAnnouncementForm((current) => ({ ...current, date }))} palette={palette} />
                <Field label="Message" value={announcementForm.message} onChangeText={(message) => setAnnouncementForm((current) => ({ ...current, message }))} palette={palette} multiline />
                <PrimaryButton title="Post Announcement" onPress={addAnnouncement} />
              </>
            )}
            {modal === "createClassroom" && (
              <>
                <Field label="Classroom Name" value={classroomForm.name} onChangeText={(name) => setClassroomForm((current) => ({ ...current, name }))} palette={palette} placeholder="e.g., CS 101" />
                <Field label="Section/Code" value={classroomForm.section} onChangeText={(section) => setClassroomForm((current) => ({ ...current, section }))} palette={palette} placeholder="e.g., A1" />
                <Field label="Subject" value={classroomForm.subject} onChangeText={(subject) => setClassroomForm((current) => ({ ...current, subject }))} palette={palette} placeholder="e.g., Introduction to Programming" />
                <Field label="Room" value={classroomForm.room} onChangeText={(room) => setClassroomForm((current) => ({ ...current, room }))} palette={palette} placeholder="e.g., Lab 3" />
                <Field label="School Year" value={classroomForm.schoolYear} onChangeText={(schoolYear) => setClassroomForm((current) => ({ ...current, schoolYear }))} palette={palette} placeholder="e.g., 2026-2027" />
                <Field label="Semester" value={classroomForm.semester} onChangeText={(semester) => setClassroomForm((current) => ({ ...current, semester }))} palette={palette} placeholder="e.g., 1st Semester" />
                <Field label="Description" value={classroomForm.description} onChangeText={(description) => setClassroomForm((current) => ({ ...current, description }))} palette={palette} placeholder="Optional description" multiline />
                <PrimaryButton title="Create Classroom" onPress={createClassroom} />
              </>
            )}
            {modal === "addMember" && (
              <>
                <Field label="Student name" value={memberForm.name} onChangeText={(name) => setMemberForm((current) => ({ ...current, name }))} palette={palette} />
                <Field label="Student school email" value={memberForm.email} onChangeText={(email) => setMemberForm((current) => ({ ...current, email }))} palette={palette} keyboardType="email-address" />
                <PrimaryButton title="Add Member" onPress={addClassroomMember} />
              </>
            )}
            {modal === "joinClassroom" && (
              <>
                <Field label="Classroom Code" value={joinClassroomForm.code} onChangeText={(code) => setJoinClassroomForm((current) => ({ ...current, code: code.toUpperCase() }))} palette={palette} placeholder="Enter 6-character code" />
                <TouchableOpacity style={[styles.scanButton, { borderColor: palette.line, backgroundColor: palette.softSurface }]} onPress={openQrScanner}>
                  <Text style={[styles.scanButtonText, { color: palette.blue }]}>Scan classroom QR code</Text>
                </TouchableOpacity>
                <PrimaryButton title="Join Classroom" onPress={joinClassroom} />
              </>
            )}
            {modal === "forgotPassword" && (
              <>
                <Field label="Student Number" value={forgotPasswordForm.studentNumber} onChangeText={(studentNumber) => setForgotPasswordForm((current) => ({ ...current, studentNumber }))} palette={palette} />
                <Field label="School Email" value={forgotPasswordForm.email} onChangeText={(email) => setForgotPasswordForm((current) => ({ ...current, email }))} palette={palette} />
                <PasswordField label="New Password" value={forgotPasswordForm.password} onChangeText={(password) => setForgotPasswordForm((current) => ({ ...current, password }))} palette={palette} isVisible={false} onToggle={() => {}} />
                <PasswordField label="Confirm Password" value={forgotPasswordForm.confirmPassword} onChangeText={(confirmPassword) => setForgotPasswordForm((current) => ({ ...current, confirmPassword }))} palette={palette} isVisible={false} onToggle={() => {}} />
                <PrimaryButton title="Change Password" onPress={resetPassword} />
              </>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setModal(null)}>
              <Text style={[styles.cancelText, { color: palette.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}

function AcademicDashboard({ palette, user, classroom, schedule, tasks, announcements, attendance, isFaculty, isClassPresident, onCreate, onJoin, onWorkspace, onSchedule, onTasks, onCalendar }) {
  const roleName = isFaculty ? "Teacher" : isClassPresident ? "Class President" : "Student";
  const counts = (attendance.members || []).reduce((result, member) => ({ ...result, [member.status]: (result[member.status] || 0) + 1 }), {});
  const actions = isFaculty || isClassPresident
    ? [{ label: "Create Classroom", onPress: onCreate }, { label: "Manage Classroom", onPress: onWorkspace }, { label: "Take Attendance", onPress: onWorkspace }, { label: "Tasks", onPress: onTasks }]
    : [{ label: "Join Classroom", onPress: onJoin }, { label: "View Schedule", onPress: onSchedule }, { label: "View Tasks", onPress: onTasks }, { label: "View Calendar", onPress: onCalendar }];
  const firstName = (user.name || roleName).trim().split(" ")[0];
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayClasses = schedule.filter((item) => !item.day || item.day === todayName);
  const priorityCount = tasks.filter((task) => task.status !== "Completed").length;
  return <View>
    <View style={[styles.dashboardGreeting, { borderLeftColor: palette.blue }]}>
      <Text style={[styles.dashboardKicker, { color: palette.muted }]}>{roleName} Dashboard</Text>
      <Text style={[styles.dashboardGreetingTitle, { color: palette.ink }]}>Good day, {firstName}.</Text>
      <Text style={[styles.dashboardGreetingCopy, { color: palette.muted }]}>Here's what you need to focus on today.</Text>
      <Text style={[styles.attentionSummary, { color: palette.blue }]}>{priorityCount} priority tasks | {todayClasses.length} classes today | {tasks.filter((task) => task.dueDate).length} upcoming deadlines</Text>
    </View>
    <Section title="Quick Actions" palette={palette} />
    <View style={styles.dashboardActionGrid}>{actions.map((action) => <TouchableOpacity key={action.label} onPress={action.onPress} style={[styles.dashboardAction, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.dashboardActionText, { color: palette.ink }]}>{action.label}</Text><Text style={[styles.dashboardActionArrow, { color: palette.blue }]}>→</Text></TouchableOpacity>)}</View>
    <Section title="Today's Schedule" palette={palette} />
    {schedule.slice(0, 3).map((item) => <ListItem key={item.id} title={item.subject} subtitle={`${item.start || "Time TBA"} · ${item.room || "Room TBA"}`} palette={palette} />)}
    {!schedule.length ? <EmptyText text="No scheduled classes yet." palette={palette} /> : null}
    <Section title="Priority Tasks" palette={palette} />
    {tasks.slice(0, 3).map((item) => <ListItem key={item.id} title={item.title} subtitle={`${item.subject || "General"} · Due ${item.dueDate || "TBA"}`} badge={item.priority || "Normal"} palette={palette} />)}
    {!tasks.length ? <EmptyText text="No upcoming tasks." palette={palette} /> : null}
    <Section title="Recent Announcements" palette={palette} />
    {announcements.slice(0, 3).map((item) => <ListItem key={item.id} title={item.title} subtitle={item.message || "No message"} badge={item.date} palette={palette} />)}
    {isFaculty || isClassPresident ? <><Section title="My Created Classroom" palette={palette} /><Card palette={palette}><Text style={[styles.largeMetric, { color: palette.blue }]}>{classroom?.members?.length || 0}</Text><Text style={[styles.cardMeta, { color: palette.muted }]}>{classroom ? `${classroom.name}: enrolled members` : "Create a classroom to manage members and attendance."}</Text></Card></> : <><Section title="Joined Classroom" palette={palette} />{classroom ? <ListItem title={classroom.name} subtitle={`${classroom.section || "Class section"} · ${classroom.subject || "Subject TBA"}`} palette={palette} /> : <EmptyText text="Join a classroom to see shared learning activity." palette={palette} />}</>}
    <Section title="Attendance Summary" palette={palette} />
    <View style={styles.statsRow}>{["Present", "Late", "Absent", "Excused"].map((status) => <View key={status} style={[styles.statCard, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.statValue, { color: palette.ink }]}>{counts[status] || 0}</Text><Text style={[styles.statLabel, { color: palette.muted }]}>{status}</Text></View>)}</View>
  </View>;
}

function AdminDashboard({ palette, data, onRefresh, onUsers, onApprovals }) {
  const counts = data.counts || {};
  return <View>
    <View style={[styles.dashboardGreeting, { borderLeftColor: palette.blue }]}><Text style={[styles.dashboardKicker, { color: palette.muted }]}>Admin Dashboard</Text><Text style={[styles.dashboardGreetingTitle, { color: palette.ink }]}>System overview</Text><Text style={[styles.dashboardGreetingCopy, { color: palette.muted }]}>Account activity, approvals, classrooms, and alerts.</Text></View>
    <Section title="Quick Actions" palette={palette} />
    <View style={styles.dashboardActionGrid}>{[{ label: "Refresh", onPress: onRefresh }, { label: "Manage Users", onPress: onUsers }, { label: "Pending Approvals", onPress: onApprovals }].map((action) => <TouchableOpacity key={action.label} onPress={action.onPress} style={[styles.dashboardAction, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.dashboardActionText, { color: palette.ink }]}>{action.label}</Text><Text style={[styles.dashboardActionArrow, { color: palette.blue }]}>→</Text></TouchableOpacity>)}</View>
    <Section title="System Statistics" palette={palette} />
    <View style={styles.statsRow}>{[["Users", counts.totalUsers], ["Students", counts.students], ["Teachers", counts.teachers], ["Pending", counts.pending]].map(([label, value]) => <View key={label} style={[styles.statCard, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.statValue, { color: palette.ink }]}>{value || 0}</Text><Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text></View>)}</View>
    <Section title="Account Status" palette={palette} />
    <ListItem title="Active accounts" subtitle={`${counts.active || 0} active`} palette={palette} />
    <ListItem title="Suspended accounts" subtitle={`${counts.suspended || 0} suspended`} palette={palette} />
    <ListItem title="Class Presidents" subtitle={`${counts.classPresidents || 0} appointed`} palette={palette} />
    <Section title="Classroom Overview" palette={palette} />
    <ListItem title="Classrooms" subtitle={`${data.classroomCounts?.total || 0} total · ${data.classroomCounts?.active || 0} active · ${data.classroomCounts?.archived || 0} archived`} palette={palette} />
    <Section title="Pending Account Approvals" palette={palette} />
    {(data.pendingApprovals || []).slice(0, 5).map((user) => <ListItem key={user.id} title={user.name || user.email} subtitle={`${user.role} · ${user.studentNumber || user.facultyId || "No school ID"}`} badge="Pending" palette={palette} />)}
    {!(data.pendingApprovals || []).length ? <EmptyText text="No accounts are waiting for approval." palette={palette} /> : null}
    <Section title="Recent System Activity" palette={palette} />
    {(data.activities || []).slice(0, 5).map((item) => <ListItem key={item.id} title={String(item.activity_type || "System activity").replaceAll("_", " ")} subtitle={new Date(item.created_at).toLocaleString()} palette={palette} />)}
    <Section title="System Alerts" palette={palette} />
    {(data.systemAlerts || []).map((item, index) => <ListItem key={`${item.type}-${index}`} title={item.message} subtitle={item.type} badge={item.severity} palette={palette} />)}
    {!(data.systemAlerts || []).length ? <EmptyText text="No active system alerts." palette={palette} /> : null}
  </View>;
}

function AdminClassroomsScreen({ palette, data }) {
  return <Screen title="Classrooms" subtitle="Recently created classrooms and their owners." palette={palette}><Section title="Recent Classrooms" palette={palette} />
    {(data.recentClassrooms || []).map((item) => <ListItem key={item.id} title={item.name || "Untitled classroom"} subtitle={`${item.section || "No section"} · Owner: ${item.creatorId || "Unknown"}`} badge={item.archived ? "Archived" : "Active"} palette={palette} />)}
    {!(data.recentClassrooms || []).length ? <EmptyText text="No classrooms have been created." palette={palette} /> : null}
  </Screen>;
}

function AdminUsersScreen({ palette, title = "User Management", users, onRefresh, onStatus, onPresident, presidentOnly = false }) {
  return <Screen title={title} subtitle={presidentOnly ? "Appoint or revoke Class President capability for student accounts." : "Approve, suspend, and review registered accounts."} palette={palette}>
    <ActionGrid palette={palette} actions={[{ label: "Refresh", onPress: onRefresh }]} />
    {users.map((user) => <Card key={user.id} palette={palette}><Text style={[styles.cardTitle, { color: palette.ink }]}>{user.name || user.email}</Text><Text style={[styles.cardMeta, { color: palette.muted }]}>{user.email} · {user.role}</Text><Text style={[styles.cardMeta, { color: palette.muted }]}>{user.studentNumber || user.facultyId || "No school ID"} · {user.accountStatus || "active"}</Text>{user.role === "student" ? <ActionGrid palette={palette} actions={[{ label: user.isClassPresident ? "Revoke President" : "Appoint President", onPress: () => onPresident(user.id, !user.isClassPresident) }]} /> : null}{!presidentOnly ? <ActionGrid palette={palette} actions={[...(user.accountStatus === "pending" ? [{ label: "Approve", onPress: () => onStatus(user.id, "active") }, { label: "Reject", onPress: () => onStatus(user.id, "rejected") }] : []), ...(user.accountStatus === "active" ? [{ label: "Suspend", onPress: () => onStatus(user.id, "suspended") }] : []), ...(user.accountStatus === "suspended" ? [{ label: "Reactivate", onPress: () => onStatus(user.id, "active") }] : [])]} /> : null}</Card>)}
    {!users.length ? <EmptyText text="No matching user accounts." palette={palette} /> : null}
  </Screen>;
}

function WelcomeScreen({ palette, onLogin, onRegister }) {
  return (
    <SafeAreaView style={[styles.welcomeScreen, { backgroundColor: palette.background }]}>
      <LinearGradient colors={palette.headerGradient} style={styles.welcomeGradient}>
        <View style={styles.welcomeGlow} />
        <Image source={logo} style={styles.welcomeLogo} resizeMode="contain" />
        <Text style={styles.welcomeKicker}>YOUR ACADEMIC COMMAND CENTER</Text>
        <Text style={styles.welcomeTitle}>Make every study day<Text style={styles.welcomeTitleAccent}>{"\n"}feel more in control.</Text></Text>
        <Text style={styles.welcomeCopy}>Keep schedules, deadlines, notes, and classrooms together in one calm workspace built for student life.</Text>
        <View style={styles.welcomeButtons}>
          <TouchableOpacity style={styles.welcomePrimary} onPress={onLogin}><Text style={styles.welcomePrimaryText}>Sign in  -&gt;</Text></TouchableOpacity>
          <TouchableOpacity style={styles.welcomeSecondary} onPress={onRegister}><Text style={styles.welcomeSecondaryText}>Create an account</Text></TouchableOpacity>
        </View>
        <View style={styles.welcomeFeatures}>
          <View><Text style={styles.welcomeFeatureNumber}>01</Text><Text style={styles.welcomeFeatureText}>Plan your week</Text></View>
          <View><Text style={styles.welcomeFeatureNumber}>02</Text><Text style={styles.welcomeFeatureText}>Stay ahead</Text></View>
          <View><Text style={styles.welcomeFeatureNumber}>03</Text><Text style={styles.welcomeFeatureText}>Learn together</Text></View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function AuthScreen({ mode, form, setForm, onSubmit, onSwitch, onForgotPassword, onBack, palette, rememberedAccount, onRememberedAccount }) {
  const isLogin = mode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex} keyboardVerticalOffset={20}>
        <TouchableOpacity style={styles.backToWelcome} onPress={onBack}><Text style={[styles.linkText, { color: palette.blue }]}>Back to welcome</Text></TouchableOpacity>
        <LinearGradient colors={palette.headerGradient} style={styles.authHero}>
          <Image source={logo} style={styles.authLogo} resizeMode="contain" />
          <Text style={styles.authTitle}>RemindMe</Text>
          <Text style={styles.authSubtitle}>Organize. Study. Succeed.</Text>
        </LinearGradient>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <Card palette={palette}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>{isLogin ? "Login" : "Create Account"}</Text>
            {isLogin ? (
              <>
                {rememberedAccount ? (
                  <TouchableOpacity style={[styles.rememberedAccount, { backgroundColor: palette.softSurface, borderColor: palette.line }]} onPress={() => onRememberedAccount(rememberedAccount.email)}>
                    <Text style={[styles.cardTitle, { color: palette.ink }]}>{rememberedAccount.name || "Previous account"}</Text>
                    <Text style={[styles.cardMeta, { color: palette.muted }]}>{rememberedAccount.email}</Text>
                  </TouchableOpacity>
                ) : null}
                <Field
                  label="School Email Address"
                  value={form.email}
                  onChangeText={(email) => setForm((current) => ({ ...current, email }))}
                  palette={palette}
                />
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChangeText={(password) => setForm((current) => ({ ...current, password }))}
                  palette={palette}
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
                <PrimaryButton title="Login" onPress={onSubmit} />
                <TouchableOpacity onPress={onForgotPassword}>
                  <Text style={[styles.linkText, { color: palette.blue }]}>Forgot Password?</Text>
                </TouchableOpacity>
                <Divider label="OR" palette={palette} />
                <TouchableOpacity onPress={onSwitch}>
                  <Text style={[styles.linkText, { color: palette.blue }]}>Register Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Field
                  label="School Email"
                  value={form.email}
                  onChangeText={(email) => setForm((current) => ({ ...current, email }))}
                  palette={palette}
                />
                <Text style={[styles.fieldLabel, { color: palette.muted }]}>Account Type</Text>
                <View style={styles.rolePicker}>
                  {["student", "faculty"].map((role) => (
                    <TouchableOpacity key={role} onPress={() => setForm((current) => ({ ...current, role }))} style={[styles.roleOption, { borderColor: palette.line, backgroundColor: form.role === role ? palette.blue : palette.input }]}>
                      <Text style={{ color: form.role === role ? "white" : palette.ink, fontWeight: "800" }}>{role === "student" ? "Student" : "Faculty"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Field
                  label={form.role === "faculty" ? "Faculty ID" : "Student ID"}
                  value={form.role === "faculty" ? form.facultyId : form.studentNumber}
                  onChangeText={(value) => setForm((current) => form.role === "faculty" ? ({ ...current, facultyId: value }) : ({ ...current, studentNumber: value }))}
                  palette={palette}
                />
                <Field
                  label="Full Name"
                  value={form.name}
                  onChangeText={(name) => setForm((current) => ({ ...current, name }))}
                  palette={palette}
                />
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChangeText={(password) => setForm((current) => ({ ...current, password }))}
                  palette={palette}
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
                <PasswordField
                  label="Confirm Password"
                  value={form.confirmPassword}
                  onChangeText={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))}
                  palette={palette}
                  isVisible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                <PrimaryButton title="Register" onPress={onSubmit} />
                <TouchableOpacity onPress={onSwitch}>
                  <Text style={[styles.linkText, { color: palette.blue }]}>Already have an account? Login</Text>
                </TouchableOpacity>
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Screen({ title, subtitle, children, palette }) {
  return (
    <View>
      <View style={styles.screenHeading}>
        <Text style={[styles.screenTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.screenSubtitle, { color: palette.muted }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function Card({ children, palette }) {
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>{children}</View>;
}

function Section({ title, action, onAction, palette }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.ink }]}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={[styles.sectionAction, { color: palette.blue }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChangeText, palette, placeholder, multiline, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: palette.input,
            borderColor: palette.line,
            color: palette.ink
          }
        ]}
      />
    </View>
  );
}

function PrimaryButton({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function ActionGrid({ actions, palette }) {
  return (
    <View style={styles.actionGrid}>
      {actions.map((action) => (
        <TouchableOpacity key={action.label} style={[styles.actionButton, { backgroundColor: palette.softSurface, borderColor: palette.line }]} onPress={action.onPress}>
          <Text style={[styles.actionText, { color: palette.blue }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StatsRow({ items, palette }) {
  return (
    <View style={styles.statsRow}>
      {items.map((item) => (
        <View key={item.label} style={[styles.statCard, { backgroundColor: palette.softSurface, borderColor: palette.line }]}>
          <Text style={[styles.statValue, { color: palette.blue }]}>{item.value}</Text>
          <Text style={[styles.statLabel, { color: palette.muted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ListItem({ title, subtitle, badge, palette }) {
  return (
    <Card palette={palette}>
      <View style={styles.listRow}>
        <View style={styles.listText}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>{title}</Text>
          {subtitle ? <Text style={[styles.cardMeta, { color: palette.muted }]}>{subtitle}</Text> : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: palette.softSurface }]}>
            <Text style={[styles.badgeText, { color: palette.blue }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function EmptyText({ text, palette }) {
  return <Text style={[styles.emptyText, { color: palette.muted }]}>{text}</Text>;
}

function PreviewBox({ label, palette }) {
  return (
    <View style={[styles.previewBox, { backgroundColor: palette.softSurface, borderColor: palette.line }]}>
      <Text style={[styles.previewText, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

function CalendarGrid({ palette }) {
  const days = Array.from({ length: 25 }, (_, index) => index + 1);
  return (
    <Card palette={palette}>
      <Text style={[styles.calendarTitle, { color: palette.ink }]}>July 2026</Text>
      <View style={styles.weekRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <Text key={day} style={[styles.weekText, { color: palette.muted }]}>{day}</Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day) => (
          <View key={day} style={[styles.dayCell, day === 17 && { backgroundColor: palette.blue }]}>
            <Text style={[styles.dayText, { color: day === 17 ? "white" : palette.ink }]}>{day}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Legend({ palette }) {
  const items = [
    { label: "Completed", color: colors.green },
    { label: "Overdue", color: colors.red },
    { label: "Upcoming", color: colors.yellow },
    { label: "Today", color: colors.blue }
  ];
  return (
    <View style={styles.legendGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={[styles.cardMeta, { color: palette.muted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function PasswordField({ label, value, onChangeText, palette, isVisible, onToggle }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      <View style={[styles.passwordFieldContainer, { backgroundColor: palette.input, borderColor: palette.line }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={`Enter your ${label.toLowerCase()}`}
          placeholderTextColor={palette.muted}
          secureTextEntry={!isVisible}
          style={[styles.passwordInput, { color: palette.ink }]}
        />
        <TouchableOpacity onPress={onToggle} style={styles.toggleButton}>
          <Text style={[styles.toggleText, { color: palette.blue }]}>👁</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Divider({ label, palette }) {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: palette.line }]} />
      <Text style={[styles.dividerText, { color: palette.muted }]}>{label}</Text>
      <View style={[styles.dividerLine, { backgroundColor: palette.line }]} />
    </View>
  );
}

function buildPriorityPlan(tasks) {
  const priorityScore = { High: 5, Medium: 3, Low: 1 };
  const difficultyScore = { Hard: 4, Medium: 2, Easy: 1 };
  return [...tasks]
    .map((task) => ({
      ...task,
      score: (priorityScore[task.priority] || 1) + (difficultyScore[task.difficulty] || 1) + Number(task.workload || 1)
    }))
    .sort((a, b) => b.score - a.score);
}

function buildNotifications(tasks, announcements) {
  return [
    ...tasks.slice(0, 3).map((task) => ({
      id: `notif-${task.id}`,
      title: task.title,
      detail: `${task.subject} deadline reminder`,
      when: `Due ${task.dueDate}`
    })),
    ...announcements.slice(0, 2).map((announcement) => ({
      id: `notif-${announcement.id}`,
      title: "New Announcement",
      detail: announcement.title,
      when: announcement.date
    }))
  ];
}

function normalizeId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `subject-${Date.now()}`;
}

function accountDataKey(email = "") {
  return `${DATA_KEY_PREFIX}-${email.trim().toLowerCase()}`;
}

function normalizeWorkspace(workspace = {}) {
  const classrooms = Array.isArray(workspace.classrooms) ? workspace.classrooms : [];
  const members = workspace.attendance?.members || workspace.members || [];
  const sourceClassroom = workspace.classroom || classrooms[0] || null;
  // Older desktop snapshots keep members at workspace level. Normalizing them
  // here avoids a crash and keeps the classroom card complete in Expo.
  const classroom = sourceClassroom ? {
    ...sourceClassroom,
    members: Array.isArray(sourceClassroom.members) ? sourceClassroom.members : members
  } : null;
  return {
    ...workspace,
    user: { ...(workspace.profile || {}), ...(workspace.user || {}) },
    profile: { ...(workspace.profile || {}), ...(workspace.user || {}) },
    classroom,
    classrooms: classrooms.length ? classrooms : (classroom ? [classroom] : []),
    attendance: { ...(workspace.attendance || {}), members }
  };
}

function subjectSummary(subjectTitle, notes, tasks, announcements) {
  const noteCount = notes.filter((note) => note.subject === subjectTitle).length;
  const taskCount = tasks.filter((task) => task.subject === subjectTitle).length;
  const announcementCount = announcements.filter((item) => !item.subject || item.subject === subjectTitle).length;
  return `${noteCount} note(s) - ${taskCount} assignment(s) - ${announcementCount} announcement(s)`;
}

function randomSubjectColor(index) {
  return ["#3678f4", "#31c28b", "#ff9f43", "#dd4d8f", "#8b5cf6", "#20d2ff"][index % 6];
}

function firstName(name) {
  return name.split(" ")[0] || "Student";
}

function screenTitle(id, items = navItems) {
  return items.find((item) => item.id === id)?.label || "Dashboard";
}

function subjectScheduleLabel(subject, schedule) {
  const item = schedule.find((entry) => entry.subject === subject);
  if (!item) return "No schedule yet";
  return `${item.day}, ${item.start}-${item.end}`;
}

function attendanceRate(stats = {}) {
  const present = stats.Present || 0;
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

function guessFileType(name) {
  const ext = name.split(".").pop()?.toUpperCase();
  if (!ext) return "File";
  if (["PDF", "DOCX", "PPT", "PPTX", "ZIP", "PNG", "JPG"].includes(ext)) return ext;
  return "File";
}

function analyzeScheduleUpload(fileName = "") {
  const cleanName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dayMatch = cleanName.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  const timeMatch = cleanName.match(/\b(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\s*(?:to|-)\s*(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\b/i);
  const roomMatch = cleanName.match(/\b(?:room|rm|lab)\s*([a-z0-9 -]+)/i);
  const day = normalizeDay(dayMatch?.[1] || "Monday");
  const start = timeMatch ? formatTime(timeMatch[1], timeMatch[2], timeMatch[3]) : "09:00";
  const end = timeMatch ? formatTime(timeMatch[4], timeMatch[5], timeMatch[6] || timeMatch[3]) : "10:00";
  const subjectText = cleanName
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/ig, "")
    .replace(/\b\d{1,2}:?\d{0,2}\s*(AM|PM)?\s*(to|-)\s*\d{1,2}:?\d{0,2}\s*(AM|PM)?\b/ig, "")
    .replace(/\b(?:room|rm|lab)\s*[a-z0-9 -]+/ig, "")
    .trim();
  const subject = titleCase(subjectText || "Uploaded Schedule Subject");
  const subjectId = normalizeId(subject);

  return [{
    id: `s${Date.now()}`,
    subjectId,
    subject,
    day,
    start,
    end,
    room: roomMatch ? `Room ${roomMatch[1].trim()}` : "Room TBA",
    fromUpload: true
  }];
}

function normalizeDay(value) {
  const map = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const lower = value.toLowerCase().slice(0, 3);
  return map[lower] || titleCase(value);
}

function formatTime(hour, minute = "00", meridiem = "") {
  let numericHour = Number(hour);
  const normalizedMinute = String(minute || "00").padStart(2, "0");
  const upper = meridiem.toUpperCase();
  if (upper === "PM" && numericHour < 12) numericHour += 12;
  if (upper === "AM" && numericHour === 12) numericHour = 0;
  return `${String(numericHour).padStart(2, "0")}:${normalizedMinute}`;
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function isAllowedUpload(name = "") {
  const lowerName = name.toLowerCase();
  return allowedUploadExtensions.some((extension) => lowerName.endsWith(extension));
}

function allowedDocumentTypes() {
  return [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "image/*"
  ];
}

const lightPalette = {
  background: "#f6f7fb",
  surface: "#ffffff",
  softSurface: "#f0f2f8",
  input: "#ffffff",
  ink: "#172033",
  muted: "#65718a",
  line: "#e1e5ee",
  blue: "#635bff",
  headerGradient: ["#4038aa", "#635bff", "#2d8cff"]
};

const darkPalette = {
  background: "#0b1020",
  surface: "#151b33",
  softSurface: "#1b2340",
  input: "#10162b",
  ink: "#f4f8ff",
  muted: "#a8b7cc",
  line: "rgba(180, 190, 255, 0.18)",
  blue: "#8b7cff",
  headerGradient: ["#151035", "#30236d", "#2469b7"]
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  welcomeScreen: {
    flex: 1
  },
  welcomeGradient: {
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingBottom: 42,
    paddingTop: 70
  },
  welcomeGlow: {
    backgroundColor: "rgba(32, 210, 255, 0.16)",
    borderRadius: 220,
    height: 440,
    position: "absolute",
    right: -180,
    top: 80,
    width: 440
  },
  welcomeLogo: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderRadius: 16,
    height: 58,
    marginBottom: "auto",
    width: 58
  },
  welcomeKicker: {
    color: "#7ee8ff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 14
  },
  welcomeTitle: {
    color: "#f8fbff",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42
  },
  welcomeTitleAccent: {
    color: "#ffd34f"
  },
  welcomeCopy: {
    color: "rgba(248,251,255,0.76)",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 20,
    maxWidth: 390
  },
  welcomeButtons: {
    gap: 10,
    marginTop: 26
  },
  welcomePrimary: {
    alignItems: "center",
    backgroundColor: "#ffd34f",
    borderRadius: 14,
    minHeight: 54,
    justifyContent: "center"
  },
  welcomePrimaryText: {
    color: "#101c3c",
    fontSize: 16,
    fontWeight: "900"
  },
  welcomeSecondary: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: "center"
  },
  welcomeSecondaryText: {
    color: "#f8fbff",
    fontSize: 15,
    fontWeight: "800"
  },
  welcomeFeatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 34
  },
  welcomeFeatureNumber: {
    color: "#ffd34f",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5
  },
  welcomeFeatureText: {
    color: "rgba(248,251,255,0.78)",
    fontSize: 12
  },
  backToWelcome: {
    alignSelf: "flex-start",
    marginLeft: 18,
    marginTop: 12
  },
  authHero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 30,
    paddingTop: 34
  },
  authLogo: {
    width: 116,
    height: 116,
    borderRadius: 28,
    marginBottom: 12,
    objectFit: "contain"
  },
  authTitle: {
    color: "white",
    fontSize: 34,
    fontWeight: "900"
  },
  authSubtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "800"
  },
  authContent: {
    padding: 18,
    paddingBottom: 120
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    paddingTop: 18
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  headerLogo: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "white",
    objectFit: "contain"
  },
  headerText: {
    flex: 1
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900"
  },
  headerSubcopy: {
    color: "rgba(255,255,255,0.86)",
    fontWeight: "800",
    marginTop: 10
  },
  modeBox: {
    alignItems: "center"
  },
  modeLabel: {
    color: "white",
    fontSize: 11,
    fontWeight: "900"
  },
  navRail: {
    borderBottomWidth: 1
  },
  navRailContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  navChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  activeNavChip: {
    backgroundColor: colors.blue,
    borderColor: colors.blue
  },
  navChipText: {
    fontSize: 12,
    fontWeight: "900"
  },
  content: {
    flex: 1
  },
  contentInner: {
    padding: 16,
    paddingBottom: 28
  },
  screenHeading: {
    marginBottom: 14
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "900"
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4
  },
  cardMeta: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  enrollmentCode: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 3,
    marginVertical: 5
  },
  largeMetric: {
    fontSize: 34,
    fontWeight: "900"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 8
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900"
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "900"
  },
  fieldWrap: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6
  },
  rolePicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  roleOption: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  passwordFieldContainer: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  passwordInput: {
    flex: 1,
    padding: 0,
    minHeight: 46
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "900"
  },
  flex: {
    flex: 1
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "900"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12
  },
  actionButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  actionText: {
    fontWeight: "900"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  dashboardGreeting: {
    borderLeftWidth: 3,
    marginBottom: 18,
    paddingLeft: 13
  },
  dashboardKicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  dashboardGreetingTitle: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 5
  },
  dashboardGreetingCopy: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3
  },
  attentionSummary: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12
  },
  dashboardActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12
  },
  dashboardAction: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minWidth: "47%",
    padding: 13
  },
  dashboardActionText: {
    fontSize: 12,
    fontWeight: "900"
  },
  dashboardActionArrow: {
    fontSize: 17,
    fontWeight: "900"
  },
  statCard: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900"
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  listText: {
    flex: 1
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900"
  },
  addCard: {
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  addCardText: {
    fontWeight: "900"
  },
  subjectGrid: {
    gap: 12
  },
  subjectCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  subjectColor: {
    borderRadius: 999,
    height: 12,
    marginBottom: 10,
    width: 44
  },
  previewBox: {
    alignItems: "center",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 150,
    marginBottom: 12,
    padding: 18
  },
  previewText: {
    fontWeight: "900",
    textAlign: "center"
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  weekText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    marginBottom: 7,
    minHeight: 36,
    width: "14.28%"
  },
  dayText: {
    fontWeight: "900"
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  legendDot: {
    borderRadius: 4,
    height: 12,
    width: 12
  },
  qrBox: {
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    height: 184,
    marginBottom: 14,
    padding: 14,
    width: 184
  },
  qrPixel: {
    borderRadius: 3,
    height: 16,
    width: 16
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  profilePhoto: {
    borderRadius: 16,
    height: 64,
    width: 64
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  widgetLine: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10
  },
  bottomNav: {
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingBottom: 10,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  bottomNavItem: {
    alignItems: "center",
    flex: 1
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: "900"
  },
  modalOverlay: {
    backgroundColor: "rgba(0,0,0,0.42)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    padding: 18
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12
  },
  cancelButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center"
  },
  cancelText: {
    fontWeight: "900"
  },
  linkText: {
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center"
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 12
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "900"
  },
  emptyText: {
    fontWeight: "800",
    marginBottom: 12
  },
  searchShell: {
    alignItems: "flex-end",
    marginBottom: 10
  },
  searchIconButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  searchIconText: {
    fontSize: 24,
    fontWeight: "900"
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  headerIconText: {
    color: "white",
    fontSize: 22,
    fontWeight: "900"
  },
  settingsButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginBottom: 12,
    width: 44
  },
  settingsButtonText: {
    fontSize: 20,
    fontWeight: "900"
  },
  emptyStart: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 104,
    justifyContent: "center",
    marginBottom: 18,
    width: 104
  },
  emptyPlus: {
    fontSize: 54,
    fontWeight: "300",
    lineHeight: 62
  },
  rememberedAccount: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  scanButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 46,
    justifyContent: "center"
  },
  scanButtonText: {
    fontWeight: "900"
  },
  scannerOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(4, 15, 34, 0.78)",
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  scannerPanel: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    width: "100%"
  },
  scannerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  scannerSubtitle: {
    color: colors.muted,
    marginBottom: 14,
    marginTop: 5
  },
  cameraFrame: {
    borderRadius: 16,
    height: 300,
    overflow: "hidden"
  },
  camera: {
    flex: 1
  },
  appMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "flex-start",
    justifyContent: "flex-start"
  },
  appMenuPanel: {
    width: "58%",
    height: "100%",
    backgroundColor: "#113a8f",
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 28
  },
  appMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.14)"
  },
  appMenuTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900"
  },
  appMenuClose: {
    color: "white",
    fontSize: 28,
    fontWeight: "300"
  },
  appMenuContent: {
    paddingVertical: 8
  },
  appMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)"
  },
  appMenuItemIcon: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 22,
    fontWeight: "900",
    marginRight: 12,
    width: 36,
    textAlign: "center"
  },
  appMenuItemLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "800"
  }
});



