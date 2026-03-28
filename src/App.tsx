import { useState, useCallback, useEffect } from "react";

const TIKWM_API = "/api/tikwm";
const MAX_DURATION = 5 * 60;
const LIBRARY_KEY = "tikload_lib_v2";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ── helpers ─────────────────────────────────────────────
const fmt = (n: number) =>
  !n ? "0" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
const daysAgo = (ts: number) => Math.floor((Date.now() - ts) / 86400000);

function parseUsername(v: string) {
  v = v.trim();
  const m = v.match(/tiktok\.com\/@([^/?&]+)/);
  if (m) return m[1];
  if (v.startsWith("@")) return v.slice(1);
  if (!v.includes("/") && !v.includes(".")) return v;
  return null;
}
const isVideoUrl = (v: string) => v.includes("tiktok.com") && v.includes("/video/");

// ── localStorage helpers (sync) ──────────────────────────
function libRead(): LibItem[] {
  try {
    const raw: LibItem[] = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    return raw.filter(x => Date.now() - x.savedAt < ONE_MONTH_MS);
  } catch { return []; }
}
function libWrite(items: LibItem[]) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); } catch {}
}

// ── types ────────────────────────────────────────────────
type Video = {
  id: string; cover: string; origin_cover: string;
  title: string; duration: number;
  play: string; wmplay: string;
  digg_count: number; play_count: number;
};
type LibItem = { id: string; cover: string; title: string; savedAt: number; };
type SortKey = "default" | "views" | "likes" | "shortest" | "longest";
type DlMode = "device" | "library";

// ── styles ───────────────────────────────────────────────
const S = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e8e8;font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.app{min-height:100vh;background:#080808}
.g1{position:fixed;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(0,255,198,.05) 0%,transparent 65%);top:-250px;left:-250px;pointer-events:none;z-index:0}
.g2{position:fixed;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,0,80,.04) 0%,transparent 65%);bottom:-150px;right:-150px;pointer-events:none;z-index:0}
.pg{max-width:1140px;margin:0 auto;padding:40px 20px 80px;position:relative;z-index:1}

