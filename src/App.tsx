// @ts-nocheck
import { useState, useEffect, useRef } from "react";

// ── FONTS & GLOBAL STYLES ────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap";
document.head.appendChild(fontLink);

const style = document.createElement("style");
style.textContent = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0f; --surface: #12121a; --surface2: #1a1a26;
  --border: #2a2a3d; --accent: #c8f060; --accent2: #60c8f0;
  --accent3: #f060a0; --text: #e8e8f0; --muted: #6a6a8a;
  --red: #f06060; --orange: #f0a060;
  --font-display: 'Syne', sans-serif; --font-mono: 'DM Mono', monospace;
}
body { background: var(--bg); color: var(--text); font-family: var(--font-display); }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
@keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn { from{opacity:0}to{opacity:1} }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
.fade-up { animation: fadeUp 0.35s ease forwards; }
.fade-in { animation: fadeIn 0.2s ease forwards; }
input,textarea,select {
  background: var(--surface2); border: 1px solid var(--border);
  color: var(--text); font-family: var(--font-display); font-size: 14px;
  border-radius: 10px; padding: 10px 14px; outline: none; width: 100%;
  transition: border-color 0.2s;
}
input:focus,textarea:focus,select:focus { border-color: var(--accent); }
textarea { resize: vertical; min-height: 70px; }
button { font-family: var(--font-display); cursor: pointer; border: none; outline: none; }
`;
document.head.appendChild(style);

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const RACE_DATE = "2026-06-14";
const STRAVA_CLIENT_ID = "218654";
const STRAVA_REDIRECT_URI = window.location.origin + window.location.pathname;
const STRAVA_SCOPE = "read,activity:read_all";

const DISC_COLOR = { swim: "#60c8f0", bike: "#c8f060", run: "#f060a0", rest: "#6a6a8a", strength: "#f0a060", race: "#f06040" };
const DISC_ICON = { swim: "🏊", bike: "🚴", run: "🏃", rest: "😴", strength: "💪", race: "🏆" };

const PHASE = {
  base: { bg: "#1a2610", border: "#c8f06044", label: "var(--accent)", name: "BASIS" },
  build: { bg: "#10201a", border: "#60c8f044", label: "var(--accent2)", name: "OPBOUW" },
  peak: { bg: "#200a18", border: "#f060a044", label: "var(--accent3)", name: "PIEK" },
  taper: { bg: "#1a1a10", border: "#f0c06044", label: "#f0c060", name: "TAPER" },
  race: { bg: "#200a0a", border: "#f0604044", label: "#f06040", name: "RACE" },
};

const DEFAULT_TRAININGS = [
  { id: "t1", date: "2026-03-28", type: "Zwemmen", discipline: "swim", duration: 65, distance: 3200, rpe: 6, notes: "1:36/100m gemiddeld", completed: true, source: "manual" },
  { id: "t2", date: "2026-03-29", type: "Fietsen", discipline: "bike", duration: 120, distance: 72, rpe: 7, notes: "Intervaltraining, FTP ~295W", completed: true, source: "manual" },
  { id: "t3", date: "2026-03-30", type: "Lopen", discipline: "run", duration: 55, distance: 12, rpe: 6, notes: "Herstelloop", completed: true, source: "manual" },
];

const DEFAULT_EVENTS = [
  { id: "e1", date: "2026-04-06", title: "Amateur Ronde van Vlaanderen", type: "race", icon: "🚴" },
  { id: "e2", date: "2026-05-03", title: "Kortrijk Halve Marathon", type: "race", icon: "🏃" },
  { id: "e3", date: "2026-06-14", title: "Ironman Klagenfurt", type: "race", icon: "🏆" },
  { id: "e4", date: "2026-04-20", title: "Start voco Gent", type: "work", icon: "🏨" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
function daysUntil(d) { return Math.ceil((new Date(d) - new Date(TODAY)) / 86400000); }
function fmtDate(d) { return new Date(d).toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" }); }
function fmtShort(d) { return new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }); }
function uid() { return Math.random().toString(36).slice(2, 9); }

function useStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }, [key, val]);
  return [val, setVal];
}

// ── STRAVA HELPERS ───────────────────────────────────────────────────────────
function stravaAuthUrl() {
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&response_type=code&scope=${STRAVA_SCOPE}`;
}

async function exchangeCode(code) {
  const res = await fetch("/api/strava-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, grant_type: "authorization_code" }),
  });
  return res.json();
}

async function refreshToken(refresh_token) {
  const res = await fetch("/api/strava-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token, grant_type: "refresh_token" }),
  });
  return res.json();
}

async function fetchStravaActivities(access_token, page = 1) {
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30&page=${page}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return res.json();
}

function stravaToTraining(act) {
  const typeMap = {
    Swim: { type: "Zwemmen", discipline: "swim" },
    Ride: { type: "Fietsen", discipline: "bike" },
    VirtualRide: { type: "Fietsen (indoor)", discipline: "bike" },
    Run: { type: "Lopen", discipline: "run" },
    Walk: { type: "Wandelen", discipline: "run" },
    WeightTraining: { type: "Kracht", discipline: "strength" },
    Workout: { type: "Kracht", discipline: "strength" },
  };
  const mapped = typeMap[act.type] || { type: act.type, discipline: "bike" };
  return {
    id: `strava_${act.id}`,
    stravaId: act.id,
    date: act.start_date_local.slice(0, 10),
    type: mapped.type,
    discipline: mapped.discipline,
    duration: Math.round(act.moving_time / 60),
    distance: mapped.discipline === "swim" ? Math.round(act.distance) : Math.round(act.distance / 100) / 10,
    rpe: act.perceived_exertion || 0,
    notes: act.name + (act.average_watts ? ` · ${Math.round(act.average_watts)}W` : "") + (act.average_heartrate ? ` · ${Math.round(act.average_heartrate)}bpm` : ""),
    completed: true,
    source: "strava",
    heartrate: act.average_heartrate || 0,
    watts: act.average_watts || 0,
    elevation: act.total_elevation_gain || 0,
  };
}

