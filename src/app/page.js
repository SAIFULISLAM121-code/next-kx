"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const storageKey = "student-attendance-data";
const storageEvent = "student-attendance-data-change";
const initialStudents = [
  { id: "ST-001", name: "Aman", className: "Grade 10 · A", email: "aman@example.com", attendance: 71 },
  { id: "ST-002", name: "Saif", className: "Grade 10 · A", email: "saif@example.com", attendance: 89 },
  { id: "ST-003", name: "Priya", className: "Grade 10 · A", email: "priya@example.com", attendance: 99 },
];

function subscribeToStorage(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEvent, callback);
  };
}

function getStorageSnapshot() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch (error) {
    return `__storage_error__:${error.message}`;
  }
}

const iconPaths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function attendanceTone(value) {
  if (value < 75) return "low";
  if (value >= 95) return "high";
  return "steady";
}

function downloadCsv(students, rollCall) {
  const rows = [
    ["Student ID", "Name", "Class", "Email", "Attendance", "Today's status"],
    ...students.map((student) => [
      student.id,
      student.name,
      student.className,
      student.email,
      `${student.attendance}%`,
      rollCall[student.id] || "Unmarked",
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-attendance.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const savedSnapshot = useSyncExternalStore(subscribeToStorage, getStorageSnapshot, () => null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [operationError, setOperationError] = useState("");
  const { students, rollCall, snapshotError } = useMemo(() => {
    if (!savedSnapshot) return { students: initialStudents, rollCall: {}, snapshotError: "" };
    if (savedSnapshot.startsWith("__storage_error__:")) {
      return {
        students: initialStudents,
        rollCall: {},
        snapshotError: `Browser storage is unavailable: ${savedSnapshot.slice("__storage_error__:".length)}`,
      };
    }
    try {
      const parsed = JSON.parse(savedSnapshot);
      const validStudents =
        parsed &&
        Array.isArray(parsed.students) &&
        parsed.students.every(
          (student) =>
            student &&
            typeof student.id === "string" &&
            typeof student.name === "string" &&
            typeof student.className === "string" &&
            typeof student.email === "string" &&
            Number.isFinite(student.attendance) &&
            student.attendance >= 0 &&
            student.attendance <= 100,
        );
      const validRollCall =
        parsed?.rollCall &&
        typeof parsed.rollCall === "object" &&
        !Array.isArray(parsed.rollCall) &&
        Object.values(parsed.rollCall).every((status) => status === "Present" || status === "Absent");
      if (!validStudents || !validRollCall) {
        throw new Error("Saved data has an unexpected format.");
      }
      return { students: parsed.students, rollCall: parsed.rollCall, snapshotError: "" };
    } catch (error) {
      return {
        students: initialStudents,
        rollCall: {},
        snapshotError: `Saved data could not be loaded: ${error.message}`,
      };
    }
  }, [savedSnapshot]);
  const storageError = snapshotError || operationError;

  function saveData(nextStudents, nextRollCall) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ students: nextStudents, rollCall: nextRollCall }));
      window.dispatchEvent(new Event(storageEvent));
      setOperationError("");
      return true;
    } catch (error) {
      setOperationError(`Changes could not be saved in this browser: ${error.message}`);
      return false;
    }
  }

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = `${student.name} ${student.id} ${student.className} ${student.email}`
        .toLowerCase()
        .includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && student.attendance < 75) ||
        (filter === "high" && student.attendance >= 95);
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, students]);

  const averageAttendance = students.length
    ? Math.round(students.reduce((sum, student) => sum + student.attendance, 0) / students.length)
    : 0;
  const markedCount = Object.values(rollCall).filter((status) => status === "Present" || status === "Absent").length;
  const presentCount = Object.values(rollCall).filter((status) => status === "Present").length;

  function markAttendance(studentId) {
    const current = rollCall[studentId];
    const next = current === undefined ? "Present" : current === "Present" ? "Absent" : undefined;
    const updated = { ...rollCall };
    if (next) updated[studentId] = next;
    else delete updated[studentId];
    saveData(students, updated);
  }

  function addStudent(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const className = String(formData.get("className") || "").trim();
    const email = String(formData.get("email") || "").trim();
    if (!name || !className) return;

    const id = `ST-${Date.now().toString(36).toUpperCase()}-${students.length + 1}`;
    if (!saveData([...students, { id, name, className, email, attendance: 0 }], rollCall)) return;
    setNotice(`${name} was added to the student list.`);
    setShowForm(false);
    event.currentTarget.reset();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Classroom home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">classroom<span>.</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Icon name="grid" /> Overview</a>
          <a className="nav-item" href="#students"><Icon name="users" /> Students</a>
          <a className="nav-item" href="#attendance"><Icon name="calendar" /> Attendance</a>
          <a className="nav-item" href="#insights"><Icon name="chart" /> Insights</a>
        </nav>

        <div className="sidebar-bottom">
          <div className="class-card">
            <div className="class-card-top"><span className="class-dot" /> ACTIVE CLASS</div>
            <strong>Grade 10 · Section A</strong>
            <span>Student attendance workspace</span>
          </div>
          <div className="profile">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jordan Davis</strong><span>Administrator</span></div>
            <span className="profile-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="live-dot" /> <span className="sync-label">{storageError ? "Storage unavailable" : "Changes saved locally"}</span>
            <div className="top-avatar" aria-label="Jordan Davis">JD</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLASS OVERVIEW <span className="heading-dash">·</span> GRADE 10 — SECTION A</div>
              <h1>Good morning, Jordan <span className="wave">✳</span></h1>
              <p>Here&apos;s what&apos;s happening with your students today.</p>
            </div>
            <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>
              <Icon name="plus" size={17} /> Add student
            </button>
          </div>

          {(notice || storageError) && (
            <div className={`notice ${storageError ? "notice-error" : ""}`} role="status">
              <span>{storageError || notice}</span>
              <button type="button" aria-label="Dismiss message" onClick={() => { setNotice(""); setOperationError(""); }}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          <section className="stats-grid" id="insights" aria-label="Class summary">
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon indigo"><Icon name="users" size={18} /></span><span className="stat-caption">THIS CLASS</span></div>
              <div className="stat-value">{students.length}<span className="stat-unit"> students</span></div>
              <div className="stat-foot"><span className="stat-neutral">Grade 10 · Section A</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon green"><Icon name="check" size={18} /></span><span className="stat-caption">PRESENT TODAY</span></div>
              <div className="stat-value">{presentCount}<span className="stat-unit"> / {students.length}</span></div>
              <div className="stat-foot"><span className="stat-positive">{markedCount} marked</span><span className="stat-note"> in today&apos;s roll call</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon amber"><Icon name="chart" size={18} /></span><span className="stat-caption">AVG. ATTENDANCE</span></div>
              <div className="stat-value">{averageAttendance}<span className="stat-unit">%</span></div>
              <div className="stat-foot"><span className="stat-positive">Across all students</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon rose"><Icon name="calendar" size={18} /></span><span className="stat-caption">NEEDS ATTENTION</span></div>
              <div className="stat-value">{students.filter((student) => student.attendance < 75).length}<span className="stat-unit"> students</span></div>
              <div className="stat-foot"><span className="stat-warning">Below 75% attendance</span></div>
            </article>
          </section>

          <section className="attendance-banner" id="attendance">
            <div className="banner-icon"><Icon name="calendar" size={20} /></div>
            <div className="banner-copy">
              <strong>Today&apos;s attendance</strong>
              <span>Mark students present or absent for the daily roll call.</span>
            </div>
            <div className="banner-progress" aria-label={`${markedCount} of ${students.length} students marked`}>
              <div className="progress-label"><strong>{markedCount} <span>/ {students.length}</span></strong><span>marked</span></div>
              <div className="progress-track"><span style={{ width: `${students.length ? (markedCount / students.length) * 100 : 0}%` }} /></div>
            </div>
            <a className="banner-link" href="#students">Take attendance <Icon name="arrow" size={15} /></a>
          </section>

          <section className="students-section" id="students">
            <div className="section-heading">
              <div>
                <div className="section-title-row"><h2>Student attendance</h2><span className="count-pill">{students.length}</span></div>
                <p>Track attendance and manage your class roster.</p>
              </div>
              <button className="button button-outline" type="button" onClick={() => downloadCsv(students, rollCall)}>
                <Icon name="download" size={16} /> Export CSV
              </button>
            </div>

            <div className="table-toolbar">
              <div className="filter-tabs" role="group" aria-label="Filter students">
                <button className={filter === "all" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("all")} type="button">All students <span>{students.length}</span></button>
                <button className={filter === "low" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("low")} type="button">Needs attention</button>
                <button className={filter === "high" ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter("high")} type="button">Excellent</button>
              </div>
              <label className="search-box">
                <Icon name="search" size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students..." aria-label="Search students" />
                <kbd>⌘ K</kbd>
              </label>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>STUDENT</th><th>CLASS</th><th>ATTENDANCE</th><th>TODAY</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {filteredStudents.map((student, index) => {
                    const status = rollCall[student.id];
                    return (
                      <tr key={student.id}>
                        <td>
                          <div className="student-cell">
                            <div className={`student-avatar avatar-${index % 5}`}>{student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
                            <div className="student-copy"><strong>{student.name}</strong><span>{student.id}{student.email ? ` · ${student.email}` : ""}</span></div>
                          </div>
                        </td>
                        <td><span className="class-name">{student.className}</span></td>
                        <td>
                          <div className="attendance-cell">
                            <div className="attendance-number"><strong>{student.attendance}%</strong><span className={`attendance-badge ${attendanceTone(student.attendance)}`}>{student.attendance < 75 ? "Low" : student.attendance >= 95 ? "Excellent" : "On track"}</span></div>
                            <div className="mini-track"><span className={attendanceTone(student.attendance)} style={{ width: `${Math.min(100, Math.max(0, student.attendance))}%` }} /></div>
                          </div>
                        </td>
                        <td>
                          <span className={`today-status ${status ? status.toLowerCase() : "unmarked"}`}>
                            <span />{status || "Not marked"}
                          </span>
                        </td>
                        <td className="action-cell">
                          <button
                            className={`mark-button ${status === "Present" ? "marked" : ""}`}
                            type="button"
                            onClick={() => markAttendance(student.id)}
                            aria-label={`Update today's attendance for ${student.name}`}
                          >
                            {status === undefined ? "Mark present" : status === "Present" ? "Mark absent" : "Undo"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr><td className="empty-state" colSpan="5">No students match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students</span><span>Attendance data is saved in this browser</span></div>
          </section>

          <footer className="page-footer"><span>© 2026 Classroom</span><span>Made for better learning <span className="footer-heart">♥</span></span></footer>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div><span className="modal-icon"><Icon name="users" size={19} /></span><h2 id="modal-title">Add a student</h2><p>Add a student to Grade 10 · Section A.</p></div>
              <button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setShowForm(false)}><Icon name="close" /></button>
            </div>
            <form onSubmit={addStudent}>
              <label>Full name<input name="name" autoFocus required placeholder="e.g. Alex Morgan" /></label>
              <label>Class / section<input name="className" required defaultValue="Grade 10 · A" /></label>
              <label>Email <span className="optional">(optional)</span><input name="email" type="email" placeholder="student@example.com" /></label>
              <div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Icon name="plus" size={16} /> Add student</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
