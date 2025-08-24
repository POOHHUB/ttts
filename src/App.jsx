import React, { useEffect, useMemo, useState, useContext, createContext } from "react";
import { MemoryRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Trophy, Swords, User, LogIn, LogOut, Settings, Home, Crown, ShieldCheck, Plus, Trash2, Save, Layers3, ClipboardCheck, Wand2, Edit3, KeyRound, Search, Volume2, VolumeX, HelpCircle, Palette, ChevronUp, ChevronDown, Wrench, Undo2 } from "lucide-react";

/**
 * Thawee Koon — Forgot Password + Admin Inline Reset
 * - เพิ่มระบบ "ลืมรหัสผ่าน" (โค้ดรีเซ็ตจำลอง ส่งขึ้นหน้าจอแบบเดโม)
 * - แอดมินรีเซ็ตรหัสแบบ inline ในตารางผู้ใช้ (ไม่ใช้ prompt แล้ว)
 * - แอดมินตั้งเวลา/เปิดปิดด่าน/สร้างด่าน/แก้ theme/แก้คู่มือ/ถังขยะกู้คืนได้ เหมือนก่อนหน้า
 * - ผู้เล่นเห็นคะแนนหลังส่งเท่านั้น
 * - ธีมชมพูพาสเทล + เสียงคลิก/สำเร็จ/ผิดพลาด
 * - Copyright: © 2025 Thawee Koon. All rights reserved
 */

// ==========================
// LocalStorage Keys
// ==========================
const LS_USERS = "tk_users";        // [{id, name, email, passHash, role}]
const LS_SCORES = "tk_scores";      // [{id, userId, userName, mode, levelId, score, time, ts}]
const LS_LEVELS = "tk_levels";      // [{id, mode, name, data, points, difficulty, timeSec, enabled, allowDifficultyChoice}]
const LS_CURRENT = "tk_current";    // current user
const LS_SOUND = "tk_sound";        // true/false
const LS_GUIDE = "tk_guide_seen";   // { [mode]: true }
const LS_SITE = "tk_site";          // { brand, tagline, theme, guides: { [mode]: string } }
const LS_TRASH = "tk_trash";        // [{id, type: 'level'|'user'|'score', data, ts}]
const LS_RESET = "tk_reset";        // { [email]: { code, exp } }

