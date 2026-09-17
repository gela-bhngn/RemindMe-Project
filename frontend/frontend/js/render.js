import { generatePriorities, getTaskStatus, suggestedStudyBlock } from "./priority.js";

export function renderAll(state) {
  renderDashboard(state);
  renderSchedule(state.schedule);
  renderSubjects(state);
  renderTasks(state.tasks);
  renderNotes(state.notes);
  renderAnnouncements(state.announcements);
  renderNotifications(state);
  renderCalendar(state.tasks, state.announcements);
  renderCollaboration(state);
  renderProfile(state.profile);
}

export function renderDashboard(state) {
  const today = new Date();
  const todayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const todaySchedule = state.schedule.filter((item) => item.day === todayName);
  setList("todaySchedule", todaySchedule, (item) => `
    <article class="item-card">
      <strong>${item.subject}</strong>
      <div class="item-meta">${item.startTime}-${item.endTime} | ${item.room} | ${item.instructor}</div>
    </article>
  `, "No classes scheduled today.");

  setList("deadlineList", state.tasks.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4), taskTemplate, "No deadlines yet.");
  setList("announcementList", state.announcements.slice(0, 3), announcementTemplate, "No announcements yet.");

  setList("priorityList", generatePriorities(state.tasks), (task) => `
    <article class="item-card">
      <strong>${task.title}</strong>
      <div class="item-meta">${task.subject} | Due in ${task.daysLeft} day(s) | ${suggestedStudyBlock(task)}</div>
    </article>
  `, "No priority tasks right now.");
}

export function renderSchedule(schedule) {
  const grouped = groupBy(schedule, "day");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  document.getElementById("scheduleBoard").innerHTML = days.map((day) => `
    <div class="schedule-row">
      <strong>${day}</strong>
      <div class="stack-list">
        ${(grouped[day] || []).map((item) => `
          <article class="item-card subject-schedule-card" data-subject="${escapeAttribute(item.subject)}">
            <strong>${item.subject}</strong>
            <div class="item-meta">${item.startTime}-${item.endTime} | ${item.room} | ${item.instructor}</div>
            <div class="item-meta">${item.semester} | ${item.schoolYear}</div>
            ${item.notes ? `<p>${item.notes}</p>` : ""}
          </article>
        `).join("") || "<span class='muted'>No class</span>"}
      </div>
    </div>
  `).join("");
}

export function renderSubjects(state) {
  const subjects = [...new Set([...state.schedule.map((item) => item.subject), ...state.tasks.map((item) => item.subject), ...state.notes.map((item) => item.subject)])];
  setList("subjectGrid", subjects, (subject) => {
    const taskCount = state.tasks.filter((task) => task.subject === subject).length;
    const noteCount = state.notes.filter((note) => note.subject === subject).length;
    const classCount = state.schedule.filter((item) => item.subject === subject).length;
    return `
      <article class="subject-card" data-subject-workspace="${escapeAttribute(subject)}" tabindex="0" role="button">
        <strong>${subject}</strong>
        <div class="subject-stats">
          <span>${taskCount}<br>Tasks</span>
          <span>${noteCount}<br>Notes</span>
          <span>${classCount}<br>Classes</span>
        </div>
      </article>
    `;
  }, "No subject workspaces yet.");
}

export function renderTasks(tasks, filter = "all") {
  const filtered = tasks.filter((task) => filter === "all" || getTaskStatus(task) === filter);
  setList("taskList", filtered, taskTemplate, "No tasks match this filter.");
}

