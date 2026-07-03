/* ==========================================================
   Fitness Log — app.js
   App 100% frontend. Datos en localStorage, organizados por mes.
   Estructura:
   {
     "2026-07": {
       gym: [], running: [], bodyWeight: [], goals: [],
       monthlyNotes: "", createdAt: "", updatedAt: ""
     }
   }
   ========================================================== */

"use strict";

/* ---------------- Constantes ---------------- */
const STORAGE_KEY = "fitnessLog";
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DOW = ["L","M","M","J","V","S","D"];
const WORKOUT_TYPES = ["Push","Pull","Legs","Upper","Full Body","Pecho y tríceps","Espalda y bíceps","Pierna","Personalizado"];
const MUSCLE_GROUPS = ["Pecho","Espalda","Pierna","Hombro","Bíceps","Tríceps","Abdomen","Glúteo","Cardio","Otro"];
const RUN_TYPES = ["Suave","Fondo","Intervalos","Tempo","Caminata/carrera","Prueba personal"];
const TERRAINS = ["Calle","Pista","Caminadora","Trail"];
const WEATHER = ["Normal","Fresco","Calor","Lluvia"];
const GOAL_TYPES = [
  { id: "run_km", label: "Correr X km" },
  { id: "gym_count", label: "Hacer X entrenamientos de gym" },
  { id: "run_count", label: "Completar X sesiones de running" },
  { id: "weight", label: "Peso corporal objetivo (kg)" },
  { id: "custom", label: "Objetivo personalizado" }
];
const BADGES = [
  { id: "first_run", icon: "🏁", name: "Primera carrera", check: m => m.running.length >= 1 },
  { id: "km10", icon: "➤", name: "10 km acumulados", check: m => totalKm(m) >= 10 },
  { id: "km20", icon: "➤➤", name: "20 km acumulados", check: m => totalKm(m) >= 20 },
  { id: "km50", icon: "★", name: "50 km acumulados", check: m => totalKm(m) >= 50 },
  { id: "gym5", icon: "◈", name: "5 entrenamientos", check: m => m.gym.length >= 5 },
  { id: "gym10", icon: "◆", name: "10 entrenamientos", check: m => m.gym.length >= 10 },
  { id: "pr", icon: "⚡", name: "Récord personal", check: m => hasPR(m) }
];

/* ---------------- Estado ---------------- */
let db = loadDB();
let currentKey = monthKey(new Date());
let currentView = "dashboard";