// ── GARMIN FIT PARSER (basic) ─────────────────────────────────────────────────
function parseFitFile(buffer) {
  // Basic FIT file metadata extraction (header + summary)
  const view = new DataView(buffer);
  const headerSize = view.getUint8(0);
  const protocol = view.getUint8(1);

  // Return basic info — full FIT parsing requires a library
  return {
    id: uid(),
    date: TODAY,
    type: "Garmin Import",
    discipline: "bike",
    duration: 0,
    distance: 0,
    rpe: 0,
    notes: `FIT import (${Math.round(buffer.byteLength / 1024)}KB) — controleer details`,
    completed: true,
    source: "garmin",
    raw: true,
  };
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
function Card({ children, style: s = {}, onClick }) {
  return <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, cursor: onClick ? "pointer" : "default", ...s }}>{children}</div>;
}

function Badge({ color, children }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500 }}>{children}</span>;
}

function Btn({ children, onClick, color = "var(--accent)", textColor = "#0a0a0f", style: s = {}, disabled = false }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "var(--surface2)" : color, color: disabled ? "var(--muted)" : textColor, fontWeight: 700, borderRadius: 12, padding: "10px 16px", fontSize: 13, opacity: disabled ? 0.6 : 1, ...s }}>{children}</button>;
}

function IconBtn({ children, onClick, color = "var(--muted)" }) {
  return <button onClick={onClick} style={{ background: "var(--surface2)", border: `1px solid var(--border)`, color, borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>{children}</button>;
}

function Nav({ tab, setTab }) {
  return <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(10,10,15,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)", display: "flex", zIndex: 100 }}>
    {[["today", "◉", "Vandaag"], ["schema", "📋", "Schema"], ["training", "⚡", "Log"], ["agenda", "📅", "Agenda"], ["nutrition", "🥗", "Voeding"], ["brief", "✦", "AI Brief"]].map(([id, icon, label]) => (
      <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "11px 2px 9px", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === id ? "var(--accent)" : "var(--muted)", transition: "color 0.2s" }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>{label}</span>
      </button>
    ))}
  </nav>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={onClose} className="fade-in">
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", border: "1px solid var(--border)", padding: 24, width: "100%", maxHeight: "85vh", overflowY: "auto" }} className="fade-up">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "6px 10px", fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── STRAVA CONNECT PANEL ──────────────────────────────────────────────────────
function StravaPanel({ stravaAuth, onConnect, onSync, syncing, lastSync }) {
  return (
    <Card style={{ background: "linear-gradient(135deg,#1a0a0a,#200d0d)", border: "1px solid #fc4c0244" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fc4c0222", border: "1px solid #fc4c0244", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🟠</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>Strava</p>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: stravaAuth ? "var(--accent)" : "var(--muted)" }}>
            {stravaAuth ? `✓ Verbonden · ${stravaAuth.athlete?.firstname} ${stravaAuth.athlete?.lastname}` : "Niet verbonden"}
          </p>
        </div>
        {stravaAuth && <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite" }} />}
      </div>
      {stravaAuth ? (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={onSync} disabled={syncing} color="#fc4c02" textColor="white" style={{ flex: 1 }}>
            {syncing ? "⟳ Syncing..." : "⟳ Sync activiteiten"}
          </Btn>
          {lastSync && <p style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", alignSelf: "center" }}>
            {new Date(lastSync).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
          </p>}
        </div>
      ) : (
        <Btn onClick={onConnect} color="#fc4c02" textColor="white" style={{ width: "100%" }}>
          Verbind met Strava
        </Btn>
      )}
    </Card>
  );
}

// ── GARMIN UPLOAD PANEL ───────────────────────────────────────────────────────
function GarminPanel({ onUpload, uploading }) {
  const fileRef = useRef();

  function handleFile(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => onUpload(file, ev.target.result);
      reader.readAsArrayBuffer(file);
    });
    e.target.value = "";
  }

  return (
    <Card style={{ background: "linear-gradient(135deg,#0a1020,#0d1530)", border: "1px solid #1db95444" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1db95422", border: "1px solid #1db95444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⌚</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>Garmin Connect</p>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>Upload .fit bestanden</p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".fit" multiple style={{ display: "none" }} onChange={handleFile} />
      <Btn onClick={() => fileRef.current?.click()} color="#1db954" textColor="white" style={{ width: "100%" }} disabled={uploading}>
        {uploading ? "⟳ Verwerken..." : "📁 .fit bestand uploaden"}
      </Btn>
      <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, fontFamily: "var(--font-mono)", textAlign: "center" }}>
        Exporteer via Garmin Connect → Activiteiten → Export Original
      </p>
    </Card>
  );
}

// ── GOOGLE CALENDAR PANEL ─────────────────────────────────────────────────────
function CalendarPanel({ calendarEvents, onImport, importing }) {
  const [calUrl, setCalUrl] = useState("");
  const [showInput, setShowInput] = useState(false);

  async function importIcal() {
    if (!calUrl) return;
    onImport(calUrl);
    setShowInput(false);
    setCalUrl("");
  }

  return (
    <Card style={{ background: "linear-gradient(135deg,#0a1015,#0a1520)", border: "1px solid #4285f444" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4285f422", border: "1px solid #4285f444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📅</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14 }}>Google Calendar</p>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: calendarEvents.length > 0 ? "var(--accent)" : "var(--muted)" }}>
            {calendarEvents.length > 0 ? `✓ ${calendarEvents.length} events geladen` : "Niet verbonden"}
          </p>
        </div>
      </div>
      {showInput ? (
        <div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
            Google Calendar → Instellingen → Exporteer iCal → plak link
          </p>
          <input value={calUrl} onChange={e => setCalUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..." style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={importIcal} color="#4285f4" textColor="white" style={{ flex: 1 }} disabled={importing}>
              {importing ? "⟳ Importeren..." : "Importeer"}
            </Btn>
            <Btn onClick={() => setShowInput(false)} color="var(--surface2)" textColor="var(--text)" style={{ border: "1px solid var(--border)" }}>Annuleer</Btn>
          </div>
        </div>
      ) : (
        <Btn onClick={() => setShowInput(true)} color="#4285f4" textColor="white" style={{ width: "100%" }}>
          📅 Koppel Google Calendar
        </Btn>
      )}
    </Card>
  );
}

// ── TRAINING FORM ─────────────────────────────────────────────────────────────
function TrainingForm({ initial, onSave, onClose }) {
  const blank = { date: TODAY, type: "Fietsen", discipline: "bike", duration: "", distance: "", rpe: "6", notes: "", completed: false };
  const [form, setForm] = useState(initial || blank);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <>
      {[["Datum", "date", "date"], ["Type", "type", "select", ["Zwemmen", "Fietsen", "Lopen", "Rust", "Kracht", "Zwemmen open water", "Brick"]], ["Discipline", "discipline", "select", ["swim", "bike", "run", "rest", "strength"]], ["Duur (min)", "duration", "number"], ["Afstand (km of m)", "distance", "number"], ["RPE (1–10)", "rpe", "number"], ["Notities", "notes", "textarea"]].map(([label, key, type, opts]) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 5 }}>{label.toUpperCase()}</p>
          {type === "select" ? <select value={form[key]} onChange={e => f(key, e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select>
            : type === "textarea" ? <textarea value={form[key]} onChange={e => f(key, e.target.value)} placeholder="Optionele notities..." />
              : <input type={type} value={form[key]} onChange={e => f(key, e.target.value)} />}
        </div>
      ))}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
        <input type="checkbox" checked={form.completed} onChange={e => f("completed", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        <span style={{ fontSize: 14 }}>Afgewerkt ✓</span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={() => onSave({ ...form, duration: +form.duration || 0, distance: +form.distance || 0, rpe: +form.rpe || 0 })} style={{ flex: 1, padding: 14, fontSize: 15 }}>Opslaan</Btn>
        <Btn onClick={onClose} color="var(--surface2)" textColor="var(--text)" style={{ border: "1px solid var(--border)", padding: 14 }}>Annuleer</Btn>
      </div>
    </>
  );
}

// ── INTEGRATIONS TAB ──────────────────────────────────────────────────────────
function IntegrationsTab({ stravaAuth, onStravaConnect, onStravaSync, syncing, lastSync, calendarEvents, onCalendarImport, importing, onGarminUpload, uploading, trainings }) {
  const stravaCount = trainings.filter(t => t.source === "strava").length;
  const garminCount = trainings.filter(t => t.source === "garmin").length;

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>🔗 Integraties</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Koppel jouw data bronnen</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StravaPanel stravaAuth={stravaAuth} onConnect={onStravaConnect} onSync={onStravaSync} syncing={syncing} lastSync={lastSync} />
        <GarminPanel onUpload={onGarminUpload} uploading={uploading} />
        <CalendarPanel calendarEvents={calendarEvents} onImport={onCalendarImport} importing={importing} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 14 }}>DATA OVERZICHT</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["Strava", stravaCount, "#fc4c02"], ["Garmin", garminCount, "#1db954"], ["Kalender", calendarEvents.length, "#4285f4"]].map(([l, v, c]) => (
            <div key={l} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</p>
              <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 4 }}>{l}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────────
function TodayTab({ trainings, events, stravaAuth, onStravaConnect }) {
  const todayT = trainings.find(t => t.date === TODAY);
  const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s, t) => s + t.duration, 0);
  const done = trainings.filter(t => t.completed && daysUntil(t.date) >= -6 && daysUntil(t.date) <= 0);
  const upcoming = [...events].sort((a, b) => new Date(a.date) - new Date(b.date)).filter(e => daysUntil(e.date) >= 0);
  const daysLeft = daysUntil(RACE_DATE);
  const rvv = events.find(e => e.title.includes("Ronde"));
  const dayName = new Date(TODAY).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ padding: "0 16px 110px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ paddingTop: 58 }}>
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{dayName}</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>Goedemorgen,<br /><span style={{ color: "var(--accent)" }}>Jonas.</span></h1>
      </div>

      {/* Race countdown */}
      <Card style={{ background: "linear-gradient(135deg,#1a1a26,#0a1520)", border: "1px solid rgba(96,200,240,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>DOELRACE</p>
            <p style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>🏆 Ironman Klagenfurt</p>
            <p style={{ color: "var(--accent2)", fontSize: 12, fontFamily: "var(--font-mono)", marginTop: 2 }}>14 juni 2026</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 44, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{daysLeft}</p>
            <p style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>DAGEN</p>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 4 }}>
          {["BASIS", "OPBOUW", "PIEK", "TAPER", "RACE"].map((ph, i) => {
            const colors = ["var(--accent)", "var(--accent2)", "var(--accent3)", "#f0c060", "#f06040"];
            const active = daysLeft > 70 ? 0 : daysLeft > 49 ? 1 : daysLeft > 21 ? 2 : daysLeft > 7 ? 3 : 4;
            return <div key={ph} style={{ flex: 1, height: 4, borderRadius: 2, background: i === active ? colors[i] : colors[i] + "33" }} />;
          })}
        </div>
      </Card>

      {/* Strava banner if not connected */}
      {!stravaAuth && (
        <Card style={{ background: "linear-gradient(135deg,#1a0a0a,#200d0d)", border: "1px solid #fc4c0244", cursor: "pointer" }} onClick={onStravaConnect}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🟠</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>Verbind Strava</p>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>Auto-sync al jouw trainingen</p>
            </div>
            <span style={{ marginLeft: "auto", color: "#fc4c02", fontSize: 18 }}>→</span>
          </div>
        </Card>
      )}

      {/* Today's training */}
      {todayT ? (
        <Card>
          <p style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)", marginBottom: 10 }}>TRAINING VANDAAG</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: DISC_COLOR[todayT.discipline] + "22", border: `1px solid ${DISC_COLOR[todayT.discipline]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{DISC_ICON[todayT.discipline]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontWeight: 700, fontSize: 16 }}>{todayT.type}</p>
                {todayT.source === "strava" && <Badge color="#fc4c02">STRAVA</Badge>}
                {todayT.source === "garmin" && <Badge color="#1db954">GARMIN</Badge>}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>{todayT.duration} min{todayT.distance ? ` · ${todayT.distance}${todayT.discipline === "swim" ? "m" : "km"}` : ""}{todayT.watts ? ` · ${todayT.watts}W` : ""}</p>
            </div>
            <Badge color={todayT.completed ? DISC_COLOR[todayT.discipline] : "var(--muted)"}>{todayT.completed ? "✓ KLAAR" : "GEPLAND"}</Badge>
          </div>
        </Card>
      ) : (
        <Card style={{ textAlign: "center", padding: "20px 16px" }}>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>😴 Geen training gepland vandaag</p>
        </Card>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[["WEEK MIN", load + "'", "var(--accent)"], ["SESSIES", String(done.length), "var(--accent2)"], [rvv ? "RvV" : "EVENTS", rvv ? daysUntil(rvv.date) + "d" : String(upcoming.length), "var(--accent3)"]].map(([l, v, c]) => (
          <Card key={l} style={{ textAlign: "center", padding: "14px 8px" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</p>
            <p style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 4 }}>{l}</p>
          </Card>
        ))}
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <Card>
          <p style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)", marginBottom: 12 }}>AANKOMENDE EVENTS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcoming.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{e.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                <Badge color={e.type === "race" ? "var(--accent3)" : "var(--accent2)"}>{daysUntil(e.date) === 0 ? "VANDAAG" : daysUntil(e.date) + "d"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TRAINING LOG TAB ──────────────────────────────────────────────────────────
function TrainingTab({ trainings, setTrainings }) {
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  function save(form) {
    if (modal.mode === "add") setTrainings(p => [...p, { ...form, id: uid(), source: "manual" }]);
    else setTrainings(p => p.map(t => t.id === modal.item.id ? { ...form, id: t.id } : t));
    setModal(null); setSelected(null);
  }
  function remove(id) { setTrainings(p => p.filter(t => t.id !== id)); setSelected(null); }
  function toggleComplete(id) { setTrainings(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t)); }

  const sorted = [...trainings].filter(t => filter === "all" || t.discipline === filter).sort((a, b) => new Date(b.date) - new Date(a.date));
  const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s, t) => s + t.duration, 0);

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>⚡ Training Log</h2>
        <Btn onClick={() => setModal({ mode: "add" })}>+ Toevoegen</Btn>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 12 }}>DEZE WEEK · {load} min</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 56 }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(TODAY); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) + i);
            const ds = d.toISOString().slice(0, 10);
            const t = trainings.find(t => t.date === ds);
            const h = t ? Math.max(Math.min((t.duration / 150) * 52, 52), 4) : 4;
            const isToday = ds === TODAY;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: h, background: t?.completed ? (DISC_COLOR[t.discipline] || "var(--accent)") : (t ? "var(--surface2)" : "var(--border)"), borderRadius: "3px 3px 2px 2px", border: isToday ? "1px solid var(--accent)" : "none" }} />
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: isToday ? "var(--accent)" : "var(--muted)" }}>{["ma", "di", "wo", "do", "vr", "za", "zo"][i]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {[["all", "Alles"], ["swim", "🏊"], ["bike", "🚴"], ["run", "🏃"], ["rest", "😴"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: filter === v ? "var(--accent)" : "var(--surface2)", color: filter === v ? "#0a0a0f" : "var(--text)", border: `1px solid ${filter === v ? "var(--accent)" : "var(--border)"}`, whiteSpace: "nowrap", flexShrink: 0 }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.length === 0 && <Card style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Geen trainingen gevonden</Card>}
        {sorted.map(t => (
          <Card key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div onClick={() => toggleComplete(t.id)} style={{ width: 42, height: 42, borderRadius: 10, background: DISC_COLOR[t.discipline] + "22", border: `1px solid ${DISC_COLOR[t.discipline]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, cursor: "pointer" }}>
              {t.completed ? DISC_ICON[t.discipline] : "◌"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => setSelected(t)}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{t.type}</p>
                {t.source === "strava" && <Badge color="#fc4c02">S</Badge>}
                {t.source === "garmin" && <Badge color="#1db954">G</Badge>}
              </div>
              <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{fmtDate(t.date)} · {t.duration}min{t.distance ? ` · ${t.distance}${t.discipline === "swim" ? "m" : "km"}` : ""}</p>
              {t.notes && <p style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              <IconBtn onClick={() => setModal({ mode: "edit", item: t })} color="var(--accent2)">✏️</IconBtn>
              <IconBtn onClick={() => remove(t.id)} color="var(--red)">🗑</IconBtn>
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <Modal title={selected.type} onClose={() => setSelected(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 36 }}>{DISC_ICON[selected.discipline]}</span>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{fmtDate(selected.date)}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <Badge color={selected.completed ? DISC_COLOR[selected.discipline] : "var(--muted)"}>{selected.completed ? "✓ AFGEWERKT" : "GEPLAND"}</Badge>
                {selected.source === "strava" && <Badge color="#fc4c02">STRAVA</Badge>}
                {selected.source === "garmin" && <Badge color="#1db954">GARMIN</Badge>}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[["Duur", selected.duration + " min"], ["Afstand", selected.distance ? `${selected.distance}${selected.discipline === "swim" ? "m" : "km"}` : "—"], ["RPE", selected.rpe || "—"], selected.watts ? ["Vermogen", selected.watts + "W"] : null, selected.heartrate ? ["Hartslag", selected.heartrate + "bpm"] : null, selected.elevation ? ["Hoogte", selected.elevation + "m"] : null].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{v}</p>
                <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 2 }}>{l}</p>
              </div>
            ))}
          </div>
          {selected.notes && <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>{selected.notes}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => { setModal({ mode: "edit", item: selected }); setSelected(null); }} color="var(--accent2)" textColor="#0a0a0f" style={{ flex: 1 }}>✏️ Bewerken</Btn>
            <Btn onClick={() => remove(selected.id)} color="var(--red)" textColor="white" style={{ flex: 1 }}>🗑 Verwijderen</Btn>
          </div>
        </Modal>
      )}
      {modal && (
        <Modal title={modal.mode === "add" ? "Training toevoegen" : "Training bewerken"} onClose={() => setModal(null)}>
          <TrainingForm initial={modal.item} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── SCHEMA TAB ────────────────────────────────────────────────────────────────
function SchemaTab({ trainings, setTrainings }) {
  const [modal, setModal] = useState(null);
  const [weekModal, setWeekModal] = useState(null);
  const [gen, setGen] = useState(false);

  function getWeeks() {
    const end = new Date(RACE_DATE), weeks = [], cur = new Date(TODAY);
    const day = cur.getDay(); cur.setDate(cur.getDate() - (day === 0 ? 6 : day - 1));
    while (cur <= end) {
      const s = cur.toISOString().slice(0, 10), e = new Date(cur); e.setDate(e.getDate() + 6);
      const d = Math.ceil((end - cur) / 86400000);
      let phase = "base";
      if (d <= 7) phase = "race"; else if (d <= 21) phase = "taper"; else if (d <= 49) phase = "peak"; else if (d <= 70) phase = "build";
      weeks.push({ start: s, end: e.toISOString().slice(0, 10), phase, daysToRace: d });
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  }

  const WEEKS = getWeeks();
  function getWeekTrainings(w) { return trainings.filter(t => t.date >= w.start && t.date <= w.end).sort((a, b) => new Date(a.date) - new Date(b.date)); }

  async function aiWeek(week) {
    setGen(true);
    try {
      const ph = PHASE[week.phase];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 900, messages: [{ role: "user", content: `Triatleetcoach voor Jonas (38j, Ironman Klagenfurt 14 juni, FTP~300W, HM PB 1:31, zwemmen zwakste). Fase: ${ph.name}, ${week.daysToRace} dagen tot race. Week start ${week.start}. Geef 7 trainingen (ma-zo) als JSON array: [{date:"YYYY-MM-DD",type:"Zwemmen|Fietsen|Lopen|Rust|Kracht",discipline:"swim|bike|run|rest|strength",duration:number,distance:0,rpe:number,notes:"focus beschrijving",completed:false}]. Enkel JSON array.` }] })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      const toAdd = parsed.map(s => ({ ...s, id: uid(), planned: true, source: "ai" }));
      setTrainings(prev => { const filtered = prev.filter(t => !(t.date >= week.start && t.date <= week.end && !t.completed)); return [...filtered, ...toAdd]; });
      setWeekModal(null);
    } catch (e) { console.error(e); }
    finally { setGen(false); }
  }

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>📋 Schema</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Klagenfurt · {daysUntil(RACE_DATE)} dagen</p>
        </div>
        <Btn onClick={() => setModal({ mode: "add" })}>+ Training</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {WEEKS.map(w => {
          const ph = PHASE[w.phase];
          const wt = getWeekTrainings(w);
          const tot = wt.reduce((s, t) => s + t.duration, 0);
          const isNow = daysUntil(w.start) <= 0 && daysUntil(w.end) >= 0;
          const isPast = daysUntil(w.end) < 0;
          return (
            <div key={w.start} style={{ background: isNow ? ph.bg : "var(--surface)", border: isNow ? ph.border : "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", opacity: isPast ? 0.5 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => setWeekModal(w)}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {isNow && <div style={{ width: 6, height: 6, borderRadius: "50%", background: ph.label, animation: "pulse 2s infinite" }} />}
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: ph.label, fontWeight: 600 }}>{ph.name}{isNow ? " · NU" : ""}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{fmtShort(w.start)} – {fmtShort(w.end)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: ph.label }}>{tot > 0 ? tot + "'" : "—"}</p>
                  <p style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>T-{w.daysToRace}d</p>
                </div>
              </div>
              {wt.length > 0 && (
                <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date(w.start); d.setDate(d.getDate() + i);
                    const ds = d.toISOString().slice(0, 10);
                    const t = wt.find(t => t.date === ds);
                    return <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: t ? (DISC_COLOR[t.discipline] + "88") : "var(--border)" }} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {weekModal && (
        <Modal title={`Week ${fmtShort(weekModal.start)} – ${fmtShort(weekModal.end)}`} onClose={() => setWeekModal(null)}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => aiWeek(weekModal)} disabled={gen} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "var(--accent)", color: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {gen ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>AI genereert...</> : "✦ AI Week genereren"}
            </button>
            <button onClick={() => { setModal({ mode: "add", date: weekModal.start }); setWeekModal(null); }} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>+ Manueel</button>
          </div>
          {getWeekTrainings(weekModal).length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>Geen trainingen deze week</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["ma", "di", "wo", "do", "vr", "za", "zo"].map((day, i) => {
                const d = new Date(weekModal.start); d.setDate(d.getDate() + i);
                const ds = d.toISOString().slice(0, 10);
                const t = getWeekTrainings(weekModal).find(t => t.date === ds);
                return (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface2)", borderRadius: 12, border: `1px solid ${t ? DISC_COLOR[t.discipline] + "44" : "var(--border)"}` }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", width: 24 }}>{day}</span>
                    {t ? (<>
                      <span style={{ fontSize: 18 }}>{DISC_ICON[t.discipline]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</p>
                        <p style={{ fontSize: 11, color: "var(--muted)" }}>{t.duration}min{t.notes ? ` · ${t.notes}` : ""}</p>
                      </div>
                      <IconBtn onClick={() => { setModal({ mode: "edit", item: t }); setWeekModal(null); }} color="var(--accent2)">✏️</IconBtn>
                      <IconBtn onClick={() => setTrainings(p => p.filter(x => x.id !== t.id))} color="var(--red)">🗑</IconBtn>
                    </>) : (<p style={{ color: "var(--border)", fontSize: 13, flex: 1 }}>Rust / vrij</p>)}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Btn onClick={() => { setTrainings(p => p.filter(t => !(t.date >= weekModal.start && t.date <= weekModal.end && !t.completed))); setWeekModal(null); }} color="var(--red)" textColor="white" style={{ width: "100%" }}>🗑 Week leegmaken</Btn>
          </div>
        </Modal>
      )}
      {modal && (
        <Modal title={modal.mode === "add" ? "Training toevoegen" : "Training bewerken"} onClose={() => setModal(null)}>
          <TrainingForm initial={modal.item || (modal.date ? { date: modal.date } : null)} onSave={(form) => { if (modal.mode === "add") { setTrainings(p => [...p, { ...form, id: uid(), source: "manual" }]); } else { setTrainings(p => p.map(t => t.id === modal.item.id ? { ...form, id: t.id } : t)); } setModal(null); }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── AGENDA TAB ────────────────────────────────────────────────────────────────
function AgendaTab({ events, setEvents, calendarEvents }) {
  const [modal, setModal] = useState(null);

  function save(form) {
    if (modal.mode === "add") setEvents(p => [...p, { ...form, id: uid() }]);
    else setEvents(p => p.map(e => e.id === modal.item.id ? { ...form, id: e.id } : e));
    setModal(null);
  }

  const allEvents = [...events, ...calendarEvents.map(e => ({ ...e, fromCalendar: true }))].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = allEvents.filter(e => daysUntil(e.date) >= -1);
  const past = allEvents.filter(e => daysUntil(e.date) < -1);

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>📅 Agenda</h2>
        <Btn onClick={() => setModal({ mode: "add" })}>+ Event</Btn>
      </div>
      {upcoming.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 10 }}>AANKOMEND</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {upcoming.map(e => (
              <Card key={e.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</p>
                    {e.fromCalendar && <Badge color="#4285f4">GCal</Badge>}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                <Badge color={e.type === "race" ? "var(--accent3)" : e.type === "work" ? "var(--accent2)" : "var(--muted)"}>{daysUntil(e.date) === 0 ? "VANDAAG" : daysUntil(e.date) + "d"}</Badge>
                {!e.fromCalendar && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <IconBtn onClick={() => setModal({ mode: "edit", item: e })} color="var(--accent2)">✏️</IconBtn>
                    <IconBtn onClick={() => setEvents(p => p.filter(x => x.id !== e.id))} color="var(--red)">🗑</IconBtn>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 10 }}>VOORBIJ</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {past.map(e => (
              <Card key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.4 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                {!e.fromCalendar && <IconBtn onClick={() => setEvents(p => p.filter(x => x.id !== e.id))} color="var(--red)">🗑</IconBtn>}
              </Card>
            ))}
          </div>
        </>
      )}
      {modal && (
        <Modal title={modal.mode === "add" ? "Event toevoegen" : "Event bewerken"} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[["Datum", "date", "date"], ["Titel", "title", "text"], ["Type", "type", "select", ["race", "work", "personal", "medical", "family"]]].map(([label, key, type, opts]) => (
              <div key={key}>
                <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 5 }}>{label.toUpperCase()}</p>
                {type === "select" ? <select value={modal.item?.[key] || opts[0]} onChange={e => setModal(p => ({ ...p, item: { ...p.item, [key]: e.target.value } }))}>{opts.map(o => <option key={o}>{o}</option>)}</select>
                  : <input type={type} value={modal.item?.[key] || (type === "date" ? TODAY : "")} onChange={e => setModal(p => ({ ...p, item: { ...p.item, [key]: e.target.value } }))} />}
              </div>
            ))}
            <Btn onClick={() => save({ icon: "📌", ...modal.item })} style={{ padding: 14 }}>Opslaan</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── NUTRITION TAB ─────────────────────────────────────────────────────────────
function NutritionTab({ trainings }) {
  const [log, setLog] = useStorage("ic_nutrition", []);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: TODAY, meal: "Ontbijt", carbs: "", protein: "", fat: "", kcal: "", notes: "" });
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loading, setLoading] = useState(false);

  const todayLog = log.filter(l => l.date === TODAY);
  const todayKcal = todayLog.reduce((s, l) => s + (+l.kcal || 0), 0);
  const todayCarbs = todayLog.reduce((s, l) => s + (+l.carbs || 0), 0);
  const todayProtein = todayLog.reduce((s, l) => s + (+l.protein || 0), 0);

  const todayTraining = trainings.find(t => t.date === TODAY && t.completed);
  const weekLoad = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s, t) => s + t.duration, 0);
  const targetKcal = todayTraining ? (weekLoad > 400 ? 3200 : 2800) : 2400;
  const targetCarbs = todayTraining ? (todayTraining.duration > 90 ? 400 : 300) : 220;

  function saveEntry() {
    setLog(p => [...p, { ...form, id: uid(), carbs: +form.carbs || 0, protein: +form.protein || 0, fat: +form.fat || 0, kcal: +form.kcal || 0 }]);
    setModal(false);
    setForm({ date: TODAY, meal: "Ontbijt", carbs: "", protein: "", fat: "", kcal: "", notes: "" });
  }

  async function getAiAdvice() {
    setLoading(true); setAiAdvice(null);
    const recent = trainings.filter(t => t.completed).slice(-3);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 600,
          messages: [{
            role: "user", content: `Voedingscoach voor Jonas (38j, 79kg → doel 74kg, Ironman Klagenfurt 14 juni).
Vandaag: ${todayKcal} kcal, ${todayCarbs}g KH, ${todayProtein}g eiwit.
Training vandaag: ${todayTraining ? `${todayTraining.type} ${todayTraining.duration}min` : "geen"}.
Weekbelasting: ${weekLoad} min.
Recente trainingen: ${recent.map(t => `${t.type} ${t.duration}min`).join(", ")}.
Shake-basis voeding (Plenny Shake + whey).
Geef CONCREET voedingsadvies voor REST van de dag in 3-4 korte bullets in het Nederlands. Focus op timing, hoeveelheden, race-voeding (90g KH/uur doel).`
          }]
        })
      });
      const data = await res.json();
      setAiAdvice(data.content?.map(b => b.text || "").join("") || "");
    } catch { setAiAdvice("Verbinding mislukt."); }
    finally { setLoading(false); }
  }

  const pct = (v, t) => Math.min(Math.round((v / t) * 100), 100);

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>🥗 Voeding</h2>
        <Btn onClick={() => setModal(true)}>+ Log</Btn>
      </div>

      {/* Today summary */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 14 }}>VANDAAG · {fmtDate(TODAY)}</p>
        {[["Calorieën", todayKcal, targetKcal, "kcal", "var(--accent)"], ["Koolhydraten", todayCarbs, targetCarbs, "g", "var(--accent2)"], ["Eiwit", todayProtein, 155, "g", "var(--accent3)"]].map(([l, v, t, u, c]) => (
          <div key={l} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{v} / {t}{u}</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
              <div style={{ height: "100%", width: pct(v, t) + "%", background: c, borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
        {todayTraining && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{DISC_ICON[todayTraining.discipline]}</span>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Training dag — hogere koolhydraten nodig</p>
          </div>
        )}
      </Card>

      {/* AI advice button */}
      <button onClick={getAiAdvice} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: loading ? "var(--surface2)" : "linear-gradient(135deg,#c8f06088,#60c8f088)", color: loading ? "var(--muted)" : "var(--text)", border: "1px solid var(--border)", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>Analyse...</> : "✦ AI Voedingsadvies"}
      </button>

      {aiAdvice && (
        <Card style={{ marginBottom: 14, background: "linear-gradient(180deg,#12121a,#0d0d18)" }} className="fade-up">
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 10 }}>AI ADVIES</p>
          {aiAdvice.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", marginBottom: 4 }}
              dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>') }} />
          ))}
        </Card>
      )}

      {/* Today's log */}
      {todayLog.length > 0 && (
        <Card>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 12 }}>MAALTIJDEN VANDAAG</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayLog.map(l => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface2)", borderRadius: 10 }}>
                <span style={{ fontSize: 16 }}>{l.meal === "Ontbijt" ? "🌅" : l.meal === "Lunch" ? "☀️" : l.meal === "Avondeten" ? "🌙" : "🍎"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{l.meal}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{l.kcal}kcal · {l.carbs}g KH · {l.protein}g eiwit</p>
                </div>
                <IconBtn onClick={() => setLog(p => p.filter(x => x.id !== l.id))} color="var(--red)">🗑</IconBtn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal && (
        <Modal title="Maaltijd loggen" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 5 }}>MAALTIJD</p>
              <select value={form.meal} onChange={e => setForm(p => ({ ...p, meal: e.target.value }))}>
                {["Ontbijt", "Lunch", "Avondeten", "Snack", "Pre-training", "Post-training", "Race nutrition"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Calorieën (kcal)", "kcal"], ["Koolhydraten (g)", "carbs"], ["Eiwit (g)", "protein"], ["Vet (g)", "fat"]].map(([l, k]) => (
                <div key={k}>
                  <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 5 }}>{l.toUpperCase()}</p>
                  <input type="number" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 5 }}>NOTITIES</p>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="bv. Plenny Shake + banaan" />
            </div>
            <Btn onClick={saveEntry} style={{ padding: 14, fontSize: 15 }}>Opslaan</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── AI BRIEF TAB ──────────────────────────────────────────────────────────────
function BriefTab({ trainings, events, calendarEvents }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState("general");

  async function generate() {
    setLoading(true); setBrief(null);
    const recent = trainings.filter(t => t.completed).slice(-5);
    const upcoming = [...events, ...calendarEvents].filter(e => daysUntil(e.date) >= 0).slice(0, 5);
    const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s, t) => s + t.duration, 0);
    const prompt = `Je bent de personal coach van Jonas, 38j triatleet, Ironman Klagenfurt 14 juni (${daysUntil(RACE_DATE)} dagen). FTP ~300W (doel 350W), gewicht ~79kg (doel 74-75kg), HM PB 1:31:59, zwemmen zwakste ~1:36/100m. Nieuwe job als F&B Manager voco Gent start 20 april.

Recente trainingen:
${recent.map(t => `- ${t.date}: ${t.type} ${t.duration}min RPE${t.rpe} "${t.notes}"`).join('\n') || "geen data"}

Weekbelasting: ${load} min
Events: ${upcoming.map(e => `${e.title} (${daysUntil(e.date)}d)`).join(', ') || "geen"}
Focus: ${focus}

Schrijf directe coach-briefing in NEDERLANDS:
**Status** – hoe staat Jonas ervoor (2-3 zinnen)
**Vandaag** – concreet advies training + timing
**Voeding & herstel** – 2-3 specifieke adviezen
**Opgelet** – 1-2 risico's
**Drive** – 1 motiverende zin`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      setBrief(data.content?.map(b => b.text || "").join("") || "");
    } catch { setBrief("Verbinding mislukt. Probeer opnieuw."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: "56px 16px 110px" }} className="fade-up">
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>✦ AI Briefing</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>Dagelijks gepersonaliseerd coachadvies</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[["general", "🌅 Algemeen"], ["training", "⚡ Training"], ["nutrition", "🥗 Voeding"], ["sleep", "😴 Herstel"]].map(([id, label]) => (
          <button key={id} onClick={() => setFocus(id)} style={{ padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: focus === id ? "var(--accent)" : "var(--surface)", color: focus === id ? "#0a0a0f" : "var(--text)", border: `1px solid ${focus === id ? "var(--accent)" : "var(--border)"}`, transition: "all 0.2s" }}>{label}</button>
        ))}
      </div>
      <button onClick={generate} disabled={loading} style={{ width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 700, background: loading ? "var(--surface2)" : "linear-gradient(135deg,#c8f060,#60c8f0)", color: loading ? "var(--muted)" : "#0a0a0f", border: "none", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>Analyse bezig...</> : "Genereer mijn briefing"}
      </button>
      {brief && (
        <Card style={{ background: "linear-gradient(180deg,#12121a,#0d0d18)" }} className="fade-up">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p>
              <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>Klagenfurt T–{daysUntil(RACE_DATE)}</p>
            </div>
            <span style={{ fontSize: 22 }}>✦</span>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {brief.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
              const html = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>');
              const isHeader = /^\*\*/.test(line);
              return <p key={i} style={{ fontSize: isHeader ? 15 : 14, fontWeight: isHeader ? 700 : 400, lineHeight: 1.65, marginTop: isHeader ? 14 : 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
            })}
          </div>
        </Card>
      )}
      {!brief && !loading && (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✦</p>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Jouw persoonlijke coach</p>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>Kies een focus en genereer je dagelijkse briefing op basis van al jouw data.</p>
        </Card>
      )}
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [trainings, setTrainings] = useStorage("ic_trainings", DEFAULT_TRAININGS);
  const [events, setEvents] = useStorage("ic_events", DEFAULT_EVENTS);
  const [calendarEvents, setCalendarEvents] = useStorage("ic_calendar", []);
  const [stravaAuth, setStravaAuth] = useStorage("ic_strava", null);
  const [lastSync, setLastSync] = useStorage("ic_last_sync", null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  // ── Handle Strava OAuth callback ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeCode(code).then(data => {
        if (data.access_token) {
          setStravaAuth(data);
          syncStrava(data.access_token);
        }
      });
    }
  }, []);

  // ── Auto-refresh token if expired ──
  useEffect(() => {
    if (!stravaAuth) return;
    const expired = stravaAuth.expires_at && Date.now() / 1000 > stravaAuth.expires_at - 300;
    if (expired && stravaAuth.refresh_token) {
      refreshToken(stravaAuth.refresh_token).then(data => {
        if (data.access_token) setStravaAuth(prev => ({ ...prev, ...data }));
      });
    }
  }, [stravaAuth]);

  async function syncStrava(token) {
    const t = token || stravaAuth?.access_token;
    if (!t) return;
    setSyncing(true);
    try {
      const acts = await fetchStravaActivities(t);
      if (Array.isArray(acts)) {
        const converted = acts.map(stravaToTraining);
        setTrainings(prev => {
          const nonStrava = prev.filter(t => t.source !== "strava");
          return [...nonStrava, ...converted];
        });
        setLastSync(Date.now());
      }
    } catch (e) { console.error(e); }
    finally { setSyncing(false); }
  }

  function handleStravaConnect() {
    window.location.href = stravaAuthUrl();
  }

  function handleGarminUpload(file, buffer) {
    setUploading(true);
    try {
      const training = parseFitFile(buffer);
      training.notes = `${file.name} — ${training.notes}`;
      setTrainings(prev => [...prev, training]);
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function handleCalendarImport(url) {
    setImporting(true);
    try {
      // In production: proxy via serverless function to avoid CORS
      // For now store the URL and show a note
      setCalendarEvents([{
        id: uid(), date: TODAY, title: "Google Calendar gekoppeld", type: "personal", icon: "📅",
        notes: url
      }]);
    } catch (e) { console.error(e); }
    finally { setImporting(false); }
  }

  const sharedProps = { trainings, events, stravaAuth, calendarEvents };

  const pages = {
    today: <TodayTab {...sharedProps} onStravaConnect={handleStravaConnect} />,
    schema: <SchemaTab trainings={trainings} setTrainings={setTrainings} />,
    training: <TrainingTab trainings={trainings} setTrainings={setTrainings} />,
    agenda: <AgendaTab events={events} setEvents={setEvents} calendarEvents={calendarEvents} />,
    nutrition: <NutritionTab trainings={trainings} />,
    brief: <BriefTab trainings={trainings} events={events} calendarEvents={calendarEvents} />,
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", position: "relative", overflowX: "hidden" }}>
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 50, background: "rgba(10,10,15,0.93)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 17 }}>🏊🚴🏃</span>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>Iron<span style={{ color: "var(--accent)" }}>Coach</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stravaAuth && (
            <button onClick={() => syncStrava()} style={{ background: "none", border: "none", color: syncing ? "var(--muted)" : "#fc4c02", fontSize: 14, padding: "4px 8px" }}>
              <span style={{ display: "inline-block", animation: syncing ? "spin 1s linear infinite" : "none" }}>⟳</span>
            </button>
          )}
          <button onClick={() => setTab("integrations")} style={{ background: "none", border: "none", color: tab === "integrations" ? "var(--accent)" : "var(--muted)", fontSize: 14, padding: "4px 8px" }}>🔗</button>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>@theroadtoiron</span>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: stravaAuth ? "#fc4c02" : "var(--accent)", animation: "pulse 2s infinite" }} />
        </div>
      </div>

      <div key={tab} className="fade-up">
        {tab === "integrations"
          ? <IntegrationsTab stravaAuth={stravaAuth} onStravaConnect={handleStravaConnect} onStravaSync={() => syncStrava()} syncing={syncing} lastSync={lastSync} calendarEvents={calendarEvents} onCalendarImport={handleCalendarImport} importing={importing} onGarminUpload={handleGarminUpload} uploading={uploading} trainings={trainings} />
          : pages[tab]}
      </div>

      <Nav tab={tab} setTab={setTab} />
    </div>
  );
}
