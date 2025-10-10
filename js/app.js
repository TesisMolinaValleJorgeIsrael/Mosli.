// js/app.js — añade transición suave: fade-out video + fade-in UI
(() => {
  /********* Parte A: manejo del video inicial (VIDEO AL FRENTE con fade) *********/
  const video = document.getElementById('bgVideo');
  const overlay = document.getElementById('videoOverlay');
  const playBtn = document.getElementById('playBtn');
  const playNoFsBtn = document.getElementById('playNoFsBtn');
  const topbar = document.getElementById('topbar');
  const sidePanel = document.getElementById('sidePanel');
  const mainArea = document.getElementById('mainArea');

  // ensure video is on front
  if (video) {
    video.style.zIndex = 1000;
    video.style.display = 'block';
    video.classList.remove('fade-out');
  }
  if (overlay) overlay.classList.add('hidden');

  // helper: fade-in UI elements (adds ui-visible and removes ui-hidden)
  function fadeInUI() {
    [topbar, sidePanel, mainArea].forEach(el => {
      if (!el) return;
      el.classList.remove('ui-hidden');
      el.classList.add('ui-visible');
    });
  }
  // helper: hide UI instantly (used on init)
  function hideUIInstant() {
    [topbar, sidePanel, mainArea].forEach(el => {
      if (!el) return;
      el.classList.add('ui-hidden');
      el.classList.remove('ui-visible');
    });
  }

  // call at start
  hideUIInstant();

  // Show main UI with fade: fade the video out, then reveal UI when transition ends
  function fadeOutVideoAndShowUI() {
    if (!video) {
      fadeInUI();
      return;
    }
    // start fading out overlay too
    if (overlay) overlay.classList.add('hidden');

    // add fade-out class to video (CSS handles transition)
    video.classList.add('fade-out');

    // wait for transitionend to then hide video and show UI
    const onTransitionEnd = (ev) => {
      if (ev.propertyName === 'opacity') {
        // remove listener
        video.removeEventListener('transitionend', onTransitionEnd);
        // hide video element so it won't block interactability
        try { video.style.display = 'none'; } catch(e){}
        // if fullscreen, try to exit (so UI is visible normally)
        if (document.fullscreenElement) {
          try { document.exitFullscreen(); } catch(e){}
        }
        // show UI
        fadeInUI();
      }
    };
    video.addEventListener('transitionend', onTransitionEnd);
  }

  // Mostrar UI principal (sin animación de video) — fallback
  function showMainUIInstant() {
    if (video) try { video.pause(); video.style.display = 'none'; } catch(e){}
    if (overlay) overlay.classList.add('hidden');
    fadeInUI();
  }

  // Intentar autoplay
  function tryAutoplay() {
    if (!video) { showMainUIInstant(); return; }
    const promise = video.play();
    if (promise !== undefined) {
      promise.then(() => {
        // autoplay OK — overlay hidden
        if (overlay) overlay.classList.add('hidden');
      }).catch(() => {
        // Autoplay bloqueado -> show overlay (with fade)
        if (overlay) overlay.classList.remove('hidden');
      });
    } else {
      setTimeout(()=> overlay && overlay.classList.add('hidden'), 300);
    }
  }

  // overlay buttons
  async function playAndFullscreen() {
    try {
      await video.play();
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch(e){ console.warn(e); }
    // hide overlay smoothly
    if (overlay) overlay.classList.add('hidden');
  }
  async function playNoFullscreen() {
    try { await video.play(); } catch(e){ console.warn(e); }
    if (overlay) overlay.classList.add('hidden');
  }

  playBtn && playBtn.addEventListener('click', playAndFullscreen);
  playNoFsBtn && playNoFsBtn.addEventListener('click', playNoFullscreen);

  // When video ends: fade it out and show UI
  if (video) {
    video.addEventListener('ended', () => {
      fadeOutVideoAndShowUI();
    });
    // Example: if you want to auto-hide earlier (e.g., 8s), uncomment:
    // setTimeout(()=>{ if (!video.paused) { video.pause(); fadeOutVideoAndShowUI(); } }, 8000);
  }

  // If user interacts, retry autoplay
  function onFirstUserInteraction(){ tryAutoplay(); window.removeEventListener('click', onFirstUserInteraction); }
  window.addEventListener('click', onFirstUserInteraction);
  tryAutoplay();

  /********* Parte B: interfaz XRD y gráfica con Chart.js + zoom (sin cambios funcionales) *********/
  // ---------- UI wiring and XRD logic (same as earlier implementation) ----------
  // Elements
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

  // Data
  let rawX = [], rawY = [], procY = [], baseline = null, peaks = [], selectedPeak = null, chart = null;

  // Utils (parsing, smoothing, baseline, peaks, gaussian, refine) - same implementations
  function parseTextToXY(txt) {
    const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !/^#/.test(l));
    const xs=[], ys=[];
    for (const line of lines) {
      const parts = line.replace(/\s+/g,' ').split(/[\s,]+/).filter(Boolean);
      if (parts.length>=2) {
        const a = parseFloat(parts[0]); const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) { xs.push(a); ys.push(b); }
      }
    }
    return { xs, ys };
  }
  function smoothArray(arr, windowSize){
    const w = Math.max(1,Math.floor(windowSize));
    if (w<=1) return arr.slice();
    const n=arr.length; const out=new Array(n).fill(0); const half=Math.floor(w/2);
    for (let i=0;i<n;i++){ let s=0,c=0; for (let j=i-half;j<=i+half;j++){ if (j>=0 && j<n){s+=arr[j]; c++;}} out[i]=s/c; }
    return out;
  }
  function baselinePolyFit(x,y,deg=2){
    const n=x.length; const m=deg+1;
    const A=new Array(m).fill(0).map(()=>new Array(m).fill(0)); const b=new Array(m).fill(0);
    const xPows=new Array(2*deg+1).fill(0);
    for (let i=0;i<n;i++){ let xi=1; for (let p=0;p<=2*deg;p++){ xPows[p]+=xi; xi*=x[i]; }}
    for (let row=0;row<m;row++){
      for (let col=0;col<m;col++) A[row][col]=xPows[row+col];
      let s=0; for (let i=0;i<n;i++) s+=y[i]*Math.pow(x[i],row); b[row]=s;
    }
    for (let i=0;i<m;i++) A[i].push(b[i]);
    for (let i=0;i<m;i++){
      let maxR=i; for (let r=i+1;r<m;r++) if (Math.abs(A[r][i])>Math.abs(A[maxR][i])) maxR=r;
      [A[i],A[maxR]]=[A[maxR],A[i]];
      const piv=A[i][i]; if (Math.abs(piv)<1e-12) continue;
      for (let j=i;j<=m;j++) A[i][j]/=piv;
      for (let r=0;r<m;r++){ if (r===i) continue; const fac=A[r][i]; for (let c=i;c<=m;c++) A[r][c]-=fac*A[i][c];}
    }
    const coeffs=new Array(m).fill(0); for (let i=0;i<m;i++) coeffs[i]=A[i][m]; return coeffs;
  }
  function evaluatePoly(coeffs,x){ let s=0,p=1; for(let i=0;i<coeffs.length;i++){ s+=coeffs[i]*p; p*=x;} return s; }
  function detectPeaks(y, opts={thresholdFactor:0.2,minDistance:3}){
    const out=[]; if (!y || y.length===0) return out;
    const n=y.length; const mean=y.reduce((a,b)=>a+b,0)/n; const thr=Math.max(0, mean*opts.thresholdFactor);
    for (let i=1;i<n-1;i++){ if (y[i]>y[i-1] && y[i]>y[i+1] && y[i]>=thr){
      if (out.length && Math.abs(i-out[out.length-1].index)<opts.minDistance){
        if (y[i]>out[out.length-1].y) out[out.length-1]={index:i,y:y[i]};
      } else out.push({index:i,y:y[i]});
    } } return out;
  }
  function estimateGaussian(xArr,yArr,idx){
    const x0=xArr[idx]; const amp=yArr[idx]; const half=amp/2;
    let left=idx,right=idx;
    while (left>0 && yArr[left]>half) left--;
    while (right<yArr.length-1 && yArr[right]>half) right++;
    const fwhm=Math.abs(xArr[right]-xArr[left]) || ((xArr[1]-xArr[0])*3);
    const sigma = fwhm/(2*Math.sqrt(2*Math.log(2))) || 0.5;
    return {amp,x0,sigma};
  }
  function gaussian(x,amp,x0,sigma){ return amp*Math.exp(-0.5*Math.pow((x-x0)/sigma,2)); }
  function refineGaussian(xArr,yArr,init,windowRadius=12){
    let idx=0,best=Infinity;
    for (let i=0;i<xArr.length;i++){ const d=Math.abs(xArr[i]-init.x0); if (d<best){best=d;idx=i;} }
    const start=Math.max(0,idx-windowRadius), end=Math.min(xArr.length-1, idx+windowRadius);
    const xs=xArr.slice(start,end+1), ys=yArr.slice(start,end+1);
    let amp=init.amp||Math.max(...ys), x0=init.x0||xs[Math.floor(xs.length/2)], sigma=init.sigma||((xs[xs.length-1]-xs[0])/6)||0.5;
    const lr=0.03;
    for (let iter=0; iter<120; iter++){
      let g_amp=0,g_x0=0,g_sigma=0;
      for (let i=0;i<xs.length;i++){
        const xi=xs[i], yi=ys[i];
        const yi_pred=gaussian(xi,amp,x0,sigma);
        const err=yi_pred-yi;
        g_amp += 2*err * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        const common = 2*err * amp * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        g_x0 += common * ((xi-x0)/(sigma*sigma));
        g_sigma += common * (Math.pow(xi-x0,2)/(sigma*sigma*sigma));
      }
      amp -= lr * g_amp / xs.length;
      x0  -= lr * g_x0 / xs.length;
      sigma -= lr * g_sigma / xs.length;
      if (sigma < 1e-3) sigma = 1e-3;
    }
    return {amp,x0,sigma};
  }

  // Chart creation with grid and zoom plugin
  function createChart(x, y){
    if (chart) chart.destroy();
    try { Chart.register(chartjsPluginZoom); } catch(e){}
    const ctx = xrdCanvas.getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: x,
        datasets: [{ label: 'Observado', data: y, borderColor: '#1e88e5', tension: 0.1, borderWidth: 1.8, pointRadius: 0, backgroundColor: 'rgba(30,136,229,0.06)'}]
      },
      options: {
        animation:false, maintainAspectRatio:false,
        scales: {
          x: { title:{display:true,text:'2θ (deg)',color:'#222'}, ticks:{color:'#222'}, grid:{display:true,color:'rgba(0,0,0,0.08)'} },
          y: { title:{display:true,text:'Intensidad (u.a.)',color:'#222'}, ticks:{color:'#222'}, grid:{display:true,color:'rgba(0,0,0,0.08)'} }
        },
        plugins: {
          legend:{ display:true, labels:{ color:'#222' } },
          tooltip:{ callbacks:{ title: ctx => `2θ = ${ctx[0].label}`, label: ctx => `I = ${ctx[0].formattedValue}` } },
          zoom:{ zoom:{ wheel:{enabled:true,speed:0.1}, pinch:{enabled:true}, mode:'x' }, pan:{ enabled:true, mode:'x' } }
        },
        onClick: (evt) => {
          const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect:false }, false);
          if (points.length) {
            const idx = points[0].index;
            const p = peaks.find(pk => Math.abs(pk.index - idx) <= 3);
            if (p) { selectedPeak = { index: p.index, x: rawX[p.index], y: rawY[p.index] }; updatePeakInfo(); overlayPeaksAndFits(); }
          }
        }
      }
    });
  }

  function overlayPeaksAndFits(){
    if (!chart) return;
    while (chart.data.datasets.length > 1) chart.data.datasets.pop();
    if (baseline) { const baselineY = rawX.map(xv => evaluatePoly(baseline, xv)); chart.data.datasets.push({ label:'Baseline', data: baselineY, borderDash:[6,4], pointRadius:0, borderWidth:1, borderColor:'#888' }); }
    if (procY && procY.length) chart.data.datasets.push({ label:'Procesado', data: procY, tension:0.1, borderWidth:1, pointRadius:0, borderColor:'#ffb74d' });
    for (const pk of peaks) chart.data.datasets.push({ label:`Pico @ ${rawX[pk.index].toFixed(3)}`, data:[{x:rawX[pk.index], y:rawY[pk.index]}], showLine:false, pointRadius:6, backgroundColor:'#ef5350' });
    if (selectedPeak && selectedPeak.fit) { const params = selectedPeak.fit; const yfit = rawX.map(xv => gaussian(xv, params.amp, params.x0, params.sigma)); chart.data.datasets.push({ label:'Fit (gauss)', data: yfit, borderWidth:2, pointRadius:0, borderColor:'#66bb6a' }); }
    chart.update('none');
  }

  smoothWindow && smoothWindow.addEventListener('input', ()=>{ const el = document.getElementById('smoothVal'); if(el) el.textContent = smoothWindow.value; });
  peakThresh && peakThresh.addEventListener('input', ()=>{ const el = document.getElementById('peakThreshVal'); if(el) el.textContent = parseFloat(peakThresh.value).toFixed(2); });

  togglePanel && togglePanel.addEventListener('click', ()=> { if (sidePanel) sidePanel.style.display = (sidePanel.style.display === 'none') ? 'block' : 'none'; });

  fileInput && fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    fileNameLabel.textContent = f.name; log(`Cargando ${f.name} ...`);
    const txt = await f.text(); const parsed = parseTextToXY(txt);
    rawX = parsed.xs; rawY = parsed.ys;
    if (rawX.length===0) { log('No se leyeron datos.'); return; }
    procY = rawY.slice(); baseline = null; peaks = []; selectedPeak = null;
    createChart(rawX, procY); log(`Archivo cargado: puntos=${rawX.length}`);
  });

  applySmoothBtn && applySmoothBtn.addEventListener('click', ()=> {
    if (!rawY.length) return;
    const w = parseInt(smoothWindow.value,10);
    procY = smoothArray(procY.length?procY:rawY, w);
    createChart(rawX, procY); overlayPeaksAndFits(); log(`Smoothing aplicado (ventana=${w})`);
  });

  applyBaselineBtn && applyBaselineBtn.addEventListener('click', ()=>{
    if (!rawX.length) return;
    const deg = parseInt(baselineDeg.value,10);
    baseline = baselinePolyFit(rawX, procY.length?procY:rawY, deg);
    procY = rawX.map((xx,i) => (rawY[i] - evaluatePoly(baseline, xx)));
    createChart(rawX, procY); overlayPeaksAndFits(); log(`Baseline restada (deg=${deg})`);
  });

  resetBaselineBtn && resetBaselineBtn.addEventListener('click', ()=> { baseline = null; procY = rawY.slice(); createChart(rawX, procY); overlayPeaksAndFits(); log('Baseline reseteada.'); });

  detectPeaksBtn && detectPeaksBtn.addEventListener('click', ()=> {
    if (!procY.length) return;
    const factor = parseFloat(peakThresh.value);
    const detected = detectPeaks(procY, { thresholdFactor: factor, minDistance: Math.max(3, Math.floor(rawX.length/400)) });
    peaks = detected.map(d => ({ index: d.index, y: procY[d.index] }));
    overlayPeaksAndFits(); log(`Detectados ${peaks.length} picos (factor=${factor.toFixed(2)})`);
  });

  estimatePeakBtn && estimatePeakBtn.addEventListener('click', ()=> {
    if (!peaks.length){ log('No hay picos detectados'); return; }
    selectedPeak = { index: peaks[0].index, x: rawX[peaks[0].index], y: rawY[peaks[0].index] };
    const est = estimateGaussian(rawX, procY, selectedPeak.index); selectedPeak.fit = est;
    overlayPeaksAndFits(); updatePeakInfo(); log('Estimación automática del primer pico.');
  });

  fitPeakBtn && fitPeakBtn.addEventListener('click', ()=> {
    if (!selectedPeak){ log('Selecciona un pico primero'); return; }
    const init = selectedPeak.fit || estimateGaussian(rawX, procY, selectedPeak.index);
    log(`Refinando pico @ ${init.x0.toFixed(4)}...`);
    const refined = refineGaussian(rawX, procY, init, Math.max(8, Math.floor(rawX.length/200)));
    selectedPeak.fit = refined; overlayPeaksAndFits(); updatePeakInfo();
    log(`Refinado: x0=${refined.x0.toFixed(4)}, amp=${refined.amp.toFixed(2)}, sigma=${refined.sigma.toFixed(4)}`);
  });

  function updatePeakInfo(){
    const peakInfo = document.getElementById('peakInfo');
    if (!peakInfo) return;
    if (!selectedPeak) peakInfo.textContent = 'Ningún pico seleccionado';
    else {
      const p = selectedPeak;
      peakInfo.innerHTML = `Indice: ${p.index}<br>2θ: ${p.x.toFixed(4)}<br>I: ${p.y.toFixed(2)}<br>`;
      if (p.fit) peakInfo.innerHTML += `Fit → x0: ${p.fit.x0.toFixed(4)}, amp: ${p.fit.amp.toFixed(2)}, σ: ${p.fit.sigma.toFixed(4)}`;
    }
  }

  exportJson && exportJson.addEventListener('click', ()=> {
    if (!rawX.length){ log('Nada que exportar'); return; }
    const payload = { meta:{created:new Date().toISOString()}, x:rawX, y_raw:rawY, y_proc:procY, baseline_coeffs:baseline, peaks:peaks.map(p=>({index:p.index,x:rawX[p.index],y:p.y})), selectedPeak };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='xrd_result.json'; a.click(); URL.revokeObjectURL(url); log('Exportado JSON.');
  });

  sendBackend && sendBackend.addEventListener('click', async ()=> {
    if (!fileInput.files.length){ log('Sube tu .asr primero'); return; }
    const f = fileInput.files[0]; log('Enviando a backend (Netlify)...');
    const form = new FormData(); form.append('file', f); form.append('meta', JSON.stringify({peaks:peaks.map(pk=>({index:pk.index,x:rawX[pk.index],y:pk.y})), baseline, created:new Date().toISOString()}));
    try {
      const resp = await fetch(sendUrl, { method:'POST', body: form });
      if (!resp.ok) { const t = await resp.text(); throw new Error(t||resp.statusText); }
      const data = await resp.json(); log(`Backend: ${data.message || 'ok'}`);
    } catch(err){ log(`Error al enviar: ${err.message||err}`); }
  });

  downloadPNG && downloadPNG.addEventListener('click', ()=> {
    if (!chart) return; const url = chart.toBase64Image(); const a=document.createElement('a'); a.href=url; a.download='xrd_plot.png'; a.click();
  });

  resetZoomBtn && resetZoomBtn.addEventListener('click', ()=> {
    if (chart && chart.resetZoom) { chart.resetZoom(); log('Zoom reseteado'); }
    else log('No se pudo resetear zoom (plugin no registrado)');
  });

  // init empty chart
  createChart([0,1],[0,0]);
  log('Interfaz lista. El video de introducción se reproduce al inicio.');
})();
