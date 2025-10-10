// js/app.js — integra reproducción inicial del video (una vez) + UI (análisis XRD)
// Basado en tu UI previa: parsing .asr, smoothing, baseline, detección picos, ajuste simple
(() => {
  /************ Part A: manejo del video inicial (reproducir una sola vez) ************/
  const video = document.getElementById('bgVideo');
  const overlay = document.getElementById('videoOverlay');
  const playBtn = document.getElementById('playBtn');
  const playNoFsBtn = document.getElementById('playNoFsBtn');

  // Elementos UI principales (ocultos hasta que termine el video)
  const topbar = document.getElementById('topbar');
  const sidePanel = document.getElementById('sidePanel');
  const mainArea = document.getElementById('mainArea');

  function showMainUI() {
    // Oculta video y overlay y muestra UI
    try { video.pause(); } catch(e){}
    if (video && video.parentNode) video.style.display = 'none';
    overlay.classList.add('hidden');
    topbar.classList.remove('hidden');
    sidePanel.classList.remove('hidden');
    mainArea.classList.remove('hidden');
  }

  // Intentar autoplay inmediatamente
  function tryAutoplay() {
    if (!video) { showMainUI(); return; }
    const p = video.play();
    if (p !== undefined) {
      p.then(() => {
        // autoplay OK; ocultamos overlay
        overlay.classList.add('hidden');
      }).catch((err) => {
        // Autoplay bloqueado -> mostrar overlay
        overlay.classList.remove('hidden');
      });
    } else {
      // No promesa — esconder overlay después de un rato
      setTimeout(()=> overlay.classList.add('hidden'), 300);
    }
  }

  // Botones overlay
  async function playAndFullscreen() {
    try {
      await video.play();
      // request fullscreen en documentElement (el usuario hizo clic)
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch (err) {
      console.warn('No se pudo entrar en fullscreen o reproducir:', err);
    } finally {
      overlay.classList.add('hidden');
    }
  }
  async function playNoFullscreen() {
    try {
      await video.play();
    } catch (err) {
      console.warn('No se pudo reproducir:', err);
    } finally {
      overlay.classList.add('hidden');
    }
  }

  // Cuando el video termine, mostramos la UI principal
  if (video) {
    video.addEventListener('ended', () => {
      showMainUI();
    });
    video.addEventListener('play', () => {
      // Si se pudo reproducir por autoplay, ocultamos overlay
      overlay.classList.add('hidden');
    });
  }

  playBtn && playBtn.addEventListener('click', async (e) => { e.preventDefault(); await playAndFullscreen(); });
  playNoFsBtn && playNoFsBtn.addEventListener('click', async (e) => { e.preventDefault(); await playNoFullscreen(); });

  // reintento de autoplay si el usuario interactúa
  function onFirstUserInteraction() {
    tryAutoplay();
    window.removeEventListener('click', onFirstUserInteraction);
    window.removeEventListener('keydown', onFirstUserInteraction);
    window.removeEventListener('touchstart', onFirstUserInteraction);
  }
  window.addEventListener('click', onFirstUserInteraction);
  window.addEventListener('keydown', onFirstUserInteraction);
  window.addEventListener('touchstart', onFirstUserInteraction);

  // Intentamos autoplay ahora
  tryAutoplay();

  /************ Part B: interfaz XRD (igual que antes, activada tras video) ************/
  // Elementos UI
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
  const sendUrl = '/.netlify/functions/refine'; // Netlify Function

  const log = (s) => {
    logEl.textContent = `[${new Date().toLocaleTimeString()}] ${s}\n` + logEl.textContent;
  };

  // Estado de datos
  let rawX = [], rawY = [];
  let procY = []; // after baseline and smoothing
  let baseline = null;
  let peaks = []; // array of {x, y, index}
  let selectedPeak = null;
  let chart = null;
  let resultImages = [];

  // util: parse archivo .asr (dos columnas: x y I)
  function parseTextToXY(txt) {
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^#/.test(l));
    const xs = [], ys = [];
    for (const line of lines) {
      const parts = line.replace(/\s+/g, ' ').split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) { xs.push(a); ys.push(b); }
      }
    }
    return { xs, ys };
  }

  // smoothing: moving average (odd window)
  function smoothArray(arr, windowSize) {
    const w = Math.max(1, Math.floor(windowSize));
    if (w <= 1) return arr.slice();
    const n = arr.length;
    const out = new Array(n).fill(0);
    const half = Math.floor(w / 2);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = i - half; j <= i + half; j++) {
        if (j >= 0 && j < n) { s += arr[j]; c += 1; }
      }
      out[i] = s / c;
    }
    return out;
  }

  // baseline polynomial fit (least squares) deg 0..2
  function baselinePolyFit(x, y, deg=2) {
    const n = x.length;
    const m = deg + 1;
    const A = new Array(m).fill(0).map(()=>new Array(m).fill(0));
    const b = new Array(m).fill(0);
    const xPows = new Array(2*deg + 1).fill(0);
    for (let i=0;i<n;i++) {
      let xi = 1;
      for (let p=0;p<=2*deg;p++) {
        xPows[p] += xi;
        xi *= x[i];
      }
    }
    for (let row=0;row<m;row++) {
      for (let col=0;col<m;col++) A[row][col] = xPows[row+col];
      let s = 0;
      for (let i=0;i<n;i++) s += y[i] * Math.pow(x[i], row);
      b[row] = s;
    }
    const M = m;
    for (let i=0;i<M;i++) A[i].push(b[i]);
    for (let i=0;i<M;i++) {
      let maxR = i;
      for (let r=i+1;r<M;r++) if (Math.abs(A[r][i]) > Math.abs(A[maxR][i])) maxR=r;
      const tmp = A[i]; A[i] = A[maxR]; A[maxR] = tmp;
      const piv = A[i][i];
      if (Math.abs(piv) < 1e-12) continue;
      for (let j=i;j<=M;j++) A[i][j] /= piv;
      for (let r=0;r<M;r++){
        if (r===i) continue;
        const fac = A[r][i];
        for (let c=i;c<=M;c++) A[r][c] -= fac * A[i][c];
      }
    }
    const coeffs = new Array(M).fill(0);
    for (let i=0;i<M;i++) coeffs[i] = A[i][M];
    return coeffs;
  }

  function evaluatePoly(coeffs, x) {
    let s = 0, p = 1;
    for (let i=0;i<coeffs.length;i++){ s += coeffs[i]*p; p*=x; }
    return s;
  }

  // peak detection (local maxima with threshold)
  function detectPeaks(y, opts={thresholdFactor:0.2, minDistance:3}) {
    const peaks = [];
    const n = y.length;
    const mean = y.reduce((a,b)=>a+b,0)/n;
    const threshold = Math.max(0, mean * opts.thresholdFactor);
    for (let i=1;i<n-1;i++){
      if (y[i] > y[i-1] && y[i] > y[i+1] && y[i] >= threshold) {
        if (peaks.length && Math.abs(i-peaks[peaks.length-1].index) < opts.minDistance) {
          if (y[i] > peaks[peaks.length-1].y) peaks[peaks.length-1] = {index:i, y:y[i]};
        } else {
          peaks.push({index:i, y:y[i]});
        }
      }
    }
    return peaks;
  }

  // estimate gaussian params around a peak
  function estimateGaussian(xArr, yArr, idx) {
    const x0 = xArr[idx];
    const amp = yArr[idx];
    const half = amp / 2;
    let left = idx, right = idx;
    while (left>0 && yArr[left] > half) left--;
    while (right < yArr.length-1 && yArr[right] > half) right++;
    const fwhm = Math.abs(xArr[right] - xArr[left]) || ( (xArr[1]-xArr[0]) * 3 );
    const sigma = fwhm / (2*Math.sqrt(2*Math.log(2))) || 0.5;
    return {amp, x0, sigma};
  }

  function gaussian(x, amp, x0, sigma) {
    return amp * Math.exp(-0.5 * Math.pow((x - x0)/sigma, 2));
  }

  function refineGaussian(xArr, yArr, init, windowRadius = 12) {
    const n = xArr.length;
    let idx = 0; let bestDiff = Infinity;
    for (let i=0;i<n;i++){
      const d = Math.abs(xArr[i] - init.x0);
      if (d < bestDiff){ bestDiff = d; idx = i; }
    }
    const start = Math.max(0, idx - windowRadius);
    const end = Math.min(n-1, idx + windowRadius);
    const xs = xArr.slice(start, end+1);
    const ys = yArr.slice(start, end+1);

    let amp = init.amp || Math.max(...ys);
    let x0 = init.x0 || xs[Math.floor(xs.length/2)];
    let sigma = init.sigma || ( (xs[xs.length-1]-xs[0]) / 6 ) || 0.5;
    const lr = 0.03;
    for (let iter=0; iter<120; iter++) {
      let loss = 0;
      let g_amp = 0, g_x0 = 0, g_sigma = 0;
      for (let i=0;i<xs.length;i++) {
        const xi = xs[i];
        const yi = ys[i];
        const yi_pred = gaussian(xi, amp, x0, sigma);
        const err = yi_pred - yi;
        loss += err*err;
        g_amp += 2*err * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        const common = 2*err * amp * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        g_x0 += common * ( (xi - x0) / (sigma*sigma) );
        g_sigma += common * ( Math.pow(xi - x0,2) / (sigma*sigma*sigma) );
      }
      amp -= lr * g_amp / xs.length;
      x0  -= lr * g_x0 / xs.length;
      sigma -= lr * g_sigma / xs.length;
      if (sigma < 1e-3) sigma = 1e-3;
    }
    return {amp, x0, sigma};
  }

  // Chart.js plot
  function createChart(x, y, options={}) {
    if (chart) chart.destroy();
    const ctx = xrdCanvas.getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: x,
        datasets: [
          { label: 'Observado', data: y, tension: 0.1, borderWidth: 1.5, pointRadius: 0, parsing: { xAxisKey: null, yAxisKey: null } }
        ]
      },
      options: {
        animation:false,
        maintainAspectRatio:false,
        scales: {
          x: { title: { display: true, text: '2θ (deg)' } },
          y: { title: { display: true, text: 'Intensidad (u.a.)' } }
        },
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              title: ctx => `2θ = ${ctx[0].label}`,
              label: ctx => `I = ${ctx[0].formattedValue}`
            }
          }
        },
        onClick: (evt, elements) => {
          const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, false);
          if (points.length) {
            const idx = points[0].index;
            const p = peaks.find(pk => Math.abs(pk.index - idx) <= 3);
            if (p) {
              selectedPeak = { index: p.index, x: rawX[p.index], y: rawY[p.index] };
              updatePeakInfo();
              overlayPeaksAndFits();
            }
          }
        }
      }
    });
  }

  function overlayPeaksAndFits() {
    if (!chart) return;
    while (chart.data.datasets.length > 1) chart.data.datasets.pop();

    if (baseline) {
      const baselineY = rawX.map(xv => evaluatePoly(baseline, xv));
      chart.data.datasets.push({ label: 'Baseline', data: baselineY, borderDash: [6,4], pointRadius:0, borderWidth:1 });
    }
    if (procY && procY.length) {
      chart.data.datasets.push({ label: 'Procesado', data: procY, tension:0.1, borderWidth:1, pointRadius:0, borderColor: '#ffcc66' });
    }
    for (const pk of peaks) {
      chart.data.datasets.push({
        label: `Pico @ ${rawX[pk.index].toFixed(3)}`,
        data: [{ x: rawX[pk.index], y: rawY[pk.index] }],
        showLine:false,
        pointRadius:6,
        backgroundColor:'#ff6b6b'
      });
    }
    if (selectedPeak && selectedPeak.fit) {
      const params = selectedPeak.fit;
      const yfit = rawX.map(xv => gaussian(xv, params.amp, params.x0, params.sigma));
      chart.data.datasets.push({ label: 'Fit (gauss)', data: yfit, borderWidth:2, pointRadius:0, borderColor:'#78e08f' });
    }
    chart.update('none');
  }

  // UI updates
  smoothWindow.addEventListener('input', ()=> { smoothVal.textContent = smoothWindow.value; });
  peakThresh.addEventListener('input', ()=> { peakThreshVal.textContent = parseFloat(peakThresh.value).toFixed(2); });

  // Toggle panel
  togglePanel && togglePanel.addEventListener('click', ()=> {
    sidePanel.style.display = (sidePanel.style.display === 'none') ? 'block' : 'none';
  });

  // File handling
  fileInput && fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    fileNameLabel.textContent = f.name;
    log(`Cargando ${f.name} ...`);
    const txt = await f.text();
    const parsed = parseTextToXY(txt);
    rawX = parsed.xs;
    rawY = parsed.ys;
    if (rawX.length === 0) {
      log('No se pudieron leer datos del archivo. Asegúrate de que tenga columnas "2theta intensidad".');
      return;
    }
    procY = rawY.slice();
    baseline = null; peaks = []; selectedPeak = null;
    createChart(rawX, procY);
    log(`Archivo cargado: puntos=${rawX.length}`);
  });

  // Preprocesado
  applySmoothBtn && applySmoothBtn.addEventListener('click', () => {
    if (!rawY.length) return;
    const w = parseInt(smoothWindow.value, 10);
    procY = smoothArray(procY.length ? procY : rawY, w);
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log(`Aplicado smoothing (window=${w})`);
  });

  applyBaselineBtn && applyBaselineBtn.addEventListener('click', () => {
    if (!rawX.length) return;
    const deg = parseInt(baselineDeg.value, 10);
    baseline = baselinePolyFit(rawX, procY.length ? procY : rawY, deg);
    procY = rawX.map((xx,i) => (rawY[i] - evaluatePoly(baseline, xx)));
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log(`Baseline restada (deg=${deg}).`);
  });

  resetBaselineBtn && resetBaselineBtn.addEventListener('click', () => {
    baseline = null;
    procY = rawY.slice();
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log('Baseline reseteada.');
  });

  // Detect peaks
  detectPeaksBtn && detectPeaksBtn.addEventListener('click', () => {
    if (!procY.length) return;
    const factor = parseFloat(peakThresh.value);
    const detected = detectPeaks(procY, { thresholdFactor: factor, minDistance: Math.max(3, Math.floor(rawX.length/400)) });
    peaks = detected.map(d => ({ index: d.index, y: procY[d.index] }));
    overlayPeaksAndFits();
    log(`Detectados ${peaks.length} picos (factor=${factor.toFixed(2)}).`);
  });

  // estimate peak params automatically for selected peak
  estimatePeakBtn && estimatePeakBtn.addEventListener('click', () => {
    if (!peaks.length) { log('No hay picos detectados'); return; }
    selectedPeak = { index: peaks[0].index, x: rawX[peaks[0].index], y: rawY[peaks[0].index] };
    const est = estimateGaussian(rawX, procY, selectedPeak.index);
    selectedPeak.fit = est;
    overlayPeaksAndFits();
    updatePeakInfo();
    log('Estimación automática realizada para primer pico.');
  });

  // fit single peak (refine)
  fitPeakBtn && fitPeakBtn.addEventListener('click', () => {
    if (!selectedPeak) { log('Selecciona un pico primero (clic sobre un marcador)'); return; }
    const init = selectedPeak.fit || estimateGaussian(rawX, procY, selectedPeak.index);
    log(`Refinando pico @ ${init.x0.toFixed(4)} ...`);
    const refined = refineGaussian(rawX, procY, init, Math.max(8, Math.floor(rawX.length/200)));
    selectedPeak.fit = refined;
    overlayPeaksAndFits();
    updatePeakInfo();
    log(`Refinado: x0=${refined.x0.toFixed(4)}, amp=${refined.amp.toFixed(2)}, sigma=${refined.sigma.toFixed(4)}`);
  });

  function updatePeakInfo() {
    const peakInfo = document.getElementById('peakInfo');
    if (!selectedPeak) {
      peakInfo.textContent = 'Ningún pico seleccionado';
    } else {
      const p = selectedPeak;
      peakInfo.innerHTML = `Indice: ${p.index}<br>2θ: ${p.x.toFixed(4)}<br>I: ${p.y.toFixed(2)}<br>`;
      if (p.fit) {
        peakInfo.innerHTML += `Fit → x0: ${p.fit.x0.toFixed(4)}, amp: ${p.fit.amp.toFixed(2)}, σ: ${p.fit.sigma.toFixed(4)}`;
      }
    }
  }

  // Export JSON
  exportJson && exportJson.addEventListener('click', () => {
    if (!rawX.length) { log('Nada que exportar.'); return; }
    const payload = {
      meta: { created: new Date().toISOString() },
      x: rawX,
      y_raw: rawY,
      y_proc: procY,
      baseline_coeffs: baseline,
      peaks: peaks.map(p => ({ index: p.index, x: rawX[p.index], y: p.y })),
      selectedPeak
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'xrd_result.json'; a.click();
    URL.revokeObjectURL(url);
    log('Exportado JSON.');
  });

  // Send to Netlify (multipart/form-data)
  sendBackend && sendBackend.addEventListener('click', async () => {
    if (!fileInput.files.length) { log('Sube primero tu .asr'); return; }
    const f = fileInput.files[0];
    log('Preparando envío al backend (Netlify Function)...');
    const form = new FormData();
    form.append('file', f);
    form.append('meta', JSON.stringify({
      peaks: peaks.map(pk => ({ index: pk.index, x: rawX[pk.index], y: pk.y })),
      baseline: baseline,
      created: new Date().toISOString()
    }));

    try {
      const resp = await fetch(sendUrl, { method:'POST', body: form });
      if (!resp.ok) { const text = await resp.text(); throw new Error(text || resp.statusText); }
      const data = await resp.json();
      log(`Backend: ${data.message || 'ok'}`);
      if (data.result_url) {
        log(`URL resultado: ${data.result_url}`);
        resultImages.push(data.result_url);
      }
    } catch (err) {
      log(`Error al enviar: ${err.message || err}`);
    }
  });

  // Download chart as PNG
  downloadPNG && downloadPNG.addEventListener('click', () => {
    if (!chart) return;
    const url = chart.toBase64Image();
    const a = document.createElement('a'); a.href=url; a.download='xrd_plot.png'; a.click();
  });

  // inicializar chart vacío (evita errores antes de carga)
  createChart([0,1], [0,0]);
  log('Interfaz lista. El video de introducción se reproduce al inicio.');

})();
