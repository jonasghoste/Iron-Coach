import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Training {
  id: number;
  date: string;
  type: string;
  discipline: string;
  duration: number;
  distance: number;
  rpe: number;
  notes: string;
  completed: boolean;
  planned?: boolean;
}

interface Event {
  id: number;
  date: string;
  title: string;
  type: string;
  icon: string;
}

interface Week {
  start: string;
  end: string;
  phase: string;
  daysToRace: number;
}

interface Session {
  id: string;
  date: string;
  dayIdx: number;
  discipline: string;
  type: string;
  duration: number;
  focus: string;
  keyWorkout?: boolean;
}

// ── Fonts & styles ───────────────────────────────────────────────────────────
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
    --font-display: 'Syne', sans-serif; --font-mono: 'DM Mono', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--font-display); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:translateY(0);} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .fade-up { animation: fadeUp 0.35s ease forwards; }
  input, textarea, select {
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-display); font-size: 14px;
    border-radius: 10px; padding: 10px 14px; outline: none; width: 100%;
    transition: border-color 0.2s;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); }
  textarea { resize: vertical; min-height: 70px; }
  button { font-family: var(--font-display); cursor: pointer; border: none; outline: none; }
`;
document.head.appendChild(style);

// ── Constants ────────────────────────────────────────────────────────────────
const TODAY = "2026-03-31";
const RACE_DATE = "2026-06-14";

const DISC_COLOR: Record<string, string> = {
  swim: "#60c8f0", bike: "#c8f060", run: "#f060a0",
  rest: "#6a6a8a", strength: "#f0a060", race: "#f06040",
};
const DISC_ICON: Record<string, string> = {
  swim: "🏊", bike: "🚴", run: "🏃", rest: "😴", strength: "💪", race: "🏆",
};

const PHASE_COLORS: Record<string, { bg: string; border: string; label: string; name: string }> = {
  base:    { bg: "#1a2610", border: "#c8f06044", label: "var(--accent)",  name: "BASIS" },
  build:   { bg: "#10201a", border: "#60c8f044", label: "var(--accent2)", name: "OPBOUW" },
  peak:    { bg: "#200a18", border: "#f060a044", label: "var(--accent3)", name: "PIEK" },
  taper:   { bg: "#1a1a10", border: "#f0c06044", label: "#f0c060",        name: "TAPER" },
  race:    { bg: "#200a0a", border: "#f0604044", label: "#f06040",        name: "RACE" },
};

const WEEK_TEMPLATES: Record<string, Omit<Session, "id" | "date" | "dayIdx">[]> = {
  base: [
    { discipline:"swim", type:"Zwemmen",  duration:60,  focus:"Techniek + duurzaamheid" },
    { discipline:"bike", type:"Fietsen",  duration:120, focus:"Zone 2 duurrit" },
    { discipline:"run",  type:"Lopen",    duration:60,  focus:"Rustige duurloop" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Actief herstel" },
    { discipline:"swim", type:"Zwemmen",  duration:65,  focus:"Drills + volume" },
    { discipline:"bike", type:"Fietsen",  duration:180, focus:"Lange rit Z2" },
    { discipline:"run",  type:"Lopen",    duration:90,  focus:"Lange duurloop" },
  ],
  build: [
    { discipline:"swim", type:"Zwemmen",  duration:65,  focus:"Tempo intervals" },
    { discipline:"bike", type:"Fietsen",  duration:90,  focus:"Sweet spot intervals" },
    { discipline:"run",  type:"Lopen",    duration:65,  focus:"Tempo run" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Herstel" },
    { discipline:"swim", type:"Zwemmen",  duration:70,  focus:"Race pace" },
    { discipline:"bike", type:"Fietsen",  duration:210, focus:"Lange rit + brick run" },
    { discipline:"run",  type:"Lopen",    duration:100, focus:"Lange loop" },
  ],
  peak: [
    { discipline:"swim", type:"Zwemmen",  duration:70,  focus:"Race pace sets" },
    { discipline:"bike", type:"Fietsen",  duration:90,  focus:"VO2max intervals" },
    { discipline:"run",  type:"Lopen",    duration:70,  focus:"Threshold run" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Herstel" },
    { discipline:"swim", type:"Zwemmen",  duration:75,  focus:"Open water simulatie" },
    { discipline:"bike", type:"Fietsen",  duration:240, focus:"Race simulatie" },
    { discipline:"run",  type:"Lopen",    duration:110, focus:"Marathon pace" },
  ],
  taper: [
    { discipline:"swim", type:"Zwemmen",  duration:40,  focus:"Activatie" },
    { discipline:"bike", type:"Fietsen",  duration:60,  focus:"Kort + scherp" },
    { discipline:"run",  type:"Lopen",    duration:40,  focus:"Activatie" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Rust" },
    { discipline:"swim", type:"Zwemmen",  duration:30,  focus:"Losjes" },
    { discipline:"bike", type:"Fietsen",  duration:45,  focus:"Spin" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Maximale rust" },
  ],
  race: [
    { discipline:"swim", type:"Zwemmen",  duration:20,  focus:"Activatie" },
    { discipline:"bike", type:"Fietsen",  duration:30,  focus:"Benen losmaken" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Rust" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Rust" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Rust" },
    { discipline:"rest", type:"Rust",     duration:0,   focus:"Rust" },
    { discipline:"race", type:"IRONMAN",  duration:600, focus:"🏆 RACE DAY" },
  ],
};

const INIT_TRAININGS: Training[] = [
  { id:1, date:"2026-03-28", type:"Zwemmen", discipline:"swim", duration:65, distance:3200, rpe:6, notes:"1:36/100m gemiddeld", completed:true },
  { id:2, date:"2026-03-29", type:"Fietsen", discipline:"bike", duration:120, distance:72, rpe:7, notes:"Intervaltraining, FTP ~295W", completed:true },
  { id:3, date:"2026-03-30", type:"Lopen",   discipline:"run",  duration:55, distance:12, rpe:6, notes:"Herstelloop", completed:true },
  { id:4, date:"2026-03-31", type:"Fietsen", discipline:"bike", duration:90, distance:0, rpe:0, notes:"", completed:false, planned:true },
  { id:5, date:"2026-04-01", type:"Zwemmen", discipline:"swim", duration:60, distance:0, rpe:0, notes:"", completed:false, planned:true },
  { id:6, date:"2026-04-02", type:"Rust",    discipline:"rest", duration:0, distance:0, rpe:0, notes:"Actief herstel", completed:false, planned:true },
  { id:7, date:"2026-04-03", type:"Lopen",   discipline:"run",  duration:75, distance:0, rpe:0, notes:"Lange duurloop", completed:false, planned:true },
];

const INIT_EVENTS: Event[] = [
  { id:1, date:"2026-04-06", title:"Amateur Ronde van Vlaanderen", type:"race", icon:"🚴" },
  { id:2, date:"2026-05-03", title:"Kortrijk Halve Marathon",      type:"race", icon:"🏃" },
  { id:3, date:"2026-06-14", title:"Ironman Klagenfurt",           type:"race", icon:"🏆" },
  { id:4, date:"2026-04-01", title:"Start voco Gent",              type:"work", icon:"🏨" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - new Date(TODAY).getTime()) / 86400000); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("nl-BE", { weekday:"short", day:"numeric", month:"short" }); }
function formatShort(d: string) { return new Date(d).toLocaleDateString("nl-BE", { day:"numeric", month:"short" }); }
function weekLoad(ts: Training[]) { return ts.filter(t => t.completed && daysUntil(t.date) >= -7 && daysUntil(t.date) <= 0).reduce((s, t) => s + t.duration, 0); }

function getWeeks(): Week[] {
  const end = new Date(RACE_DATE);
  const weeks: Week[] = [];
  const cur = new Date(TODAY);
  const day = cur.getDay();
  cur.setDate(cur.getDate() - (day === 0 ? 6 : day - 1));
  while (cur <= end) {
    const wStart = cur.toISOString().slice(0,10);
    const wEnd = new Date(cur); wEnd.setDate(wEnd.getDate() + 6);
    const daysToRace = Math.ceil((end.getTime() - cur.getTime()) / 86400000);
    let phase = "base";
    if (daysToRace <= 7) phase = "race";
    else if (daysToRace <= 21) phase = "taper";
    else if (daysToRace <= 49) phase = "peak";
    else if (daysToRace <= 70) phase = "build";
    weeks.push({ start: wStart, end: wEnd.toISOString().slice(0,10), phase, daysToRace });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}
const WEEKS = getWeeks();

// ── Shared UI ────────────────────────────────────────────────────────────────
function Card({ children, style: s = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:16, cursor:onClick?"pointer":"default", ...s }}>{children}</div>;
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontFamily:"var(--font-mono)", fontWeight:500 }}>{children}</span>;
}
function BottomNav({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const tabs = [
    { id:"today",    icon:"◉",  label:"Vandaag" },
    { id:"schema",   icon:"📋", label:"Schema" },
    { id:"training", icon:"⚡", label:"Log" },
    { id:"agenda",   icon:"📅", label:"Agenda" },
    { id:"brief",    icon:"✦",  label:"AI Brief" },
  ];
  return (
    <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(10,10,15,0.97)", backdropFilter:"blur(20px)", borderTop:"1px solid var(--border)", display:"flex", zIndex:100 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"11px 4px 9px", background:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:tab===t.id?"var(--accent)":"var(--muted)", transition:"color 0.2s" }}>
          <span style={{ fontSize:17 }}>{t.icon}</span>
          <span style={{ fontSize:9, fontFamily:"var(--font-mono)" }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── TODAY ────────────────────────────────────────────────────────────────────
function TodayTab({ trainings, events }: { trainings: Training[]; events: Event[] }) {
  const todayT = trainings.find(t => t.date === TODAY);
  const load = weekLoad(trainings);
  const done = trainings.filter(t => t.completed && daysUntil(t.date) >= -6 && daysUntil(t.date) <= 0);
  const upcoming = [...events].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime()).filter(e => daysUntil(e.date) >= 0);
  return (
    <div style={{ padding:"0 16px 110px", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ paddingTop:58 }}>
        <p style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.1em" }}>DINSDAG 31 MAART 2026</p>
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
            <p style={{ fontSize:44, fontWeight:800, color:"var(--accent)", lineHeight:1 }}>75</p>
            <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)" }}>DAGEN</p>
          </div>
        </div>
        <div style={{ marginTop:14, display:"flex", gap:4 }}>
          {["BASIS","OPBOUW","PIEK","TAPER","RACE"].map((ph,i) => {
            const colors = ["var(--accent)","var(--accent2)","var(--accent3)","#f0c060","#f06040"];
            return <div key={ph} style={{ flex:1, height:4, borderRadius:2, background: i===1 ? colors[i] : colors[i]+"33" }}/>;
          })}
        </div>
        <p style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--accent2)", marginTop:6 }}>OPBOUWFASE · week 2/10</p>
      </Card>
      {todayT && (
        <Card>
          <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)", marginBottom:10 }}>TRAINING VANDAAG</p>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:DISC_COLOR[todayT.discipline]+"22", border:`1px solid ${DISC_COLOR[todayT.discipline]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{DISC_ICON[todayT.discipline]}</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:700, fontSize:16 }}>{todayT.type}</p>
              <p style={{ color:"var(--muted)", fontSize:12, fontFamily:"var(--font-mono)" }}>{todayT.duration} min</p>
            </div>
            <Badge color={DISC_COLOR[todayT.discipline]}>{todayT.planned ? "GEPLAND" : "✓ KLAAR"}</Badge>
          </div>
        </Card>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {([["WEEK MIN", load+"'", "var(--accent)"], ["SESSIES", String(done.length), "var(--accent2)"], ["RvV", daysUntil("2026-04-06")+"d", "var(--accent3)"]] as [string,string,string][]).map(([l,v,c]) => (
          <Card key={l} style={{ textAlign:"center", padding:"14px 8px" }}>
            <p style={{ fontSize:22, fontWeight:800, color:c }}>{v}</p>
            <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--muted)", marginTop:4 }}>{l}</p>
          </Card>
        ))}
      </div>
      <Card>
        <p style={{ color:"var(--muted)", fontSize:11, fontFamily:"var(--font-mono)", marginBottom:12 }}>AANKOMENDE EVENTS</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {upcoming.slice(0,4).map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18, width:28, textAlign:"center" }}>{e.icon}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:600 }}>{e.title}</p>
                <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{formatDate(e.date)}</p>
              </div>
              <Badge color={e.type==="race" ? "var(--accent3)" : "var(--accent2)"}>{daysUntil(e.date)}d</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SCHEMA ───────────────────────────────────────────────────────────────────
