import { analyzeScheduleImage, fetchRemoteState, getAdminUsers, loginUser, registerUser, resetPassword, signOut, syncRemoteState, updateAccountStatus, uploadFile, verifySession } from "./api.js";
import { addRecord, emptyStudentState, forgetAccount, loadRememberedAccounts, loadState, rememberAccount, saveState } from "./store.js";
import { renderAll, renderTasks } from "./render.js";

let state = loadState();
let activeSubjectWorkspace = "";
let activeSubjectFeature = "";
let activePost = null;
const syncStatus = document.getElementById("syncStatus");
const allowedUploadExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".png", ".jpg", ".jpeg", ".webp", ".gif"];

ensureMockContent();
renderAll(state);
renderProfileSummary();
initializeShell();
bindNavigation();
bindForms();
bindActions();
renderRememberedAccounts();
updateEmptyDashboard();
showView(getStoredView());
restoreVerifiedSession();

function getStoredView() {
  const storedView = localStorage.getItem("remindme-active-view");
  return storedView && document.getElementById(storedView) ? storedView : "dashboard";
}

function initializeShell() {
  const savedTheme = localStorage.getItem("remindme-theme") || "light";
  const isCollapsed = localStorage.getItem("remindme-sidebar") === "collapsed";
  const isLoggedIn = sessionStorage.getItem("remindme-session") === "active";

  document.body.classList.toggle("dark-mode", savedTheme === "dark");
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  document.getElementById("themeToggle").textContent = savedTheme === "dark" ? "Light mode" : "Dark mode";
  document.getElementById("themeToggle").textContent = savedTheme === "dark" ? "☀" : "☾";
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  if (isLoggedIn) {
    showApp();
  } else {
    showWelcome();
  }
}

function bindNavigation() {
  document.querySelectorAll("[data-view], [data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view || button.dataset.viewJump));
  });

  document.querySelectorAll("[data-dialog-jump]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.dialogJump));
  });
}