.hdr{text-align:center;margin-bottom:36px}
.logo{font-family:'Bebas Neue',cursive;font-size:clamp(58px,9vw,96px);letter-spacing:6px;line-height:1;background:linear-gradient(135deg,#fff 0%,#00ffc6 45%,#ff0050 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}
.tag{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#333}

.nav{display:flex;gap:4px;margin-bottom:28px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:5px;width:fit-content}
.nb{padding:9px 22px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#444;display:flex;align-items:center;gap:6px}
.nb.on{background:#161616;color:#e8e8e8}
.nbadge{min-width:18px;height:18px;border-radius:99px;background:#00ffc6;color:#000;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}

.mbar{display:flex;align-items:center;gap:10px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:14px 20px;margin-bottom:18px;flex-wrap:wrap}
.mlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2e2e2e;flex-shrink:0}
.mopts{display:flex;gap:6px}
.mopt{padding:7px 16px;border-radius:10px;border:1px solid #1c1c1c;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#444;cursor:pointer;transition:all .2s}
.mopt:hover{border-color:#2a2a2a;color:#777}
.mopt.on{background:#111;border-color:#00ffc6;color:#00ffc6}
.mopt.on.lib{border-color:#a855f7;color:#a855f7;background:rgba(168,85,247,.06)}
.mdesc{font-size:12px;color:#2a2a2a;width:100%;margin-top:4px}

.sc{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:18px;padding:24px 28px;margin-bottom:18px;transition:border-color .25s}
.sc:focus-within{border-color:#00ffc6}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#2a2a2a;margin-bottom:12px}
.row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.inp{flex:1 1 240px;background:#080808;border:1px solid #1c1c1c;border-radius:11px;padding:12px 16px;color:#e8e8e8;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s;min-height:46px}
.inp:focus{border-color:#00ffc6}
.inp::placeholder{color:#222}
.chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
.chip{font-size:12px;padding:4px 13px;background:#0a0a0a;border:1px solid #181818;border-radius:99px;color:#2e2e2e;cursor:pointer;transition:all .2s}
.chip:hover{border-color:#2a2a2a;color:#666}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 22px;min-height:46px;border:none;border-radius:11px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.3;cursor:not-allowed!important;transform:none!important}
.bf{background:linear-gradient(135deg,#00ffc6,#00b4ff);color:#000}
.bf:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,255,198,.28)}
.bd{background:linear-gradient(135deg,#ff0050,#ff4d00);color:#fff}
.bd:not(:disabled):hover{transform:translateY(-1px)}
.bl{background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff}
.bl:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(168,85,247,.28)}
.bm{background:#111;color:#555;border:1px solid #1e1e1e}
.bm:not(:disabled):hover{border-color:#333;color:#999}
.bo{background:transparent;color:#555;border:1px solid #1c1c1c}
.bo:not(:disabled):hover{border-color:#333;color:#999}
.bs{padding:0 14px;min-height:34px;font-size:12px;border-radius:9px}

.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.flab{font-size:10px;color:#2a2a2a;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.fb{padding:6px 13px;border-radius:99px;border:1px solid #181818;background:transparent;color:#383838;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.fb:hover{border-color:#2a2a2a;color:#777}
.fb.on{background:#141414;border-color:#00ffc6;color:#00ffc6}

.al{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:11px;font-size:13px;margin-bottom:14px;line-height:1.5}
.ae{background:rgba(255,0,80,.05);border:1px solid rgba(255,0,80,.15);color:#ff6685}
.ai{background:rgba(0,255,198,.04);border:1px solid rgba(0,255,198,.1);color:#00e6b0}
.as{background:#0f0f0f;border:1px solid #1c1c1c;color:#555}
.aw{background:rgba(255,180,0,.04);border:1px solid rgba(255,180,0,.12);color:#c8950a}
.pd{width:7px;height:7px;border-radius:50%;background:#00ffc6;flex-shrink:0;margin-top:3px;animation:pulse 1.6s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}

.prc{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:14px;padding:18px 22px;margin-bottom:18px}
.prh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.prt{font-size:13px;font-weight:600;color:#bbb}
.prp{font-size:13px;color:#555}
.prtr{height:5px;background:#161616;border-radius:99px;overflow:hidden;margin-bottom:6px}
.prf{height:100%;border-radius:99px;transition:width .3s}
.prf.device{background:linear-gradient(90deg,#00ffc6,#00b4ff)}
.prf.library{background:linear-gradient(90deg,#a855f7,#6366f1)}
.prs{font-size:11px;color:#2e2e2e}

.tbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.tbl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.sn{font-family:'Bebas Neue',cursive;font-size:30px;letter-spacing:1px;color:#00ffc6;line-height:1}
.sl{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#252525}

/* SEL BAR */
.selbar{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.selbar-l{display:flex;align-items:center;gap:10px}
.selbar-r{display:flex;gap:8px;flex-wrap:wrap}
.sel-c{font-family:'Bebas Neue',cursive;font-size:22px;color:#00ffc6;letter-spacing:1px}
.sel-c.lib{color:#a855f7}
.sel-t{font-size:12px;color:#333}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:13px}

/* CARD */
.card{background:#0d0d0d;border:2px solid transparent;border-radius:15px;overflow:hidden;display:flex;flex-direction:column;user-select:none;position:relative;transition:border-color .15s,transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);border-color:#1e1e1e}
.card.sd{border-color:#00ffc6;box-shadow:0 0 18px rgba(0,255,198,.12)}
.card.sl2{border-color:#a855f7;box-shadow:0 0 18px rgba(168,85,247,.12)}

.th{position:relative;aspect-ratio:9/16;overflow:hidden;background:#111;flex-shrink:0;cursor:pointer}
.th img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.card:hover .th img{transform:scale(1.04)}
.dur{position:absolute;bottom:7px;left:7px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:6px}
.ck{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid #2a2a2a;display:flex;align-items:center;justify-content:center;transition:all .15s;z-index:2}
.card.sd .ck{background:#00ffc6;border-color:#00ffc6}
.card.sl2 .ck{background:#a855f7;border-color:#a855f7}
.ct{font-size:13px;font-weight:800;color:#000;opacity:0;transition:opacity .15s}
.card.sd .ct,.card.sl2 .ct{opacity:1}
.snum{position:absolute;top:8px;left:8px;min-width:22px;height:22px;border-radius:99px;background:#00ffc6;color:#000;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;z-index:2}
.card.sl2 .snum{background:#a855f7;color:#fff}

.cb{padding:10px 12px 5px;flex:1}
.cs{display:flex;gap:10px;font-size:11px;color:#333;margin-bottom:5px}
.cd{font-size:12px;color:#3e3e3e;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cf{padding:7px 11px 11px;display:flex;flex-direction:column;gap:5px}
.dlb{width:100%;min-height:34px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.dlb:disabled{opacity:.3;cursor:not-allowed}
.dlb.dv{background:linear-gradient(135deg,#00ffc6,#00b4ff);color:#000}
.dlb.dv:not(:disabled):hover{transform:translateY(-1px)}
.dlb.lo{background:rgba(168,85,247,.1);color:#a855f7;border:1px solid rgba(168,85,247,.2)}
.dlb.lo:not(:disabled):hover{background:rgba(168,85,247,.18)}
.ilt{width:100%;min-height:28px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid rgba(0,255,198,.15);background:rgba(0,255,198,.04);color:#00a87a;display:flex;align-items:center;justify-content:center;gap:5px}

.lmw{display:flex;justify-content:center;margin-top:28px}

.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:13px}
.sk{background:#0d0d0d;border-radius:15px;overflow:hidden}
.skt{aspect-ratio:9/16;background:linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl{height:9px;margin:10px 12px 0;border-radius:5px;background:linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl.s{width:55%;margin-bottom:11px}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}

.emp{text-align:center;padding:80px 20px}
.ei{font-size:50px;margin-bottom:16px}
.et{font-family:'Bebas Neue',cursive;font-size:34px;letter-spacing:2px;color:#1c1c1c;margin-bottom:6px}
.es{font-size:13px;color:#222}

.lhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.lt{font-family:'Bebas Neue',cursive;font-size:26px;letter-spacing:2px;color:#3a3a3a}
.lstats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.lstat{background:#0d0d0d;border:1px solid #141414;border-radius:11px;padding:12px 18px}
.lsn{font-family:'Bebas Neue',cursive;font-size:24px;color:#a855f7}
.lsl{font-size:11px;color:#2a2a2a}
.li{background:#0d0d0d;border:1px solid #141414;border-radius:13px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
.li:hover{border-color:rgba(168,85,247,.25)}
.lth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#111}
.lth img{width:100%;height:100%;object-fit:cover;display:block}
.la{position:absolute;top:7px;left:7px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px}
.la.old{background:rgba(255,0,80,.75);color:#fff}
.la.ok{background:rgba(0,255,198,.15);color:#00ffc6}
.lbd{padding:10px 12px 12px;flex:1;display:flex;flex-direction:column;gap:6px}
.ld{font-size:12px;color:#3a3a3a;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1}
.ldt{font-size:11px;color:#232323}
.lr{min-height:30px;border-radius:8px;border:none;background:rgba(255,0,80,.07);color:#ff4466;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .2s}
.lr:hover{background:rgba(255,0,80,.14)}
.lemp{text-align:center;padding:60px 20px}
.lei{font-size:42px;margin-bottom:14px}
.let{font-size:13px;color:#1e1e1e;line-height:1.7}

@media(max-width:560px){
  .grid,.sg{grid-template-columns:repeat(2,1fr);gap:9px}
  .row{flex-direction:column}
  .inp{flex:1 1 100%}
  .btn{width:100%}
  .sc{padding:16px}
  .selbar-r{width:100%}
  .selbar-r .btn{flex:1}
}
`;

// ════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]       = useState<"search"|"library">("search");
  const [dlMode, setDlMode] = useState<DlMode>("device");
  const [url, setUrl]       = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string|null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [selOrder, setSelOrder] = useState<string[]>([]);   // ترتيب التحديد
  const [loading, setLoading]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");
  const [dlId, setDlId]     = useState<string|null>(null);
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkDone, setBulkDone]   = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkLabel, setBulkLabel] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  // ── المكتبة: state + localStorage بشكل مباشر ──────────
  const [library, setLibraryState] = useState<LibItem[]>(() => libRead());

  // كل تغيير في المكتبة يُحفظ فوراً
  const setLibrary = useCallback((updater: LibItem[] | ((prev: LibItem[]) => LibItem[])) => {
    setLibraryState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      libWrite(next);           // حفظ فوري في localStorage
      return next;
    });
  }, []);

  // إضافة قائمة فيديوهات للمكتبة دفعة واحدة (بدون تكرار)
  const addBatchToLib = useCallback((vs: Video[]) => {
    setLibraryState(prev => {
      const existIds = new Set(prev.map(x => x.id));
      const now = Date.now();
      const newItems: LibItem[] = [];
      for (const v of vs) {
        const id = String(v.id);
        if (!existIds.has(id)) {
          existIds.add(id);
          newItems.push({ id, cover: v.cover || v.origin_cover, title: v.title || "بدون عنوان", savedAt: now });
        }
      }
      if (!newItems.length) return prev;
      const next = [...newItems, ...prev];
      libWrite(next);           // حفظ فوري
      return next;
    });
  }, []);

  const addToLib = useCallback((v: Video) => addBatchToLib([v]), [addBatchToLib]);

  const isInLib = (id: string) => library.some(x => x.id === id);

  // ── fetch helpers ────────────────────────────────────
  const fetchPage = async (username: string, cur?: string) => {
    const qs = `endpoint=user/posts&unique_id=${username}&count=35${cur ? `&cursor=${cur}` : ""}`;
    const r  = await fetch(`${TIKWM_API}?${qs}`);
    const d  = await r.json();
    if (!d || d.code !== 0) throw new Error("تعذّر جلب البروفايل. تحقق من اسم المستخدم.");
    const all: Video[] = d.data?.videos || [];
    const filtered = all.filter(v => !v.duration || v.duration <= MAX_DURATION);
    return { filtered, skipped: all.length - filtered.length, nextCursor: d.data?.cursor, more: !!d.data?.hasMore };
  };

  const fetchProfile = useCallback(async (username: string) => {
    setLoading(true); setError(""); setVideos([]); setSkipped(0);
    setSelOrder([]); setCursor(null); setHasMore(false); setCurrentUser(username);
    setStatus(`جاري جلب فيديوهات @${username}...`);
    try {
      const pg = await fetchPage(username);
      if (!pg.filtered.length) throw new Error("لا توجد فيديوهات في هذا الحساب.");
      setVideos(pg.filtered);
      setSkipped(pg.skipped);
      setCursor(pg.nextCursor || null);
      setHasMore(pg.more);
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.more ? " · اضغط «تحميل المزيد» للمزيد" : ""}`);
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, []);

  const loadMore = async () => {
    if (!currentUser || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const pg = await fetchPage(currentUser, cursor);
      setVideos(prev => {
        const ids = new Set(prev.map(v => String(v.id)));
        return [...prev, ...pg.filtered.filter(v => !ids.has(String(v.id)))];
      });
      setSkipped(p => p + pg.skipped);
      setCursor(pg.nextCursor || null);
      setHasMore(pg.more);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingMore(false); }
  };

  const fetchSingle = useCallback(async (videoUrl: string) => {
    setLoading(true); setError(""); setStatus("جاري جلب الفيديو...");
    try {
      const r = await fetch(`${TIKWM_API}?endpoint=&url=${encodeURIComponent(videoUrl)}`);
      const d = await r.json();
      if (!d || d.code !== 0) throw new Error("تعذّر جلب الفيديو.");
      if (d.data?.duration > MAX_DURATION) throw new Error("هذا الفيديو أطول من 5 دقائق.");
      setVideos([d.data]); setHasMore(false); setStatus("تم جلب الفيديو بنجاح!");
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = () => {
    const v = url.trim(); if (!v) return; setError("");
    if (isVideoUrl(v)) fetchSingle(v);
    else { const u = parseUsername(v); if (!u) { setError("أدخل رابط بروفايل مثل: @username"); return; } fetchProfile(u); }
  };

  // ── selection ────────────────────────────────────────
  const toggleSel = (id: string) =>
    setSelOrder(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelOrder(videos.map(v => String(v.id)));
  const clearSel  = () => setSelOrder([]);

  // ── sorted videos ────────────────────────────────────
  const sorted = [...videos].sort((a, b) => {
    if (sortKey === "views")    return b.play_count  - a.play_count;
    if (sortKey === "likes")    return b.digg_count  - a.digg_count;
    if (sortKey === "shortest") return a.duration    - b.duration;
    if (sortKey === "longest")  return b.duration    - a.duration;
    return 0;
  });

  // ── download one ─────────────────────────────────────
  const downloadToDevice = async (video: Video): Promise<boolean> => {
    const dlUrl = video.play || video.wmplay;
    if (!dlUrl) return false;
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok_${video.id}.mp4`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
      return true;
    } catch { return false; }
  };

  const downloadOne = async (video: Video) => {
    const id = String(video.id);
    setDlId(id); setError("");
    if (dlMode === "library") { addToLib(video); setDlId(null); return; }
    const ok = await downloadToDevice(video);
    if (ok) addToLib(video); else setError("فشل تحميل الفيديو.");
    setDlId(null);
  };

  // ── bulk action ──────────────────────────────────────
  const bulkAction = async () => {
    const videoMap = new Map(videos.map(v => [String(v.id), v]));
    const toProcess = selOrder.map(id => videoMap.get(id)).filter(Boolean) as Video[];
    if (!toProcess.length) return;

    setBulkActive(true); setBulkDone(0); setBulkTotal(toProcess.length); setError("");

    if (dlMode === "library") {
      // ─ حفظ في المكتبة: دفعة واحدة فورية ─
      setBulkLabel("جاري الحفظ في المكتبة...");
      addBatchToLib(toProcess);
      setBulkDone(toProcess.length);
      await new Promise(r => setTimeout(r, 400));
      setBulkActive(false); setBulkLabel("");
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة!`);
      clearSel();
      return;
    }

    // ─ تحميل على الجهاز: واحد ورا واحد ─
    let failed = 0;
    for (let i = 0; i < toProcess.length; i++) {
      setBulkLabel(`فيديو ${i + 1} من ${toProcess.length}`);
      const ok = await downloadToDevice(toProcess[i]);
      if (ok) addToLib(toProcess[i]); else failed++;
      setBulkDone(i + 1);
      await new Promise(r => setTimeout(r, 700));
    }
    setBulkActive(false); setBulkLabel("");
    setStatus(`✅ تم تحميل ${toProcess.length - failed} فيديو!${failed > 0 ? ` (فشل ${failed})` : ""}`);
    clearSel();
  };

  const bulkPct = bulkTotal > 0 ? Math.round((bulkDone / bulkTotal) * 100) : 0;
  const expiringSoon = library.filter(x => daysAgo(x.savedAt) >= 25).length;
  const sorts: { key: SortKey; label: string }[] = [
    { key: "default", label: "الافتراضي" }, { key: "views", label: "▶ الأكثر مشاهدة" },
    { key: "likes", label: "❤ الأكثر لايك" }, { key: "shortest", label: "⏱ الأقصر" }, { key: "longest", label: "⏱ الأطول" },
  ];

  // ════════════════════════════════════════════════════════
  return (
    <>
      <style>{S}</style>
      <div className="app">
        <div className="g1" /><div className="g2" />
        <div className="pg">

          {/* HEADER */}
          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="tag">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          {/* TABS */}
          <div className="nav">
            <button className={`nb${tab === "search" ? " on" : ""}`} onClick={() => setTab("search")}>🔍 البحث</button>
            <button className={`nb${tab === "library" ? " on" : ""}`} onClick={() => setTab("library")}>
              {library.length > 0 && <span className="nbadge">{library.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {/* ═══ SEARCH TAB ═══ */}
          {tab === "search" && <>

            {/* وضع التحميل */}
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${dlMode === "device" ? " on" : ""}`} onClick={() => setDlMode("device")}>💾 على الجهاز</button>
                <button className={`mopt${dlMode === "library" ? " on lib" : ""}`} onClick={() => setDlMode("library")}>📁 في المكتبة</button>
              </div>
              <div className="mdesc">
                {dlMode === "device" ? "⬇ يحمّل على جهازك ويضيفه للمكتبة تلقائياً" : "📁 يحفظ في المكتبة فقط — كل المحدد يُحفظ فوراً دفعة واحدة"}
              </div>
            </div>

            {/* بحث */}
            <div className="sc">
              <label className="fl">رابط البروفايل أو الفيديو</label>
              <div className="row">
                <input className="inp" dir="ltr" placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
                <button className="btn bf" onClick={handleSearch} disabled={loading || !url.trim()}>
                  {loading ? "جاري الجلب..." : "جلب الفيديوهات"}
                </button>
              </div>
              <div className="chips">
                {["@mrbeast", "@khaby.lame", "@charlidamelio"].map(ex => (
                  <span key={ex} className="chip" onClick={() => setUrl(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error   && <div className="al ae">⚠ {error}</div>}
            {status && !error && <div className="al as"><div className="pd" />{status}</div>}
            {skipped > 0 && <div className="al ai">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

            {/* progress */}
            {bulkActive && (
              <div className="prc">
                <div className="prh">
                  <span className="prt">{dlMode === "library" ? "📁 جاري الحفظ..." : "⬇ جاري التحميل..."} {bulkLabel}</span>
                  <span className="prp">{bulkDone}/{bulkTotal}</span>
                </div>
                <div className="prtr"><div className={`prf ${dlMode}`} style={{ width: `${bulkPct}%` }} /></div>
                <div className="prs">{bulkPct}% مكتمل</div>
              </div>
            )}

            {/* skeletons */}
            {loading && (
              <div className="sg">{Array.from({ length: 8 }).map((_, i) => (
                <div className="sk" key={i}><div className="skt" /><div className="skl" /><div className="skl s" /></div>
              ))}</div>
            )}

            {!loading && videos.length > 0 && <>
              {/* filters */}
              <div className="frow">
                <span className="flab">ترتيب:</span>
                {sorts.map(s => <button key={s.key} className={`fb${sortKey === s.key ? " on" : ""}`} onClick={() => setSortKey(s.key)}>{s.label}</button>)}
              </div>

              {/* toolbar */}
              <div className="tbar">
                <div className="tbl">
                  <div><div className="sn">{videos.length}</div><div className="sl">فيديو</div></div>
                  {selOrder.length < videos.length
                    ? <button className="btn bo bs" onClick={selectAll} disabled={bulkActive}>تحديد الكل</button>
                    : <button className="btn bo bs" onClick={clearSel}  disabled={bulkActive}>إلغاء الكل</button>
                  }
                  {selOrder.length > 0 && selOrder.length < videos.length && (
                    <button className="btn bo bs" onClick={clearSel} disabled={bulkActive}>✕ إلغاء التحديد</button>
                  )}
                </div>
              </div>

              {/* selection bar */}
              {selOrder.length > 0 && (
                <div className="selbar">
                  <div className="selbar-l">
                    <div>
                      <div className={`sel-c${dlMode === "library" ? " lib" : ""}`}>{selOrder.length}</div>
                      <div className="sel-t">فيديو محدد — اضغط مجدداً للإلغاء</div>
                    </div>
                  </div>
                  <div className="selbar-r">
                    {dlMode === "library"
                      ? <button className="btn bl bs" onClick={bulkAction} disabled={bulkActive}>
                          {bulkActive ? `📁 ${bulkPct}%` : `📁 حفظ ${selOrder.length} في المكتبة`}
                        </button>
                      : <button className="btn bd bs" onClick={bulkAction} disabled={bulkActive}>
                          {bulkActive ? `⬇ ${bulkPct}%` : `⬇ تحميل ${selOrder.length} فيديو`}
                        </button>
                    }
                  </div>
                </div>
              )}

              {/* GRID */}
              <div className="grid">
                {sorted.map(v => {
                  const id    = String(v.id);
                  const idx   = selOrder.indexOf(id);   // -1 = غير محدد
                  const isSel = idx !== -1;
                  const isDl  = dlId === id;
                  const inLib = isInLib(id);
                  return (
                    <div key={id} className={`card${isSel ? (dlMode === "library" ? " sl2" : " sd") : ""}`}>
                      {/* الصورة = منطقة التحديد */}
                      <div className="th" onClick={() => !bulkActive && !isDl && toggleSel(id)}>
                        <img src={v.cover || v.origin_cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        {v.duration > 0 && <div className="dur">{fmtDur(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel && <div className="snum">{idx + 1}</div>}
                      </div>

                      {/* معلومات */}
                      <div className="cb">
                        <div className="cs"><span>❤ {fmt(v.digg_count)}</span><span>▶ {fmt(v.play_count)}</span></div>
                        <div className="cd">{v.title || "بدون عنوان"}</div>
                      </div>

                      {/* أزرار */}
                      <div className="cf">
                        {dlMode === "library" ? (
                          inLib
                            ? <div className="ilt">✓ محفوظ</div>
                            : <button className="dlb lo" onClick={() => downloadOne(v)} disabled={isDl || bulkActive}>
                                {isDl ? "⏳..." : "📁 حفظ"}
                              </button>
                        ) : (
                          <>
                            <button className="dlb dv" onClick={() => downloadOne(v)} disabled={isDl || bulkActive}>
                              {isDl ? "⏳ جاري..." : "⬇ تحميل"}
                            </button>
                            {inLib
                              ? <div className="ilt">✓ في المكتبة</div>
                              : <button className="dlb lo" onClick={() => addToLib(v)} disabled={bulkActive}>📁 حفظ فقط</button>
                            }
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="lmw">
                  <button className="btn bm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "جاري التحميل..." : "⬇ تحميل المزيد"}
                  </button>
                </div>
              )}
            </>}

            {!loading && videos.length === 0 && !error && (
              <div className="emp">
                <div className="ei">🎬</div>
                <div className="et">ابدأ من هنا</div>
                <div className="es">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {/* ═══ LIBRARY TAB ═══ */}
          {tab === "library" && <>
            {expiringSoon > 0 && (
              <div className="al aw">⚠ {expiringSoon} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>
            )}
            <div className="lhdr">
              <div className="lt">📁 مكتبتي ({library.length})</div>
              {library.length > 0 && (
                <button className="btn bo bs" onClick={() => { if (confirm("مسح المكتبة كاملة؟")) setLibrary([]); }}>🗑 مسح الكل</button>
              )}
            </div>
            {library.length > 0 && (
              <div className="lstats">
                <div className="lstat"><div className="lsn">{library.length}</div><div className="lsl">محفوظ</div></div>
                <div className="lstat"><div className="lsn">{library.filter(x => daysAgo(x.savedAt) < 7).length}</div><div className="lsl">هذا الأسبوع</div></div>
                <div className="lstat"><div className="lsn">{expiringSoon}</div><div className="lsl">تنتهي قريباً</div></div>
              </div>
            )}
            {library.length === 0 ? (
              <div className="lemp">
                <div className="lei">📭</div>
                <div className="let">لم تحفظ أي فيديو بعد.<br />استخدم "حفظ في المكتبة" وستظهر هنا.</div>
              </div>
            ) : (
              <div className="grid">
                {library.map(item => {
                  const days = daysAgo(item.savedAt);
                  return (
                    <div key={item.id} className="li">
                      <div className="lth">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className={`la ${days >= 25 ? "old" : "ok"}`}>{days === 0 ? "اليوم" : `${days} يوم`}</div>
                      </div>
                      <div className="lbd">
                        <div className="ld">{item.title}</div>
                        <div className="ldt">📅 منذ {days} يوم</div>
                        <button className="lr" onClick={() => setLibrary(p => p.filter(x => x.id !== item.id))}>✕ إزالة</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>}

        </div>
      </div>
    </>
  );
}