/* ---------------- Utilidades ---------------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nowISO() { return new Date().toISOString(); }
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function keyToDate(key) { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1); }
function monthLabel(key) { const d = keyToDate(key); return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmm(totalMin) {
  const h = Math.floor(totalMin / 60), m = Math.round(totalMin % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
function paceStr(minPerKm) {
  if (!isFinite(minPerKm) || minPerKm <= 0) return "—";
  const m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}
function round1(n) { return Math.round(n * 10) / 10; }
function num(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(Math.round(n)); }

/* ---------------- Persistencia ---------------- */
function loadDB() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveDB() {
  const m = db[currentKey];
  if (m) m.updatedAt = nowISO();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
function getMonth(key = currentKey) {
  if (!db[key]) {
    db[key] = { gym: [], running: [], bodyWeight: [], goals: [], monthlyNotes: "", createdAt: nowISO(), updatedAt: nowISO() };
  }
  // Compatibilidad con datos incompletos importados
  const m = db[key];
  m.gym ??= []; m.running ??= []; m.bodyWeight ??= []; m.goals ??= []; m.monthlyNotes ??= "";
  return m;
}

/* ---------------- Métricas ---------------- */
function exerciseVolume(ex) {
  return (ex.sets || []).reduce((acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
}
function workoutVolume(w) { return (w.exercises || []).reduce((a, e) => a + exerciseVolume(e), 0); }
function monthVolume(m) { return m.gym.reduce((a, w) => a + workoutVolume(w), 0); }
function monthSets(m) { return m.gym.reduce((a, w) => a + (w.exercises || []).reduce((b, e) => b + (e.sets?.length || 0), 0), 0); }
function totalKm(m) { return m.running.reduce((a, r) => a + (Number(r.distance) || 0), 0); }
function totalRunMin(m) { return m.running.reduce((a, r) => a + (Number(r.minutes) || 0), 0); }
function hasPR(m) {
  return m.gym.some(w => (w.exercises || []).some(e => e.pr)) || m.running.some(r => r.pr);
}
function bestRun(m) {
  const withPace = m.running.filter(r => r.distance > 0 && r.minutes > 0);
  if (!withPace.length) return null;
  return withPace.reduce((best, r) => (r.minutes / r.distance) < (best.minutes / best.distance) ? r : best);
}
function longestRun(m) {
  if (!m.running.length) return null;
  return m.running.reduce((b, r) => (r.distance > b.distance ? r : b));
}
// Mejor marca por ejercicio (peso máximo levantado en cualquier serie)
function bestMarksByExercise(m) {
  const marks = {};
  m.gym.forEach(w => (w.exercises || []).forEach(e => {
    const maxW = Math.max(0, ...(e.sets || []).map(s => Number(s.weight) || 0));
    const name = e.name.trim();
    if (!marks[name] || maxW > marks[name].weight) marks[name] = { weight: maxW, date: w.date };
  }));
  return marks;
}
// Progreso por ejercicio: compara primer y último máximo del mes
function exerciseProgress(m) {
  const byEx = {};
  [...m.gym].sort((a, b) => a.date.localeCompare(b.date)).forEach(w => {
    (w.exercises || []).forEach(e => {
      const maxW = Math.max(0, ...(e.sets || []).map(s => Number(s.weight) || 0));
      const name = e.name.trim();
      (byEx[name] ??= []).push(maxW);
    });
  });
  const prog = [];
  for (const [name, arr] of Object.entries(byEx)) {
    if (arr.length >= 2) prog.push({ name, delta: arr[arr.length - 1] - arr[0], count: arr.length });
    else prog.push({ name, delta: 0, count: arr.length });
  }
  return prog.sort((a, b) => b.delta - a.delta);
}
function mostRepeatedExercises(m) {
  const count = {};
  m.gym.forEach(w => (w.exercises || []).forEach(e => { count[e.name.trim()] = (count[e.name.trim()] || 0) + 1; }));
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}
// Agrupa cantidades por semana del mes (1-5)
function byWeek(records, valueFn) {
  const weeks = [0, 0, 0, 0, 0];
  records.forEach(r => {
    const day = Number(r.date?.split("-")[2] || 1);
    const w = Math.min(4, Math.floor((day - 1) / 7));
    weeks[w] += valueFn(r);
  });
  return weeks;
}
function prevMonthKey(key) {
  const d = keyToDate(key); d.setMonth(d.getMonth() - 1); return monthKey(d);
}
function goalProgress(goal, m) {
  const target = Number(goal.target) || 0;
  let current = 0;
  switch (goal.type) {
    case "run_km": current = totalKm(m); break;
    case "gym_count": current = m.gym.length; break;
    case "run_count": current = m.running.length; break;
    case "weight": {
      const last = [...m.bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).pop();
      current = last ? Number(last.weight) : 0;
      break;
    }
    case "custom": current = Number(goal.current) || 0; break;
  }
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return { current, target, pct };
}

/* ---------------- Render principal ---------------- */
function renderAll() {
  document.getElementById("monthLabel").textContent = monthLabel(currentKey);
  renderHeaderSummary();
  renderView(currentView);
}

function renderHeaderSummary() {
  const m = getMonth();
  const chips = [
    { val: m.gym.length, lbl: "Gym" },
    { val: m.running.length, lbl: "Carreras" },
    { val: round1(totalKm(m)) + " km", lbl: "Distancia" },
    { val: hhmm(totalRunMin(m)), lbl: "Corriendo" },
    { val: num(monthVolume(m)) + " kg", lbl: "Volumen" }
  ];
  document.getElementById("headerSummary").innerHTML =
    chips.map(c => `<div class="summary-chip"><div class="val">${c.val}</div><div class="lbl">${c.lbl}</div></div>`).join("");
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  document.getElementById(`view-${view}`).hidden = false;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  renderView(view);
  window.scrollTo({ top: 0 });
}

function renderView(view) {
  ({ dashboard: renderDashboard, gym: renderGym, running: renderRunning, progreso: renderProgress, ajustes: renderSettings })[view]();
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard() {
  const m = getMonth();
  const el = document.getElementById("view-dashboard");
  const best = bestRun(m);
  const prog = exerciseProgress(m).filter(p => p.delta > 0)[0];
  const lastWeight = [...m.bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).pop();

  const recent = [
    ...m.gym.map(w => ({ t: "gym", date: w.date, label: w.name, created: w.createdAt })),
    ...m.running.map(r => ({ t: "run", date: r.date, label: `${r.type} · ${round1(r.distance)} km`, created: r.createdAt }))
  ].sort((a, b) => (b.created || "").localeCompare(a.created || "")).slice(0, 5);

  el.innerHTML = `
    <div class="card-grid">
      ${statCard("◈", m.gym.length, "Entrenamientos de gym")}
      ${statCard("➤", m.running.length, "Sesiones de running")}
      ${statCard("⟶", round1(totalKm(m)) + " km", "Kilómetros totales")}
      ${statCard("◷", hhmm(totalRunMin(m)), "Tiempo corriendo")}
      ${statCard("⚖", lastWeight ? lastWeight.weight + " kg" : "—", "Peso corporal")}
      ${statCard("⚡", best ? paceStr(best.minutes / best.distance) : "—", "Mejor ritmo del mes")}
      ${prog ? statCard("▲", `${esc(prog.name)} +${prog.delta} kg`, "Mayor progreso") : ""}
    </div>

    <h2 class="section-title">Calendario del mes</h2>
    <div class="card">
      ${renderCalendar(m)}
      <div class="cal-legend"><span class="lg-gym">Gym</span><span class="lg-run">Running</span><span class="lg-both">Ambos</span></div>
    </div>

    <h2 class="section-title">Objetivos del mes <button class="btn-add" onclick="openGoalModal()">+ Objetivo</button></h2>
    <div class="card">${renderGoals(m)}</div>

    <h2 class="section-title">Logros</h2>
    <div class="badges">${BADGES.map(b => `
      <div class="badge ${b.check(m) ? "earned" : ""}">
        <div class="b-icon">${b.icon}</div><div class="b-name">${b.name}</div>
      </div>`).join("")}
    </div>

    <h2 class="section-title">Últimos registros</h2>
    ${recent.length ? recent.map(r => `
      <div class="record" style="padding:12px 16px">
        <div class="record-head">
          <div><div class="record-title">${r.t === "gym" ? "◈" : "➤"} ${esc(r.label)}</div>
          <div class="record-date">${fmtDate(r.date)}</div></div>
          <span class="pill ${r.t === "gym" ? "blue" : "green"}">${r.t === "gym" ? "Gym" : "Running"}</span>
        </div>
      </div>`).join("") : `<div class="empty-state">Todavía no hay registros este mes. Empieza en Gym o Running.</div>`}
  `;
}
function statCard(icon, val, lbl) {
  return `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="stat-val">${val}</div><div class="stat-lbl">${lbl}</div></div>`;
}

function renderCalendar(m) {
  const d = keyToDate(currentKey);
  const year = d.getFullYear(), month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
  const gymDays = new Set(m.gym.map(w => Number(w.date?.split("-")[2])));
  const runDays = new Set(m.running.map(r => Number(r.date?.split("-")[2])));
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  let html = `<div class="calendar">${DOW.map(x => `<div class="dow">${x}</div>`).join("")}`;
  for (let i = 0; i < firstDow; i++) html += `<div class="day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const g = gymDays.has(day), r = runDays.has(day);
    const cls = g && r ? "both" : g ? "gym" : r ? "run" : "";
    const t = isThisMonth && today.getDate() === day ? "today" : "";
    html += `<div class="day ${cls} ${t}">${day}</div>`;
  }
  return html + `</div>`;
}

function renderGoals(m) {
  if (!m.goals.length) return `<div class="empty-state" style="border:none;background:none;padding:16px">Sin objetivos aún. Define uno para este mes.</div>`;
  return m.goals.map(g => {
    const p = goalProgress(g, m);
    return `
    <div class="goal-item">
      <div class="goal-top">
        <span style="font-weight:600">${esc(g.label)}</span>
        <span style="color:var(--text-2)">${round1(p.current)} / ${p.target} <button class="icon-btn danger" style="width:24px;height:24px;font-size:.7rem;margin-left:6px" onclick="deleteGoal('${g.id}')">✕</button></span>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${p.pct}%"></div></div>
    </div>`;
  }).join("");
}

/* ---------------- GYM ---------------- */
let gymSearch = "";

function renderGym() {
  const m = getMonth();
  const el = document.getElementById("view-gym");
  const list = [...m.gym].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gymSearch
    ? list.filter(w => w.name.toLowerCase().includes(gymSearch) || (w.exercises || []).some(e => e.name.toLowerCase().includes(gymSearch)))
    : list;

  el.innerHTML = `
    <h2 class="section-title">Gym <button class="btn-add" onclick="openWorkoutModal()">+ Entrenamiento</button></h2>
    <div class="form-group" style="margin-bottom:16px">
      <input type="search" id="gymSearchInput" placeholder="Buscar ejercicio o entrenamiento…" value="${esc(gymSearch)}">
    </div>
    ${filtered.length ? filtered.map(renderWorkoutCard).join("")
      : `<div class="empty-state">${gymSearch ? "Sin resultados para esa búsqueda." : "Sin entrenamientos este mes. Registra el primero."}</div>`}
  `;
  const inp = document.getElementById("gymSearchInput");
  inp.addEventListener("input", e => { gymSearch = e.target.value.toLowerCase(); renderGym(); });
  if (gymSearch) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function renderWorkoutCard(w) {
  const vol = workoutVolume(w);
  const energy = { Bajo: "red", Medio: "orange", Alto: "green" }[w.energy] || "";
  return `
  <div class="record">
    <div class="record-head">
      <div>
        <div class="record-title">${esc(w.name)}</div>
        <div class="record-date">${fmtDate(w.date)}${w.duration ? ` · ${w.duration} min` : ""}</div>
      </div>
      <div class="record-actions">
        <button class="icon-btn" title="Duplicar" onclick="duplicateWorkout('${w.id}')">⧉</button>
        <button class="icon-btn" title="Editar" onclick="openWorkoutModal('${w.id}')">✎</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteWorkout('${w.id}')">✕</button>
      </div>
    </div>
    <div class="record-meta">
      ${w.energy ? `<span class="pill ${energy}">Energía ${w.energy}</span>` : ""}
      <span class="pill blue">${num(vol)} kg volumen</span>
      <span class="pill">${(w.exercises || []).length} ejercicios</span>
    </div>
    ${(w.exercises || []).map(e => `
      <div class="exercise-line">
        <div class="ex-name">${e.pr ? '<span class="pr-star">★</span> ' : ""}${esc(e.name)} <span class="pill purple" style="margin-left:6px">${esc(e.group || "Otro")}</span>
          <button class="link-btn" style="font-size:.75rem;margin-left:6px" onclick="openExerciseHistory('${esc(e.name)}')">historial</button>
        </div>
        <div class="ex-sets">${(e.sets || []).map((s, i) => `S${i + 1}: ${s.weight} kg × ${s.reps}`).join(" · ")}${e.rpe ? ` · RPE ${e.rpe}` : ""}</div>
        ${e.notes ? `<div class="ex-sets">📝 ${esc(e.notes)}</div>` : ""}
      </div>`).join("")}
    ${w.notes ? `<div class="exercise-line" style="color:var(--text-2);font-size:.82rem">📝 ${esc(w.notes)}</div>` : ""}
  </div>`;
}

function duplicateWorkout(id) {
  const m = getMonth();
  const src = m.gym.find(w => w.id === id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid(); copy.date = todayISO(); copy.createdAt = nowISO(); copy.updatedAt = nowISO();
  copy.exercises.forEach(e => { e.id = uid(); e.pr = false; });
  m.gym.push(copy); saveDB(); renderAll();
  toast("Entrenamiento duplicado con fecha de hoy");
}

function deleteWorkout(id) {
  confirmModal("¿Eliminar este entrenamiento?", "Esta acción no se puede deshacer.", () => {
    const m = getMonth();
    m.gym = m.gym.filter(w => w.id !== id);
    saveDB(); renderAll(); toast("Entrenamiento eliminado");
  });
}

// Historial de un ejercicio a través de TODOS los meses
function openExerciseHistory(name) {
  const rows = [];
  Object.keys(db).sort().forEach(key => {
    (db[key].gym || []).forEach(w => (w.exercises || []).forEach(e => {
      if (e.name.trim().toLowerCase() === name.trim().toLowerCase()) {
        const maxW = Math.max(0, ...(e.sets || []).map(s => Number(s.weight) || 0));
        rows.push({ date: w.date, sets: e.sets, maxW, rpe: e.rpe, pr: e.pr });
      }
    }));
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));
  openModal(`
    <h2>Historial · ${esc(name)}</h2>
    ${rows.length ? rows.map(r => `
      <div class="exercise-line">
        <div class="ex-name">${r.pr ? '<span class="pr-star">★</span> ' : ""}${fmtDate(r.date)} · máx ${r.maxW} kg</div>
        <div class="ex-sets">${(r.sets || []).map((s, i) => `S${i + 1}: ${s.weight}×${s.reps}`).join(" · ")}${r.rpe ? ` · RPE ${r.rpe}` : ""}</div>
      </div>`).join("") : `<p class="modal-msg">Sin registros de este ejercicio.</p>`}
    <div class="modal-actions"><button class="btn btn-neutral" onclick="closeModal()">Cerrar</button></div>
  `);
}

/* ----- Formulario de entrenamiento (crear / editar) ----- */
function openWorkoutModal(editId = null) {
  const m = getMonth();
  const w = editId ? m.gym.find(x => x.id === editId) : null;
  const data = w ? JSON.parse(JSON.stringify(w)) : {
    id: uid(), date: todayISO(), name: "Push", duration: "", energy: "Medio", notes: "",
    exercises: [blankExercise()], createdAt: nowISO()
  };
  window.__draft = data;
  window.__editingGym = !!w;
  renderWorkoutForm();
}
function blankExercise() {
  return { id: uid(), name: "", group: "Pecho", rpe: "", notes: "", pr: false, sets: [{ weight: "", reps: "" }] };
}
function renderWorkoutForm() {
  const d = window.__draft;
  openModal(`
    <h2>${window.__editingGym ? "Editar" : "Nuevo"} entrenamiento</h2>
    <div class="form-row">
      <div class="form-group"><label>Fecha</label><input type="date" id="w-date" value="${d.date}"></div>
      <div class="form-group"><label>Duración (min)</label><input type="number" id="w-duration" min="0" value="${esc(d.duration)}"></div>
    </div>
    <div class="form-group"><label>Nombre del entrenamiento</label>
      <select id="w-name">${WORKOUT_TYPES.map(t => `<option ${d.name === t ? "selected" : ""}>${t}</option>`).join("")}</select>
    </div>
    <div class="form-group" id="w-custom-wrap" ${WORKOUT_TYPES.includes(d.name) && d.name !== "Personalizado" ? "hidden" : (d.name === "Personalizado" || !WORKOUT_TYPES.includes(d.name) ? "" : "hidden")}>
      <label>Nombre personalizado</label><input type="text" id="w-custom" value="${!WORKOUT_TYPES.includes(d.name) ? esc(d.name) : ""}">
    </div>
    <div class="form-group"><label>Energía antes de entrenar</label>
      <div class="segmented" id="w-energy">
        ${["Bajo", "Medio", "Alto"].map(e => `<button type="button" class="${d.energy === e ? "active" : ""}" data-v="${e}">${e}</button>`).join("")}
      </div>
    </div>
    <div id="w-exercises">${d.exercises.map((e, i) => exerciseFormBlock(e, i)).join("")}</div>
    <button class="link-btn" onclick="draftAddExercise()">+ Agregar ejercicio</button>
    <div class="form-group" style="margin-top:12px"><label>Notas del entrenamiento</label><textarea id="w-notes">${esc(d.notes)}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveWorkout()">Guardar</button>
    </div>
  `);
  document.getElementById("w-name").addEventListener("change", e => {
    document.getElementById("w-custom-wrap").hidden = e.target.value !== "Personalizado";
  });
  document.getElementById("w-energy").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    syncDraftFromForm();
    window.__draft.energy = b.dataset.v;
    renderWorkoutForm();
  });
}
function exerciseFormBlock(e, i) {
  return `
  <div class="exercise-block" data-ex="${i}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <strong style="font-size:.85rem">Ejercicio ${i + 1}</strong>
      <button class="link-btn red" onclick="draftRemoveExercise(${i})">Quitar</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nombre</label><input type="text" class="ex-name-inp" value="${esc(e.name)}" placeholder="Press banca"></div>
      <div class="form-group"><label>Grupo muscular</label>
        <select class="ex-group-inp">${MUSCLE_GROUPS.map(g => `<option ${e.group === g ? "selected" : ""}>${g}</option>`).join("")}</select>
      </div>
    </div>
    ${(e.sets || []).map((s, si) => `
      <div class="set-row">
        <span class="set-num">S${si + 1}</span>
        <input type="number" class="set-w" min="0" step="0.5" placeholder="kg" value="${esc(s.weight)}">
        <input type="number" class="set-r" min="0" placeholder="reps" value="${esc(s.reps)}">
        <button class="icon-btn danger" onclick="draftRemoveSet(${i},${si})">✕</button>
      </div>`).join("")}
    <button class="link-btn" onclick="draftAddSet(${i})">+ Serie</button>
    <div class="form-row" style="margin-top:10px">
      <div class="form-group"><label>RPE (1–10)</label><input type="number" class="ex-rpe-inp" min="1" max="10" value="${esc(e.rpe)}"></div>
      <div class="form-group"><label>Récord personal</label>
        <div class="segmented ex-pr-seg">
          <button type="button" class="${!e.pr ? "active" : ""}" data-v="0">No</button>
          <button type="button" class="${e.pr ? "active" : ""}" data-v="1">★ Sí</button>
        </div>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:0"><label>Notas</label><input type="text" class="ex-notes-inp" value="${esc(e.notes)}"></div>
  </div>`;
}
// Sincroniza inputs -> draft antes de re-renderizar
function syncDraftFromForm() {
  const d = window.__draft;
  d.date = document.getElementById("w-date")?.value || d.date;
  d.duration = document.getElementById("w-duration")?.value ?? d.duration;
  const sel = document.getElementById("w-name")?.value;
  d.name = sel === "Personalizado" ? (document.getElementById("w-custom")?.value || "Personalizado") : (sel || d.name);
  d.notes = document.getElementById("w-notes")?.value ?? d.notes;
  document.querySelectorAll(".exercise-block").forEach((block, i) => {
    const e = d.exercises[i]; if (!e) return;
    e.name = block.querySelector(".ex-name-inp").value;
    e.group = block.querySelector(".ex-group-inp").value;
    e.rpe = block.querySelector(".ex-rpe-inp").value;
    e.notes = block.querySelector(".ex-notes-inp").value;
    e.pr = block.querySelector(".ex-pr-seg .active")?.dataset.v === "1";
    const ws = [...block.querySelectorAll(".set-w")], rs = [...block.querySelectorAll(".set-r")];
    e.sets = ws.map((w, si) => ({ weight: w.value, reps: rs[si].value }));
  });
  // PR segments necesitan listeners tras cada render
}
function bindPrSegments() {
  document.querySelectorAll(".ex-pr-seg").forEach((seg, i) => {
    seg.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return;
      syncDraftFromForm();
      window.__draft.exercises[i].pr = b.dataset.v === "1";
      renderWorkoutForm(); bindPrSegments();
    });
  });
}
function draftAddExercise() { syncDraftFromForm(); window.__draft.exercises.push(blankExercise()); renderWorkoutForm(); bindPrSegments(); }
function draftRemoveExercise(i) { syncDraftFromForm(); window.__draft.exercises.splice(i, 1); if (!window.__draft.exercises.length) window.__draft.exercises.push(blankExercise()); renderWorkoutForm(); bindPrSegments(); }
function draftAddSet(i) { syncDraftFromForm(); window.__draft.exercises[i].sets.push({ weight: "", reps: "" }); renderWorkoutForm(); bindPrSegments(); }
function draftRemoveSet(i, si) { syncDraftFromForm(); const s = window.__draft.exercises[i].sets; s.splice(si, 1); if (!s.length) s.push({ weight: "", reps: "" }); renderWorkoutForm(); bindPrSegments(); }

function saveWorkout() {
  syncDraftFromForm();
  const d = window.__draft;
  if (!d.date) return toast("Selecciona una fecha");
  if (!d.name.trim()) return toast("El entrenamiento necesita un nombre");
  d.exercises = d.exercises.filter(e => e.name.trim());
  if (!d.exercises.length) return toast("Agrega al menos un ejercicio con nombre");
  d.exercises.forEach(e => {
    e.sets = e.sets.filter(s => s.weight !== "" || s.reps !== "")
      .map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }));
    e.rpe = e.rpe ? Math.min(10, Math.max(1, Number(e.rpe))) : "";
  });
  d.updatedAt = nowISO();

  // El registro se guarda en el mes de SU fecha (puede diferir del mes visible)
  const targetKey = d.date.slice(0, 7);
  const target = getMonth(targetKey);
  if (window.__editingGym) getMonth().gym = getMonth().gym.filter(w => w.id !== d.id);
  target.gym.push(d);
  saveDB(); closeModal();
  if (targetKey !== currentKey) { currentKey = targetKey; }
  renderAll();
  toast(window.__editingGym ? "Entrenamiento actualizado" : "Entrenamiento guardado");
}

/* ---------------- RUNNING ---------------- */
function renderRunning() {
  const m = getMonth();
  const el = document.getElementById("view-running");
  const list = [...m.running].sort((a, b) => b.date.localeCompare(a.date));
  const best = bestRun(m), longest = longestRun(m);
  const avgPace = totalKm(m) > 0 ? totalRunMin(m) / totalKm(m) : 0;

  el.innerHTML = `
    <h2 class="section-title">Running <button class="btn-add" onclick="openRunModal()">+ Carrera</button></h2>
    <div class="card-grid" style="margin-bottom:16px">
      ${statCard("⟶", round1(totalKm(m)) + " km", "Km del mes")}
      ${statCard("◷", hhmm(totalRunMin(m)), "Tiempo total")}
      ${statCard("∅", paceStr(avgPace), "Ritmo promedio")}
      ${statCard("▲", longest ? round1(longest.distance) + " km" : "—", "Carrera más larga")}
      ${statCard("⚡", best ? paceStr(best.minutes / best.distance) : "—", "Mejor ritmo")}
      ${statCard("∑", m.running.length ? round1(totalKm(m) / m.running.length) + " km" : "—", "Promedio / sesión")}
    </div>
    <h2 class="section-title">Historial</h2>
    ${list.length ? list.map(r => renderRunCard(r, best)).join("") : `<div class="empty-state">Sin carreras este mes. Registra tu primera sesión.</div>`}
  `;
}
function renderRunCard(r, best) {
  const pace = r.distance > 0 ? r.minutes / r.distance : 0;
  const isBest = best && r.id === best.id;
  return `
  <div class="record">
    <div class="record-head">
      <div>
        <div class="record-title">${r.pr || isBest ? '<span class="pr-star">★</span> ' : ""}${esc(r.type)} · ${round1(r.distance)} km</div>
        <div class="record-date">${fmtDate(r.date)} · ${hhmm(r.minutes)} · ${paceStr(pace)}</div>
      </div>
      <div class="record-actions">
        <button class="icon-btn" title="Editar" onclick="openRunModal('${r.id}')">✎</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteRun('${r.id}')">✕</button>
      </div>
    </div>
    <div class="record-meta">
      <span class="pill green">${esc(r.terrain)}</span>
      <span class="pill orange">${esc(r.weather)}</span>
      ${r.effort ? `<span class="pill">Esfuerzo ${r.effort}/10</span>` : ""}
      ${r.calories ? `<span class="pill red">${r.calories} kcal</span>` : ""}
    </div>
    ${r.notes ? `<div class="exercise-line" style="color:var(--text-2);font-size:.82rem">📝 ${esc(r.notes)}</div>` : ""}
  </div>`;
}
function deleteRun(id) {
  confirmModal("¿Eliminar esta carrera?", "Esta acción no se puede deshacer.", () => {
    const m = getMonth();
    m.running = m.running.filter(r => r.id !== id);
    saveDB(); renderAll(); toast("Carrera eliminada");
  });
}
function openRunModal(editId = null) {
  const m = getMonth();
  const r = editId ? m.running.find(x => x.id === editId) : null;
  const d = r ? { ...r } : { id: uid(), date: todayISO(), type: "Suave", distance: "", minutes: "", calories: "", effort: "", terrain: "Calle", weather: "Normal", notes: "", pr: false, createdAt: nowISO() };
  openModal(`
    <h2>${r ? "Editar" : "Nueva"} carrera</h2>
    <div class="form-row">
      <div class="form-group"><label>Fecha</label><input type="date" id="r-date" value="${d.date}"></div>
      <div class="form-group"><label>Tipo</label><select id="r-type">${RUN_TYPES.map(t => `<option ${d.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Distancia (km)</label><input type="number" id="r-dist" min="0" step="0.01" value="${esc(d.distance)}"></div>
      <div class="form-group"><label>Tiempo (min)</label><input type="number" id="r-min" min="0" step="0.1" value="${esc(d.minutes)}"></div>
      <div class="form-group"><label>Calorías</label><input type="number" id="r-cal" min="0" value="${esc(d.calories)}"></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Esfuerzo (1–10)</label><input type="number" id="r-eff" min="1" max="10" value="${esc(d.effort)}"></div>
      <div class="form-group"><label>Terreno</label><select id="r-terr">${TERRAINS.map(t => `<option ${d.terrain === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="form-group"><label>Clima</label><select id="r-wea">${WEATHER.map(t => `<option ${d.weather === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    </div>
    <div class="form-group"><label>Récord / mejor carrera</label>
      <div class="segmented" id="r-pr">
        <button type="button" class="${!d.pr ? "active" : ""}" data-v="0">No</button>
        <button type="button" class="${d.pr ? "active" : ""}" data-v="1">★ Sí</button>
      </div>
    </div>
    <div class="form-group"><label>Notas</label><textarea id="r-notes">${esc(d.notes)}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="r-save">Guardar</button>
    </div>
  `);
  let pr = !!d.pr;
  document.getElementById("r-pr").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    pr = b.dataset.v === "1";
    document.querySelectorAll("#r-pr button").forEach(x => x.classList.toggle("active", x === b));
  });
  document.getElementById("r-save").addEventListener("click", () => {
    const date = document.getElementById("r-date").value;
    const distance = Number(document.getElementById("r-dist").value);
    const minutes = Number(document.getElementById("r-min").value);
    if (!date) return toast("Selecciona una fecha");
    if (!distance || distance <= 0) return toast("Ingresa una distancia válida");
    if (!minutes || minutes <= 0) return toast("Ingresa el tiempo en minutos");
    const rec = {
      ...d, date, distance, minutes,
      type: document.getElementById("r-type").value,
      calories: Number(document.getElementById("r-cal").value) || "",
      effort: Number(document.getElementById("r-eff").value) || "",
      terrain: document.getElementById("r-terr").value,
      weather: document.getElementById("r-wea").value,
      notes: document.getElementById("r-notes").value,
      pr, updatedAt: nowISO()
    };
    const targetKey = date.slice(0, 7);
    if (r) getMonth().running = getMonth().running.filter(x => x.id !== rec.id);
    getMonth(targetKey).running.push(rec);
    saveDB(); closeModal();
    if (targetKey !== currentKey) currentKey = targetKey;
    renderAll();
    toast(r ? "Carrera actualizada" : "Carrera guardada");
  });
}

/* ---------------- PROGRESO ---------------- */
function renderProgress() {
  const m = getMonth();
  const el = document.getElementById("view-progreso");
  const prevM = db[prevMonthKey(currentKey)];

  const volWeeks = byWeek(m.gym, workoutVolume);
  const kmWeeks = byWeek(m.running, r => Number(r.distance) || 0);
  const countWeeks = byWeek([...m.gym, ...m.running], () => 1);
  const marks = Object.entries(bestMarksByExercise(m)).sort((a, b) => b[1].weight - a[1].weight).slice(0, 6);
  const repeated = mostRepeatedExercises(m).slice(0, 5);
  const weights = [...m.bodyWeight].sort((a, b) => a.date.localeCompare(b.date));

  // Tendencia: actividad total vs mes anterior
  let trend = "Estable", trendIcon = "→", trendColor = "var(--text-2)";
  if (prevM) {
    const cur = m.gym.length + m.running.length;
    const prev = (prevM.gym?.length || 0) + (prevM.running?.length || 0);
    if (cur > prev) { trend = "Subiendo"; trendIcon = "▲"; trendColor = "var(--green)"; }
    else if (cur < prev) { trend = "Bajando"; trendIcon = "▼"; trendColor = "var(--red)"; }
  }

  el.innerHTML = `
    <h2 class="section-title">Tendencia general</h2>
    <div class="card" style="display:flex;align-items:center;gap:12px">
      <span style="font-size:1.6rem;color:${trendColor}">${trendIcon}</span>
      <div><strong>${trend}</strong><div style="font-size:.8rem;color:var(--text-2)">${prevM ? "Comparado con " + monthLabel(prevMonthKey(currentKey)) : "Sin datos del mes anterior para comparar"}</div></div>
    </div>

    ${prevM ? `<h2 class="section-title">Vs. mes anterior</h2>
    <div class="card">
      ${compareRow("Entrenamientos gym", m.gym.length, prevM.gym?.length || 0)}
      ${compareRow("Sesiones running", m.running.length, prevM.running?.length || 0)}
      ${compareRow("Kilómetros", round1(totalKm(m)), round1(totalKm({ running: prevM.running || [] })))}
      ${compareRow("Volumen (kg)", Math.round(monthVolume(m)), Math.round(monthVolume({ gym: prevM.gym || [] })))}
    </div>` : ""}

    <h2 class="section-title">Peso corporal <button class="btn-add" onclick="openWeightModal()">+ Registro</button></h2>
    <div class="card">
      ${weights.length ? barChart(weights.map(w => ({ lbl: fmtDate(w.date).slice(0, 6), val: Number(w.weight), extra: `<button class="icon-btn danger" style="width:22px;height:22px;font-size:.65rem" onclick="deleteWeight('${w.id}')">✕</button>` })), "orange", " kg")
        : `<div class="empty-state" style="border:none;background:none">Registra tu peso para ver la evolución.</div>`}
    </div>

    <h2 class="section-title">Volumen de gym por semana</h2>
    <div class="card">${weekChart(volWeeks, "", " kg")}</div>

    <h2 class="section-title">Kilómetros por semana</h2>
    <div class="card">${weekChart(kmWeeks, "green", " km")}</div>

    <h2 class="section-title">Entrenamientos por semana</h2>
    <div class="card">${weekChart(countWeeks, "orange", "")}</div>

    <h2 class="section-title">Mejores marcas por ejercicio</h2>
    <div class="card">
      ${marks.length ? marks.map(([name, x]) => `
        <div class="goal-top" style="margin-bottom:8px"><span style="font-weight:600">${esc(name)}</span><span>${x.weight} kg · ${fmtDate(x.date)}</span></div>`).join("")
        : `<div class="empty-state" style="border:none;background:none">Sin datos de gym todavía.</div>`}
    </div>

    <h2 class="section-title">Ejercicios más repetidos</h2>
    <div class="card">
      ${repeated.length ? barChart(repeated.map(([n, c]) => ({ lbl: n.slice(0, 12), val: c })), "", "×")
        : `<div class="empty-state" style="border:none;background:none">Sin datos de gym todavía.</div>`}
    </div>

    <h2 class="section-title">Notas del mes</h2>
    <div class="card">
      <div class="form-group" style="margin-bottom:10px">
        <label>Qué mejoró, qué falló, objetivo del siguiente mes</label>
        <textarea id="monthNotes" rows="4">${esc(m.monthlyNotes)}</textarea>
      </div>
      <button class="btn btn-ghost" onclick="saveMonthNotes()">Guardar notas</button>
    </div>
  `;
}
function compareRow(lbl, cur, prev) {
  const diff = cur - prev;
  const color = diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text-2)";
  const sign = diff > 0 ? "+" : "";
  return `<div class="goal-top" style="margin-bottom:8px"><span>${lbl}</span><span><strong>${cur}</strong> <span style="color:var(--text-2)">vs ${prev}</span> <span style="color:${color};font-weight:700">${sign}${round1(diff)}</span></span></div>`;
}
function weekChart(weeks, color, unit) {
  const max = Math.max(...weeks, 1);
  return weeks.map((v, i) => barRow(`Sem ${i + 1}`, v, max, color, unit)).join("");
}
function barChart(items, color, unit) {
  const max = Math.max(...items.map(x => x.val), 1);
  return items.map(x => barRow(x.lbl, x.val, max, color, unit, x.extra)).join("");
}
function barRow(lbl, val, max, color, unit, extra = "") {
  return `<div class="bar-row">
    <span class="bar-lbl">${esc(lbl)}</span>
    <div class="bar-track"><div class="bar-fill ${color}" style="width:${(val / max) * 100}%">${round1(val)}${unit}</div></div>${extra}
  </div>`;
}
function saveMonthNotes() {
  getMonth().monthlyNotes = document.getElementById("monthNotes").value;
  saveDB(); toast("Notas guardadas");
}
function openWeightModal() {
  openModal(`
    <h2>Peso corporal</h2>
    <div class="form-row">
      <div class="form-group"><label>Fecha</label><input type="date" id="bw-date" value="${todayISO()}"></div>
      <div class="form-group"><label>Peso (kg)</label><input type="number" id="bw-kg" min="1" step="0.1" placeholder="78.5"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="bw-save">Guardar</button>
    </div>
  `);
  document.getElementById("bw-save").addEventListener("click", () => {
    const date = document.getElementById("bw-date").value;
    const weight = Number(document.getElementById("bw-kg").value);
    if (!date || !weight) return toast("Completa fecha y peso");
    getMonth(date.slice(0, 7)).bodyWeight.push({ id: uid(), date, weight, createdAt: nowISO(), updatedAt: nowISO() });
    saveDB(); closeModal(); renderAll(); toast("Peso registrado");
  });
}
function deleteWeight(id) {
  const m = getMonth();
  m.bodyWeight = m.bodyWeight.filter(w => w.id !== id);
  saveDB(); renderAll();
}

/* ---------------- OBJETIVOS ---------------- */
function openGoalModal() {
  openModal(`
    <h2>Nuevo objetivo del mes</h2>
    <div class="form-group"><label>Tipo</label>
      <select id="g-type">${GOAL_TYPES.map(g => `<option value="${g.id}">${g.label}</option>`).join("")}</select>
    </div>
    <div class="form-group"><label>Descripción</label><input type="text" id="g-label" placeholder="Ej. Correr 40 km este mes"></div>
    <div class="form-row">
      <div class="form-group"><label>Meta (número)</label><input type="number" id="g-target" min="0" step="0.1"></div>
      <div class="form-group" id="g-current-wrap" hidden><label>Avance actual</label><input type="number" id="g-current" min="0" step="0.1" value="0"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="g-save">Guardar</button>
    </div>
  `);
  document.getElementById("g-type").addEventListener("change", e => {
    document.getElementById("g-current-wrap").hidden = e.target.value !== "custom";
  });
  document.getElementById("g-save").addEventListener("click", () => {
    const type = document.getElementById("g-type").value;
    const label = document.getElementById("g-label").value.trim() || GOAL_TYPES.find(g => g.id === type).label;
    const target = Number(document.getElementById("g-target").value);
    if (!target) return toast("Define una meta numérica");
    getMonth().goals.push({ id: uid(), type, label, target, current: Number(document.getElementById("g-current").value) || 0, createdAt: nowISO(), updatedAt: nowISO() });
    saveDB(); closeModal(); renderAll(); toast("Objetivo agregado");
  });
}
function deleteGoal(id) {
  getMonth().goals = getMonth().goals.filter(g => g.id !== id);
  saveDB(); renderAll();
}

/* ---------------- AJUSTES ---------------- */
function renderSettings() {
  const el = document.getElementById("view-ajustes");
  el.innerHTML = `
    <h2 class="section-title">Ajustes</h2>
    <div class="card settings-row">
      <div>
        <strong>Exportar datos del mes</strong>
        <p style="font-size:.82rem;color:var(--text-2);margin:4px 0 10px">Descarga un JSON con todo lo registrado en ${monthLabel(currentKey)}, incluidas las métricas calculadas.</p>
        <button class="btn btn-primary" onclick="exportMonthJSON()">Exportar datos del mes</button>
        <button class="btn btn-ghost" style="margin-top:8px" onclick="exportMonthCSV()">Exportar CSV</button>
      </div>
    </div>
    <div class="card settings-row">
      <div>
        <strong>Importar datos</strong>
        <p style="font-size:.82rem;color:var(--text-2);margin:4px 0 10px">Restaura un archivo JSON exportado previamente. Los datos se agregan al mes correspondiente.</p>
        <button class="btn btn-neutral" onclick="document.getElementById('importFile').click()">Importar archivo JSON</button>
        <input type="file" id="importFile" class="hidden-input" accept=".json,application/json">
      </div>
    </div>
    <div class="card settings-row">
      <div>
        <strong style="color:var(--red)">Zona de peligro</strong>
        <p style="font-size:.82rem;color:var(--text-2);margin:4px 0 10px">Elimina únicamente los datos de ${monthLabel(currentKey)}. Los demás meses no se tocan.</p>
        <button class="btn btn-danger" onclick="startDeleteFlow()">Borrar datos del mes</button>
      </div>
    </div>
    <p style="text-align:center;color:var(--text-2);font-size:.75rem;margin-top:8px">Fitness Log v1.0 · Datos guardados localmente en tu navegador</p>
  `;
  document.getElementById("importFile").addEventListener("change", importJSON);
}

/* ----- Exportar ----- */
function monthExportPayload() {
  const m = getMonth();
  const d = keyToDate(currentKey);
  return {
    month: MONTH_NAMES[d.getMonth()],
    year: d.getFullYear(),
    monthKey: currentKey,
    gym: m.gym,
    running: m.running,
    bodyWeight: m.bodyWeight,
    goals: m.goals,
    monthlyNotes: m.monthlyNotes,
    metrics: {
      gymWorkouts: m.gym.length,
      runningSessions: m.running.length,
      totalKm: round1(totalKm(m)),
      totalRunMinutes: Math.round(totalRunMin(m)),
      avgPaceMinPerKm: totalKm(m) > 0 ? round1(totalRunMin(m) / totalKm(m)) : null,
      totalVolumeKg: Math.round(monthVolume(m)),
      totalSets: monthSets(m),
      bestMarks: bestMarksByExercise(m)
    },
    exportedAt: nowISO()
  };
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportMonthJSON() {
  const d = keyToDate(currentKey);
  const name = `fitness-log-${MONTH_NAMES[d.getMonth()].toLowerCase()}-${d.getFullYear()}.json`;
  downloadFile(name, JSON.stringify(monthExportPayload(), null, 2), "application/json");
  toast("JSON exportado");
}
function exportMonthCSV() {
  const m = getMonth();
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let csv = "tipo,fecha,nombre,detalle,valor,unidad,notas\n";
  m.gym.forEach(w => (w.exercises || []).forEach(e => (e.sets || []).forEach((s, i) =>
    csv += ["gym", w.date, q(w.name), q(`${e.name} S${i + 1}`), `${s.weight}x${s.reps}`, "kg x reps", q(e.notes)].join(",") + "\n")));
  m.running.forEach(r =>
    csv += ["running", r.date, q(r.type), q(`${r.terrain} / ${r.weather}`), r.distance, "km", q(r.notes)].join(",") + "\n");
  m.bodyWeight.forEach(w =>
    csv += ["peso", w.date, "Peso corporal", "", w.weight, "kg", ""].join(",") + "\n");
  const d = keyToDate(currentKey);
  downloadFile(`fitness-log-${MONTH_NAMES[d.getMonth()].toLowerCase()}-${d.getFullYear()}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
  toast("CSV exportado");
}

/* ----- Importar ----- */
function importJSON(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const key = data.monthKey || currentKey;
      const m = getMonth(key);
      ["gym", "running", "bodyWeight", "goals"].forEach(k => {
        const existing = new Set(m[k].map(x => x.id));
        (data[k] || []).forEach(x => { if (!existing.has(x.id)) m[k].push(x); });
      });
      if (data.monthlyNotes && !m.monthlyNotes) m.monthlyNotes = data.monthlyNotes;
      saveDB();
      currentKey = key;
      renderAll();
      toast(`Datos de ${monthLabel(key)} importados`);
    } catch {
      toast("El archivo no es un JSON válido de Fitness Log");
    }
    ev.target.value = "";
  };
  reader.readAsText(file);
}

/* ----- Borrado con doble confirmación ----- */
function startDeleteFlow() {
  openModal(`
    <h2>Borrar datos del mes</h2>
    <p class="modal-msg">¿Seguro que quieres borrar todos los datos de este mes? Esta acción no se puede deshacer.</p>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="deleteStep2()">Continuar</button>
    </div>
  `);
}
function deleteStep2() {
  openModal(`
    <h2>Confirmación final</h2>
    <p class="modal-msg">Se eliminarán todos los entrenamientos de gym, running y progreso de <strong>${monthLabel(currentKey)}</strong>.<br><br>Escribe <strong>BORRAR</strong> para confirmar.</p>
    <div class="form-group"><input type="text" id="confirmText" placeholder="BORRAR" autocomplete="off"></div>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="finalDelete" disabled>Eliminar definitivamente</button>
    </div>
  `);
  const input = document.getElementById("confirmText");
  const btn = document.getElementById("finalDelete");
  input.addEventListener("input", () => { btn.disabled = input.value !== "BORRAR"; });
  btn.addEventListener("click", () => {
    delete db[currentKey];
    saveDB(); closeModal(); renderAll();
    toast("Datos del mes eliminados correctamente");
  });
  input.focus();
}

/* ---------------- MODAL / TOAST genéricos ---------------- */
function openModal(html) {
  const overlay = document.getElementById("modalOverlay");
  document.getElementById("modalBox").innerHTML = html;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  // Vincular segmentos de PR de gym si existen
  bindPrSegments();
}
function closeModal() {
  document.getElementById("modalOverlay").hidden = true;
  document.body.style.overflow = "";
}
function confirmModal(title, msg, onConfirm) {
  openModal(`
    <h2>${esc(title)}</h2>
    <p class="modal-msg">${esc(msg)}</p>
    <div class="modal-actions">
      <button class="btn btn-neutral" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="confirmBtn">Eliminar</button>
    </div>
  `);
  document.getElementById("confirmBtn").addEventListener("click", () => { closeModal(); onConfirm(); });
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------------- Inicialización ---------------- */
document.getElementById("prevMonth").addEventListener("click", () => {
  const d = keyToDate(currentKey); d.setMonth(d.getMonth() - 1);
  currentKey = monthKey(d); renderAll();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  const d = keyToDate(currentKey); d.setMonth(d.getMonth() + 1);
  currentKey = monthKey(d); renderAll();
});
document.getElementById("tabBar").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (tab) switchView(tab.dataset.view);
});
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target.id === "modalOverlay") closeModal();
});

renderAll();