function bindForms() {
  document.getElementById("registerRole")?.addEventListener("change", (event) => {
    const isStudent = event.target.value === "student";
    const isFaculty = event.target.value === "faculty";
    const student = document.querySelector("#studentIdField input");
    const faculty = document.querySelector("#facultyIdField input");
    document.getElementById("studentIdField").classList.toggle("is-hidden", !isStudent);
    document.getElementById("facultyIdField").classList.toggle("is-hidden", !isFaculty);
    student.required = isStudent;
    faculty.required = isFaculty;
  });
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    try {
      const result = await loginUser(data);
      state.profile = { ...state.profile, email: result.user.email, name: result.user.user_metadata?.name || state.profile.name || "" };
      rememberAccount({ email: data.email, name: state.profile.name });
      saveState(state);
      sessionStorage.setItem("remindme-session", "active");
      showApp();
      await attemptInitialSync();
    } catch (error) { alert(error.message); }
  });

  document.getElementById("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    if (data.role === "student" && !/^\d{4}-\d{6}$/.test(data.studentNumber || "")) return alert("Student ID must use YYYY-NNNNNN.");
    if (data.role === "faculty" && !/^[A-Za-z]{3}-\d{6}$/.test(data.facultyId || "")) return alert("Faculty ID must use AAA-NNNNNN.");
    if (data.password !== data.confirmPassword) {
      alert("Password and confirm password must match.");
      return;
    }
    try {
      const result = await registerUser(data);
      if (!result.token) {
        alert("Account created. Confirm your email, then sign in.");
        toggleAuthMode("login");
        return;
      }
      state = structuredClone(emptyStudentState);
      state.profile = { name: data.name, email: data.email, role: data.role, studentNumber: data.studentNumber || "", facultyId: data.facultyId || "", birthdate: "", age: "", address: "", course: "", yearLevel: "", semester: "" };
      rememberAccount({ email: data.email, name: data.name });
      saveState(state);
      sessionStorage.setItem("remindme-session", "active");
      showApp();
      await attemptInitialSync();
    } catch (error) { alert(error.message); }
  });

  document.getElementById("classroomScheduleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!hasClassroom()) {
      alert("Create or join a classroom before adding a class schedule.");
      showView("collaboration");
      return;
    }
    const data = formData(event.target);
    addRecord(state, "schedule", {
      ...data,
      shareWithClassroom: Boolean(data.shareWithClassroom === "on"),
      classroomId: state.classrooms[0].id
    });
    ensureMockContent();
    event.target.reset();
    renderAll(state);
    syncNow();
  });

  document.getElementById("taskForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!hasClassroom()) {
      alert("Create or join a classroom before adding assignments.");
      showView("collaboration");
      return;
    }
    addRecord(state, "tasks", { ...formData(event.target), status: "Upcoming" });
    event.target.reset();
    renderAll(state);
    syncNow();
  });

  document.getElementById("noteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hasClassroom()) {
      alert("Create or join a classroom before adding notes or files.");
      showView("collaboration");
      return;
    }
    const data = formData(event.target);
    const file = event.target.elements.file.files[0];
    if (file) {
      if (!navigator.onLine) {
        alert("Files cannot be uploaded while offline. Your notes still work offline, but upload after reconnecting.");
        return;
      }
      if (!isAllowedUpload(file)) {
        alert("Only PDF, DOCX, PPT/PPTX, ZIP, and image files can be uploaded.");
        return;
      }
      try {
        const uploaded = await uploadFile(file, `notes/${data.subject || "general"}`);
        data.fileName = uploaded.fileName;
        data.fileUrl = uploaded.url;
      } catch (error) {
        alert(error.message);
        return;
      }
    }
    addRecord(state, "notes", data);
    event.target.reset();
    renderAll(state);
    updateEmptyDashboard();
    syncNow();
  });

  const announcementForm = document.getElementById("announcementForm");
  announcementForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addRecord(state, "announcements", formData(event.target));
    event.target.reset();
    renderAll(state);
    syncNow();
  });

  document.getElementById("classroomForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canManageClassrooms()) return alert("Only Faculty accounts or appointed Class Presidents can create classrooms.");
    const data = formData(event.target);
    createClassroom(data);
    event.target.reset();
  });

  document.getElementById("joinClassroomForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = formData(event.target).code.trim();
    if (!code) return;
    const normalizedCode = code.toUpperCase();
    const classroom = {
      id: code,
      name: `Joined Class ${normalizedCode.slice(0, 6)}`,
      section: "Shared",
      description: "Joined from a classroom code.",
      ownerEmail: "classroom-owner",
      inviteCode: normalizedCode,
      joiningEnabled: true
    };
    state.classrooms = [classroom];
    state.members = [{ id: crypto.randomUUID(), name: state.profile.name || "Student", email: state.profile.email || "student@example.com", role: "Member" }];
    ensureMockContent();
    saveState(state);
    renderAll(state);
    updateEmptyDashboard();
    syncNow();
    event.target.reset();
  });

  document.getElementById("classroomAnnouncementForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    if (!data.title || !data.message) return;
    addRecord(state, "announcements", {
      ...data,
      audience: "Class",
      date: new Date().toISOString().slice(0, 10),
      shared: true,
      classroomId: state.classrooms[0]?.id || "classroom"
    });
    event.target.reset();
    renderAll(state);
  });

  document.getElementById("classroomNoteForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    if (!data.title || !data.content) return;
    addRecord(state, "notes", {
      ...data,
      subject: "Classroom",
      shared: true,
      classroomId: state.classrooms[0]?.id || "classroom"
    });
    event.target.reset();
    renderAll(state);
  });

  document.getElementById("subjectNoteForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const file = event.target.elements.file.files[0];
    if (file) {
      if (!isAllowedUpload(file)) return alert("Notes support DOC, DOCX, PDF, PPT, PPTX, PNG, and JPEG files.");
      try {
        const uploaded = await uploadFile(file, `notes/${activeSubjectWorkspace}`);
        data.fileName = uploaded.fileName;
        data.fileUrl = uploaded.url;
      } catch (error) { return alert(error.message); }
    }
    addRecord(state, "notes", { ...data, subject: activeSubjectWorkspace, shared: true });
    event.target.reset();
    renderAll(state);
    openSubjectFeature("notes");
    syncNow();
  });

  document.getElementById("subjectTaskForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    addRecord(state, "tasks", { ...data, subject: activeSubjectWorkspace, type: "Activity", status: "Upcoming" });
    event.target.reset();
    renderAll(state);
    openSubjectWorkspace(activeSubjectWorkspace);
    syncNow();
  });

  document.getElementById("subjectAnnouncementForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    addRecord(state, "announcements", { ...data, subject: activeSubjectWorkspace, audience: "Subject", date: new Date().toISOString().slice(0, 10), shared: true });
    event.target.reset();
    renderAll(state);
    openSubjectWorkspace(activeSubjectWorkspace);
    syncNow();
  });

  document.getElementById("profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const registeredFields = {
      name: state.profile.name,
      email: state.profile.email,
      studentNumber: state.profile.studentNumber
    };
    state.profile = {
      ...state.profile,
      ...data,
      age: data.birthdate ? calculateAge(data.birthdate) : "",
      ...registeredFields
    };
    delete state.profile.password;
    saveState(state);
    renderProfileSummary();
    document.getElementById("profileEditPanel").classList.add("is-hidden");
    renderAll(state);
    document.getElementById("profile").classList.remove("profile-edit-mode");
    showView("profile");
    syncNow();
  });

  document.querySelector("#profileForm [name='birthdate']").addEventListener("change", (event) => {
    document.querySelector("#profileForm [name='age']").value = calculateAge(event.target.value);
  });

  document.getElementById("deleteAccountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = formData(event.target).email;
    if (email !== state.profile.email) {
      alert("The email you entered does not match this account.");
      return;
    }
    forgetAccount(state.profile.email);
    state = structuredClone(emptyStudentState);
    saveState(state);
    sessionStorage.removeItem("remindme-session");
    renderRememberedAccounts();
    document.getElementById("profileDeletePanel").classList.add("is-hidden");
    document.getElementById("appFrame").classList.add("is-hidden");
    showWelcome();
  });

  document.getElementById("forgotPasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    try {
      await resetPassword(data.email);
      alert("Password reset email sent.");
      document.getElementById("forgotPasswordDialog").close();
      event.target.reset();
    } catch (error) { alert(error.message); }
  });
}

