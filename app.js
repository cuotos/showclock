const DEFAULT_SCHEDULE = `10:00 Load in
13:00 Soundcheck
16:00 Support soundcheck
17:00 Dinner
18:30 Doors
19:30 Support
20:15 Changeover
20:45 Headliner
22:45 Curfew`;

const MIN = 60 * 1000;
const STORE_SCHEDULE = "showclock.schedule";

const $ = (id) => document.getElementById(id);

let schedule = parseSchedule(localStorage.getItem(STORE_SCHEDULE) || DEFAULT_SCHEDULE).phases;

// "HH:MM Name" per line -> { phases: [{ mins, name }], errors: [{ line, text }] }
// Blank lines are ignored. Times that go backwards roll past midnight.
function parseSchedule(text) {
  const phases = [];
  const errors = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/^(\d{1,2})[:.](\d{2})\s+(.+)$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      errors.push({ line: i, text: line });
      return;
    }
    let mins = Number(m[1]) * 60 + Number(m[2]);
    const prev = phases[phases.length - 1];
    while (prev && mins < prev.mins) mins += 24 * 60;
    phases.push({ mins, name: m[3] });
  });
  return { phases, errors };
}

// Midnight of the show day. Just after midnight on a late show, that's yesterday.
function baseDate(now) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const last = schedule[schedule.length - 1];
  if (last && last.mins > 24 * 60 && now - base.getTime() < (last.mins - 24 * 60 + 120) * MIN) {
    base.setDate(base.getDate() - 1);
  }
  return base.getTime();
}

function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(ms) {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function render() {
  const now = Date.now();
  const base = baseDate(now);
  const sched = (i) => base + schedule[i].mins * MIN;
  const lastIdx = schedule.length - 1;

  $("clock").textContent = new Date(now).toLocaleTimeString([], { hour12: false });  if (schedule.length < 2) return;

  // Current phase is whichever scheduled start we last passed
  let current = -1;
  for (let i = 0; i <= lastIdx; i++) if (sched(i) <= now) current = i;

  // Now
  $("phase-name").textContent = current < 0 ? "Pre-show" : schedule[current].name;
  $("phase-remaining").textContent = current < lastIdx
    ? `${fmtDuration(sched(current + 1) - now)} left`
    : "";

  // Next
  if (current < lastIdx) {
    const next = current + 1;
    $("next-name").textContent = schedule[next].name;
    $("next-at").textContent = fmtClock(sched(next));
  } else {
    $("next-name").textContent = "—";
    $("next-at").textContent = "";
  }

  // Later: everything after next
  const later = $("later");
  later.innerHTML = "";
  for (let i = current + 2; i <= lastIdx; i++) {
    const item = document.createElement("div");
    item.className = "later-item";
    item.innerHTML = `<span class="later-name"></span> <span class="later-at"></span>`;
    item.querySelector(".later-name").textContent = schedule[i].name;
    item.querySelector(".later-at").textContent = fmtClock(sched(i));
    later.appendChild(item);
  }
  // Drop items that would be cut off at the right edge
  let overflowed = false;
  for (const item of later.children) {
    overflowed ||= item.offsetLeft + item.offsetWidth > later.clientWidth;
    item.hidden = overflowed;
  }

  renderTimeline(now, sched, current);
}

// Progress through the current phase only, from its scheduled start to scheduled end
function renderTimeline(now, sched, current) {
  const timeline = $("timeline");
  timeline.hidden = current < 0 || current >= schedule.length - 1;
  if (timeline.hidden) return;

  const start = sched(current);
  const end = sched(current + 1);
  $("fill").style.width = `${((now - start) / (end - start)) * 100}%`;
  $("tick-start").textContent = fmtClock(start);
  $("tick-end").textContent = fmtClock(end);
}

function openEditor() {
  $("schedule-text").value = schedule.map((p) => {
    const m = p.mins % (24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")} ${p.name}`;
  }).join("\n");
  showErrors([]);
  $("editor").showModal();
}

// Save only if every line parses; otherwise list the bad lines and select the first one
function trySave() {
  const ta = $("schedule-text");
  const { phases, errors } = parseSchedule(ta.value);
  const messages = errors.map((e) => `LINE ${e.line + 1}: "${e.text}" — EXPECTED HH:MM NAME`);
  if (!errors.length && phases.length < 2) messages.push("NEED AT LEAST TWO LINES (A PHASE AND AN END POINT)");
  showErrors(messages);
  if (messages.length) {
    if (errors.length) selectLine(ta, errors[0].line);
    return;
  }
  schedule = phases;
  localStorage.setItem(STORE_SCHEDULE, ta.value);
  $("editor").close();
  render();
}

function showErrors(messages) {
  const el = $("editor-errors");
  el.innerHTML = "";
  for (const msg of messages) {
    const div = document.createElement("div");
    div.textContent = msg;
    el.appendChild(div);
  }
  $("schedule-text").classList.toggle("has-error", messages.length > 0);
}

function selectLine(ta, lineNo) {
  const lines = ta.value.split("\n");
  const start = lines.slice(0, lineNo).reduce((n, l) => n + l.length + 1, 0);
  ta.focus();
  ta.setSelectionRange(start, start + lines[lineNo].length);
}

$("save").addEventListener("click", trySave);

// Enter saves and closes; Shift+Enter inserts a new line
$("schedule-text").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const ta = e.target;
  if (e.shiftKey) {
    ta.setRangeText("\n", ta.selectionStart, ta.selectionEnd, "end");
  } else {
    trySave();
  }
});

document.addEventListener("keydown", (e) => {
  if ($("editor").open) return;
  switch (e.key) {
    case "e":
    case "E":
      e.preventDefault();
      openEditor();
      break;
    case "f":
    case "F":
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      break;
  }
});

render();
setInterval(render, 250);
