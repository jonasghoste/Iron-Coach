// @ts-nocheck
import { useState, useEffect } from "react";

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
    --red: #f06060;
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

const TODAY = new Date().toISOString().slice(0,10);
const RACE_DATE = "2026-06-14";

const DISC_COLOR = { swim:"#60c8f0", bike:"#c8f060", run:"#f060a0", rest:"#6a6a8a", strength:"#f0a060", race:"#f06040" };
const DISC_ICON = { swim:"🏊", bike:"🚴", run:"🏃", rest:"😴", strength:"💪", race:"🏆" };
const PHASE = {
  base:  { bg:"#1a2610", border:"#c8f06044", label:"var(--accent)",  name:"BASIS" },
  build: { bg:"#10201a", border:"#60c8f044", label:"var(--accent2)", name:"OPBOUW" },
  peak:  { bg:"#200a18", border:"#f060a044", label:"var(--accent3)", name:"PIEK" },
  taper: { bg:"#1a1a10", border:"#f0c06044", label:"#f0c060",        name:"TAPER" },
  race:  { bg:"#200a0a", border:"#f0604044", label:"#f06040",        name:"RACE" },
};

const DEFAULT_TRAININGS = [
  {id:"t1", date:"2026-03-28", type:"Zwemmen", discipline:"swim", duration:65, distance:3200, rpe:6, notes:"1:36/100m gemiddeld", completed:true},
  {id:"t2", date:"2026-03-29", type:"Fietsen", discipline:"bike", duration:120, distance:72, rpe:7, notes:"Intervaltraining, FTP ~295W", completed:true},
  {id:"t3", date:"2026-03-30", type:"Lopen",   discipline:"run",  duration:55, distance:12, rpe:6, notes:"Herstelloop", completed:true},
];

const DEFAULT_EVENTS = [
  {id:"e1", date:"2026-04-06", title:"Amateur Ronde van Vlaanderen", type:"race", icon:"🚴"},
  {id:"e2", date:"2026-05-03", title:"Kortrijk Halve Marathon",      type:"race", icon:"🏃"},
  {id:"e3", date:"2026-06-14", title:"Ironman Klagenfurt",           type:"race", icon:"🏆"},
  {id:"e4", date:"2026-04-20", title:"Start voco Gent",              type:"work", icon:"🏨"},
];

function daysUntil(d) { return Math.ceil((new Date(d) - new Date(TODAY)) / 86400000); }
function fmtDate(d) { return new Date(d).toLocaleDateString("nl-BE", {weekday:"short", day:"numeric", month:"short"}); }
function fmtShort(d) { return new Date(d).toLocaleDateString("nl-BE", {day:"numeric", month:"short"}); }
function uid() { return Math.random().toString(36).slice(2,9); }

function useStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

// ── Shared UI ────────────────────────────────────────────────────────────────
function Card({ children, style:s={}, onClick }) {
  return <div onClick={onClick} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:16, cursor:onClick?"pointer":"default", ...s }}>{children}</div>;
}
function Badge({ color, children }) {
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontFamily:"var(--font-mono)", fontWeight:500 }}>{children}</span>;
}
function Btn({ children, onClick, color="var(--accent)", textColor="#0a0a0f", style:s={} }) {
  return <button onClick={onClick} style={{ background:color, color:textColor, fontWeight:700, borderRadius:12, padding:"10px 16px", fontSize:13, ...s }}>{children}</button>;
}
function IconBtn({ children, onClick, color="var(--muted)" }) {
  return <button onClick={onClick} style={{ background:"var(--surface2)", border:`1px solid var(--border)`, color, borderRadius:8, padding:"6px 10px", fontSize:13 }}>{children}</button>;
}

function Nav({ tab, setTab }) {
  return <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(10,10,15,0.97)", backdropFilter:"blur(20px)", borderTop:"1px solid var(--border)", display:"flex", zIndex:100 }}>
    {[["today","◉","Vandaag"],["schema","📋","Schema"],["training","⚡","Log"],["agenda","📅","Agenda"],["brief","✦","AI Brief"]].map(([id,icon,label]) => (
      <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"11px 4px 9px", background:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:tab===id?"var(--accent)":"var(--muted)", transition:"color 0.2s" }}>
        <span style={{ fontSize:17 }}>{icon}</span>
        <span style={{ fontSize:9, fontFamily:"var(--font-mono)" }}>{label}</span>
      </button>
    ))}
  </nav>;
}