function bindActions() {
  document.getElementById("welcomeLogin").addEventListener("click", () => showAuth("login"));
  document.getElementById("welcomeRegister").addEventListener("click", () => showAuth("register"));
  document.getElementById("showRegister").addEventListener("click", () => toggleAuthMode("register"));
  document.getElementById("showLogin").addEventListener("click", () => toggleAuthMode("login"));
  document.getElementById("showCreateClassroomForm")?.addEventListener("click", () => {
    if (!canManageClassrooms()) return alert("Only Faculty accounts or appointed Class Presidents can create classrooms. Use a class code to join instead.");
    document.getElementById("classroomForm").classList.remove("is-hidden");
    document.getElementById("joinClassroomForm").classList.add("is-hidden");
  });
  document.getElementById("showJoinClassroomForm")?.addEventListener("click", () => {
    document.getElementById("joinClassroomForm").classList.remove("is-hidden");
    document.getElementById("classroomForm").classList.add("is-hidden");
  });
  document.getElementById("showManualScheduleForm")?.addEventListener("click", () => {
    document.getElementById("classroomScheduleForm").classList.remove("is-hidden");
    document.getElementById("showManualScheduleForm").classList.add("is-hidden");
  });
  document.getElementById("addAnotherSchedule")?.addEventListener("click", () => {
    document.getElementById("classroomScheduleSetup").classList.remove("is-hidden");
    document.getElementById("classroomScheduleSetupOptions").classList.remove("is-hidden");
    document.getElementById("classroomScheduleSetupActions").classList.remove("is-hidden");
    document.getElementById("showManualScheduleForm").classList.remove("is-hidden");
    document.getElementById("classroomScheduleForm").classList.add("is-hidden");
    document.getElementById("classroomScheduleReview").classList.add("is-hidden");
    document.getElementById("classroomScheduleSetup").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.previousElementSibling;
      const nextType = input.type === "password" ? "text" : "password";
      input.type = nextType;
      button.textContent = "👁";
      button.setAttribute("aria-label", nextType === "password" ? "Show password" : "Hide password");
    });
  });

  document.getElementById("appIconButton").addEventListener("click", () => {
    document.getElementById("dashboardMenu").classList.toggle("open");
  });

  document.getElementById("themeToggle").addEventListener("click", (event) => {
    document.body.classList.toggle("dark-mode");
    const mode = document.body.classList.contains("dark-mode") ? "dark" : "light";
    localStorage.setItem("remindme-theme", mode);
    event.currentTarget.textContent = mode === "dark" ? "☀" : "☾";
  });

  const logout = async () => {
    await signOut();
    sessionStorage.removeItem("remindme-session");
    clearAuthForms();
    document.getElementById("appFrame").classList.add("is-hidden");
    showWelcome();
  };
  document.getElementById("sidebarLogout").addEventListener("click", logout);
  document.getElementById("leaveClassroomButton")?.addEventListener("click", () => {
    if (!confirm("Leave this classroom?")) return;
    state.classrooms = [];
    state.members = [];
    saveState(state);
    renderAll(state);
  });
  const openForgotPassword = () => document.getElementById("forgotPasswordDialog").showModal();
  document.getElementById("showForgotPassword").addEventListener("click", openForgotPassword);
  document.getElementById("profileForgotPassword").addEventListener("click", () => {
    document.getElementById("profileSettingsMenu").classList.add("is-hidden");
    openForgotPassword();
  });
  document.getElementById("editProfileButton").addEventListener("click", () => {
    const form = document.getElementById("profileForm");
    const menu = document.getElementById("profileSettingsMenu");
    form.reset();
    Object.entries(state.profile).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value || "";
    });
    form.elements.age.value = state.profile.birthdate ? calculateAge(state.profile.birthdate) : "";
    document.getElementById("profileEditPanel").classList.remove("is-hidden");
    document.getElementById("profileDeletePanel").classList.add("is-hidden");
    menu.classList.add("is-hidden");
    document.getElementById("profile").classList.add("profile-edit-mode");
    document.getElementById("viewTitle").textContent = "Edit Profile";
  });

  document.getElementById("deleteAccountButton").addEventListener("click", () => {
    document.getElementById("profileSettingsMenu").classList.add("is-hidden");
    document.getElementById("profileEditPanel").classList.add("is-hidden");
    document.getElementById("profileDeletePanel").classList.remove("is-hidden");
  });

  document.getElementById("cancelDeleteAccount").addEventListener("click", () => {
    document.getElementById("profileDeletePanel").classList.add("is-hidden");
  });

  document.getElementById("profileSettingsButton").addEventListener("click", () => {
    document.getElementById("profileSettingsMenu").classList.toggle("is-hidden");
  });

  document.addEventListener("click", (event) => {
    const settingsButton = document.getElementById("profileSettingsButton");
    const settingsMenu = document.getElementById("profileSettingsMenu");
    if (!settingsButton.contains(event.target) && !settingsMenu.contains(event.target)) {
      settingsMenu.classList.add("is-hidden");
    }
  });



  document.getElementById("openQuickAdd").addEventListener("click", () => {
    document.getElementById("quickDialog").showModal();
  });

  document.getElementById("taskFilter").addEventListener("change", (event) => {
    renderTasks(state.tasks, event.target.value);
  });

  document.getElementById("globalSearch").addEventListener("input", (event) => {
    const value = event.target.value.toLowerCase();
    document.querySelectorAll(".item-card, .subject-card").forEach((card) => {
      card.style.display = card.textContent.toLowerCase().includes(value) ? "" : "none";
    });
  });

  document.getElementById("backToSubjects").addEventListener("click", () => showView("subjects"));
  document.getElementById("backToSubjectDetail").addEventListener("click", () => openSubjectWorkspace(activeSubjectWorkspace));
  document.getElementById("backToPostSource").addEventListener("click", () => showView(activeSubjectFeature ? "subjectFeature" : "subjects"));
  document.addEventListener("click", (event) => {
    if (event.target.closest("button, a, input, textarea")) return;
    const card = event.target.closest("[data-open-post]");
    if (card) openPost(card.dataset.openPost, card.dataset.postId);
  });
  document.getElementById("classroomSummary")?.addEventListener("click", async (event) => {
    const classroom = state.classrooms?.[0];
    if (!classroom || !canManageClassrooms() || classroom.ownerEmail !== state.profile.email) return;
    if (event.target.closest("[data-copy-class-code]")) {
      try {
        await navigator.clipboard.writeText(classroom.inviteCode || classroom.id);
        alert("Class code copied.");
      } catch { alert(`Class code: ${classroom.inviteCode || classroom.id}`); }
    }
    if (event.target.closest("[data-toggle-class-joining]")) {
      classroom.joiningEnabled = classroom.joiningEnabled === false;
      saveState(state); renderAll(state); syncNow();
    }
    if (event.target.closest("[data-regenerate-class-code]")) {
      if (!confirm("Regenerate the code? The previous code will no longer work.")) return;
      classroom.inviteCode = generateClassCode();
      classroom.joiningEnabled = true;
      saveState(state); renderAll(state); syncNow();
    }
  });
  document.getElementById("postCommentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activePost) return;
    const text = formData(event.target).comment.trim();
    if (!text) return;
    activePost.item.comments ||= [];
    activePost.item.comments.push({ id: crypto.randomUUID(), text, author: state.profile.name || state.profile.email || "Member", createdAt: new Date().toISOString() });
    event.target.reset(); saveState(state); syncNow(); renderPostDetail();
  });
  document.querySelectorAll("[data-subject-feature]").forEach((button) => button.addEventListener("click", () => openSubjectFeature(button.dataset.subjectFeature)));
  document.getElementById("subjectGrid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-subject-workspace]");
    if (card) openSubjectWorkspace(card.dataset.subjectWorkspace);
  });
  document.getElementById("subjectGrid").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-subject-workspace]");
    if (!card) return;
    event.preventDefault();
    openSubjectWorkspace(card.dataset.subjectWorkspace);
  });
  document.getElementById("classroomScheduleList").addEventListener("click", (event) => {
    const item = event.target.closest("[data-subject-workspace]");
    if (item) openSubjectWorkspace(item.dataset.subjectWorkspace);
  });
  document.getElementById("classroomScheduleList").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-subject-workspace]");
    if (!item) return;
    event.preventDefault();
    openSubjectWorkspace(item.dataset.subjectWorkspace);
  });

  document.getElementById("scheduleBoard").addEventListener("click", (event) => {
    const card = event.target.closest(".subject-schedule-card");
    if (!card) return;
    openSubjectWorkspace(card.dataset.subject);
  });

  document.getElementById("copyInvite").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("inviteLink").value);
  });

  document.getElementById("toggleClassroomInvite").addEventListener("click", () => document.getElementById("classroomLinkDialog").showModal());
  document.getElementById("classroomLinkDialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("toggleClassroomMembers").addEventListener("click", () => showView("classroomMembersView"));
  document.getElementById("toggleClassroomAnnouncements").addEventListener("click", () => showView("classroomAnnouncementsView"));
  document.getElementById("toggleClassroomNotes").addEventListener("click", () => showView("classroomNotesView"));
  document.getElementById("showClassroomAnnouncementForm").addEventListener("click", () => document.getElementById("classroomAnnouncementForm").classList.toggle("is-hidden"));
  document.getElementById("showClassroomNoteForm").addEventListener("click", () => document.getElementById("classroomNoteForm").classList.toggle("is-hidden"));
  document.getElementById("toggleAttendance").addEventListener("click", () => {
    const classroom = state.classrooms?.[0];
    if (!classroom || !canManageClassrooms() || classroom.ownerEmail !== state.profile.email) return alert("Only the creator of this classroom can take attendance.");
    document.getElementById("attendancePanel").classList.toggle("is-hidden");
  });
  document.getElementById("saveAttendance").addEventListener("click", () => {
    const records = [...document.querySelectorAll("[data-attendance-member]")].map((input) => ({ id: crypto.randomUUID(), memberId: input.dataset.attendanceMember, present: input.checked, date: new Date().toISOString().slice(0, 10) }));
    state.attendance ||= { records: [] };
    state.attendance.records.push(...records);
    saveState(state); syncNow(); alert("Attendance saved.");
  });

  document.addEventListener("click", (event) => {
    const deleteAnnouncement = event.target.closest("[data-delete-announcement]");
    const deleteNote = event.target.closest("[data-delete-note]");
    const editAnnouncement = event.target.closest("[data-edit-announcement]");
    const editNote = event.target.closest("[data-edit-note]");
    const toggleTask = event.target.closest("[data-toggle-task]");
    const deleteNotification = event.target.closest("[data-delete-notification]");

    if (deleteNotification) {
      state.dismissedNotifications ||= [];
      state.dismissedNotifications.push(deleteNotification.dataset.deleteNotification);
      saveState(state); syncNow(); renderAll(state); return;
    }
    if (toggleTask) {
      const task = state.tasks.find((item) => item.id === toggleTask.dataset.toggleTask);
      if (task) task.status = task.status === "Completed" ? "Upcoming" : "Completed";
      saveState(state); syncNow(); renderAll(state); openSubjectFeature("tasks"); return;
    }

    if (deleteAnnouncement) {
      state.announcements = state.announcements.filter((item) => item.id !== deleteAnnouncement.dataset.deleteAnnouncement);
      saveState(state);
      syncNow();
      renderAll(state);
      return;
    }

    if (deleteNote) {
      state.notes = state.notes.filter((item) => item.id !== deleteNote.dataset.deleteNote);
      saveState(state);
      syncNow();
      renderAll(state);
      return;
    }

    if (editAnnouncement) {
      const item = state.announcements.find((entry) => entry.id === editAnnouncement.dataset.editAnnouncement);
      if (!item) return;
      const title = window.prompt("Edit announcement title:", item.title) ?? item.title;
      const message = window.prompt("Edit announcement message:", item.message) ?? item.message;
      Object.assign(item, { title, message });
      saveState(state);
      syncNow();
      renderAll(state);
      return;
    }

    if (editNote) {
      const item = state.notes.find((entry) => entry.id === editNote.dataset.editNote);
      if (!item) return;
      const title = window.prompt("Edit note title:", item.title) ?? item.title;
      const content = window.prompt("Edit note details:", item.content) ?? item.content;
      Object.assign(item, { title, content });
      saveState(state);
      syncNow();
      renderAll(state);
    }
  });

  document.getElementById("classroomScheduleImage").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const fileName = file?.name;
    if (!fileName) return;
    if (!navigator.onLine) {
      alert("Schedule images cannot be uploaded while offline.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image of your schedule.");
      return;
    }
    try {
      const result = await analyzeScheduleImage(file);
      showScheduleReview(fileName, result.uploaded?.url || "", result.rows || []);
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("enableNotifications").addEventListener("click", enableNotifications);
  document.getElementById("refreshAdminApprovals")?.addEventListener("click", loadAdminApprovals);
  document.getElementById("adminApprovalList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-account-status]");
    if (!button) return;
    button.disabled = true;
    try {
      await updateAccountStatus(button.dataset.userId, button.dataset.accountStatus);
      await loadAdminApprovals();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  });

  window.addEventListener("online", () => {
    setOnline(true);
    syncNow();
  });
  window.addEventListener("offline", () => setOnline(false));
}

