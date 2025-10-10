:root{
  --accent:#1e88e5;  /* azul */
  --accent-2:#42a5f5;
  --bgglass: rgba(10,10,12,0.55);
  --panel-w: 360px;
  --radius:12px;
  --transition-duration: 800ms;
}

*{box-sizing:border-box}
html,body{height:100%;margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;background:#000;color:#fff}
body{overflow:auto;background:#000}
.hidden { display: none !important; }

/* VIDEO: ahora con z-index ALTO para aparecer al frente y transición de opacidad */
.bg-video{
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1000;    /* video al frente */
  background: black;
  display:block;
  opacity: 1;
  transition: opacity var(--transition-duration) ease;
  will-change: opacity;
}

/* Clase para hacer fade-out */
.bg-video.fade-out{
  opacity: 0;
  pointer-events: none;
}

/* Overlay: sobre el video (también con transición) */
.video-overlay{
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;    /* overlay encima del video */
  background: rgba(0,0,0,0.45);
  opacity: 1;
  transition: opacity var(--transition-duration) ease, visibility var(--transition-duration) ease;
  visibility: visible;
}
.video-overlay.hidden{ opacity: 0; visibility: hidden; }

/* Overlay card (no cambia) */
.overlay-card{
  background: rgba(10,10,12,0.92);
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  color: #fff;
  min-width: 280px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.overlay-actions{ display:flex; gap:8px; justify-content:center; margin-top:8px; }

/* Botones — AZUL con texto blanco */
button{
  appearance:none;border:0;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:700;color:#fff;
}
.primary{ background: linear-gradient(90deg,var(--accent),var(--accent-2)); }
.secondary{ background: rgba(255,255,255,0.06); color:#fff; border: 1px solid rgba(255,255,255,0.08); }
.small{ padding:6px 8px; font-size:0.87rem; border-radius:8px; background: linear-gradient(180deg,var(--accent),var(--accent-2)); }

/* UI hidden/visible states with smooth fade */
.ui-hidden{
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition: opacity var(--transition-duration) ease, transform var(--transition-duration) ease, visibility var(--transition-duration) ease;
}
.ui-visible{
  opacity: 1 !important;
  visibility: visible !important;
  transform: translateY(0) !important;
}

/* Topbar (bajo el video) */
.topbar{
  position:fixed;left:0;right:0;top:0;height:56px;padding:8px 16px;display:flex;align-items:center;gap:12px;
  background:linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15));
  backdrop-filter: blur(6px);z-index:20; /* debajo del video */
}
.topbar h1{font-size:1rem;margin:0}
.icon-btn{font-size:1.1rem;padding:8px;border-radius:8px;border:0;background:transparent;color:var(--accent);cursor:pointer}
.topbar .right{margin-left:auto;display:flex;gap:8px;align-items:center}

/* Sidebar */
.sidepanel{
  position:fixed;left:16px;top:76px;width:var(--panel-w);padding:12px;border-radius:var(--radius);
  background:var(--bgglass);box-shadow:0 10px 30px rgba(0,0,0,0.6);z-index:18;max-height:calc(100% - 96px);overflow:auto;
}
.panel-section{margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.03);padding-bottom:8px}
.panel-section h2{margin:0 0 8px 0;font-size:0.95rem}
.muted{opacity:0.78}

/* Main layout */
.main{margin-top:72px;margin-left:400px;padding:20px;display:flex;gap:18px;align-items:flex-start}
.canvas-card{flex:1;padding:12px;border-radius:10px;backdrop-filter: blur(4px);box-shadow:0 6px 20px rgba(0,0,0,0.6)}
.white-card{background:#ffffff;color:#000}
.canvas-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
canvas { width:100% !important; height:520px !important; display:block; background:#fff; border-radius:6px; }

/* results panel */
.results-panel{width:380px;background:rgba(0,0,0,0.22);padding:12px;border-radius:10px;max-height:70vh;overflow:auto}
.row{display:flex;gap:8px;align-items:center}
.row.between{display:flex;justify-content:space-between;align-items:center}
.log{white-space:pre-wrap;background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;min-height:120px}

/* Responsive */
@media (max-width:1000px){
  .main{margin-left:20px;flex-direction:column;}
  .sidepanel{position:relative;top:auto;left:auto;width:100%;margin:12px}
  .topbar h1{display:none}
}