// ── FORM MODAL ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", zIndex:300 }} onClick={onClose} className="fade-in">
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"20px 20px 0 0", border:"1px solid var(--border)", padding:24, width:"100%", maxHeight:"85vh", overflowY:"auto" }} className="fade-up">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ fontSize:18, fontWeight:800 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:8, padding:"6px 10px", fontSize:16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TrainingForm({ initial, onSave, onClose }) {
  const blank = { date:TODAY, type:"Fietsen", discipline:"bike", duration:"", distance:"", rpe:"6", notes:"", completed:false };
  const [form, setForm] = useState(initial || blank);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      {[
        ["Datum","date","date"],
        ["Type","type","select",["Zwemmen","Fietsen","Lopen","Rust","Kracht","Zwemmen open water","Brick"]],
        ["Discipline","discipline","select",["swim","bike","run","rest","strength"]],
        ["Duur (min)","duration","number"],
        ["Afstand (km of m)","distance","number"],
        ["RPE (1–10)","rpe","number"],
        ["Notities","notes","textarea"],
      ].map(([label, key, type, opts]) => (
        <div key={key} style={{ marginBottom:12 }}>
          <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>{label.toUpperCase()}</p>
          {type==="select" ? (
            <select value={form[key]} onChange={e => f(key, e.target.value)}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : type==="textarea" ? (
            <textarea value={form[key]} onChange={e => f(key, e.target.value)} placeholder="Optionele notities..." />
          ) : (
            <input type={type} value={form[key]} onChange={e => f(key, e.target.value)} />
          )}
        </div>
      ))}
      <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:16 }}>
        <input type="checkbox" checked={form.completed} onChange={e => f("completed", e.target.checked)} style={{ width:18, height:18, accentColor:"var(--accent)" }} />
        <span style={{ fontSize:14 }}>Afgewerkt ✓</span>
      </label>
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={() => onSave({ ...form, duration:+form.duration||0, distance:+form.distance||0, rpe:+form.rpe||0 })} style={{ flex:1, padding:14, fontSize:15 }}>Opslaan</Btn>
        <Btn onClick={onClose} color="var(--surface2)" textColor="var(--text)" style={{ border:"1px solid var(--border)", padding:14 }}>Annuleer</Btn>
      </div>
    </>
  );
}

