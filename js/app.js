// js/app.js — control del video al frente + fade-out y UI; además UI XRD (Chart.js con zoom)
// NOTA: este archivo asume que tu index.html ya contiene los ids:
// #bgVideo, #videoOverlay, #playBtn, #playNoFsBtn, #topbar, #sidePanel, #mainArea, etc.

(() => {
  /********* PARTE A: manejo del video (aparece al frente y luego se quita con fade) *********/
  const video = document.getElementById('bgVideo');
  const overlay = document.getElementById('videoOverlay');
  const playBtn = document.getElementById('playBtn');
  const playNoFsBtn = document.getElementById('playNoFsBtn');

  const topbar = document.getElementById('topbar');
  const sidePanel = document.getElementById('sidePanel');
  const mainArea = document.getElementById('mainArea');

  // Muestra la UI principal y oculta video (hace fade para transición suave)
  function hideVideoAndShowUI() {
    if (video) {
      // añadir clase para fade
      video.classList.add('fade-out');
    }
    if (overlay) {
      overlay.classList.add('fade-out');
    }

    // esperar a que termine la transición (600ms en CSS) y luego hacer display:none
    setTimeout(() => {
      if (video) {
        video.style.display = 'none';
        // opcional: liberar src si quieres liberar memoria
        // video.src = '';
      }
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
      }
      // mostrar UI
      topbar && topbar.classList.remove('hidden');
      sidePanel && sidePanel.classList.remove('hidden');
      mainArea && mainArea.classList.remove('hidden');
    }, 700);
  }

  // Try autoplay; si funciona ocultamos overlay. Si falla mostramos overlay.
  function tryAutoplay() {
    if (!video) { hideVideoAndShowUI(); return; }
    const p = video.play();
    if (p !== undefined) {
      p.then(() => {
        // autoplay worked: overlay hidden
        overlay && overlay.classList.add('hidden');
      }).catch(() => {
        // blocked -> show overlay on top of video
        overlay && overlay.classList.remove('hidden');
      });
    } else {
      // legacy: hide overlay shortly
      setTimeout(()=> overlay && overlay.classList.add('hidden'), 300);
    }
  }

  // Si el usuario presiona reproducir (con interacción), pedimos fullscreen y reproducimos
  async function playAndFullscreen() {
    try {
      await video.play();
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch(e) {
      console.warn('playAndFullscreen error', e);
    } finally {
      // ocultar overlay (inmediato) — video queda al frente hasta ended
      overlay && overlay.classList.add('hidden');
    }
  }
  async function playNoFullscreen() {
    try { await video.play(); } catch(e){ console.warn(e); }
    overlay && overlay.classList.add('hidden');
  }

  if (playBtn) playBtn.addEventListener('click', playAndFullscreen);
  if (playNoFsBtn) playNoFsBtn.addEventListener('click', playNoFullscreen);

  // Si el video termina naturalmente — hacer fade-out y mostrar UI
  if (video) {
    video.addEventListener('ended', () => {
      hideVideoAndShowUI();
    });

    // Caso opcional: si quieres que se quite antes de que termine,
    // descomenta y ajusta el timeout (por ejemplo 8000 ms)
    // setTimeout(()=>{ if (!video.paused) hideVideoAndShowUI(); }, 8000);
  }

  // Reintentar autoplay tras interacción del usuario
  function onFirstUserInteraction() {
    tryAutoplay();
    window.removeEventListener('click', onFirstUserInteraction);
    window.removeEventListener('keydown', onFirstUserInteraction);
    window.removeEventListener('touchstart', onFirstUserInteraction);
  }
  window.addEventListener('click', onFirstUserInteraction);
  window.addEventListener('keydown', onFirstUserInteraction);
  window.addEventListener('touchstart', onFirstUserInteraction);

  // Intentar autoplay ahora
  tryAutoplay();

  /********* PARTE B: la interfaz XRD (gráfica, zoom, operaciones) *********/
  // --- Elementos UI ---
  const fileInput = document.getElementById('fileInput');
  const fileNameLabel = document.getElementById('fileName');
  const logEl = document.getElementById('log');
  const smoothWindow = document.getElementById('smoothWindow');
  const smoothVal = document.getElementById('smoothVal');
  const applySmoothBtn = document.getElementById('applySmooth');
  const baselineDeg = document.getElementById('baselineDeg');
  const applyBaselineBtn = document.getElementById('applyBaseline');
  const resetBaselineBtn = document.getElementById('resetBaseline');
  const peakThresh = document.getElementById('peakThresh');
  const peakThreshVal = document.getElementById('peakThreshVal');
  const detectPeaksBtn = document.getElementById('detectPeaks');
  const estimatePeakBtn = document.getElementById('estimatePeak');
  const fitPeakBtn = document.getElementById('fitPeak');
  const togglePanel = document.getElementById('togglePanel');
  const xrdCanvas = document.getElementById('xrdChart');
  const exportJson = document.getElementById('exportJson');
  const sendBackend = document.getElementById('sendBackend');
  const downloadPNG = document.getElementById('downloadPNG');
  const resetZoomBtn = document.getElementById('resetZoom');
  const sendUrl = '/.netlify/functions/refine';

  const log = (s) => { if (logEl) logEl.textContent = `[${new Date().toLocaleTimeString()}] ${s}\n` + logEl.textContent; };

  // --- Estado y utilidades (idéntico a versiones previas) ---
  let rawX = [], rawY = [], procY = [], baseline = null, peaks = [], selectedPeak = null, chart = null;

  function parseTextToXY(txt) {
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^#/.test(l));
    const xs = [], ys = [];
    for (const line of lines) {
      const parts = line.replace(/\s+/g, ' ').split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 2) {
        const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) { xs.push(a); ys.push(b); }
      }
    }
    return { xs, ys };
  }

  function smoothArray(arr, windowSize){
    const w = Math.max(1, Math.floor(windowSize));
    if (w <= 1) return arr.slice();
    const n = arr.length, out = new Array(n).fill(0), half = Math.floor(w/2);
    for (let i=0;i<n;i++){ let s=0,c=0; for (let j=i-half;j<=i+half;j++){ if (j>=0 && j<n){ s+=arr[j]; c++; }} out[i]=s/c; }
    return out;
  }

  function baselinePolyFit(x,y,deg=2){
    const n=x.length, m=deg+1;
    const A=new Array(m).fill(0).map(()=>new Array(m).fill(0)); const b=new Array(m).fill(0);
    const xPows=new Array(2*deg+1).fill(0);
    for (let i=0;i<n;i++){ let xi=1; for (let p=0;p<=2*deg;p++){ xPows[p]+=xi; xi*=x[i]; }}
    for (let row=0;row<m;row++){ for (let col=0;col<m;col++) A[row][col]=xPows[row+col]; let s=0; for (let i=0;i<n;i++) s+=y[i]*Math.pow(x[i],row); b[row]=s; }
    for (let i=0;i<m;i++) A[i].push(b[i]);
    for (let i=0;i<m;i++){ let maxR=i; for (let r=i+1;r<m;r++) if (Math.abs(A[r][i])>Math.abs(A[maxR][i])) maxR=r; [A[i],A[maxR]]=[A[maxR],A[i]]; const piv=A[i][i]; if (Math.abs(piv)<1e-12) continue; for (let j=i;j<=m;j++) A[i][j]/=piv; for (let r=0;r<m;r++){ if (r===i) continue; const fac=A[r][i]; for (let c=i;c<=m;c++) A[r][c]-=fac*A[i][c]; }} 
    const coeffs=new Array(m).fill(0); for (let i=0;i<m;i++) coeffs[i]=A[i][m]; return coeffs;
  }
  function evaluatePoly(coeffs,x){ let s=0,p=1; for (let i=0;i<coeffs.length;i++){ s+=coeffs[i]*p; p*=x; } return s; }

  function detectPeaks(y, opts={thresholdFactor:0.2,minDistance:3}){
    const out=[]; const n=y.length; const mean = n? y.reduce((a,b)=>a+b,0)/n : 0; const thr = Math.max(0, mean * opts.thresholdFactor);
    for (let i=1;i<n-1;i++){
      if (y[i] > y[i-1] && y[i] > y[i+1] && y[i] >= thr) {
        if (out.length && Math.abs(i - out[out.length-1].index) < opts.minDistance) {
          if (y[i] > out[out.length-1].y) out[out.length-1] = { index:i, y:y[i] };
        } else out.push({ index:i, y:y[i] });
      }
    }
    return out;
  }

  function estimateGaussian(xArr,yArr,idx){
    const x0=xArr[idx], amp=yArr[idx], half=amp/2;
    let left=idx,right=idx;
    while (left>0 && yArr[left]
