import { useState, useCallback } from "react";

const TIKWM_API = "/api/tikwm";
const MAX_DURATION = 5 * 60;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #f0f0f0; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  .app { min-height: 100vh; background: #0a0a0a; position: relative; overflow: hidden; }
  .bg-glow { position: fixed; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(0,255,198,0.06) 0%, transparent 70%); top: -200px; left: -200px; pointer-events: none; z-index: 0; }
  .bg-glow2 { position: fixed; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(255,0,80,0.05) 0%, transparent 70%); bottom: -100px; right: -100px; pointer-events: none; z-index: 0; }
  .container { max-width: 1100px; margin: 0 auto; padding: 40px 24px; position: relative; z-index: 1; }
  .header { text-align: center; margin-bottom: 48px; }
  .logo { font-family: 'Bebas Neue', cursive; font-size: clamp(52px, 8vw, 88px); letter-spacing: 4px; line-height: 1; background: linear-gradient(135deg, #ffffff 0%, #00ffc6 50%, #ff0050 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 12px; }
  .subtitle { color: #666; font-size: 14px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; }
  .search-box { background: #111; border: 1px solid #1e1e1e; border-radius: 16px; padding: 28px; margin-bottom: 32px; transition: border-color 0.3s; }
  .search-box:focus-within { border-color: #00ffc6; }
  .input-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #444; margin-bottom: 12px; display: block; }
  .input-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .url-input { flex: 1; min-width: 260px; background: #0a0a0a; border: 1px solid #222; border-radius: 10px; padding: 14px 18px; color: #f0f0f0; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
  .url-input:focus { border-color: #00ffc6; }
  .url-input::placeholder { color: #333; }
  .btn { padding: 14px 28px; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .btn-primary { background: linear-gradient(135deg, #00ffc6, #00b8ff); color: #000; }
  .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,255,198,0.25); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-zip { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; }
  .btn-zip:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(168,85,247,0.3); }
  .btn-zip:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: #666; border: 1px solid #222; }
  .btn-ghost:hover { border-color: #444; color: #aaa; }
  .btn-sm { padding: 8px 16px; font-size: 12px; border-radius: 8px; }
  .status-bar { display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #111; border: 1px solid #1e1e1e; border-radius: 10px; margin-bottom: 24px; font-size: 13px; color: #888; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #00ffc6; animation: pulse 1.5s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .error-bar { padding: 14px 20px; background: rgba(255,0,80,0.06); border: 1px solid rgba(255,0,80,0.2); border-radius: 10px; margin-bottom: 24px; font-size: 13px; color: #ff6685; }
  .info-bar { padding: 12px 20px; background: rgba(0,255,198,0.04); border: 1px solid rgba(0,255,198,0.1); border-radius: 10px; margin-bottom: 24px; font-size: 13px; color: #00ffc6; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .toolbar-right { display: flex; gap: 10px; flex-wrap: wrap; }
  .count-badge { font-family: 'Bebas Neue', cursive; font-size: 28px; letter-spacing: 1px; color: #00ffc6; line-height: 1; }
  .count-label { font-size: 12px; color: #444; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }
  .selected-info { font-size: 13px; color: #666; padding: 6px 14px; background: #111; border: 1px solid #1e1e1e; border-radius: 20px; }
  .selected-info span { color: #00ffc6; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .card { background: #111; border: 2px solid transparent; border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 0.2s; position: relative; }
  .card:hover { border-color: #1e1e1e; transform: translateY(-2px); }
  .card.selected { border-color: #00ffc6; box-shadow: 0 0 20px rgba(0,255,198,0.15); }
  .card-thumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #1a1a1a; }
  .card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
  .card:hover .card-thumb img { transform: scale(1.04); }
  .duration-badge { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.75); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
  .check-overlay { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.6); border: 2px solid #333; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .card.selected .check-overlay { background: #00ffc6; border-color: #00ffc6; }
  .check-icon { color: #000; font-size: 14px; font-weight: 700; opacity: 0; transition: opacity 0.2s; }
  .card.selected .check-icon { opacity: 1; }
  .card-info { padding: 12px; }
  .card-stats { display: flex; gap: 10px; font-size: 11px; color: #444; margin-bottom: 6px; }
  .card-desc { font-size: 12px; color: #555; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
  .dl-btn-wrap { padding: 0 12px 12px; }
  .loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .skeleton { background: #111; border-radius: 14px; overflow: hidden; }
  .skeleton-thumb { aspect-ratio: 9/16; background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
  .skeleton-line { height: 10px; background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%); background-size: 200% 100%; border-radius: 5px; margin: 12px; animation: shimmer 1.5s infinite; }
  .skeleton-line.short { width: 60%; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .empty-state { text-align: center; padding: 80px 40px; }
  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', cursive; font-size: 32px; letter-spacing: 2px; color: #222; margin-bottom: 8px; }
  .empty-sub { font-size: 13px; color: #333; }
  .tips { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tip-tag { font-size: 12px; padding: 5px 12px; background: #111; border: 1px solid #1e1e1e; border-radius: 20px; color: #444; cursor: pointer; transition: all 0.2s; }
  .tip-tag:hover { border-color: #333; color: #777; }
  .tip-label { font-size: 12px; color: #333; }
  .progress-wrap { background: #111; border: 1px solid #222; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
  .progress-title { font-size: 14px; color: #ccc; font-weight: 600; margin-bottom: 6px; }
  .progress-sub { font-size: 12px; color: #555; margin-bottom: 14px; }
  .progress-bar { height: 6px; background: #1a1a1a; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
  .progress-fill { height: 100%; border-radius: 6px; transition: width 0.3s; }
  .progress-fill.zip { background: linear-gradient(90deg, #a855f7, #6366f1); }
  .progress-pct { font-size: 12px; color: #666; text-align: right; }
  @media (max-width: 600px) {
    .grid, .loading-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .input-row { flex-direction: column; }
    .url-input { min-width: unset; width: 100%; }
    .btn { width: 100%; text-align: center; }
  }
`;

function formatNum(n: number) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseUsername(input: string) {
  input = input.trim();
  const match = input.match(/tiktok\.com\/@([^/?&]+)/);
  if (match) return match[1];
  if (input.startsWith("@")) return input.slice(1);
  if (!input.includes("/") && !input.includes(".")) return input;
  return null;
}

function isSingleVideo(input: string) {
  return input.includes("tiktok.com") && input.includes("/video/");
}

// تحميل فيديو واحد كـ blob - يجرب مباشر أولاً ثم عبر proxy
async function getVideoBlob(dlUrl: string): Promise<Blob> {
  try {
    // أولاً: جرب مباشر
    const res = await fetch(dlUrl, { mode: 'cors' });
    if (res.ok) return await res.blob();
    throw new Error("direct failed");
  } catch {
    // ثانياً: عبر proxy
    const res = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`);
    if (!res.ok) throw new Error("فشل التحميل");
    return await res.blob();
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipDone, setZipDone] = useState(0);
  const [zipTotal, setZipTotal] = useState(0);
  const [zipPhase, setZipPhase] = useState("");
  const [zipCompressProgress, setZipCompressProgress] = useState(0);

  const fetchProfile = useCallback(async (username: string) => {
    setLoading(true);
    setError("");
    setVideos([]);
    setSkipped(0);
    setSelected(new Set());
    setStatus(`جاري جلب فيديوهات @${username}...`);
    try {
      const res = await fetch(`${TIKWM_API}?endpoint=user/posts&unique_id=${username}&count=35&cursor=0`);
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error("تعذّر جلب البروفايل. تحقق من اسم المستخدم.");
      const all = data.data?.videos || [];
      if (all.length === 0) throw new Error("لا توجد فيديوهات في هذا الحساب.");
      const filtered = all.filter((v: any) => !v.duration || v.duration <= MAX_DURATION);
      const skip = all.length - filtered.length;
      setVideos(filtered);
      setSkipped(skip);
      setStatus(`تم جلب ${filtered.length} فيديو من @${username}`);
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSingle = useCallback(async (videoUrl: string) => {
    setLoading(true);
    setError("");
    setStatus("جاري جلب الفيديو...");
    try {
      const res = await fetch(`${TIKWM_API}?endpoint=&url=${encodeURIComponent(videoUrl)}`);
      const data = await res.json();
      if (!data || data.code !== 0) throw new Error("تعذّر جلب الفيديو.");
      const v = data.data;
      if (v.duration && v.duration > MAX_DURATION) throw new Error("هذا الفيديو أطول من 5 دقائق.");
      setVideos([v]);
      setStatus("تم جلب الفيديو بنجاح!");
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    const input = url.trim();
    if (!input) return;
    setError("");
    if (isSingleVideo(input)) fetchSingle(input);
    else {
      const username = parseUsername(input);
      if (!username) { setError("أدخل رابط بروفايل مثل: tiktok.com/@username أو @username"); return; }
      fetchProfile(username);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectAll = () => {
    if (selected.size === videos.length) setSelected(new Set());
    else setSelected(new Set(videos.map((v) => v.id)));
  };

  const downloadOne = async (video: any) => {
    const dlUrl = video.play || video.wmplay;
    if (!dlUrl) return;
    const id = video.id;
    setDownloading((p) => new Set(p).add(id));
    try {
      const blob = await getVideoBlob(dlUrl);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok_${id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      setError("فشل تحميل الفيديو، جرّب مرة أخرى.");
    } finally {
      setDownloading((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  const downloadAsZip = async () => {
    const toDownload = videos.filter((v) => selected.has(v.id));
    if (!toDownload.length) return;

    setIsZipping(true);
    setZipDone(0);
    setZipTotal(toDownload.length);
    setZipPhase("download");
    setZipCompressProgress(0);
    setError("");

    try {
      // تحميل JSZip
      if (!(window as any).JSZip) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        document.head.appendChild(script);
        await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
      }

      const JSZip = (window as any).JSZip;
      const zip = new JSZip();
      let done = 0;
      let failed = 0;

      // تحميل كل الفيديوهات وإضافتها للـ zip
      for (const v of toDownload) {
        const dlUrl = v.play || v.wmplay;
        try {
          const blob = await getVideoBlob(dlUrl);
          zip.file(`tiktok_${v.id}.mp4`, blob);
        } catch {
          failed++;
        }
        done++;
        setZipDone(done);
      }

      // ضغط الملف
      setZipPhase("compress");
      const zipBlob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 1 } },
        (meta: any) => { setZipCompressProgress(Math.round(meta.percent)); }
      );

      // تحميل الـ ZIP
      const success = done - failed;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `tikload_${success}_videos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      setStatus(`✅ تم تجميع ${success} فيديو في ملف ZIP!${failed > 0 ? ` (فشل ${failed})` : ""}`);
      setSelected(new Set());
    } catch (e: any) {
      setError("فشل إنشاء ZIP: " + e.message);
    } finally {
      setIsZipping(false);
      setZipPhase("");
    }
  };

  const zipPercent = zipPhase === "download"
    ? Math.round((zipDone / zipTotal) * 100)
    : zipCompressProgress;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="bg-glow" /><div className="bg-glow2" />
        <div className="container">
          <div className="header">
            <div className="logo">TIKLOAD</div>
            <div className="subtitle">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          <div className="search-box">
            <label className="input-label">رابط البروفايل أو الفيديو</label>
            <div className="input-row">
              <input className="url-input" placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} dir="ltr" />
              <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !url.trim()}>
                {loading ? "جاري الجلب..." : "جلب الفيديوهات"}
              </button>
            </div>
            <div className="tips">
              <span className="tip-label">أمثلة:</span>
              {["@mrbeast", "@khaby.lame", "@charlidamelio"].map((ex) => (
                <span key={ex} className="tip-tag" onClick={() => setUrl(ex)}>{ex}</span>
              ))}
            </div>
          </div>

          {error && <div className="error-bar">⚠ {error}</div>}
          {status && !error && <div className="status-bar"><div className="status-dot" />{status}</div>}
          {skipped > 0 && <div className="info-bar">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق تلقائياً</div>}

          {isZipping && (
            <div className="progress-wrap">
              <div className="progress-title">
                {zipPhase === "download" ? `⬇ جاري تحميل الفيديوهات... (${zipDone} من ${zipTotal})` : "🗜 جاري ضغط الملفات..."}
              </div>
              <div className="progress-sub">
                {zipPhase === "download" ? `تم تحميل ${zipDone} فيديو بنجاح` : `اكتمل ${zipCompressProgress}%`}
              </div>
              <div className="progress-bar">
                <div className="progress-fill zip" style={{ width: `${zipPercent}%` }} />
              </div>
              <div className="progress-pct">{zipPercent}%</div>
            </div>
          )}

          {loading && (
            <div className="loading-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="skeleton" key={i}>
                  <div className="skeleton-thumb" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          )}

          {!loading && videos.length > 0 && (
            <>
              <div className="toolbar">
                <div className="toolbar-left">
                  <div>
                    <div className="count-badge">{videos.length}</div>
                    <div className="count-label">فيديو</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                    {selected.size === videos.length ? "إلغاء الكل" : "تحديد الكل"}
                  </button>
                  {selected.size > 0 && (
                    <div className="selected-info"><span>{selected.size}</span> محدد</div>
                  )}
                </div>
                {selected.size > 0 && (
                  <div className="toolbar-right">
                    <button className="btn btn-zip btn-sm" onClick={downloadAsZip} disabled={isZipping}>
                      {isZipping ? `🗜 ${zipPercent}%` : `🗜 تحميل ZIP (${selected.size} فيديو)`}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid">
                {videos.map((v) => (
                  <div key={v.id} className={`card ${selected.has(v.id) ? "selected" : ""}`} onClick={() => toggleSelect(v.id)}>
                    <div className="card-thumb">
                      <img src={v.cover || v.origin_cover} alt="" loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {v.duration && <div className="duration-badge">{formatDuration(v.duration)}</div>}
                      <div className="check-overlay"><span className="check-icon">✓</span></div>
                    </div>
                    <div className="card-info">
                      <div className="card-stats">
                        <span>❤ {formatNum(v.digg_count)}</span>
                        <span>▶ {formatNum(v.play_count)}</span>
                      </div>
                      <div className="card-desc">{v.title || "بدون عنوان"}</div>
                    </div>
                    <div className="dl-btn-wrap">
                      <button className="btn btn-primary btn-sm" style={{ width: "100%" }}
                        onClick={(e) => { e.stopPropagation(); downloadOne(v); }}
                        disabled={downloading.has(v.id) || isZipping}>
                        {downloading.has(v.id) ? "⏳ جاري..." : "⬇ تحميل"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && videos.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-icon">🎬</div>
              <div className="empty-title">ابدأ من هنا</div>
              <div className="empty-sub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