function showView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === id));
  localStorage.setItem("remindme-active-view", id);
  const activeItem = document.querySelector(`[data-view="${id}"] .nav-label`);
  document.getElementById("viewTitle").textContent = id === "announcements"
    ? "Announcement Feed"
    : activeItem?.textContent || "RemindMe";
  document.getElementById("dashboardMenu").classList.remove("open");
  if (id === "profile") {
    document.getElementById("profile").classList.remove("profile-edit-mode");
    document.getElementById("profileEditPanel").classList.add("is-hidden");
    document.getElementById("profileDeletePanel").classList.add("is-hidden");
    document.getElementById("profileSettingsMenu").classList.add("is-hidden");
  }
  document.querySelector(".top-actions").classList.toggle("is-hidden", id === "profile" || id === "about");
  if (id === "adminApprovals") loadAdminApprovals();
}

function showApp() {
  clearAuthForms();
  document.getElementById("welcomeScreen").classList.add("is-hidden");
  document.getElementById("loginScreen").classList.add("is-hidden");
  document.getElementById("appFrame").classList.remove("is-hidden");
  showView("dashboard");
  renderProfileSummary();
  updateAdminNavigation();
}

function updateAdminNavigation() {
  document.getElementById("adminApprovalsNav").classList.toggle("is-hidden", state.profile?.role !== "admin");
}