// ==========================
// Utils
// ==========================
const dbg = (...a)=>{}; // ปิด log ดีบัก
function hash(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0;} return (h>>>0).toString(16); }
function readLS(key, def){ try{ return JSON.parse(localStorage.getItem(key)||"null") ?? def;}catch(e){ return def; } }
function writeLS(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
function cryptoRandomId(){ try{ return crypto.randomUUID(); }catch{ return "id_"+Math.random().toString(36).slice(2);} }

function pushTrash(item){ const t=readLS(LS_TRASH, []); t.push({ id: cryptoRandomId(), ...item, ts: Date.now() }); writeLS(LS_TRASH, t); }
function listTrash(){ return readLS(LS_TRASH, []); }
function purgeTrash(){ writeLS(LS_TRASH, []); }

// Reset helpers
function genCode(){ return (Math.floor(Math.random()*900000)+100000).toString(); }
function getResetMap(){ return readLS(LS_RESET, {}); }
function setResetMap(m){ writeLS(LS_RESET, m); }

// ==========================
// Default Content / Seeds
// ==========================
const THEME_PRESETS = {
  pink: { key: 'pink', bg: "from-rose-50 via-pink-50 to-fuchsia-50", card: "bg-white/75 backdrop-blur border border-pink-100 shadow-[0_10px_30px_rgba(244,114,182,0.15)]", btnPrimary: "bg-pink-200 hover:bg-pink-300 text-pink-900" },
  sky:  { key: 'sky',  bg: "from-sky-50 via-indigo-50 to-pink-50",  card: "bg-white/70 backdrop-blur border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.05)]", btnPrimary: "bg-sky-200 hover:bg-sky-300 text-sky-900" },
  mint: { key: 'mint', bg: "from-emerald-50 via-teal-50 to-cyan-50", card: "bg-white/75 backdrop-blur border border-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.12)]", btnPrimary: "bg-emerald-200 hover:bg-emerald-300 text-emerald-900" },
};

function defaultSite(){
  return {
    brand: "Thawee Koon",
    tagline: "เกมตรรกศาสตร์แนวชมพูพาสเทล — ฝึกคิดแบบมีความสุข",
    theme: 'pink',
    guides: {
      "Truth Table": "เลือก T/F ให้ครบทุกช่องตามนิพจน์ตรรกะ ถ้าเลือกระดับง่ายจะมีตารางช่วยด้านขวา",
      "XOR Maze": "กดสวิตช์ให้จำนวน True เป็นคี่ (XOR เป็นจริง) ประตูจะเปิด",
      "Implication": "อ่านสมมุติฐานแล้วเลือกข้อสรุปตามกฎ (Modus Ponens/Tollens)",
      "CNF": "เลือกตัวเลือกที่เป็น CNF ของนิพจน์ที่กำหนด",
    }
  };
}

function defaultLevels(){
  const base = [
    { id: "tt_p_imp_q",  mode: "Truth Table", name: "ตาราง p→q",        data:{expr:"p→q"},              points:100, difficulty:'easy', timeSec:60, enabled:true, allowDifficultyChoice:true },
    { id: "tt_p_bi_q",   mode: "Truth Table", name: "ตาราง p↔q",        data:{expr:"p↔q"},              points:120, difficulty:'easy', timeSec:60, enabled:true, allowDifficultyChoice:true },
    { id: "tt_and",      mode: "Truth Table", name: "p ∧ q",              data:{expr:"p∧q"},              points:90,  difficulty:'easy', timeSec:45, enabled:true, allowDifficultyChoice:false },
    { id: "tt_mix1",     mode: "Truth Table", name: "(p→q) ∧ ¬r",         data:{expr:"(p→q)∧¬r"},         points:130, difficulty:'hard', timeSec:90, enabled:true, allowDifficultyChoice:true },
    { id: "xor_abc",     mode: "XOR Maze",   name: "เขาวงกต XOR (a,b,c)",data:{vars:["a","b","c"], targetOdd:true}, points:90, difficulty:'easy', timeSec:45, enabled:true, allowDifficultyChoice:false },
    { id: "imp_basic",   mode: "Implication", name:"Modus (Ponens/Tollens)", data:{}, points:110, difficulty:'easy', timeSec:60, enabled:true, allowDifficultyChoice:false },
    { id: "cnf_1",       mode: "CNF",        name:"CNF เบื้องต้น",       data:{expr:"(p→q) ↔ (¬r ∨ s)"}, points:130, difficulty:'hard', timeSec:90, enabled:true, allowDifficultyChoice:false },
  ];
  return base;
}

function seedOnce(){
  const users = readLS(LS_USERS, []);
  if (!users.find(u=>u.role==="admin")){
    users.push({ id: cryptoRandomId(), name: "ผู้ดูแลระบบ", email: "admin@thawee-koon.app", passHash: hash("admin123"), role: "admin" });
    writeLS(LS_USERS, users);
  }
  if (!readLS(LS_LEVELS, null)) writeLS(LS_LEVELS, defaultLevels());
  if (readLS(LS_SOUND, null)===null) writeLS(LS_SOUND, true);
  if (!readLS(LS_SITE, null)) writeLS(LS_SITE, defaultSite());
  if (!readLS(LS_GUIDE, null)) writeLS(LS_GUIDE, {});
  if (!readLS(LS_TRASH, null)) writeLS(LS_TRASH, []);
  if (!readLS(LS_RESET, null)) writeLS(LS_RESET, {});
}

// ==========================
// Sound System (simple beeps)
// ==========================
const SoundCtx = createContext({ play: (k)=>{}, enabled: true, toggle: ()=>{} });
function useSound(){ return useContext(SoundCtx); }

const SFX = {
  click: new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAABAACAgICAAAA="),
  success: new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAABAACAgICAAAA="),
  error: new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAABAACAgICAAAA="),
};

function SoundProvider({ children }){
  const [enabled, setEnabled] = useState(()=> readLS(LS_SOUND, true));
  useEffect(()=> writeLS(LS_SOUND, enabled), [enabled]);
  const play = (k) => { if(!enabled) return; const a=SFX[k]; if(!a) return; try{ a.currentTime=0; a.play(); }catch(e){} };
  const toggle = ()=> setEnabled(e=>!e);
  const value = useMemo(()=>({ play, enabled, toggle }), [enabled]);
  return <SoundCtx.Provider value={value}>{children}</SoundCtx.Provider>
}

// ==========================
// Theme
// ==========================
function useSite(){ const [site, setSite] = useState(()=> readLS(LS_SITE, defaultSite())); useEffect(()=> writeLS(LS_SITE, site), [site]); return { site, setSite }; }
function useTheme(){ const { site } = useSite(); const preset = THEME_PRESETS[site.theme] || THEME_PRESETS.pink; return preset; }

function Card({ title, right, children }){
  const theme = useTheme();
  return (
    <div className={`rounded-3xl p-6 ${theme.card}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-rose-700 flex items-center gap-2"><Layers3 className="w-5 h-5"/>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Button({ children, className="", variant="primary", type="button", onClick, ...rest }){
  const { play } = useSound();
  const theme = useTheme();
  const palette = variant==="primary"? theme.btnPrimary : variant==="success"? "bg-emerald-200 hover:bg-emerald-300 text-emerald-900" : variant==="warn"? "bg-amber-200 hover:bg-amber-300 text-amber-900" : variant==="danger"? "bg-rose-300 hover:bg-rose-400 text-rose-950" : theme.btnPrimary;
  const handle=(e)=>{ play('click'); if(onClick) onClick(e); };
  return <button type={type} className={`rounded-2xl px-4 py-2 font-medium shadow hover:shadow-xl transition active:scale-[.98] ${palette} ${className}`} onClick={handle} {...rest}>{children}</button>;
}

function TextInput({ label, type="text", value, onChange, placeholder }){
  return (
    <label className="block mb-3">
      <span className="block text-sm text-rose-700 mb-1">{label}</span>
      <input type={type} className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100 outline-none focus:ring-2 focus:ring-pink-300" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
    </label>
  );
}

// ==========================
// Auth
// ==========================
const AuthCtx = createContext(null);
function useAuth(){ return useContext(AuthCtx); }

function AuthProvider({ children }){
  const [user, setUser] = useState(()=> readLS(LS_CURRENT, null));
  useEffect(()=>{ seedOnce(); }, []);
  useEffect(()=>{ writeLS(LS_CURRENT, user); }, [user]);

  const register=(name,email,password)=>{ const users=readLS(LS_USERS,[]); if(users.find(u=>u.email===email)) throw new Error("อีเมลนี้ถูกใช้แล้ว"); const u={ id: cryptoRandomId(), name, email, passHash: hash(password), role: "player"}; users.push(u); writeLS(LS_USERS, users); setUser(u); };
  const login=(email,password)=>{ const users=readLS(LS_USERS,[]); const u=users.find(u=>u.email===email && u.passHash===hash(password)); if(!u) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); setUser(u); };
  const logout=()=> setUser(null);

  return <AuthCtx.Provider value={{ user, setUser, register, login, logout }}>{children}</AuthCtx.Provider>;
}

function Protected({ children, role }){ const { user } = useAuth(); if(!user) return <Navigate to="/login" replace/>; if(role && user.role!==role) return <Navigate to="/" replace/>; return children; }

// ==========================
// Data helpers
// ==========================
function listLevels(){ return readLS(LS_LEVELS, defaultLevels()); }
function saveLevels(lv){ writeLS(LS_LEVELS, lv); }
function addScore({ userId, userName, mode, levelId, score, time }){ const scores=readLS(LS_SCORES,[]); const rec={ id: cryptoRandomId(), userId, userName, mode, levelId, score, time, ts: Date.now() }; scores.push(rec); writeLS(LS_SCORES, scores); }
function topScores(limit=100){ const s=readLS(LS_SCORES,[]); return s.sort((a,b)=> b.score-a.score || a.time-b.time).slice(0,limit); }

// ==========================
// Guides
// ==========================
function useGuide(){
  const [state, setState] = useState(()=> readLS(LS_GUIDE, {}));
  useEffect(()=> writeLS(LS_GUIDE, state), [state]);
  return { state, setState };
}

function GuideModal({ mode, onClose }){
  const { site } = useSite();
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="max-w-lg w-full rounded-3xl p-6 bg-white" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-xl font-bold text-rose-700 mb-2">คู่มือการเล่น — {mode}</h3>
        <p className="text-rose-700 whitespace-pre-wrap">{site.guides[mode] || "ยังไม่มีคู่มือสำหรับโหมดนี้"}</p>
        <div className="mt-4 text-right"><Button onClick={onClose}>ปิด</Button></div>
      </div>
    </div>
  );
}

// ==========================
// Top Navigation
// ==========================
function TopNav(){
  const { user, logout } = useAuth();
  const { enabled, toggle } = useSound();
  const { site } = useSite();
  return (
    <div className="sticky top-0 z-50 bg-white/70 backdrop-blur border-b border-pink-100">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-rose-700">
          <Wand2 className="w-6 h-6 text-pink-500"/>
          <Link to="/" className="font-black tracking-wide">{site.brand}</Link>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700 hidden sm:inline-block">ตรรกศาสตร์ชมพูพาสเทล</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <NavLink to="/" icon={<Home className="w-4 h-4"/>}>หน้าแรก</NavLink>
          <NavLink to="/play" icon={<Swords className="w-4 h-4"/>}>เล่นเกม</NavLink>
          <NavLink to="/leaderboard" icon={<Trophy className="w-4 h-4"/>}>กระดานคะแนน</NavLink>
          {user?.role==="admin" && <NavLink to="/admin" icon={<Settings className="w-4 h-4"/>}>แอดมิน</NavLink>}
          <button className={`rounded-2xl px-3 py-1.5 font-medium shadow hover:shadow-xl transition active:scale-[.98] bg-pink-200 hover:bg-pink-300 text-pink-900 flex items-center gap-1`} onClick={toggle}>
            {enabled? <Volume2 className="w-4 h-4"/> : <VolumeX className="w-4 h-4"/>} {enabled? 'เสียงเปิด':'เสียงปิด'}
          </button>
          {user ? (
            <>
              <span className="mx-2 text-rose-400 hidden sm:inline">|</span>
              <NavLink to="/profile" icon={<User className="w-4 h-4"/>}>{user.name || "โปรไฟล์"}</NavLink>
              <button onClick={logout} className={`rounded-2xl px-3 py-1.5 font-medium shadow hover:shadow-xl transition active:scale-[.98] bg-rose-300 hover:bg-rose-400 text-rose-950 ml-2 flex items-center gap-1`}><LogOut className="w-4 h-4"/> ออกจากระบบ</button>
            </>
          ) : (
            <NavLink to="/login" icon={<LogIn className="w-4 h-4"/>}>เข้าสู่ระบบ</NavLink>
          )}
        </nav>
      </div>
    </div>
  );
}

function NavLink({ to, icon, children }){ return <Link to={to} className="px-3 py-1.5 rounded-xl hover:bg-pink-50 text-rose-700 flex items-center gap-2">{icon}<span>{children}</span></Link>; }

// ==========================
// Pages
// ==========================
function HomePage(){
  const theme = useTheme();
  const { site } = useSite();
  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className={`rounded-3xl p-8 bg-gradient-to-br ${theme.bg} border border-pink-100 shadow-inner`}>
        <h1 className="text-3xl font-black text-rose-700 mb-3 flex items-center gap-2"><Crown className="w-7 h-7 text-pink-500"/>ยินดีต้อนรับสู่ {site.brand}</h1>
        <p className="text-rose-600">{site.tagline}</p>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Link to="/play"><Button><Swords className="w-4 h-4"/> เริ่มเล่นทันที</Button></Link>
          <Link to="/leaderboard"><Button variant="success"><Trophy className="w-4 h-4"/> ดูคะแนนนำ</Button></Link>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Card title="โหมดหลัก"><ul className="list-disc pl-5 text-rose-700 space-y-1"><li>ตารางค่าความจริง</li><li>เขาวงกต XOR</li><li>อิมพลิเคชัน</li></ul></Card>
        <Card title="เรียนรู้ระหว่างเล่น"><p className="text-rose-700">De Morgan, Implication, Biconditional, XOR, CNF/DNF</p></Card>
        <Card title="แข่งกันได้"><p className="text-rose-700">เก็บคะแนน-เวลา ขึ้นลีดเดอร์บอร์ด และมีหน้าแอดมินจัดการข้อมูล</p></Card>
      </div>
    </div>
  );
}

function LoginPage(){
  const { login, register } = useAuth();
  const { play } = useSound();
  const nav = useNavigate();
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // forgot
  const [codeSent, setCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPass, setNewPass] = useState("");

  const onSubmit=()=>{
    try{ setError(""); setInfo(""); if(mode==="login"){ login(email,password);} else if(mode==="register"){ register(name,email,password);} play('success'); if(mode!=="register") nav("/play"); else nav("/play"); }catch(e){ setError(e.message); play('error'); }
  };

  const sendReset=()=>{
    setError(""); setInfo("");
    const users = readLS(LS_USERS, []);
    const u = users.find(x=> x.email===email);
    if(!u){ setError("ไม่พบอีเมลนี้"); return; }
    const map = getResetMap();
    const code = genCode();
    map[email] = { code, exp: Date.now() + 10*60*1000 };
    setResetMap(map);
    setCodeSent(true);
    setInfo(`โค้ดรีเซ็ต (เดโม): ${code} — ใช้ได้ 10 นาที\n*ในระบบจริงจะส่งทางอีเมล`);
  };

  const doReset=()=>{
    setError(""); setInfo("");
    const map = getResetMap(); const rec = map[email];
    if(!rec){ setError("ยังไม่ได้ขอโค้ดสำหรับอีเมลนี้"); return; }
    if(Date.now() > rec.exp){ setError("โค้ดหมดอายุ"); return; }
    if(resetCode !== rec.code){ setError("โค้ดไม่ถูกต้อง"); return; }
    const users = readLS(LS_USERS, []);
    const idx = users.findIndex(u=> u.email===email);
    if(idx<0){ setError("ไม่พบผู้ใช้"); return; }
    users[idx].passHash = hash(newPass);
    writeLS(LS_USERS, users);
    delete map[email]; setResetMap(map);
    setInfo("ตั้งรหัสใหม่สำเร็จ! โปรดเข้าสู่ระบบด้วยรหัสใหม่");
    setMode("login"); setPassword(""); setNewPass(""); setResetCode(""); setCodeSent(false);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <Card title={mode==="login"?"เข้าสู่ระบบ": mode==="register"?"สมัครสมาชิก":"ลืมรหัสผ่าน"}>
        {mode!=="login" && mode!=="forgot" && <TextInput label="ชื่อที่แสดง" value={name} onChange={setName} placeholder="เช่น น้องตรรกะ"/>}
        {(mode!=="register") && <TextInput label="อีเมล" value={email} onChange={setEmail} placeholder="you@example.com"/>}
        {mode==="login" && <TextInput label="รหัสผ่าน" type="password" value={password} onChange={setPassword} placeholder="••••••"/>}
        {mode==="register" && <TextInput label="รหัสผ่าน" type="password" value={password} onChange={setPassword} placeholder="••••••"/>}
        {mode==="forgot" && (
          <>
            {!codeSent ? (
              <Button onClick={sendReset}>ส่งโค้ดรีเซ็ต</Button>
            ) : (
              <>
                <TextInput label="โค้ดรีเซ็ต (6 หลัก)" value={resetCode} onChange={setResetCode} placeholder="เช่น 123456"/>
                <TextInput label="รหัสใหม่" type="password" value={newPass} onChange={setNewPass} placeholder="••••••"/>
                <Button onClick={doReset} variant="success"><KeyRound className="w-4 h-4"/> ตั้งรหัสใหม่</Button>
              </>
            )}
          </>
        )}
        {info && <p className="text-emerald-700 mt-3 whitespace-pre-wrap">{info}</p>}
        {error && <p className="text-rose-600 mt-2">{error}</p>}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {mode!=="forgot" && <Button onClick={onSubmit}><LogIn className="w-4 h-4"/> {mode==="login"?"เข้าสู่ระบบ":"สมัครและเข้าเล่น"}</Button>}
          {mode!=="forgot" && <button className="underline text-rose-600" onClick={()=> setMode(mode==="login"?"register":"login")}>{mode==="login"?"ยังไม่มีบัญชี? สมัคร":"มีบัญชีแล้ว? เข้าสู่ระบบ"}</button>}
          {mode!=="forgot" ? (
            <button className="underline text-rose-600 ml-auto" onClick={()=> { setMode("forgot"); setInfo(""); setError(""); }}>ลืมรหัสผ่าน?</button>
          ) : (
            <button className="underline text-rose-600 ml-auto" onClick={()=> { setMode("login"); setInfo(""); setError(""); setCodeSent(false); }}>กลับไปเข้าสู่ระบบ</button>
          )}
        </div>
      </Card>
      <p className="text-xs text-rose-400 mt-2">แอดมินเริ่มต้น: admin@thawee-koon.app / admin123</p>
    </div>
  );
}

function PlayPage(){
  const levels = listLevels().filter(l=> l.enabled !== false);
  const [q, setQ] = useState("");
  const shown = levels.filter(l => `${l.name} ${l.mode}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="max-w-6xl mx-auto p-4">
      <Card title="เลือกด่าน">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center bg-white/80 border border-pink-100 rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-rose-400 mr-2"/>
            <input className="bg-transparent outline-none" value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาด่าน"/>
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {shown.map(l => (
            <Card key={l.id} title={`${l.name} ${l.difficulty==='easy'?'(ง่าย)':'(ยาก)'}`} right={<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">{l.mode}</span>}>
              <p className="text-rose-700 mb-1">เวลา: {l.timeSec||60}s</p>
              <p className="text-rose-700 mb-4">คะแนนมาตรฐาน: {l.points}</p>
              <LevelPreview level={l}/>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

function LevelPreview({ level }){ const nav = useNavigate(); return <Button onClick={()=> nav(`/play/${level.id}`)}><Swords className="w-4 h-4"/> เล่นด่านนี้</Button>; }

function PlayLevelRouter(){ const { id } = useParams(); return <PlayLevelPage id={id}/>; }

function PreSubmitHint({ predicted }){ const { user } = useAuth(); if(user?.role!=="admin") return null; return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">จะได้ประมาณ {predicted} คะแนน</span>; }

function SideAid({ mode, difficulty }){
  if (difficulty!=="easy") return null;
  if (mode==="Truth Table"){
    return (
      <div className="mt-4 p-3 rounded-2xl bg-white/80 border border-pink-100">
        <div className="font-semibold text-rose-700 mb-1">ตารางช่วย (คำไทย)</div>
        <ul className="text-rose-700 text-sm list-disc pl-5">
          <li>และ (∧): จริง ก็ต่อเมื่อ ทั้งสองเป็นจริง</li>
          <li>หรือ (∨): จริง ถ้ามีสักอันเป็นจริง</li>
          <li>ถ้า..แล้ว (→): เท็จเฉพาะเมื่อ จริง → เท็จ</li>
          <li>เทียบเท่า (↔): ค่าเหมือนกันจึงจริง</li>
          <li>ไม่ (¬): กลับค่าจริง-เท็จ</li>
        </ul>
      </div>
    );
  }
  if (mode==="XOR Maze"){
    return <div className="mt-4 p-3 rounded-2xl bg-white/80 border border-pink-100 text-rose-700 text-sm">XOR จริงเมื่อจำนวน True เป็น <b>คี่</b></div>;
  }
  if (mode==="Implication"){
    return <div className="mt-4 p-3 rounded-2xl bg-white/80 border border-pink-100 text-rose-700 text-sm">จำ: Ponens (p→q, p ⟹ q) / Tollens (p→q, ¬q ⟹ ¬p)</div>;
  }
  return null;
}

function Timer({ seconds, onTimeout }){
  const [left, setLeft] = useState(seconds);
  useEffect(()=>{ setLeft(seconds); }, [seconds]);
  useEffect(()=>{ if(left<=0){ onTimeout?.(); return; } const t=setTimeout(()=> setLeft(l=>l-1), 1000); return ()=> clearTimeout(t); }, [left]);
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">เวลา {left}s</span>;
}

function DifficultyChooser({ defaultDifficulty, onPick, onCancel }){
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-[60]" onClick={onCancel}>
      <div className="max-w-md w-full rounded-3xl p-6 bg-white" onClick={(e)=>e.stopPropagation()}>
        <h3 className="text-xl font-bold text-rose-700 mb-3">เลือกรูปแบบการเล่น</h3>
        <p className="text-rose-700 mb-4">ด่านนี้มี 2 โหมดให้เลือก</p>
        <div className="flex gap-3">
          <Button variant="success" onClick={()=> onPick('easy')}>ง่าย (คำไทย + ตารางช่วย)</Button>
          <Button onClick={()=> onPick('hard')}>ยาก (สัญลักษณ์)</Button>
        </div>
        <div className="mt-4 text-right"><Button variant="danger" onClick={onCancel}>ยกเลิก</Button></div>
      </div>
    </div>
  );
}

function PlayLevelPage({ id }){
  const { user } = useAuth();
  const { state: guideState, setState: setGuideState } = useGuide();
  const { play } = useSound();
  const level = listLevels().find(l => l.id===id);
  const nav = useNavigate();

  const [difficulty, setDifficulty] = useState(level?.difficulty || 'easy');
  const [askDiff, setAskDiff] = useState(false);
  const timeSec = level?.timeSec || 60; // เวลากำหนดโดยแอดมินเท่านั้น

  useEffect(()=>{ if(!level) return; if(level.allowDifficultyChoice){ setAskDiff(true); }}, [id]);
  useEffect(()=>{ if(!level) return; const seen = guideState[level.mode]; if(!seen){ setTimeout(()=> setShowGuide(true), 50);} }, [id]);
  const [showGuide, setShowGuide] = useState(false);

  if (!level) return <Navigate to="/play" replace/>;

  const onFinish=(earned)=>{
    addScore({ userId: user.id, userName: user.name || user.email, mode: level.mode, levelId: level.id, score: earned, time: timeSec });
    play('success');
    alert(`คุณได้รับ ${earned} คะแนน`);
    nav("/leaderboard");
  };

  const onTimeout=()=>{ play('error'); alert('หมดเวลา! ส่งผลคะแนน 0'); onFinish(0); };

  const openGuide=()=> setShowGuide(true);
  const closeGuide=()=>{ setShowGuide(false); setGuideState(s=> ({...s, [level.mode]: true})); };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <Card title={`เล่น: ${level.name}`} right={<div className="flex items-center gap-2"> <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">{level.mode}</span> <Timer seconds={timeSec} onTimeout={onTimeout}/> <Button onClick={openGuide}><HelpCircle className="w-4 h-4"/> คู่มือ</Button> </div>}>
            {level.mode==="Truth Table" && <TruthTableGame level={level} onFinish={onFinish} difficulty={difficulty}/>} 
            {level.mode==="XOR Maze" && <XorMazeGame level={level} onFinish={onFinish} difficulty={difficulty}/>} 
            {level.mode==="Implication" && <ImplicationGame level={level} onFinish={onFinish} difficulty={difficulty}/>} 
            {level.mode==="CNF" && <CNFGame level={level} onFinish={onFinish} difficulty={difficulty}/>} 
          </Card>
        </div>
        <div className="w-72 hidden lg:block">
          <SideAid mode={level.mode} difficulty={difficulty} />
        </div>
      </div>

      {showGuide && <GuideModal mode={level.mode} onClose={closeGuide}/>}    
      {askDiff && <DifficultyChooser defaultDifficulty={level.difficulty} onPick={(d)=>{ setDifficulty(d); setAskDiff(false); }} onCancel={()=>{ setAskDiff(false); }}/>}
    </div>
  );
}

// ---------- Truth Table Game ----------
function TruthTableGame({ level, onFinish, difficulty }){
  const expr = level.data.expr;
  const rows = [{p:true,q:true},{p:true,q:false},{p:false,q:true},{p:false,q:false}];
  const [answers, setAnswers] = useState([null,null,null,null]);
  const truthFn = (p,q)=>{
    const not = x=>!x; const and=(a,b)=>a&&b; const or=(a,b)=>a||b; const imp=(a,b)=>!a||b; const bi=(a,b)=>a===b;
    switch(expr){
      case 'p→q': return imp(p,q);
      case 'p↔q': return bi(p,q);
      case 'p∧q': return and(p,q);
      case 'p∨q': return or(p,q);
      case '(p→q)∧¬r': return imp(p,q) && not(false);
      case '(p∨r)↔(q∧r)': return bi(or(p,false), and(q,false));
      default: return imp(p,q);
    }
  };
  const correct = rows.map(r=> truthFn(r.p,r.q));
  const isDone = answers.every(a=>a!==null);
  const predicted = isDone ? Math.round(answers.reduce((s,a,i)=> s + (a===correct[i]? level.points/rows.length : 0), 0)) : 0;
  const submit = ()=>{ if(!isDone){ alert('ตอบให้ครบก่อนนะ'); return; } onFinish(predicted); };

  return (
    <div>
      <p className="text-rose-700 mb-3">เติมตารางค่าความจริงให้กับ <span className="font-bold">{difficulty==='easy'? toThaiExpr(expr):expr}</span></p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-rose-500"><th className="p-2">{difficulty==='easy'? 'พี':'p'}</th><th className="p-2">{difficulty==='easy'? 'คิว':'q'}</th><th className="p-2">ผล {difficulty==='easy'? toThaiExpr(expr):expr}</th></tr>
          </thead>
          <tbody>
            {rows.map((r,i)=> (
              <tr key={i} className="odd:bg-white/80">
                <td className="p-2">{difficulty==='easy'? (r.p? 'จริง':'เท็จ') : (r.p? 'T':'F')}</td>
                <td className="p-2">{difficulty==='easy'? (r.q? 'จริง':'เท็จ') : (r.q? 'T':'F')}</td>
                <td className="p-2">
                  <select value={answers[i]===null?"":answers[i]? (difficulty==='easy'? 'จริง':'T') : (difficulty==='easy'? 'เท็จ':'F')} onChange={e=>{ const v=e.target.value; const arr=[...answers]; arr[i]= v===""?null:(difficulty==='easy'? (v==='จริง') : (v==='T')); setAnswers(arr); }} className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100">
                    <option value="">เลือก</option>
                    {difficulty==='easy'? (<>
                      <option value="จริง">จริง</option>
                      <option value="เท็จ">เท็จ</option>
                    </>) : (<>
                      <option value="T">T</option>
                      <option value="F">F</option>
                    </>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} variant="success"><ClipboardCheck className="w-4 h-4"/> ส่งคำตอบ</Button>
        <PreSubmitHint predicted={predicted}/>
      </div>
    </div>
  );
}

function toThaiExpr(expr){ return expr.replaceAll('p','พี').replaceAll('q','คิว').replaceAll('¬','ไม่ ').replaceAll('∧',' และ ').replaceAll('∨',' หรือ ').replaceAll('→',' ถ้า..แล้ว ').replaceAll('↔',' เทียบเท่า '); }

// ---------- XOR Maze Game ----------
function XorMazeGame({ level, onFinish, difficulty }){
  const vars = level.data.vars;
  const [state, setState] = useState(Object.fromEntries(vars.map(v=>[v,false])));
  const toggles = vars.map(v=> state[v]).filter(Boolean).length;
  const condition = (toggles % 2 === 1);
  const good = level.data.targetOdd ? condition : !condition;
  const predicted = good ? level.points : 0;
  const submit=()=>{ if(!good){ alert('ยังไม่ผ่านเงื่อนไข XOR'); return; } onFinish(predicted); };
  return (
    <div>
      <p className="text-rose-700 mb-3">ทำให้ XOR({vars.join(', ')}) เป็นจริง จำนวน True ต้องเป็น <b>คี่</b></p>
      <div className="flex gap-2 flex-wrap">
        {vars.map(v=> (
          <Button key={v} onClick={()=> setState(s=>({...s, [v]: !s[v]}))} variant={state[v]?"success":"primary"}>{v}: {difficulty==='easy' ? (state[v]? 'จริง':'เท็จ') : (state[v]? 'True':'False')}</Button>
        ))}
      </div>
      <div className="mt-4"><p className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${good? 'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>สถานะ: {good? (difficulty==='easy'? 'ประตูเปิด (จริง)':'Open (True)') : (difficulty==='easy'? 'ยังไม่เปิด (เท็จ)':'Closed (False)')}</p></div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} variant={good?"success":"warn"}><ClipboardCheck className="w-4 h-4"/> ยืนยัน</Button>
        <PreSubmitHint predicted={predicted}/>
      </div>
    </div>
  );
}

// ---------- Implication Game ----------
function ImplicationGame({ level, onFinish, difficulty }){
  const questions=[
    { id:"q1", premise:["p→q","p"], ask:"สรุปอะไรได้?", choices:["q","¬q","p↔q"], ans:"q", rule:"Modus Ponens"},
    { id:"q2", premise:["p→q","¬q"], ask:"สรุปอะไรได้?", choices:["¬p","p","q"], ans:"¬p", rule:"Modus Tollens"},
  ];
  const [idx] = useState(0);
  const [choice, setChoice] = useState(null);
  const item = questions[idx];
  const isCorrect = choice && choice===item.ans;
  const predicted = isCorrect? level.points : Math.floor(level.points/4);
  const submit=()=>{ if(!choice){ alert('เลือกคำตอบก่อน'); return; } onFinish(predicted); };
  const toThai=(s)=> s.replace('¬','ไม่ ').replace('→',' ถ้า..แล้ว ').replace('↔',' เทียบเท่า ');
  return (
    <div>
      <p className="text-rose-700">จากสมมุติฐาน: <span className="font-medium">{(difficulty==='easy'? item.premise.map(toThai).join(', ') : item.premise.join(', '))}</span></p>
      <p className="text-rose-700 mb-3">{item.ask}</p>
      <div className="flex gap-2 flex-wrap">{item.choices.map(c=> (<Button key={c} onClick={()=> setChoice(c)} variant={choice===c?"success":"primary"}>{difficulty==='easy'? toThai(c):c}</Button>))}</div>
      {choice && (<p className="mt-3 text-rose-700">เฉลย: {isCorrect? <span className="text-emerald-700 font-semibold">ถูกต้อง ({item.rule})</span> : <span className="text-rose-700 font-semibold">ยังไม่ถูก (กฎที่ถูกคือ {item.rule})</span>}</p>)}
      <div className="mt-4 flex items-center gap-3"><Button onClick={submit} variant="success"><ClipboardCheck className="w-4 h-4"/> ส่งผล</Button><PreSubmitHint predicted={predicted}/></div>
    </div>
  );
}

// ---------- CNF Mini ----------
function CNFGame({ level, onFinish, difficulty }){
  const q={ expr: level.data.expr, choices:["(¬p ∨ q) ∧ (r ∨ ¬s) ∧ (¬r ∨ s)","(p ∧ ¬q) ∨ (r ∧ s)","(p ∨ q) ∧ (¬r ∨ s)"], ansIdx:0 };
  const [pick, setPick] = useState(null);
  const correct = pick===q.ansIdx;
  const predicted = correct? level.points : Math.floor(level.points/5);
  const submit=()=>{ if(pick===null){ alert('เลือกคำตอบก่อน'); return; } onFinish(predicted); };
  return (
    <div>
      <p className="text-rose-700 mb-3">แปลงสูตร <b>{difficulty==='easy'? toThaiExpr(q.expr):q.expr}</b> ให้เป็น CNF ที่ถูกต้อง</p>
      <div className="space-y-2">
        {q.choices.map((c,i)=> (
          <label key={i} className={`block rounded-2xl p-3 border cursor-pointer ${pick===i?"border-emerald-300 bg-emerald-50":"border-pink-100 bg-white/90"}`}>
            <input type="radio" className="mr-2" name="cnf" checked={pick===i} onChange={()=> setPick(i)} /> {difficulty==='easy'? toThaiExpr(c):c}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3"><Button onClick={submit} variant="success"><ClipboardCheck className="w-4 h-4"/> ส่งผล</Button><PreSubmitHint predicted={predicted}/></div>
    </div>
  );
}

// ==========================
// Leaderboard
// ==========================
function LeaderboardPage(){
  const rows = topScores(100);
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card title="กระดานคะแนนยอดนิยม" right={<Trophy className="w-5 h-5 text-pink-500"/>}>
        {rows.length===0? <p className="text-rose-700">ยังไม่มีคะแนน ลองเล่นสักด่าน!</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-rose-500"><th className="p-2">ผู้เล่น</th><th className="p-2">โหมด</th><th className="p-2">ด่าน</th><th className="p-2">คะแนน</th><th className="p-2">เวลา</th><th className="p-2">เมื่อ</th></tr></thead>
              <tbody>
                {rows.map(r=> (
                  <tr key={r.id} className="odd:bg-white/80">
                    <td className="p-2">{r.userName}</td><td className="p-2">{r.mode}</td><td className="p-2">{r.levelId}</td>
                    <td className="p-2 font-semibold">{r.score}</td><td className="p-2">{r.time}s</td><td className="p-2 text-rose-400">{new Date(r.ts).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================
// Profile
// ==========================
function ProfilePage(){
  const { user } = useAuth();
  const all = readLS(LS_SCORES, []);
  const mine = all.filter(s=> s.userId===user?.id).sort((a,b)=> b.ts-a.ts);
  const [oldp, setOldp] = useState("");
  const [newp, setNewp] = useState("");
  const [msg, setMsg] = useState("");
  const changePass=()=>{ const users=readLS(LS_USERS,[]); const me=users.find(u=> u.id===user.id); if(!me) return; if(me.passHash!==hash(oldp)){ setMsg("รหัสเดิมไม่ถูกต้อง"); return; } me.passHash=hash(newp); writeLS(LS_USERS, users); setMsg("อัปเดตรหัสผ่านแล้ว"); };
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card title="โปรไฟล์ของฉัน" right={<ShieldCheck className="w-5 h-5 text-emerald-500"/>}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-rose-700"><b>ชื่อ:</b> {user?.name}</p>
            <p className="text-rose-700"><b>อีเมล:</b> {user?.email}</p>
            <p className="text-rose-700"><b>สถานะ:</b> {user?.role}</p>
          </div>
          <div>
            <p className="text-rose-700"><b>สถิติ:</b> เล่น {mine.length} ครั้ง, คะแนนเฉลี่ย {avg(mine.map(m=>m.score)).toFixed(0)}</p>
            <div className="mt-3">
              <TextInput label="รหัสเดิม" type="password" value={oldp} onChange={setOldp}/>
              <TextInput label="รหัสใหม่" type="password" value={newp} onChange={setNewp}/>
              <Button onClick={changePass} variant="success"><KeyRound className="w-4 h-4"/> เปลี่ยนรหัสผ่าน</Button>
              {msg && <p className="text-rose-600 mt-2">{msg}</p>}
            </div>
          </div>
        </div>
      </Card>
      <div className="mt-4">
        <Card title="ประวัติคะแนนล่าสุด">
          {mine.length===0? <p className="text-rose-700">ยังไม่มีข้อมูล</p> : (
            <ul className="text-rose-700 space-y-1">{mine.map(m => <li key={m.id}>[{new Date(m.ts).toLocaleString()}] {m.mode} / {m.levelId} — <b>{m.score}</b> คะแนน</li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function avg(arr){ if(arr.length===0) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }

// ==========================
// Admin Page — Users/Scores/Levels + Theme & Site + Trash/Recovery
// ==========================
function AdminPage(){
  const { site, setSite } = useSite();
  const [levels, setLevels] = useState(listLevels());
  const [users, setUsers] = useState(readLS(LS_USERS, []));
  const [scores, setScores] = useState(readLS(LS_SCORES, []));
  const [trash, setTrash] = useState(listTrash());
  const [filterU, setFilterU] = useState("");
  const [filterS, setFilterS] = useState("");
  const [pwDrafts, setPwDrafts] = useState({});

  useEffect(()=>{ saveLevels(levels); },[levels]);

  const syncUsers=(next)=>{ writeLS(LS_USERS, next); setUsers(next); };
  const syncScores=(next)=>{ writeLS(LS_SCORES, next); setScores(next); };
  const syncTrash=(next)=>{ writeLS(LS_TRASH, next); setTrash(next); };

  // ---------- New Level Wizard ----------
  const [nw, setNw] = useState({ mode:"Truth Table", name:"ด่านใหม่", expr:"p→q", vars:"a,b,c", points:100, difficulty:"easy", timeSec:60, enabled:true, allowDifficultyChoice:false });
  const addLevelQuick=()=>{
    const newLevel = {
      id: `custom_${cryptoRandomId().slice(0,6)}`,
      mode: nw.mode,
      name: nw.name,
      data: nw.mode==="XOR Maze"? { vars: nw.vars.split(',').map(s=>s.trim()).filter(Boolean), targetOdd:true } : { expr: nw.expr },
      points: Number(nw.points)||0,
      difficulty: nw.difficulty,
      timeSec: Number(nw.timeSec)||60,
      enabled: !!nw.enabled,
      allowDifficultyChoice: !!nw.allowDifficultyChoice,
    };
    setLevels(lv=> [...lv, newLevel]);
  };

  // ---------- Levels CRUD ----------
  const delLevel=(id)=>{
    if(!confirm('ลบเลเวลนี้?')) return;
    // ลบจาก state โดยตรง + ส่งเข้าถังขยะ แล้วบันทึก
    setLevels(curr => {
      const target = curr.find(x=> x.id===id);
      if (target) pushTrash({ type:'level', data: target });
      const next = curr.filter(x=> x.id!==id);
      saveLevels(next);
      return next;
    });
    setTrash(listTrash());
  };
  const moveLevel=(id, dir)=>{ setLevels(lv=> { const idx=lv.findIndex(x=> x.id===id); if(idx<0) return lv; const ni=idx+(dir==='up'?-1:1); if(ni<0||ni>=lv.length) return lv; const copy=[...lv]; const [it]=copy.splice(idx,1); copy.splice(ni,0,it); return copy; }); };

  // ---------- Users CRUD ----------
  const updateUser=(id, patch)=>{ const next=users.map(u=> u.id===id? {...u, ...patch}:u); syncUsers(next); };
  const promote=(id)=> updateUser(id, { role: "admin"});
  const deleteUser=(id)=>{ if(!confirm("ลบผู้ใช้นี้และคะแนนที่เกี่ยวข้อง?")) return; const nextU=users.filter(u=> u.id!==id); const removedUser = users.find(u=>u.id===id); if(removedUser) pushTrash({ type:'user', data: removedUser }); const nextS=scores.filter(s=> s.userId!==id); syncUsers(nextU); syncScores(nextS); setTrash(listTrash()); };

  // ---------- Scores CRUD ----------
  const patchScore=(id, patch)=>{ const next=scores.map(s=> s.id===id? {...s, ...patch}:s); syncScores(next); };
  const removeScore=(id)=>{ if(!confirm("ลบคะแนนนี้?")) return; const target = scores.find(s=> s.id===id); if(target) pushTrash({ type:'score', data: target }); const next=scores.filter(s=> s.id!==id); syncScores(next); setTrash(listTrash()); };

  const shownUsers = users.filter(u=> `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(filterU.toLowerCase()));
  const shownScores = scores.filter(s=> `${s.userName} ${s.levelId} ${s.mode}`.toLowerCase().includes(filterS.toLowerCase())).sort((a,b)=> b.ts-a.ts);

  // ---------- Trash (Recovery) ----------
  const restoreItem=(tid)=>{
    const items=listTrash();
    const it = items.find(x=> x.id===tid);
    if(!it) return;
    if(it.type==='level'){
      setLevels(lv=> [...lv, { ...it.data, id: it.data.id }]);
    } else if(it.type==='user'){
      syncUsers([...users, it.data]);
    } else if(it.type==='score'){
      syncScores([...scores, it.data]);
    }
    const left = items.filter(x=> x.id!==tid); syncTrash(left);
  };

  const clearTrash=()=>{ if(!confirm('ล้างถังขยะทั้งหมด?')) return; purgeTrash(); setTrash([]); };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Theme & Site */}
      <Card title="ตั้งค่าไซต์ (แบรนด์/คำโปรย/ธีม/คู่มือ)" right={<Palette className="w-5 h-5 text-pink-500"/>}>
        <div className="grid md:grid-cols-3 gap-3">
          <TextInput label="ชื่อแบรนด์" value={site.brand} onChange={v=> setSite({...site, brand:v})}/>
          <TextInput label="คำโปรยหน้าแรก" value={site.tagline} onChange={v=> setSite({...site, tagline:v})}/>
          <div>
            <span className="block text-sm text-rose-700 mb-1">ธีม</span>
            <select className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100" value={site.theme} onChange={e=> setSite({...site, theme:e.target.value})}>
              {Object.keys(THEME_PRESETS).map(k=> <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {['Truth Table','XOR Maze','Implication','CNF'].map(m=> (
            <TextInput key={m} label={`คู่มือ — ${m}`} value={site.guides[m]||''} onChange={v=> setSite({...site, guides: {...site.guides, [m]: v}})} />
          ))}
        </div>
      </Card>

      {/* New Level Wizard */}
      <Card title="สร้างด่านใหม่แบบด่วน (เลือกทุกอย่างได้)">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <span className="block text-sm text-rose-700 mb-1">โหมด</span>
            <select className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100" value={nw.mode} onChange={e=> setNw({...nw, mode:e.target.value})}>
              <option>Truth Table</option>
              <option>XOR Maze</option>
              <option>Implication</option>
              <option>CNF</option>
            </select>
          </div>
          <TextInput label="ชื่อด่าน" value={nw.name} onChange={v=> setNw({...nw, name:v})}/>
          <TextInput label="คะแนน" type="number" value={nw.points} onChange={v=> setNw({...nw, points:v})}/>
          {nw.mode==="XOR Maze" ? (
            <TextInput label="ตัวแปร (คั่นด้วย ,)" value={nw.vars} onChange={v=> setNw({...nw, vars:v})}/>
          ) : (
            <TextInput label="นิพจน์ (เช่น p→q)" value={nw.expr} onChange={v=> setNw({...nw, expr:v})}/>
          )}
          <TextInput label="เวลา (วินาที)" type="number" value={nw.timeSec} onChange={v=> setNw({...nw, timeSec:v})}/>
          <div>
            <span className="block text-sm text-rose-700 mb-1">ความยากเริ่มต้น</span>
            <select className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100" value={nw.difficulty} onChange={e=> setNw({...nw, difficulty:e.target.value})}>
              <option value="easy">ง่าย (คำไทย)</option>
              <option value="hard">ยาก (สัญลักษณ์)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={nw.enabled} onChange={e=> setNw({...nw, enabled:e.target.checked})}/> เปิดใช้งาน</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={nw.allowDifficultyChoice} onChange={e=> setNw({...nw, allowDifficultyChoice:e.target.checked})}/> ให้ผู้เล่นเลือกโหมดก่อนเข้า</label>
          </div>
        </div>
        <div className="mt-3"><Button onClick={addLevelQuick}><Plus className="w-4 h-4"/> เพิ่มด่าน</Button></div>
      </Card>

      {/* Levels */}
      <Card title="จัดการเลเวล (เปิด/ปิด, เวลา, โหมด, กู้คืนได้จากถังขยะ)">
        <div className="grid md:grid-cols-2 gap-3">
          {levels.map(l=> (
            <div key={l.id} className="p-3 rounded-2xl bg-white/90 border border-pink-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-rose-700">{l.name}</div>
                  <div className="text-xs text-rose-400">{l.mode} • {l.points} คะแนน • เวลา {l.timeSec||60}s • id: {l.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={()=> moveLevel(l.id,'up')}><ChevronUp className="w-4 h-4"/></Button>
                  <Button onClick={()=> moveLevel(l.id,'down')}><ChevronDown className="w-4 h-4"/></Button>
                  <Button variant="danger" onClick={()=> delLevel(l.id)}><Trash2 className="w-4 h-4"/> ลบ</Button>
                </div>
              </div>
              <div className="mt-2 grid md:grid-cols-3 gap-2">
                <TextInput label="ชื่อ" value={l.name} onChange={v=> setLevels(a=> a.map(x=> x.id===l.id? {...x, name:v}:x))}/>
                <div>
                  <span className="block text-sm text-rose-700 mb-1">โหมด</span>
                  <select className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100" value={l.mode} onChange={e=> setLevels(a=> a.map(x=> x.id===l.id? {...x, mode:e.target.value}:x))}>
                    <option>Truth Table</option>
                    <option>XOR Maze</option>
                    <option>Implication</option>
                    <option>CNF</option>
                  </select>
                </div>
                <div>
                  <span className="block text-sm text-rose-700 mb-1">ความยาก</span>
                  <select className="w-full rounded-2xl px-4 py-2 bg-white/80 border border-pink-100" value={l.difficulty||'easy'} onChange={e=> setLevels(a=> a.map(x=> x.id===l.id? {...x, difficulty:e.target.value}:x))}>
                    <option value="easy">ง่าย (คำไทย + ตารางช่วย)</option>
                    <option value="hard">ยาก (สัญลักษณ์)</option>
                  </select>
                </div>
                {l.mode==="Truth Table" && <TextInput label="นิพจน์" value={l.data.expr||''} onChange={v=> setLevels(a=> a.map(x=> x.id===l.id? {...x, data:{...x.data, expr:v}}:x))}/>}
                {l.mode==="XOR Maze" && <TextInput label="ตัวแปรคอมม่า" value={(l.data.vars||[]).join(',')} onChange={v=> setLevels(a=> a.map(x=> x.id===l.id? {...x, data:{...x.data, vars: v.split(',').map(s=>s.trim()).filter(Boolean)}}:x))}/>}
                <TextInput label="คะแนน" type="number" value={l.points} onChange={v=> setLevels(a=> a.map(x=> x.id===l.id? {...x, points:Number(v)}:x))}/>
                <TextInput label="เวลา (วินาที)" type="number" value={l.timeSec||60} onChange={v=> setLevels(a=> a.map(x=> x.id===l.id? {...x, timeSec:Number(v)}:x))}/>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={l.enabled!==false} onChange={e=> setLevels(a=> a.map(x=> x.id===l.id? {...x, enabled:e.target.checked}:x))}/> เปิดใช้งาน</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!l.allowDifficultyChoice} onChange={e=> setLevels(a=> a.map(x=> x.id===l.id? {...x, allowDifficultyChoice:e.target.checked}:x))}/> ให้ผู้เล่นเลือกโหมดก่อนเข้า</label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Users */}
      <Card title="ผู้ใช้ (ดู/แก้ไข/ลบ/ตั้งเป็นแอดมิน/ตั้งรหัสใหม่)" right={<Wrench className="w-5 h-5 text-pink-500"/>}>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center bg-white/90 border border-pink-100 rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-rose-400 mr-2"/>
            <input className="bg-transparent outline-none" value={filterU} onChange={e=>setFilterU(e.target.value)} placeholder="ค้นหาผู้ใช้"/>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-rose-500"><th className="p-2">ชื่อ</th><th className="p-2">อีเมล</th><th className="p-2">สิทธิ์</th><th className="p-2">ตั้งรหัสใหม่</th><th className="p-2">จัดการอื่นๆ</th></tr></thead>
            <tbody>
              {shownUsers.map(u=> (
                <tr key={u.id} className="odd:bg-white/80">
                  <td className="p-2"><input className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100" value={u.name} onChange={e=> updateUser(u.id, { name:e.target.value })}/></td>
                  <td className="p-2"><input className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100" value={u.email} onChange={e=> updateUser(u.id, { email:e.target.value })}/></td>
                  <td className="p-2">
                    <select className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100" value={u.role} onChange={e=> updateUser(u.id, { role:e.target.value })}>
                      <option value="player">player</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="p-2 flex items-center gap-2">
                    <input type="password" className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100" placeholder="รหัสใหม่" value={pwDrafts[u.id]||''} onChange={e=> setPwDrafts(d=> ({...d, [u.id]: e.target.value}))}/>
                    <Button variant="success" onClick={()=>{ const pw=pwDrafts[u.id]; if(!pw) return alert('กรุณากรอกรหัสใหม่'); updateUser(u.id, { passHash: hash(pw) }); setPwDrafts(d=> ({...d, [u.id]: ''})); alert('ตั้งรหัสใหม่แล้ว'); }}><KeyRound className="w-4 h-4"/> บันทึก</Button>
                  </td>
                  <td className="p-2 flex gap-2 flex-wrap">
                    {u.role!=="admin" && <Button variant="warn" onClick={()=> promote(u.id)}><Edit3 className="w-4 h-4"/> ตั้งเป็นแอดมิน</Button>}
                    <Button onClick={()=> deleteUser(u.id)} variant="danger"><Trash2 className="w-4 h-4"/> ลบ</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scores */}
      <Card title="คะแนนทั้งหมด (ดู/แก้/ลบ)">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center bg-white/90 border border-pink-100 rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-rose-400 mr-2"/>
            <input className="bg-transparent outline-none" value={filterS} onChange={e=>setFilterS(e.target.value)} placeholder="ค้นหาโดยผู้เล่น/ด่าน/โหมด"/>
          </div>
        </div>
        {shownScores.length===0? <p className="text-rose-700">ยังไม่มีคะแนน</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-rose-500"><th className="p-2">ผู้เล่น</th><th className="p-2">โหมด</th><th className="p-2">ด่าน</th><th className="p-2">คะแนน</th><th className="p-2">เวลา(s)</th><th className="p-2">เมื่อ</th><th className="p-2">จัดการ</th></tr></thead>
              <tbody>
                {shownScores.map(s=> (
                  <tr key={s.id} className="odd:bg-white/80">
                    <td className="p-2">{s.userName}</td>
                    <td className="p-2">{s.mode}</td>
                    <td className="p-2">{s.levelId}</td>
                    <td className="p-2"><input type="number" className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100 w-24" value={s.score} onChange={e=> patchScore(s.id, { score: Number(e.target.value) })}/></td>
                    <td className="p-2"><input type="number" className="rounded-xl px-2 py-1 bg-white/90 border border-pink-100 w-20" value={s.time} onChange={e=> patchScore(s.id, { time: Number(e.target.value) })}/></td>
                    <td className="p-2 text-rose-400">{new Date(s.ts).toLocaleString()}</td>
                    <td className="p-2"><Button variant="danger" onClick={()=> removeScore(s.id)}><Trash2 className="w-4 h-4"/> ลบ</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Trash / Recovery */}
      <Card title="ถังขยะ (สิ่งที่ถูกลบ กู้คืนได้)" right={<Button variant="danger" onClick={clearTrash}><Trash2 className="w-4 h-4"/> ล้างถังขยะ</Button>}>
        {trash.length===0? <p className="text-rose-700">ถังขยะว่าง</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-rose-500"><th className="p-2">ประเภท</th><th className="p-2">ข้อมูลย่อ</th><th className="p-2">เวลา</th><th className="p-2">กู้คืน</th></tr></thead>
              <tbody>
                {trash.map(t=> (
                  <tr key={t.id} className="odd:bg-white/80">
                    <td className="p-2">{t.type}</td>
                    <td className="p-2 text-rose-700">{t.type==='level'? t.data.name : t.type==='user'? t.data.email : `${t.data.userName} • ${t.data.levelId}`}</td>
                    <td className="p-2 text-rose-400">{new Date(t.ts).toLocaleString()}</td>
                    <td className="p-2"><Button onClick={()=> restoreItem(t.id)}><Undo2 className="w-4 h-4"/> กู้คืน</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================
// App Shell
// ==========================
function AppShell(){
  const theme = useTheme();
  const { site } = useSite();
  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg}`}>
      <TopNav/>
      <div className="py-6">
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/play" element={<Protected><PlayPage/></Protected>}/>
          <Route path="/play/:id" element={<Protected><PlayLevelRouter/></Protected>}/>
          <Route path="/leaderboard" element={<LeaderboardPage/>}/>
          <Route path="/profile" element={<Protected><ProfilePage/></Protected>}/>
          <Route path="/admin" element={<Protected role="admin"><AdminPage/></Protected>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </div>
      <footer className="text-center text-xs text-rose-500 py-6">© {new Date().getFullYear()} {site.brand}. All rights reserved</footer>
    </div>
  );
}

export default function ThaweeKoonApp(){
  return (
    <SoundProvider>
      <AuthProvider>
        <MemoryRouter>
          <AppShell/>
        </MemoryRouter>
      </AuthProvider>
    </SoundProvider>
  );
}