export function renderNotes(notes) {
  const visibleNotes = notes.filter((note) => note.shared !== false);
  setList("noteList", visibleNotes, (note) => `
    <article class="item-card" data-open-post="note" data-post-id="${note.id}">
      <strong>${note.title}</strong>
      <p>${note.content || ""}</p>
      <div class="item-meta">${note.subject}${note.fileName ? ` | <a href="${note.fileUrl || "#"}" target="_blank" rel="noreferrer">${note.fileName}</a>` : ""}${note.link ? ` | <a href="${note.link}" target="_blank" rel="noreferrer">Material link</a>` : ""}</div>
      <div class="quick-actions">
        <button class="text-btn" type="button" data-open-post="note" data-post-id="${note.id}">Comments</button>
        <button class="text-btn" type="button" data-edit-note="${note.id}">Edit</button>
        <button class="text-btn" type="button" data-delete-note="${note.id}">Delete</button>
      </div>
    </article>
  `, "No notes or materials yet.");
}

export function renderAnnouncements(announcements) {
  const visibleAnnouncements = announcements.filter((item) => item.shared !== false);
  setList("fullAnnouncementList", visibleAnnouncements, (item) => `
    <article class="item-card" data-open-post="announcement" data-post-id="${item.id}">
      <strong>${item.title}</strong>
      <p>${item.message}</p>
      <div class="item-meta">${item.audience || "Class"} | ${item.date}</div>
      <div class="quick-actions">
        <button class="text-btn" type="button" data-open-post="announcement" data-post-id="${item.id}">Comments</button>
        <button class="text-btn" type="button" data-edit-announcement="${item.id}">Edit</button>
        <button class="text-btn" type="button" data-delete-announcement="${item.id}">Delete</button>
      </div>
    </article>
  `, "No announcements yet.");
}

export function renderNotifications(state) {
  const notifications = [
    ...state.tasks.slice(0, 5).map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      detail: `${task.subject} deadline reminder`,
      when: task.dueDate || "No due date",
      kind: "Deadline"
    })),
    ...state.announcements.slice(0, 5).map((item) => ({
      id: `announcement-${item.id}`,
      title: item.title,
      detail: item.message,
      when: item.date,
      kind: "Announcement"
    }))
  ];

  const visibleNotifications = notifications.filter((item) => !(state.dismissedNotifications || []).includes(item.id));
  setList("notificationFeed", visibleNotifications, (item) => `
    <article class="notification-item">
      <span class="notification-dot"></span>
      <div>
        <strong>${item.title}</strong>
        <p>${item.detail || ""}</p>
        <div class="item-meta">${item.kind} | ${item.when}</div>
        <button class="text-btn" type="button" data-delete-notification="${item.id}">Delete</button>
      </div>
    </article>
  `, "No notifications yet.");
}

export function renderCalendar(tasks, announcements) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) cells.push("");
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  document.getElementById("calendarGrid").innerHTML = cells.map((day) => {
    if (!day) return "<div></div>";
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTasks = tasks.filter((task) => task.dueDate === dateKey);
    const dayAnnouncements = announcements.filter((item) => item.date === dateKey);
    const isToday = day === now.getDate();
    return `
      <div class="calendar-cell ${isToday ? "today" : ""}">
        <strong>${day}</strong>
        ${dayTasks.map((task) => `<span class="calendar-event ${getTaskStatus(task)}">${task.title}</span>`).join("")}
        ${dayAnnouncements.map((item) => `<span class="calendar-event">${item.title}</span>`).join("")}
      </div>
    `;
  }).join("");
}

export function renderCollaboration(state) {
  const classroom = state.classrooms?.[0];
  // A Class President receives management tools only for a classroom they
  // created; membership alone must never unlock those controls.
  const isClassManager = state.profile?.role === "faculty" || (state.profile?.role === "student" && state.profile?.isClassPresident === true);
  const isFacultyCreator = isClassManager && classroom?.ownerEmail === state.profile?.email;
  const members = [...(state.members || [])];
  const currentUser = {
    id: state.profile?.id || state.profile?.email || "current-user",
    name: state.profile?.name || "Student",
    email: state.profile?.email || "student@example.com",
    role: classroom?.ownerEmail === state.profile?.email ? "Creator" : "Member"
  };
  if (classroom) {
    const currentMemberIndex = members.findIndex((member) => member.email === currentUser.email
      || (member.role === "Creator" && classroom.ownerEmail === currentUser.email));
    if (currentMemberIndex >= 0) members[currentMemberIndex] = { ...members[currentMemberIndex], ...currentUser };
    else members.push(currentUser);
    state.members = members;
  }
  const emptyState = document.getElementById("classroomEmptyState");
  const joinedState = document.getElementById("classroomJoinedState");
  const membersPanel = document.getElementById("classroomMembersPanel");
  const invite = `${location.origin}${location.pathname}?join=remindme-class-2026`;

  if (emptyState) emptyState.classList.toggle("is-hidden", Boolean(classroom));
  if (joinedState) joinedState.classList.toggle("is-hidden", !classroom);
  if (membersPanel) membersPanel.classList.toggle("is-hidden", !classroom);
  const scheduleSetup = document.getElementById("classroomScheduleSetup");
  if (scheduleSetup) scheduleSetup.classList.toggle("is-hidden", !classroom || state.schedule.length > 0);
  const addAnotherSchedule = document.getElementById("addAnotherSchedule");
  if (addAnotherSchedule) addAnotherSchedule.classList.toggle("is-hidden", !classroom || state.schedule.length === 0);

  const createForm = document.getElementById("classroomForm");
  const joinForm = document.getElementById("joinClassroomForm");
  const createButton = document.getElementById("showCreateClassroomForm");
  if (createButton) createButton.classList.toggle("is-hidden", !isClassManager);
  ["toggleAttendance", "showClassroomAnnouncementForm", "showClassroomNoteForm"].forEach((id) => {
    document.getElementById(id)?.classList.toggle("is-hidden", !isFacultyCreator);
  });
  if (!classroom) {
    createForm?.classList.add("is-hidden");
    joinForm?.classList.add("is-hidden");
  }

  const inviteLink = classroom ? `${invite}&code=${encodeURIComponent(classroom.inviteCode || classroom.id)}` : invite;
  const inviteField = document.getElementById("inviteLink");
  if (inviteField) inviteField.value = inviteLink;

  const classroomSummary = document.getElementById("classroomSummary");
  if (classroomSummary) {
    classroomSummary.innerHTML = classroom ? `
      <article class="item-card">
        <strong>${classroom.name}</strong>
        <div class="item-meta">${classroom.subject || "Subject TBA"} · ${classroom.section || "Class section"} · ${classroom.room || "Room TBA"}</div>
        <div class="item-meta">${classroom.schoolYear || "School year TBA"} · ${classroom.semester || "Semester TBA"} · ${members.length} member(s)</div>
        <p class="muted">${classroom.description || "No description"}</p>
        <div class="enrollment-card">
          <span>Class code</span><strong>${classroom.inviteCode || classroom.id}</strong>
          <small>${classroom.joiningEnabled === false ? "Joining is paused" : "Students can join with this code"}</small>
          ${isFacultyCreator ? `<div class="quick-actions"><button type="button" class="text-btn" data-copy-class-code>Copy code</button><button type="button" class="text-btn" data-toggle-class-joining>${classroom.joiningEnabled === false ? "Enable joining" : "Pause joining"}</button><button type="button" class="text-btn" data-regenerate-class-code>Regenerate code</button></div>` : ""}
        </div>
      </article>` : "<p class='muted'>No classroom yet. Create or join one to begin.</p>";
  }

  const classroomScheduleList = document.getElementById("classroomScheduleList");
  if (classroomScheduleList) {
    const schedulesBySubject = state.schedule.reduce((subjects, item) => {
      const subject = item.subject?.trim() || "Untitled subject";
      const key = subject.toLocaleLowerCase();
      if (!subjects.has(key)) subjects.set(key, { subject, meetings: [] });
      subjects.get(key).meetings.push(item);
      return subjects;
    }, new Map());
    classroomScheduleList.innerHTML = schedulesBySubject.size
      ? Array.from(schedulesBySubject.values()).map(({ subject, meetings }) => `
        <article class="item-card classroom-schedule-item" data-subject-workspace="${escapeAttribute(subject)}" tabindex="0" role="button">
          <strong>${subject}</strong>
          ${meetings.map((item) => `
            <div class="item-meta">${item.day} | ${item.startTime || item.start || "No start time"}-${item.endTime || item.end || "No end time"} | ${item.room || "Room TBA"} | ${item.instructor || "Instructor TBA"}</div>
          `).join("")}
        </article>
      `).join("")
      : "<p class='muted'>No schedule added yet. Use Add Another Schedule to add one.</p>";
  }

  const classroomAnnouncements = state.announcements.filter((item) => item.audience === "Class" || item.classroomId === classroom?.id);
  const classroomNotes = state.notes.filter((item) => item.subject === "Classroom" || item.classroomId === classroom?.id);
  const announcementList = document.getElementById("classroomAnnouncementList");
  const noteList = document.getElementById("classroomNoteList");
  if (announcementList) announcementList.innerHTML = classroomAnnouncements.length
    ? classroomAnnouncements.map((item) => `<article class="item-card"><strong>${item.title}</strong><p>${item.message || ""}</p><div class="item-meta">${item.date || "No date"}</div>${isFacultyCreator ? `<div class="quick-actions"><button class="text-btn" type="button" data-edit-announcement="${item.id}">Edit</button><button class="text-btn" type="button" data-delete-announcement="${item.id}">Delete</button></div>` : ""}</article>`).join("")
    : "<p class='muted'>No class announcements yet.</p>";
  if (noteList) noteList.innerHTML = classroomNotes.length
    ? classroomNotes.map((item) => `<article class="item-card" data-open-post="note" data-post-id="${item.id}"><strong>${item.title}</strong><p>${item.content || ""}</p><div class="quick-actions"><button class="text-btn" type="button" data-open-post="note" data-post-id="${item.id}">Comments</button></div></article>`).join("")
    : "<p class='muted'>No class notes yet.</p>";

  const qrBox = document.getElementById("qrBox");
  if (qrBox) {
    qrBox.innerHTML = classroom ? Array.from({ length: 81 }, (_, index) => {
      const filled = index % 2 === 0 || [0, 1, 2, 9, 18, 60, 69, 78, 8, 17, 26].includes(index);
      return `<span class="qr-pixel ${filled ? "" : "blank"}"></span>`;
    }).join("") : "<p class='muted'>A QR code appears after you create a classroom.</p>";
  }

  setList("memberList", members, (member) => `
    <article class="item-card">
      <strong>${member.name}</strong>
      <div class="item-meta">${member.email || "No school email"} | ${member.role}</div>
    </article>
  `, "No members yet.");
  const attendanceList = document.getElementById("attendanceList");
  if (attendanceList) attendanceList.innerHTML = members.length ? members.map((member) => `
    <label class="item-card checkbox-row"><input type="checkbox" data-attendance-member="${member.id}" checked /> <span><strong>${member.name}</strong><br><span class="muted">Present</span></span></label>
  `).join("") : "<p class='muted'>No members available for attendance.</p>";
}

export function renderProfile(profile) {
  const form = document.getElementById("profileForm");
  Object.entries(profile).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.elements.age.value = profile.birthdate ? calculateAge(profile.birthdate) : "";
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

function setList(id, items, template, emptyText) {
  document.getElementById(id).innerHTML = items.length ? items.map(template).join("") : `<p class="muted">${emptyText}</p>`;
}

function taskTemplate(task) {
  const status = getTaskStatus(task);
  return `
    <article class="item-card" data-open-post="task" data-post-id="${task.id}">
      <strong>${task.title}</strong>
      <p>${task.description || ""}</p>
      <div class="item-meta">
        <span>${task.subject}</span>
        <span>${task.type}</span>
        <span>Due ${task.dueDate}</span>
        <span class="badge ${status}">${status}</span>
      </div>
      <div class="quick-actions"><button class="text-btn" type="button" data-open-post="task" data-post-id="${task.id}">Comments</button></div>
    </article>
  `;
}

function announcementTemplate(item) {
  return `
    <article class="item-card" data-open-post="announcement" data-post-id="${item.id}">
      <strong>${item.title}</strong>
      <p>${item.message}</p>
      <div class="item-meta">${item.audience} | ${item.date}</div>
    </article>
  `;
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    groups[item[key]] ||= [];
    groups[item[key]].push(item);
    return groups;
  }, {});
}

function escapeAttribute(value = "") {
  return String(value).replace(/"/g, "&quot;");
}