async function loadAdminApprovals() {
  const list = document.getElementById("adminApprovalList");
  if (state.profile?.role !== "admin") return;
  list.innerHTML = "<p class='muted'>Loading registrations…</p>";
  try {
    const users = await getAdminUsers();
    const pending = users.filter((user) => user.accountStatus === "pending");
    list.innerHTML = pending.length ? pending.map((user) => `
      <article class="item-card">
        <strong>${escapeMarkup(user.name || user.email)}</strong>
        <div class="item-meta">${escapeMarkup(user.email)} · ${escapeMarkup(user.role || "user")}</div>
        <div class="item-meta">${escapeMarkup(user.studentNumber || user.facultyId || "No school ID")}</div>
        <div class="quick-actions">
          <button class="primary-btn" type="button" data-user-id="${escapeMarkup(user.id)}" data-account-status="active">Approve</button>
          <button class="danger-btn" type="button" data-user-id="${escapeMarkup(user.id)}" data-account-status="rejected">Reject</button>
        </div>
      </article>`).join("") : "<p class='muted'>There are no registrations awaiting approval.</p>";
  } catch (error) {
    list.innerHTML = `<p class="muted">${escapeMarkup(error.message)}</p>`;
  }
}

function showWelcome() {
  document.getElementById("welcomeScreen").classList.remove("is-hidden");
  document.getElementById("loginScreen").classList.add("is-hidden");
  document.getElementById("appFrame").classList.add("is-hidden");
}

function showAuth(mode) {
  document.getElementById("welcomeScreen").classList.add("is-hidden");
  document.getElementById("loginScreen").classList.remove("is-hidden");
  toggleAuthMode(mode);
}

function toggleAuthMode(mode) {
  clearAuthForms();
  document.getElementById("loginForm").classList.toggle("is-hidden", mode !== "login");
  document.getElementById("registerForm").classList.toggle("is-hidden", mode !== "register");
}

function clearAuthForms() {
  document.getElementById("loginForm")?.reset();
  document.getElementById("registerForm")?.reset();
  document.getElementById("forgotPasswordForm")?.reset();
}

function renderRememberedAccounts() {
  const rememberedAccounts = document.getElementById("rememberedAccounts");
  if (!rememberedAccounts) return;
  const accounts = loadRememberedAccounts().filter((account) => !account.deleted);
  rememberedAccounts.innerHTML = accounts.map((account) => `
    <button class="remembered-account" type="button" data-email="${account.email}">
      <strong>${account.name}</strong><span>${account.email}</span>
    </button>
  `).join("");
  document.querySelectorAll(".remembered-account").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#loginForm [name='email']").value = button.dataset.email;
      document.querySelector("#loginForm [name='password']").value = "";
      document.querySelector("#loginForm [name='password']").focus();
    });
  });
}

function renderProfileSummary() {
  const profile = state.profile || {};
  const avatar = document.getElementById("profileAvatar");
  const displayName = document.getElementById("profileDisplayName");
  const displayEmail = document.getElementById("profileDisplayEmail");
  const fullName = document.getElementById("profileFullName");
  const studentNumber = document.getElementById("profileStudentNumber");
  const age = document.getElementById("profileAge");
  const address = document.getElementById("profileAddress");
  const course = document.getElementById("profileCourse");
  const yearLevel = document.getElementById("profileYearLevel");
  const semester = document.getElementById("profileSemester");

  const name = profile.name || "Student";
  avatar.textContent = (name || "S").trim().charAt(0).toUpperCase();
  displayName.textContent = name;
  displayEmail.textContent = profile.email || "student@example.com";
  fullName.textContent = profile.name || "-";
  studentNumber.textContent = profile.studentNumber || "-";
  age.textContent = profile.age || "-";
  address.textContent = profile.address || "-";
  course.textContent = profile.course || "-";
  yearLevel.textContent = profile.yearLevel || "-";
  semester.textContent = profile.semester || "-";
}