function EventForm({ initial, onSave, onClose }) {
  const blank = { date:TODAY, title:"", type:"work", icon:"📌" };
  const [form, setForm] = useState(initial || blank);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const icons = ["📌","🚴","🏃","🏊","🏆","🏨","💼","🎉","✈️","🏥","👨‍👩‍👧","🎯"];

  return (
    <>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>DATUM</p>
        <input type="date" value={form.date} onChange={e => f("date", e.target.value)} />
      </div>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>TITEL</p>
        <input type="text" value={form.title} onChange={e => f("title", e.target.value)} placeholder="bv. Doktersafspraak" />
      </div>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>TYPE</p>
        <select value={form.type} onChange={e => f("type", e.target.value)}>
          <option value="race">Wedstrijd</option>
          <option value="work">Werk</option>
          <option value="personal">Persoonlijk</option>
          <option value="medical">Medisch</option>
          <option value="family">Familie</option>
        </select>
      </div>
      <div style={{ marginBottom:16 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:8 }}>ICOON</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {icons.map(ic => (
            <button key={ic} onClick={() => f("icon", ic)} style={{ fontSize:20, padding:"6px 10px", borderRadius:8, background:form.icon===ic?"var(--accent)22":"var(--surface2)", border:`1px solid ${form.icon===ic?"var(--accent)":"var(--border)"}` }}>{ic}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={() => form.title && form.date && onSave(form)} style={{ flex:1, padding:14, fontSize:15 }}>Opslaan</Btn>
        <Btn onClick={onClose} color="var(--surface2)" textColor="var(--text)" style={{ border:"1px solid var(--border)", padding:14 }}>Annuleer</Btn>
      </div>
    </>
  );
}

// ── TODAY TAB ────────────────────────────────────────────────────────────────
function TodayTab({ trainings, events }) {
  const todayT = trainings.find(t => t.date === TODAY);
  const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s,t) => s+t.duration, 0);
  const done = trainings.filter(t => t.completed && daysUntil(t.date) >= -6 && daysUntil(t.date) <= 0);
  const upcoming = [...events].sort((a,b) => new Date(a.date)-new Date(b.date)).filter(e => daysUntil(e.date) >= 0);
  const daysLeft = daysUntil(RACE_DATE);
  const rvv = events.find(e => e.title.includes("Ronde"));
  const dayName = new Date(TODAY).toLocaleDateString("nl-BE", {weekday:"long", day:"numeric", month:"long", year:"numeric"});

  return (
    <div style={{ padding:"0 16px 110px", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ paddingTop:58 }}>
        <p style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase" }}>{dayName}</p>
        <h1 style={{ fontSize:28, fontWeight:800, lineHeight:1.1, marginTop:4 }}>Goedemorgen,<br/><span style={{ color:"var(--accent)" }}>Jonas.</span></h1>
      </div>

      <Card style={{ background:"linear-gradient(135deg,#1a1a26,#0a1520)", border:"1px solid rgba(96,200,240,0.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)" }}>DOELRACE</p>
            <p style={{ fontSize:16, fontWeight:700, marginTop:4 }}>🏆 Ironman Klagenfurt</p>
            <p style={{ color:"var(--accent2)", fontSize:12, fontFamily:"var(--font-mono)", marginTop:2 }}>14 juni 2026</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:44, fontWeight:800, color:"var(--accent)", lineHeight:1 }}>{daysLeft}</p>
            <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)" }}>DAGEN</p>
          </div>
        </div>
        <div style={{ marginTop:14, display:"flex", gap:4 }}>
          {["BASIS","OPBOUW","PIEK","TAPER","RACE"].map((ph,i) => {
            const colors = ["var(--accent)","var(--accent2)","var(--accent3)","#f0c060","#f06040"];
            const active = daysLeft > 70 ? 0 : daysLeft > 49 ? 1 : daysLeft > 21 ? 2 : daysLeft > 7 ? 3 : 4;
            return <div key={ph} style={{ flex:1, height:4, borderRadius:2, background: i===active ? colors[i] : colors[i]+"33" }} />;
          })}
        </div>
      </Card>

      {todayT ? (
        <Card>
          <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)", marginBottom:10 }}>TRAINING VANDAAG</p>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:DISC_COLOR[todayT.discipline]+"22", border:`1px solid ${DISC_COLOR[todayT.discipline]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{DISC_ICON[todayT.discipline]}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:700, fontSize:16 }}>{todayT.type}</p>
              <p style={{ color:"var(--muted)", fontSize:12, fontFamily:"var(--font-mono)" }}>{todayT.duration} min{todayT.distance ? ` · ${todayT.distance}${todayT.discipline==="swim"?"m":"km"}` : ""}</p>
            </div>
            <Badge color={todayT.completed ? DISC_COLOR[todayT.discipline] : "var(--muted)"}>{todayT.completed ? "✓ KLAAR" : "GEPLAND"}</Badge>
          </div>
        </Card>
      ) : (
        <Card style={{ textAlign:"center", padding:"20px 16px" }}>
          <p style={{ color:"var(--muted)", fontSize:14 }}>😴 Geen training gepland vandaag</p>
        </Card>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[
          ["WEEK MIN", load+"'", "var(--accent)"],
          ["SESSIES",  String(done.length), "var(--accent2)"],
          [rvv ? "RvV" : "EVENTS", rvv ? daysUntil(rvv.date)+"d" : String(upcoming.length), "var(--accent3)"],
        ].map(([l,v,c]) => (
          <Card key={l} style={{ textAlign:"center", padding:"14px 8px" }}>
            <p style={{ fontSize:22, fontWeight:800, color:c }}>{v}</p>
            <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--muted)", marginTop:4 }}>{l}</p>
          </Card>
        ))}
      </div>

      {upcoming.length > 0 && (
        <Card>
          <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)", marginBottom:12 }}>AANKOMENDE EVENTS</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {upcoming.slice(0,5).map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18, width:28, textAlign:"center" }}>{e.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600 }}>{e.title}</p>
                  <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                <Badge color={e.type==="race" ? "var(--accent3)" : "var(--accent2)"}>{daysUntil(e.date)===0?"VANDAAG":daysUntil(e.date)+"d"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TRAINING LOG ─────────────────────────────────────────────────────────────
function TrainingTab({ trainings, setTrainings }) {
  const [modal, setModal] = useState(null); // null | {mode:'add'|'edit', item?}
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  function save(form) {
    if (modal.mode === "add") {
      setTrainings(p => [...p, { ...form, id: uid() }]);
    } else {
      setTrainings(p => p.map(t => t.id === modal.item.id ? { ...form, id: t.id } : t));
    }
    setModal(null);
    setSelected(null);
  }

  function remove(id) {
    setTrainings(p => p.filter(t => t.id !== id));
    setSelected(null);
  }

  function toggleComplete(id) {
    setTrainings(p => p.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  const sorted = [...trainings]
    .filter(t => filter === "all" || t.discipline === filter)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s,t) => s+t.duration, 0);

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ fontSize:24, fontWeight:800 }}>⚡ Training Log</h2>
        <Btn onClick={() => setModal({ mode:"add" })}>+ Toevoegen</Btn>
      </div>

      {/* Week bar */}
      <Card style={{ marginBottom:14 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:12 }}>DEZE WEEK · {load} min</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:56 }}>
          {Array.from({length:7}).map((_,i) => {
            const d = new Date(TODAY); d.setDate(d.getDate() - d.getDay() + (d.getDay()===0?-6:1) + i);
            const ds = d.toISOString().slice(0,10);
            const t = trainings.find(t => t.date === ds);
            const h = t ? Math.max(Math.min((t.duration/150)*52,52),4) : 4;
            const isToday = ds === TODAY;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", height:h, background:t?.completed?(DISC_COLOR[t.discipline]||"var(--accent)"):(t?"var(--surface2)":"var(--border)"), borderRadius:"3px 3px 2px 2px", border:isToday?"1px solid var(--accent)":"none" }} />
                <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:isToday?"var(--accent)":"var(--muted)" }}>{["ma","di","wo","do","vr","za","zo"][i]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filter */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {[["all","Alles"],["swim","🏊"],["bike","🚴"],["run","🏃"],["rest","😴"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, background:filter===v?"var(--accent)":"var(--surface2)", color:filter===v?"#0a0a0f":"var(--text)", border:`1px solid ${filter===v?"var(--accent)":"var(--border)"}`, whiteSpace:"nowrap", flexShrink:0 }}>{l}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.length === 0 && <Card style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Geen trainingen gevonden</Card>}
        {sorted.map(t => (
          <Card key={t.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div onClick={() => toggleComplete(t.id)} style={{ width:42, height:42, borderRadius:10, background:DISC_COLOR[t.discipline]+"22", border:`1px solid ${DISC_COLOR[t.discipline]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, cursor:"pointer" }}>
              {t.completed ? DISC_ICON[t.discipline] : "◌"}
            </div>
            <div style={{ flex:1, minWidth:0 }} onClick={() => setSelected(t)}>
              <p style={{ fontWeight:600, fontSize:14 }}>{t.type}</p>
              <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(t.date)} · {t.duration}min{t.distance?` · ${t.distance}${t.discipline==="swim"?"m":"km"}`:""}</p>
              {t.notes && <p style={{ fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.notes}</p>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
              <IconBtn onClick={() => setModal({ mode:"edit", item:t })} color="var(--accent2)">✏️</IconBtn>
              <IconBtn onClick={() => remove(t.id)} color="var(--red)">🗑</IconBtn>
            </div>
          </Card>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal title={selected.type} onClose={() => setSelected(null)}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <span style={{ fontSize:36 }}>{DISC_ICON[selected.discipline]}</span>
            <div>
              <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--muted)" }}>{fmtDate(selected.date)}</p>
              <Badge color={selected.completed ? DISC_COLOR[selected.discipline] : "var(--muted)"}>{selected.completed?"✓ AFGEWERKT":"GEPLAND"}</Badge>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[["Duur", selected.duration+" min"], ["Afstand", selected.distance?`${selected.distance}${selected.discipline==="swim"?"m":"km"}`:"—"], ["RPE", selected.rpe||"—"]].map(([l,v]) => (
              <div key={l} style={{ background:"var(--surface2)", borderRadius:10, padding:12, textAlign:"center" }}>
                <p style={{ fontSize:16, fontWeight:700, color:"var(--accent)" }}>{v}</p>
                <p style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)", marginTop:2 }}>{l}</p>
              </div>
            ))}
          </div>
          {selected.notes && <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.6, marginBottom:16 }}>{selected.notes}</p>}
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={() => { setModal({ mode:"edit", item:selected }); setSelected(null); }} color="var(--accent2)" textColor="#0a0a0f" style={{ flex:1 }}>✏️ Bewerken</Btn>
            <Btn onClick={() => remove(selected.id)} color="var(--red)" textColor="white" style={{ flex:1 }}>🗑 Verwijderen</Btn>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={modal.mode==="add" ? "Training toevoegen" : "Training bewerken"} onClose={() => setModal(null)}>
          <TrainingForm initial={modal.item} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── SCHEMA TAB ───────────────────────────────────────────────────────────────
function SchemaTab({ trainings, setTrainings }) {
  const [modal, setModal] = useState(null);
  const [weekModal, setWeekModal] = useState(null);
  const [gen, setGen] = useState(false);

  function getWeeks() {
    const end = new Date(RACE_DATE), weeks = [], cur = new Date(TODAY);
    const day = cur.getDay(); cur.setDate(cur.getDate() - (day===0?6:day-1));
    while (cur <= end) {
      const s = cur.toISOString().slice(0,10), e = new Date(cur); e.setDate(e.getDate()+6);
      const d = Math.ceil((end - cur) / 86400000);
      let phase = "base";
      if (d<=7) phase="race"; else if (d<=21) phase="taper"; else if (d<=49) phase="peak"; else if (d<=70) phase="build";
      weeks.push({ start:s, end:e.toISOString().slice(0,10), phase, daysToRace:d });
      cur.setDate(cur.getDate()+7);
    }
    return weeks;
  }
  const WEEKS = getWeeks();

  function getWeekTrainings(w) {
    return trainings.filter(t => t.date >= w.start && t.date <= w.end).sort((a,b) => new Date(a.date)-new Date(b.date));
  }

  async function aiWeek(week) {
    setGen(true);
    try {
      const ph = PHASE[week.phase];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:900, messages:[{role:"user",content:`Triatleetcoach voor Jonas (38j, Ironman Klagenfurt 14 juni, FTP~300W, HM PB 1:31, zwemmen zwakste). Fase: ${ph.name}, ${week.daysToRace} dagen tot race. Week start ${week.start}. Geef 7 trainingen (ma-zo) als JSON array: [{date:"YYYY-MM-DD",type:"Zwemmen|Fietsen|Lopen|Rust|Kracht",discipline:"swim|bike|run|rest|strength",duration:number,distance:0,rpe:number,notes:"focus beschrijving",completed:false}]. Enkel JSON array.`}]})
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text||"").join("").replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(text);
      const toAdd = parsed.map(s => ({ ...s, id: uid(), planned: true }));
      setTrainings(prev => {
        const filtered = prev.filter(t => !(t.date >= week.start && t.date <= week.end && !t.completed));
        return [...filtered, ...toAdd];
      });
      setWeekModal(null);
    } catch(e) { console.error(e); }
    finally { setGen(false); }
  }

  function removeWeek(week) {
    setTrainings(p => p.filter(t => !(t.date >= week.start && t.date <= week.end && !t.completed)));
    setWeekModal(null);
  }

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:24, fontWeight:800 }}>📋 Schema</h2>
          <p style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>Klagenfurt · {daysUntil(RACE_DATE)} dagen</p>
        </div>
        <Btn onClick={() => setModal({ mode:"add" })}>+ Training</Btn>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {WEEKS.map(w => {
          const ph = PHASE[w.phase];
          const wt = getWeekTrainings(w);
          const tot = wt.reduce((s,t) => s+t.duration, 0);
          const isNow = daysUntil(w.start) <= 0 && daysUntil(w.end) >= 0;
          const isPast = daysUntil(w.end) < 0;

          return (
            <div key={w.start} style={{ background:isNow?ph.bg:"var(--surface)", border:isNow?ph.border:"1px solid var(--border)", borderRadius:14, padding:"14px 16px", opacity:isPast?0.5:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }} onClick={() => setWeekModal(w)}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    {isNow && <div style={{ width:6, height:6, borderRadius:"50%", background:ph.label, animation:"pulse 2s infinite" }} />}
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:ph.label, fontWeight:600 }}>{ph.name}{isNow?" · NU":""}</span>
                  </div>
                  <p style={{ fontSize:14, fontWeight:700 }}>{fmtShort(w.start)} – {fmtShort(w.end)}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:16, fontWeight:800, color:ph.label }}>{tot>0?tot+"'":"—"}</p>
                  <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>T-{w.daysToRace}d</p>
                </div>
              </div>
              {/* Day strip */}
              {wt.length > 0 && (
                <div style={{ display:"flex", gap:3, marginTop:10 }}>
                  {Array.from({length:7}).map((_,i) => {
                    const d = new Date(w.start); d.setDate(d.getDate()+i);
                    const ds = d.toISOString().slice(0,10);
                    const t = wt.find(t => t.date===ds);
                    return <div key={i} style={{ flex:1, height:4, borderRadius:2, background:t?(DISC_COLOR[t.discipline]+"88"):"var(--border)" }} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Week detail modal */}
      {weekModal && (
        <Modal title={`Week ${fmtShort(weekModal.start)} – ${fmtShort(weekModal.end)}`} onClose={() => setWeekModal(null)}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => aiWeek(weekModal)} disabled={gen} style={{ flex:1, padding:"10px", borderRadius:12, fontSize:13, fontWeight:700, background:"var(--accent)", color:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              {gen ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>◌</span>AI genereert...</> : "✦ AI Week genereren"}
            </button>
            <button onClick={() => { setModal({ mode:"add", date: weekModal.start }); setWeekModal(null); }} style={{ flex:1, padding:"10px", borderRadius:12, fontSize:13, fontWeight:700, background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)" }}>+ Manueel</button>
          </div>
          {getWeekTrainings(weekModal).length === 0 ? (
            <p style={{ textAlign:"center", color:"var(--muted)", padding:"20px 0" }}>Geen trainingen deze week</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {["ma","di","wo","do","vr","za","zo"].map((day, i) => {
                const d = new Date(weekModal.start); d.setDate(d.getDate()+i);
                const ds = d.toISOString().slice(0,10);
                const t = getWeekTrainings(weekModal).find(t => t.date===ds);
                return (
                  <div key={day} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--surface2)", borderRadius:12, border:`1px solid ${t?DISC_COLOR[t.discipline]+"44":"var(--border)"}` }}>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", width:24 }}>{day}</span>
                    {t ? (
                      <>
                        <span style={{ fontSize:18 }}>{DISC_ICON[t.discipline]}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:600 }}>{t.type}</p>
                          <p style={{ fontSize:11, color:"var(--muted)" }}>{t.duration}min{t.notes?` · ${t.notes}`:""}</p>
                        </div>
                        <IconBtn onClick={() => { setModal({ mode:"edit", item:t }); setWeekModal(null); }} color="var(--accent2)">✏️</IconBtn>
                        <IconBtn onClick={() => setTrainings(p => p.filter(x => x.id !== t.id))} color="var(--red)">🗑</IconBtn>
                      </>
                    ) : (
                      <p style={{ color:"var(--border)", fontSize:13, flex:1 }}>Rust / vrij</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop:16 }}>
            <Btn onClick={() => removeWeek(weekModal)} color="var(--red)" textColor="white" style={{ width:"100%" }}>🗑 Week leegmaken</Btn>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={modal.mode==="add" ? "Training toevoegen" : "Training bewerken"} onClose={() => setModal(null)}>
          <TrainingForm initial={modal.item || (modal.date ? { date: modal.date } : null)} onSave={(form) => { if (modal.mode==="add") { setTrainings(p => [...p, { ...form, id:uid() }]); } else { setTrainings(p => p.map(t => t.id===modal.item.id ? { ...form, id:t.id } : t)); } setModal(null); }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── AGENDA TAB ───────────────────────────────────────────────────────────────
function AgendaTab({ events, setEvents }) {
  const [modal, setModal] = useState(null);

  function save(form) {
    if (modal.mode === "add") {
      setEvents(p => [...p, { ...form, id: uid() }]);
    } else {
      setEvents(p => p.map(e => e.id === modal.item.id ? { ...form, id: e.id } : e));
    }
    setModal(null);
  }

  function remove(id) {
    setEvents(p => p.filter(e => e.id !== id));
  }

  const sorted = [...events].sort((a,b) => new Date(a.date)-new Date(b.date));
  const upcoming = sorted.filter(e => daysUntil(e.date) >= -1);
  const past = sorted.filter(e => daysUntil(e.date) < -1);

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:24, fontWeight:800 }}>📅 Agenda</h2>
        <Btn onClick={() => setModal({ mode:"add" })}>+ Event</Btn>
      </div>

      {upcoming.length > 0 && (
        <>
          <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:10 }}>AANKOMEND</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
            {upcoming.map(e => (
              <Card key={e.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{e.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:14 }}>{e.title}</p>
                  <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                <Badge color={e.type==="race"?"var(--accent3)":e.type==="work"?"var(--accent2)":"var(--muted)"}>{daysUntil(e.date)===0?"VANDAAG":daysUntil(e.date)+"d"}</Badge>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <IconBtn onClick={() => setModal({ mode:"edit", item:e })} color="var(--accent2)">✏️</IconBtn>
                  <IconBtn onClick={() => remove(e.id)} color="var(--red)">🗑</IconBtn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:10 }}>VOORBIJ</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {past.map(e => (
              <Card key={e.id} style={{ display:"flex", alignItems:"center", gap:12, opacity:0.4 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{e.icon}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600, fontSize:14 }}>{e.title}</p>
                  <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(e.date)}</p>
                </div>
                <IconBtn onClick={() => remove(e.id)} color="var(--red)">🗑</IconBtn>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.mode==="add" ? "Event toevoegen" : "Event bewerken"} onClose={() => setModal(null)}>
          <EventForm initial={modal.item} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── AI BRIEF ─────────────────────────────────────────────────────────────────
function BriefTab({ trainings, events }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState("general");

  async function generate() {
    setLoading(true); setBrief(null);
    const recent = trainings.filter(t => t.completed).slice(-5);
    const upcoming = events.filter(e => daysUntil(e.date) >= 0).slice(0,3);
    const load = trainings.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s,t) => s+t.duration, 0);
    const prompt = `Je bent de personal coach van Jonas, 38j triatleet, Ironman Klagenfurt 14 juni (${daysUntil(RACE_DATE)} dagen). FTP ~300W (doel 350W), gewicht ~79kg (doel 74-75kg), HM PB 1:31:59, zwemmen zwakste ~1:36/100m. Nieuwe job als F&B Manager voco Gent start 20 april.

Recente trainingen:
${recent.map(t => `- ${t.date}: ${t.type} ${t.duration}min RPE${t.rpe} "${t.notes}"`).join('\n')||"geen data"}
Weekbelasting: ${load} min
Events: ${upcoming.map(e => `${e.title} (${daysUntil(e.date)}d)`).join(', ')||"geen"}
Focus: ${focus}

Schrijf directe coach-briefing in NEDERLANDS:
**Status** – hoe staat Jonas ervoor (2-3 zinnen)
**Vandaag** – concreet advies training + timing
**Voeding & herstel** – 2-3 specifieke adviezen
**Opgelet** – 1-2 risico's
**Drive** – 1 motiverende zin`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      setBrief(data.content?.map(b => b.text||"").join("")||"");
    } catch { setBrief("Verbinding mislukt. Probeer opnieuw."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <h2 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>✦ AI Briefing</h2>
      <p style={{ color:"var(--muted)", fontSize:13, marginBottom:18 }}>Dagelijks gepersonaliseerd coachadvies</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[["general","🌅 Algemeen"],["training","⚡ Training"],["nutrition","🥗 Voeding"],["sleep","😴 Herstel"]].map(([id,label]) => (
          <button key={id} onClick={() => setFocus(id)} style={{ padding:"11px", borderRadius:12, fontSize:13, fontWeight:600, background:focus===id?"var(--accent)":"var(--surface)", color:focus===id?"#0a0a0f":"var(--text)", border:`1px solid ${focus===id?"var(--accent)":"var(--border)"}`, transition:"all 0.2s" }}>{label}</button>
        ))}
      </div>

      <button onClick={generate} disabled={loading} style={{ width:"100%", padding:"16px", borderRadius:14, fontSize:16, fontWeight:700, background:loading?"var(--surface2)":"linear-gradient(135deg,#c8f060,#60c8f0)", color:loading?"var(--muted)":"#0a0a0f", border:"none", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {loading ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>◌</span>Analyse bezig...</> : "Genereer mijn briefing"}
      </button>

      {brief && (
        <Card style={{ background:"linear-gradient(180deg,#12121a,#0d0d18)" }} className="fade-up">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>{new Date().toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</p>
              <p style={{ fontSize:12, color:"var(--accent)", fontWeight:600, marginTop:2 }}>Klagenfurt T–{daysUntil(RACE_DATE)}</p>
            </div>
            <span style={{ fontSize:22 }}>✦</span>
          </div>
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
            {brief.split('\n').map((line,i) => {
              if (!line.trim()) return <div key={i} style={{ height:8 }} />;
              const html = line.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--accent)">$1</strong>');
              const isHeader = /^\*\*/.test(line);
              return <p key={i} style={{ fontSize:isHeader?15:14, fontWeight:isHeader?700:400, lineHeight:1.65, marginTop:isHeader?14:0 }} dangerouslySetInnerHTML={{ __html:html }} />;
            })}
          </div>
        </Card>
      )}

      {!brief && !loading && (
        <Card style={{ textAlign:"center", padding:32 }}>
          <p style={{ fontSize:32, marginBottom:12 }}>✦</p>
          <p style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Jouw persoonlijke coach</p>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.6 }}>Kies een focus en genereer je dagelijkse briefing op basis van al jouw trainingsdata.</p>
        </Card>
      )}
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [trainings, setTrainings] = useStorage("ic_trainings", DEFAULT_TRAININGS);
  const [events, setEvents] = useStorage("ic_events", DEFAULT_EVENTS);

  const pages = {
    today:    <TodayTab    trainings={trainings} events={events} />,
    schema:   <SchemaTab   trainings={trainings} setTrainings={setTrainings} />,
    training: <TrainingTab trainings={trainings} setTrainings={setTrainings} />,
    agenda:   <AgendaTab   events={events}       setEvents={setEvents} />,
    brief:    <BriefTab    trainings={trainings} events={events} />,
  };

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:"var(--bg)", position:"relative", overflowX:"hidden" }}>
      <div style={{ position:"fixed", top:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, zIndex:50, background:"rgba(10,10,15,0.93)", backdropFilter:"blur(20px)", borderBottom:"1px solid var(--border)", padding:"11px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:17 }}>🏊🚴🏃</span>
          <span style={{ fontWeight:800, fontSize:14, letterSpacing:"-0.02em" }}>Iron<span style={{ color:"var(--accent)" }}>Coach</span></span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>@theroadtoiron</span>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite" }} />
        </div>
      </div>
      <div key={tab} className="fade-up">{pages[tab]}</div>
      <Nav tab={tab} setTab={setTab} />
    </div>
  );
}