function SchemaTab({ trainings, setTrainings }: { trainings: Training[]; setTrainings: React.Dispatch<React.SetStateAction<Training[]>> }) {
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [weekSessions, setWeekSessions] = useState<Record<string, Session[]>>({});
  const [generating, setGenerating] = useState(false);
  const DAYS = ["Ma","Di","Wo","Do","Vr","Za","Zo"];

  function getSessionsForWeek(week: Week): Session[] {
    if (weekSessions[week.start]) return weekSessions[week.start];
    const tmpl = WEEK_TEMPLATES[week.phase] || WEEK_TEMPLATES.base;
    return tmpl.map((s, i) => {
      const d = new Date(week.start); d.setDate(d.getDate() + i);
      return { ...s, id:`${week.start}-${i}`, date:d.toISOString().slice(0,10), dayIdx:i };
    });
  }

  function applyWeekToLog(week: Week) {
    const sessions = getSessionsForWeek(week);
    const toAdd: Training[] = sessions.filter(s => s.discipline !== "rest" && s.duration > 0).map(s => ({
      id: Date.now() + Math.random(), date:s.date, type:s.type, discipline:s.discipline,
      duration:s.duration, distance:0, rpe:0, notes:s.focus, completed:false, planned:true,
    }));
    setTrainings(prev => {
      const existing = prev.filter(t => !toAdd.some(n => n.date === t.date && n.discipline === t.discipline));
      return [...existing, ...toAdd];
    });
    setSelectedWeek(null);
  }

  async function generateAIWeek(week: Week) {
    setGenerating(true);
    const prompt = `Je bent triatleetcoach. Genereer een trainingsweek voor Jonas (38j, Ironman Klagenfurt 14 juni, FTP ~300W, HM PB 1:31:59, zwemmen zwakste ~1:36/100m). Fase: ${PHASE_COLORS[week.phase].name} (${week.daysToRace} dagen tot race). Geef 7 sessies (ma t/m zo) als JSON array. Elk object: { "discipline": "swim|bike|run|rest|strength", "type": "Zwemmen|Fietsen|Lopen|Rust|Kracht", "duration": number, "focus": "korte beschrijving", "keyWorkout": true/false }. Enkel JSON, geen uitleg.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:800, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      const text = data.content?.map((b: {text?:string}) => b.text||"").join("").replace(/```json|```/g,"").trim();
      const parsed: Omit<Session,"id"|"date"|"dayIdx">[] = JSON.parse(text);
      const sessions: Session[] = parsed.map((s, i) => {
        const d = new Date(week.start); d.setDate(d.getDate()+i);
        return { ...s, id:`${week.start}-ai-${i}`, date:d.toISOString().slice(0,10), dayIdx:i };
      });
      setWeekSessions(prev => ({ ...prev, [week.start]: sessions }));
    } catch(e) { console.error(e); }
    finally { setGenerating(false); }
  }

  if (selectedWeek) {
    const sessions = getSessionsForWeek(selectedWeek);
    const phase = PHASE_COLORS[selectedWeek.phase];
    const totalMin = sessions.reduce((s,t) => s+t.duration, 0);
    return (
      <div style={{ padding:"56px 16px 110px" }} className="fade-up">
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <button onClick={() => setSelectedWeek(null)} style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:10, padding:"8px 12px", fontSize:13 }}>←</button>
          <div>
            <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:phase.label }}>{phase.name}</p>
            <h2 style={{ fontSize:18, fontWeight:800 }}>{formatShort(selectedWeek.start)} – {formatShort(selectedWeek.end)}</h2>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <button onClick={() => generateAIWeek(selectedWeek)} disabled={generating} style={{ flex:1, padding:"10px", borderRadius:12, fontSize:13, fontWeight:700, background:"var(--accent)", color:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            {generating ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>◌</span> Genereren...</> : "✦ AI Week"}
          </button>
          <button onClick={() => applyWeekToLog(selectedWeek)} style={{ flex:1, padding:"10px", borderRadius:12, fontSize:13, fontWeight:700, background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)" }}>→ Zet in log</button>
        </div>
        <Card style={{ marginBottom:14, padding:"12px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            {[["TOTAAL", totalMin, "var(--accent)"], ["ZWEM", sessions.filter(s=>s.discipline==="swim").reduce((a,b)=>a+b.duration,0), "var(--accent2)"], ["FIETS", sessions.filter(s=>s.discipline==="bike").reduce((a,b)=>a+b.duration,0), "var(--accent)"], ["LOOP", sessions.filter(s=>s.discipline==="run").reduce((a,b)=>a+b.duration,0), "var(--accent3)"]].map(([l,v,c]) => (
              <div key={String(l)} style={{ textAlign:"center" }}>
                <p style={{ fontSize:20, fontWeight:800, color:String(c) }}>{v}'</p>
                <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>{l}</p>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sessions.map((s,i) => (
            <Card key={s.id} style={{ display:"flex", alignItems:"center", gap:12, border:s.keyWorkout?`1px solid ${DISC_COLOR[s.discipline]}55`:"1px solid var(--border)" }}>
              <div style={{ width:36, textAlign:"center" }}><p style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)", fontWeight:600 }}>{DAYS[i]}</p></div>
              <div style={{ width:36, height:36, borderRadius:8, background:DISC_COLOR[s.discipline]+"22", border:`1px solid ${DISC_COLOR[s.discipline]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{DISC_ICON[s.discipline]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:600, fontSize:14 }}>{s.type}</p>
                <p style={{ fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.focus}</p>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {s.duration > 0 && <p style={{ fontSize:13, fontWeight:700, color:DISC_COLOR[s.discipline] }}>{s.duration}'</p>}
                {s.keyWorkout && <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent3)" }}>KEY</p>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:24, fontWeight:800 }}>📋 Schema</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Klagenfurt · 75 dagen · 11 weken</p>
      </div>
      <Card style={{ marginBottom:16, padding:"12px 16px" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {Object.entries(PHASE_COLORS).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:v.label }}/>
              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>{v.name}</span>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {WEEKS.map(w => {
          const phase = PHASE_COLORS[w.phase];
          const sessions = getSessionsForWeek(w);
          const totalMin = sessions.reduce((s,t) => s+t.duration, 0);
          const isNow = daysUntil(w.start) <= 0 && daysUntil(w.end) >= 0;
          const isPast = daysUntil(w.end) < 0;
          return (
            <div key={w.start} onClick={() => setSelectedWeek(w)} style={{ background:isNow?phase.bg:"var(--surface)", border:isNow?phase.border:"1px solid var(--border)", borderRadius:14, padding:"14px 16px", cursor:"pointer", opacity:isPast?0.5:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    {isNow && <div style={{ width:6, height:6, borderRadius:"50%", background:phase.label, animation:"pulse 2s infinite" }}/>}
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:phase.label, fontWeight:600 }}>{phase.name}{isNow ? " ← NU" : ""}</span>
                  </div>
                  <p style={{ fontSize:14, fontWeight:700 }}>{formatShort(w.start)} – {formatShort(w.end)}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:16, fontWeight:800, color:phase.label }}>{totalMin > 0 ? totalMin+"'" : "—"}</p>
                  <p style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>T-{w.daysToRace}d</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:3, marginTop:10 }}>
                {sessions.map((s,j) => <div key={j} style={{ flex:1, height:4, borderRadius:2, background:DISC_COLOR[s.discipline]+"66" }}/>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TRAINING LOG ─────────────────────────────────────────────────────────────
function TrainingTab({ trainings, setTrainings }: { trainings: Training[]; setTrainings: React.Dispatch<React.SetStateAction<Training[]>> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Training | null>(null);
  const [form, setForm] = useState({ date:TODAY, type:"Fietsen", discipline:"bike", duration:"", distance:"", rpe:"6", notes:"", completed:false });

  function addTraining() {
    if (!form.duration) return;
    setTrainings(prev => [...prev, { ...form, id:Date.now(), duration:+form.duration, distance:+form.distance, rpe:+form.rpe }]);
    setShowAdd(false);
    setForm({ date:TODAY, type:"Fietsen", discipline:"bike", duration:"", distance:"", rpe:"6", notes:"", completed:false });
  }

  const sorted = [...trainings].sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime());
  const load = weekLoad(trainings);

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ fontSize:24, fontWeight:800 }}>⚡ Training Log</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background:"var(--accent)", color:"#0a0a0f", fontWeight:700, borderRadius:12, padding:"10px 16px", fontSize:13 }}>+ Toevoegen</button>
      </div>
      <Card style={{ marginBottom:14 }}>
        <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:12 }}>WEEK · {load} min</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:56 }}>
          {["2026-03-25","2026-03-26","2026-03-27","2026-03-28","2026-03-29","2026-03-30","2026-03-31"].map((date,i) => {
            const t = trainings.find(t => t.date===date);
            const h = t ? Math.max(Math.min((t.duration/150)*52,52),4) : 4;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:"100%", height:h, background:t?.completed?(DISC_COLOR[t.discipline]||"var(--accent)"):(t?"var(--surface2)":"var(--border)"), borderRadius:"3px 3px 2px 2px", border:date===TODAY?"1px solid var(--accent)":"none" }}/>
                <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:date===TODAY?"var(--accent)":"var(--muted)" }}>{["ma","di","wo","do","vr","za","zo"][i]}</span>
              </div>
            );
          })}
        </div>
      </Card>
      {showAdd && (
        <Card style={{ marginBottom:14 }} className="fade-up">
          <p style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Nieuwe training</p>
          {([["Datum","date","date",""], ["Type","type","select",["Zwemmen","Fietsen","Lopen","Rust","Kracht"]], ["Discipline","discipline","select",["swim","bike","run","rest","strength"]], ["Duur (min)","duration","number","90"], ["Afstand","distance","number","0"], ["RPE (1–10)","rpe","number","6"], ["Notities","notes","textarea",""]] as [string,string,string,string|string[]][]).map(([label,field,type,extra]) => (
            <div key={field} style={{ marginBottom:10 }}>
              <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>{label.toUpperCase()}</p>
              {type==="select" ? (
                <select value={(form as Record<string,string|boolean>)[field] as string} onChange={e => setForm(p => ({...p,[field]:e.target.value}))}>
                  {(extra as string[]).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : type==="textarea" ? (
                <textarea value={(form as Record<string,string|boolean>)[field] as string} onChange={e => setForm(p => ({...p,[field]:e.target.value}))}/>
              ) : (
                <input type={type} value={(form as Record<string,string|boolean>)[field] as string} onChange={e => setForm(p => ({...p,[field]:e.target.value}))} placeholder={extra as string}/>
              )}
            </div>
          ))}
          <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:12 }}>
            <input type="checkbox" checked={form.completed} onChange={e => setForm(p => ({...p,completed:e.target.checked}))} style={{ width:18, height:18, accentColor:"var(--accent)" }}/>
            <span style={{ fontSize:14 }}>Afgewerkt</span>
          </label>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={addTraining} style={{ flex:1, background:"var(--accent)", color:"#0a0a0f", fontWeight:700, borderRadius:12, padding:14, fontSize:14 }}>Opslaan</button>
            <button onClick={() => setShowAdd(false)} style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:12, padding:14, fontSize:14 }}>Annuleer</button>
          </div>
        </Card>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.map(t => (
          <Card key={t.id} onClick={() => setSelected(t)} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:10, background:DISC_COLOR[t.discipline]+"22", border:`1px solid ${DISC_COLOR[t.discipline]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {t.completed ? DISC_ICON[t.discipline] : "◌"}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:600, fontSize:14 }}>{t.type}</p>
              <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{formatDate(t.date)} · {t.duration}min</p>
              {t.notes && <p style={{ fontSize:11, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.notes}</p>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0 }}>
              <Badge color={t.completed ? DISC_COLOR[t.discipline] : "var(--muted)"}>{t.completed?"✓":"PLAN"}</Badge>
              {t.rpe>0 && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>RPE {t.rpe}</span>}
            </div>
          </Card>
        ))}
      </div>
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", zIndex:200 }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"20px 20px 0 0", border:"1px solid var(--border)", padding:24, width:"100%" }} className="fade-up">
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
              <span style={{ fontSize:32 }}>{DISC_ICON[selected.discipline]}</span>
              <div>
                <h3 style={{ fontSize:20, fontWeight:800 }}>{selected.type}</h3>
                <p style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:12 }}>{formatDate(selected.date)}</p>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
              {[["Duur", selected.duration+" min"], ["Afstand", selected.distance?`${selected.distance}${selected.discipline==="swim"?"m":"km"}`:"—"], ["RPE", String(selected.rpe||"—")]].map(([l,v]) => (
                <div key={l} style={{ background:"var(--surface2)", borderRadius:10, padding:12, textAlign:"center" }}>
                  <p style={{ fontSize:16, fontWeight:700, color:"var(--accent)" }}>{v}</p>
                  <p style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--muted)", marginTop:2 }}>{l}</p>
                </div>
              ))}
            </div>
            {selected.notes && <p style={{ fontSize:14, color:"var(--muted)", lineHeight:1.6, marginBottom:16 }}>{selected.notes}</p>}
            <button onClick={() => setSelected(null)} style={{ width:"100%", background:"var(--surface2)", color:"var(--text)", borderRadius:12, padding:14, fontSize:14, border:"1px solid var(--border)" }}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AGENDA ───────────────────────────────────────────────────────────────────
function AgendaTab({ events, setEvents }: { events: Event[]; setEvents: React.Dispatch<React.SetStateAction<Event[]>> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date:"", title:"", type:"work", icon:"📌" });

  function addEvent() {
    if (!form.title||!form.date) return;
    setEvents(prev => [...prev, { ...form, id:Date.now() }]);
    setShowAdd(false);
    setForm({ date:"", title:"", type:"work", icon:"📌" });
  }

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:24, fontWeight:800 }}>📅 Agenda</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background:"var(--accent)", color:"#0a0a0f", fontWeight:700, borderRadius:12, padding:"10px 16px", fontSize:13 }}>+ Event</button>
      </div>
      {showAdd && (
        <Card style={{ marginBottom:14 }} className="fade-up">
          {[["Datum","date","date"], ["Titel","title","text"]].map(([l,f,t]) => (
            <div key={f} style={{ marginBottom:10 }}>
              <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>{l.toUpperCase()}</p>
              <input type={t} value={(form as Record<string,string>)[f]} onChange={e => setForm(p => ({...p,[f]:e.target.value}))} placeholder={l}/>
            </div>
          ))}
          <div style={{ marginBottom:12 }}>
            <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)", marginBottom:5 }}>TYPE</p>
            <select value={form.type} onChange={e => setForm(p => ({...p,type:e.target.value}))}>
              <option value="race">Wedstrijd</option><option value="work">Werk</option><option value="personal">Persoonlijk</option>
            </select>
          </div>
          <button onClick={addEvent} style={{ width:"100%", background:"var(--accent)", color:"#0a0a0f", fontWeight:700, borderRadius:10, padding:12, fontSize:14 }}>Toevoegen</button>
        </Card>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[...events].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime()).map(e => {
          const days = daysUntil(e.date); const isPast = days < 0;
          return (
            <Card key={e.id} style={{ opacity:isPast?0.5:1, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:10, background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{e.icon}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:600, fontSize:14 }}>{e.title}</p>
                <p style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--font-mono)" }}>{formatDate(e.date)}</p>
              </div>
              <Badge color={isPast?"var(--muted)":e.type==="race"?"var(--accent3)":"var(--accent2)"}>{isPast?"VOORBIJ":days===0?"VANDAAG":`${days}d`}</Badge>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── AI BRIEF ─────────────────────────────────────────────────────────────────
function BriefTab({ trainings, events }: { trainings: Training[]; events: Event[] }) {
  const [brief, setBrief] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState("general");

  async function generate() {
    setLoading(true); setBrief(null);
    const recent = trainings.filter(t => t.completed).slice(-5);
    const nextEvents = events.filter(e => daysUntil(e.date) >= 0).slice(0,3);
    const prompt = `Je bent de personal coach van Jonas, 38j triatleet, Ironman Klagenfurt 14 juni (75 dagen). FTP ~300W (doel 350W), gewicht ~79kg (doel 74-75kg), HM PB 1:31:59, zwemmen zwakste ~1:36/100m. Nieuwe job F&B Manager voco Gent start 1 april.

Recente trainingen:
${recent.map(t => `- ${t.date}: ${t.type} ${t.duration}min RPE${t.rpe} "${t.notes}"`).join('\n')}
Weekbelasting: ${weekLoad(trainings)} min
Events: ${nextEvents.map(e => `${e.title} (${daysUntil(e.date)}d)`).join(', ')}
Focus: ${focus}

Schrijf een directe coach-briefing in NEDERLANDS:
**Status** – hoe staat Jonas ervoor (2-3 zinnen)
**Vandaag** – concreet advies training + timing
**Voeding & herstel** – 2-3 specifieke adviezen
**Opgelet** – 1-2 risico's
**Drive** – 1 motiverende zin`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      setBrief(data.content?.map((b: {text?:string}) => b.text||"").join("")||"");
    } catch { setBrief("Verbinding mislukt."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding:"56px 16px 110px" }} className="fade-up">
      <h2 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>✦ AI Briefing</h2>
      <p style={{ color:"var(--muted)", fontSize:13, marginBottom:18 }}>Gepersonaliseerd dagadvies</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[["general","🌅 Algemeen"],["training","⚡ Training"],["nutrition","🥗 Voeding"],["sleep","😴 Herstel"]].map(([id,label]) => (
          <button key={id} onClick={() => setFocus(id)} style={{ padding:"11px", borderRadius:12, fontSize:13, fontWeight:600, background:focus===id?"var(--accent)":"var(--surface)", color:focus===id?"#0a0a0f":"var(--text)", border:`1px solid ${focus===id?"var(--accent)":"var(--border)"}`, transition:"all 0.2s" }}>{label}</button>
        ))}
      </div>
      <button onClick={generate} disabled={loading} style={{ width:"100%", padding:"16px", borderRadius:14, fontSize:16, fontWeight:700, background:loading?"var(--surface2)":"linear-gradient(135deg,#c8f060,#60c8f0)", color:loading?"var(--muted)":"#0a0a0f", border:"none", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {loading ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>◌</span> Analyse bezig...</> : "Genereer mijn briefing"}
      </button>
      {brief && (
        <Card style={{ background:"linear-gradient(180deg,#12121a,#0d0d18)" }} className="fade-up">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <p style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--muted)" }}>BRIEFING · 31 MAART 2026</p>
              <p style={{ fontSize:12, color:"var(--accent)", fontWeight:600, marginTop:2 }}>Klagenfurt T–75</p>
            </div>
            <span style={{ fontSize:22 }}>✦</span>
          </div>
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
            {brief.split('\n').map((line,i) => {
              if (!line.trim()) return <div key={i} style={{ height:8 }}/>;
              const html = line.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--accent)">$1</strong>');
              const isHeader = /^\*\*/.test(line);
              return <p key={i} style={{ fontSize:isHeader?15:14, fontWeight:isHeader?700:400, lineHeight:1.65, marginTop:isHeader?14:0 }} dangerouslySetInnerHTML={{ __html:html }}/>;
            })}
          </div>
        </Card>
      )}
      {!brief && !loading && (
        <Card style={{ textAlign:"center", padding:32 }}>
          <p style={{ fontSize:32, marginBottom:12 }}>✦</p>
          <p style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Jouw persoonlijke coach</p>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.6 }}>Kies een focus en genereer je dagelijkse briefing op basis van jouw trainingsdata.</p>
        </Card>
      )}
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [trainings, setTrainings] = useState<Training[]>(INIT_TRAININGS);
  const [events, setEvents] = useState<Event[]>(INIT_EVENTS);

  const pages: Record<string, React.ReactNode> = {
    today:    <TodayTab    trainings={trainings} events={events}/>,
    schema:   <SchemaTab   trainings={trainings} setTrainings={setTrainings}/>,
    training: <TrainingTab trainings={trainings} setTrainings={setTrainings}/>,
    agenda:   <AgendaTab   events={events}       setEvents={setEvents}/>,
    brief:    <BriefTab    trainings={trainings} events={events}/>,
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
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite" }}/>
        </div>
      </div>
      <div key={tab} className="fade-up">{pages[tab]}</div>
      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