function openSubjectWorkspace(subject) {
  activeSubjectWorkspace = subject;
  const schedule = state.schedule.filter((item) => item.subject === subject);
  const notes = state.notes.filter((item) => item.subject === subject);
  const tasks = state.tasks.filter((item) => item.subject === subject);
  const announcements = state.announcements.filter((item) => item.subject === subject);
  document.getElementById("subjectDetailTitle").textContent = subject;
  document.getElementById("subjectDetailSummary").innerHTML = schedule.length
    ? schedule.map((item) => `
      <article class="item-card">
        <strong>${escapeMarkup(item.subject)}</strong>
        <div class="item-meta">${escapeMarkup(item.day)} | ${escapeMarkup(item.startTime || item.start || "No start time")}-${escapeMarkup(item.endTime || item.end || "No end time")}</div>
        <div class="item-meta">${escapeMarkup(item.room || "Room TBA")} | ${escapeMarkup(item.instructor || "Instructor TBA")}</div>
      </article>
    `).join("")
    : "<p class='muted'>No schedule details have been added for this subject.</p>";
  showView("subjectDetail");
  document.getElementById("viewTitle").textContent = subject;
}

function openSubjectFeature(feature) {
  activeSubjectFeature = feature;
  const items = feature === "notes" ? state.notes.filter((item) => item.subject === activeSubjectWorkspace)
    : feature === "tasks" ? state.tasks.filter((item) => item.subject === activeSubjectWorkspace)
      : state.announcements.filter((item) => item.subject === activeSubjectWorkspace);
  const labels = { notes: "Notes", tasks: "Activities", announcements: "Announcements" };
  document.getElementById("subjectFeatureTitle").textContent = `${activeSubjectWorkspace} — ${labels[feature]}`;
  document.getElementById("subjectFeatureList").innerHTML = items.length ? items.map((item) => {
    const body = feature === "notes" ? `${escapeMarkup(item.content || "No content")}${item.fileName ? `<div class="item-meta"><a href="${escapeMarkup(item.fileUrl || "#")}" target="_blank" rel="noreferrer">${escapeMarkup(item.fileName)}</a></div>` : ""}`
      : feature === "tasks" ? `${escapeMarkup(item.description || "No description")}<div class="item-meta">${escapeMarkup(item.status || "Upcoming")} | Due ${escapeMarkup(item.dueDate || "No date")}</div>`
        : `${escapeMarkup(item.message || "No message")}<div class="item-meta">${escapeMarkup(item.date || "No date")}</div>`;
    const actions = feature === "tasks" ? `<button class="text-btn" data-toggle-task="${item.id}" type="button">Mark ${item.status === "Completed" ? "Upcoming" : "Completed"}</button>`
      : feature === "announcements" ? `<button class="text-btn" data-edit-announcement="${item.id}" type="button">Edit</button><button class="text-btn" data-delete-announcement="${item.id}" type="button">Delete</button>` : "";
    return `<article class="item-card"><strong>${escapeMarkup(item.title)}</strong><div>${body}</div><div class="quick-actions">${actions}</div></article>`;
  }).join("") : `<p class="muted">No ${labels[feature].toLowerCase()} for this subject yet.</p>`;
  ["subjectNoteForm", "subjectTaskForm", "subjectAnnouncementForm"].forEach((id) => document.getElementById(id).classList.toggle("is-hidden", id !== `subject${feature === "tasks" ? "Task" : feature === "notes" ? "Note" : "Announcement"}Form`));
  showView("subjectFeature");
}

function renderSubjectItems(id, items, template, emptyText) {
  document.getElementById(id).innerHTML = items.length
    ? items.map((item) => `<article class="item-card">${template(item)}</article>`).join("")
    : `<p class="muted">${emptyText}</p>`;
}

function escapeMarkup(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateEmptyDashboard() {
  const isEmpty = !state.schedule.length && !state.tasks.length && !state.notes.length;
  const classroom = state.classrooms?.[0];
  const classroomBanner = document.getElementById("homeClassroomBanner");
  const noClassroomPrompt = document.getElementById("homeNoClassroomPrompt");
  if (classroomBanner) classroomBanner.classList.toggle("is-hidden", !classroom);
  if (noClassroomPrompt) noClassroomPrompt.classList.toggle("is-hidden", Boolean(classroom));
  if (classroom) {
    document.getElementById("homeClassroomName").textContent = classroom.name;
    document.getElementById("homeClassroomMeta").textContent = `${classroom.section || "Class section"} | ${state.members?.length || 0} member(s)`;
  }
  document.getElementById("emptyDashboard").classList.toggle("is-hidden", !isEmpty);
  document.querySelector("#dashboard .dashboard-grid").classList.toggle("is-hidden", isEmpty);
}

function hasClassroom() {
  return Array.isArray(state.classrooms) && state.classrooms.length > 0;
}

function canManageClassrooms() {
  return state.profile?.role === "faculty" || (state.profile?.role === "student" && state.profile?.isClassPresident === true);
}

function ensureMockContent() {
  const classroom = state.classrooms?.[0];
  if (!classroom) return false;

  let changed = false;
  const today = new Date();
  const dateAfter = (days) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const subjects = [...new Map(state.schedule
    .filter((item) => item.subject?.trim())
    .map((item) => [item.subject.trim().toLocaleLowerCase(), item.subject.trim()])).values()];

  subjects.forEach((subject) => {
    const content = subjectMockContent(subject);
    const hasMock = (collection, title) => state[collection].some((item) => item.mockContent && item.subject === subject && item.title === title);

    content.notes.forEach((entry) => {
      if (hasMock("notes", entry.title)) return;
      state.notes.push({ id: crypto.randomUUID(), ...entry, subject, shared: true, classroomId: classroom.id, mockContent: true });
      changed = true;
    });
    content.activities.forEach((entry, index) => {
      if (hasMock("tasks", entry.title)) return;
      state.tasks.push({ id: crypto.randomUUID(), ...entry, subject, type: "Activity", status: "Upcoming", dueDate: dateAfter(index + 2), difficulty: "Medium", workload: "2", mockContent: true });
      changed = true;
    });
    content.announcements.forEach((entry, index) => {
      if (hasMock("announcements", entry.title)) return;
      state.announcements.push({ id: crypto.randomUUID(), ...entry, subject, audience: "Subject", date: dateAfter(index), shared: true, classroomId: classroom.id, mockContent: true });
      changed = true;
    });
  });

  const addClassroomEntries = (collection, entries) => entries.forEach((entry, index) => {
    if (state[collection].some((item) => item.mockContent && item.classroomId === classroom.id && item.title === entry.title)) return;
    const sharedFields = { id: crypto.randomUUID(), ...entry, classroomId: classroom.id, shared: true, mockContent: true };
    state[collection].push(collection === "notes"
      ? { ...sharedFields, subject: "Classroom" }
      : { ...sharedFields, audience: "Class", date: dateAfter(index) });
    changed = true;
  });

  addClassroomEntries("announcements", [
    { title: "Welcome to the classroom", message: "Please check the class schedule and keep notifications enabled for updates." },
    { title: "Weekly learning plan", message: "Review this week's lessons and prepare your questions before each class meeting." },
    { title: "Classroom reminder", message: "Bring your notes and submit activities by their listed due dates." }
  ]);
  addClassroomEntries("notes", [
    { title: "Classroom guidelines", content: "Be on time, participate respectfully, and check the app before every meeting." },
    { title: "Study routine", content: "Review each lecture within 24 hours and keep a short list of questions for the next class." },
    { title: "Submission checklist", content: "Confirm the activity title, required format, and deadline before submitting your work." }
  ]);

  if (changed) saveState(state);
  return changed;
}

function subjectMockContent(subject) {
  const key = subject.toLocaleLowerCase();
  const topics = key.includes("mobile")
    ? ["mobile app architecture", "responsive interface design", "API integration"]
    : key.includes("algorithm")
      ? ["asymptotic analysis", "sorting strategies", "graph traversal"]
      : key.includes("research")
        ? ["research questions", "literature review", "data collection"]
        : key.includes("graphic")
          ? ["2D transformations", "color and lighting", "rendering pipeline"]
          : key.includes("automata")
            ? ["finite automata", "regular expressions", "context-free grammars"]
            : key.includes("statistic")
              ? ["descriptive statistics", "probability distributions", "hypothesis testing"]
              : ["core concepts", "guided practice", "lesson review"];
  return {
    notes: topics.map((topic, index) => ({
      title: `${subject}: ${topic}`,
      content: `Review the lecture examples for ${topic} and summarize the key ideas in your own words.`,
      order: index
    })),
    activities: topics.map((topic) => ({
      title: `${subject} ${topic} activity`,
      description: `Complete the practice exercise on ${topic} and prepare one question for discussion.`
    })),
    announcements: topics.map((topic) => ({
      title: `${subject}: ${topic} update`,
      message: `This week we will focus on ${topic}. Review the related note before class.`
    }))
  };
}

function createClassroom(data) {
  if (!canManageClassrooms()) {
    alert("Only Faculty accounts or appointed Class Presidents can create classrooms.");
    return;
  }
  const name = String(data.name || "").trim();
  if (!name) return;
  const classroom = {
    id: crypto.randomUUID(),
    name,
    section: String(data.section || "").trim(),
    subject: String(data.subject || "").trim(),
    room: String(data.room || "").trim(),
    schoolYear: String(data.schoolYear || "").trim(),
    semester: String(data.semester || "").trim(),
    description: String(data.description || "").trim(),
    ownerEmail: state.profile.email,
    inviteCode: generateClassCode(),
    joiningEnabled: true,
    archived: false
  };
  state.classrooms = [classroom];
  state.members = [{ id: crypto.randomUUID(), name: state.profile.name || "Class Creator", email: state.profile.email || "student@example.com", role: "Creator" }];
  ensureMockContent();
  saveState(state);
  renderAll(state);
  updateEmptyDashboard();
  syncNow();
}

function generateClassCode() {
  return Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function calculateAge(birthdate) {
  const date = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const birthdayHasPassed = today.getMonth() > date.getMonth()
    || (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? String(age) : "";
}

function openPost(type, id) {
  const collection = type === "note" ? state.notes : type === "announcement" ? state.announcements : state.tasks;
  const item = collection.find((entry) => entry.id === id);
  if (!item) return;
  activePost = { type, item };
  renderPostDetail();
  showView("postDetail");
}

function renderPostDetail() {
  const { type, item } = activePost;
  const body = type === "note" ? item.content : type === "announcement" ? item.message : item.description;
  document.getElementById("postDetailType").textContent = type === "task" ? "Activity" : `${type[0].toUpperCase()}${type.slice(1)}`;
  document.getElementById("postDetailTitle").textContent = item.title;
  document.getElementById("postDetailContent").innerHTML = `<p>${body || "No description"}</p><div class="item-meta">${item.subject || item.audience || "Class"} | ${item.date || item.dueDate || "Recently posted"}</div>`;
  const comments = item.comments || [];
  document.getElementById("postCommentList").innerHTML = comments.length ? comments.map((comment) => `<article class="item-card"><strong>${comment.author}</strong><p>${comment.text}</p><div class="item-meta">${new Date(comment.createdAt).toLocaleString()}</div></article>`).join("") : "<p class='muted'>No comments yet. Start the discussion.</p>";
}

async function restoreVerifiedSession() {
  if (sessionStorage.getItem("remindme-session") !== "active") return;
  try {
    const result = await verifySession();
    state.profile = { ...state.profile, ...result.user };
    showApp();
    await attemptInitialSync();
  } catch {
    showApp();
    setOnline(false);
  }
}

async function attemptInitialSync() {
  try {
    const identity = Object.fromEntries(
      ["name", "email", "studentNumber"]
        .map((key) => [key, state.profile?.[key]])
        .filter(([, value]) => value)
    );
    const remoteState = await fetchRemoteState();
    // Legacy browser users may already have data saved in localStorage from
    // before their server workspace was created. Do not replace that data with
    // a newly-created, empty remote workspace; upload it as the initial shared
    // snapshot so Expo can read the same classes and schedule.
    const uploadLocalWorkspace = workspaceHasContent(state) && !workspaceHasContent(remoteState);
    state = uploadLocalWorkspace
      ? { ...state, profile: { ...(state.profile || {}), ...identity } }
      : { ...remoteState, profile: { ...(remoteState.profile || {}), ...identity } };
    updateAdminNavigation();
    const addedMockContent = ensureMockContent();
    saveState(state);
    if (uploadLocalWorkspace || addedMockContent) await syncRemoteState(state);
    setOnline(true);
    renderAll(state);
    updateEmptyDashboard();
  } catch {
    setOnline(false);
  }
}

function workspaceHasContent(workspace = {}) {
  return ["subjects", "schedule", "tasks", "notes", "announcements", "classrooms", "files"]
    .some((key) => Array.isArray(workspace[key]) && workspace[key].length > 0)
    || Boolean(workspace.classroom);
}

async function syncNow() {
  try {
    await syncRemoteState(state);
    setOnline(true);
  } catch {
    setOnline(false);
  }
}

function setOnline(isOnline) {
  syncStatus.textContent = isOnline ? "Online" : "Offline";
  syncStatus.className = `status-pill ${isOnline ? "online" : "offline"}`;
}

function isAllowedUpload(file) {
  const lowerName = file.name.toLowerCase();
  return allowedUploadExtensions.some((extension) => lowerName.endsWith(extension)) || file.type.startsWith("image/");
}

function showScheduleReview(fileName, fileUrl, rows) {
  const detected = rows.map((row, index) => ({
    index,
    subject: row.subject || "",
    instructor: row.instructor || "",
    room: row.room || "",
    day: row.day || "Monday",
    startTime: row.startTime || row.start || "",
    endTime: row.endTime || row.end || ""
  }));
  const review = document.getElementById("classroomScheduleReview");
  review.classList.remove("is-hidden");
  review.innerHTML = `
    <article class="item-card">
      <strong>Review detected schedule</strong>
      <p class="muted">${detected.length ? `Extracted ${detected.length} class${detected.length === 1 ? "" : "es"}. Review the details before confirming.` : "No schedule rows were recognized. Try a clearer, straight-on image."}</p>
      ${detected.map((row) => `
        <div class="schedule-detected-row" data-detected-row="${row.index}">
          <div class="form-grid">
            <label>Subject <input data-detected-field="subject" value="${escapeFormValue(row.subject)}" /></label>
            <label>Instructor <input data-detected-field="instructor" value="${escapeFormValue(row.instructor)}" /></label>
            <label>Room <input data-detected-field="room" value="${escapeFormValue(row.room)}" /></label>
            <label>Day <input data-detected-field="day" value="${escapeFormValue(row.day)}" /></label>
            <label>Start Time <input data-detected-field="startTime" type="time" value="${escapeFormValue(row.startTime)}" /></label>
            <label>End Time <input data-detected-field="endTime" type="time" value="${escapeFormValue(row.endTime)}" /></label>
          </div>
        </div>
      `).join("")}
      ${detected.length ? '<label class="checkbox-row"><input id="shareDetectedSchedule" type="checkbox" checked /> Share this schedule with the classroom</label>' : ""}
      <div class="quick-actions">
        ${fileUrl ? `<a class="secondary-btn" href="${escapeFormValue(fileUrl)}" target="_blank" rel="noreferrer">Open upload</a>` : ""}
        ${detected.length ? '<button id="confirmDetectedSchedule" class="primary-btn" type="button">Confirm Schedule</button>' : ""}
      </div>
    </article>
  `;
  if (!detected.length) return;
  document.getElementById("confirmDetectedSchedule").addEventListener("click", () => {
    const generatedSubjects = new Set();
    document.querySelectorAll("[data-detected-row]").forEach((row) => {
      const value = (field) => row.querySelector(`[data-detected-field="${field}"]`).value;
      const subject = value("subject");
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      addRecord(state, "schedule", {
        subject,
        instructor: value("instructor"),
        room: value("room"),
        day: value("day"),
        startTime: value("startTime"),
        endTime: value("endTime"),
        semester: state.profile.semester || "1st Semester",
        schoolYear: "2026-2027",
        notes: `Source image: ${fileName}`,
        shareWithClassroom: document.getElementById("shareDetectedSchedule").checked,
        classroomId: state.classrooms[0]?.id || "local"
      });
      if (generatedSubjects.has(subject)) return;
      generatedSubjects.add(subject);
      addRecord(state, "notes", {
        title: `${subject} study notes`,
        subject,
        content: `Review the key concepts and lecture materials for ${subject}.`,
        shared: true,
        classroomId: state.classrooms[0]?.id || "local"
      });
      addRecord(state, "tasks", {
        title: `${subject} starter activity`,
        subject,
        type: "Activity",
        dueDate,
        difficulty: "Medium",
        workload: "2",
        status: "Upcoming",
        description: `Prepare a short review activity for ${subject}.`
      });
      addRecord(state, "announcements", {
        title: `${subject} class update`,
        subject,
        audience: "Subject",
        date: new Date().toISOString().slice(0, 10),
        message: `Your ${subject} schedule has been added. Check this subject workspace for notes and activities.`,
        shared: true
      });
    });
    review.classList.add("is-hidden");
    ensureMockContent();
    renderAll(state);
    updateEmptyDashboard();
    syncNow();
  });
}

function escapeFormValue(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("Browser notifications are not supported here.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  state.tasks.slice(0, 3).forEach((task) => {
    new Notification(`Reminder: ${task.title}`, {
      body: `${task.subject || "Academic task"} is due ${task.dueDate || "soon"}.`
    });
  });
}
