// app.js — frontend mejorado (XRD preview + operaciones básicas tipo FullProf)
(() => {
  // Elementos
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
  const sidePanel = document.getElementById('sidePanel');
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
      // aceptar delimitadores espacios o comas
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
    // Build Vandermonde and solve normal equations (small deg)
    const n = x.length;
    const m = deg + 1;
    const A = new Array(m).fill(0).map(()=>new Array(m).fill(0));
    const b = new Array(m).fill(0);
    // compute sums
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
      // rhs
      let s = 0;
      for (let i=0;i<n;i++) s += y[i] * Math.pow(x[i], row);
      b[row] = s;
    }
    // Solve Ax=b by Gaussian elimination (m small)
    const M = m;
    // augment
    for (let i=0;i<M;i++) A[i].push(b[i]);
    // elimination
    for (let i=0;i<M;i++) {
      // pivot
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
    return coeffs; // coeffs[0] + coeffs[1]*x + ...
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
        // ensure minDistance
        if (peaks.length && Math.abs(i-peaks[peaks.length-1].index) < opts.minDistance) {
          // keep higher
          if (y[i] > peaks[peaks.length-1].y) peaks[peaks.length-1] = {index:i, y:y[i]};
        } else {
          peaks.push({index:i, y:y[i]});
        }
      }
    }
    return peaks;
  }

  // estimate gaussian params around a peak (no heavy optimization)
  function estimateGaussian(xArr, yArr, idx) {
    const x0 = xArr[idx];
    const amp = yArr[idx];
    // estimate width: find points at ~half max
    const half = amp / 2;
    let left = idx, right = idx;
    while (left>0 && yArr[left] > half) left--;
    while (right < yArr.length-1 && yArr[right] > half) right++;
    const fwhm = Math.abs(xArr[right] - xArr[left]) || ( (xArr[1]-xArr[0]) * 3 );
    const sigma = fwhm / (2*Math.sqrt(2*Math.log(2))) || 0.5;
    return {amp, x0, sigma};
  }

  // gaussian function
  function gaussian(x, amp, x0, sigma) {
    return amp * Math.exp(-0.5 * Math.pow((x - x0)/sigma, 2));
  }

  // simple local refinement by numeric gradient descent on parameters amp, x0, sigma
  function refineGaussian(xArr, yArr, init, windowRadius = 12) {
    // select window around center
    const n = xArr.length;
    // find closest index to init.x0
    let idx = 0;
    let bestDiff = Infinity;
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
    // gradient descent
    const lr = 0.03;
    for (let iter=0; iter<120; iter++) {
      // compute residuals and gradients by finite differences
      let loss = 0;
      let g_amp = 0, g_x0 = 0, g_sigma = 0;
      for (let i=0;i<xs.length;i++) {
        const xi = xs[i];
        const yi = ys[i];
        const yi_pred = gaussian(xi, amp, x0, sigma);
        const err = yi_pred - yi;
        loss += err*err;
        // analytic gradients
        g_amp += 2*err * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        const common = 2*err * amp * Math.exp(-0.5*Math.pow((xi-x0)/sigma,2));
        g_x0 += common * ( (xi - x0) / (sigma*sigma) );
        g_sigma += common * ( Math.pow(xi - x0,2) / (sigma*sigma*sigma) );
      }
      // update (normalized)
      amp -= lr * g_amp / xs.length;
      x0  -= lr * g_x0 / xs.length;
      sigma -= lr * g_sigma / xs.length;
      // clamp
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
        labels: x, // x-values (angles)
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
          // detect nearest point index to click and see if it's close to a peak
          const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, false);
          if (points.length) {
            const idx = points[0].index;
            // check if this index is near any detected peak
            const p = peaks.find(pk => Math.abs(pk.index - idx) <= 3);
            if (p) {
              selectedPeak = { index: p.index, x: x[p.index], y: y[p.index] };
              updatePeakInfo();
            }
          }
        }
      }
    });
  }

  // overlay peaks and fitted curves
  function overlayPeaksAndFits() {
    if (!chart) return;
    // remove any extra datasets except the first (observed)
    while (chart.data.datasets.length > 1) chart.data.datasets.pop();

    // add baseline
    if (baseline) {
      const baselineY = rawX.map(xv => evaluatePoly(baseline, xv));
      chart.data.datasets.push({ label: 'Baseline', data: baselineY, borderDash: [6,4], pointRadius:0, borderWidth:1 });
    }

    // add processed (procY) if differs
    if (procY && procY.length) {
      chart.data.datasets.push({ label: 'Procesado', data: procY, tension:0.1, borderWidth:1, pointRadius:0, borderColor: '#ffcc66' });
    }

    // peaks markers
    for (const pk of peaks) {
      chart.data.datasets.push({
        label: `Pico @ ${rawX[pk.index].toFixed(3)}`,
        data: [{ x: rawX[pk.index], y: rawY[pk.index] }],
        showLine:false,
        pointRadius:6,
        backgroundColor:'#ff6b6b'
      });
    }

    // if selected peak and fitted params exist, overlay gaussian
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
  togglePanel.addEventListener('click', ()=> {
    sidePanel.style.display = (sidePanel.style.display === 'none') ? 'block' : 'none';
  });

  // File handling
  fileInput.addEventListener('change', async (e) => {
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
  applySmoothBtn.addEventListener('click', () => {
    if (!rawY.length) return;
    const w = parseInt(smoothWindow.value, 10);
    procY = smoothArray(procY.length ? procY : rawY, w);
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log(`Aplicado smoothing (window=${w})`);
  });

  applyBaselineBtn.addEventListener('click', () => {
    if (!rawX.length) return;
    const deg = parseInt(baselineDeg.value, 10);
    baseline = baselinePolyFit(rawX, procY.length ? procY : rawY, deg);
    // subtract baseline
    procY = rawX.map((xx,i) => (rawY[i] - evaluatePoly(baseline, xx)));
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log(`Baseline restada (deg=${deg}).`);
  });

  resetBaselineBtn.addEventListener('click', () => {
    baseline = null;
    procY = rawY.slice();
    createChart(rawX, procY);
    overlayPeaksAndFits();
    log('Baseline reseteada.');
  });

  // Detect peaks
  detectPeaksBtn.addEventListener('click', () => {
    if (!procY.length) return;
    const factor = parseFloat(peakThresh.value);
    const detected = detectPeaks(procY, { thresholdFactor: factor, minDistance: Math.max(3, Math.floor(rawX.length/400)) });
    peaks = detected.map(d => ({ index: d.index, y: procY[d.index] }));
    overlayPeaksAndFits();
    log(`Detectados ${peaks.length} picos (factor=${factor.toFixed(2)}).`);
  });

  // estimate peak params automatically for selected peak
  estimatePeakBtn.addEventListener('click', () => {
    if (!peaks.length) { log('No hay picos detectados'); return; }
    selectedPeak = { index: peaks[0].index, x: rawX[peaks[0].index], y: rawY[peaks[0].index] };
    const est = estimateGaussian(rawX, procY, selectedPeak.index);
    selectedPeak.fit = est;
    overlayPeaksAndFits();
    updatePeakInfo();
    log('Estimación automática realizada para primer pico.');
  });

  // fit single peak (refine)
  fitPeakBtn.addEventListener('click', () => {
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
    const peakInfo = document.getElementById('peakInfo') || document.createElement('div');
    if (!selectedPeak) {
      peakInfo.textContent = 'Ningún pico seleccionado';
    } else {
      const p = selectedPeak;
      peakInfo.innerHTML = `Indice: ${p.index}<br>2θ: ${p.x.toFixed(4)}<br>I: ${p.y.toFixed(2)}<br>`;
      if (p.fit) {
        peakInfo.innerHTML += `Fit → x0: ${p.fit.x0.toFixed(4)}, amp: ${p.fit.amp.toFixed(2)}, σ: ${p.fit.sigma.toFixed(4)}`;
      }
    }
    const container = document.getElementById('peakInfo');
    if (container) container.innerHTML = peakInfo.innerHTML;
  }

  // click handling inside chart is provided by Chart.js onClick earlier

  // Export JSON
  exportJson.addEventListener('click', () => {
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
  sendBackend.addEventListener('click', async () => {
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
  downloadPNG.addEventListener('click', () => {
    if (!chart) return;
    const url = chart.toBase64Image();
    const a = document.createElement('a'); a.href=url; a.download='xrd_plot.png'; a.click();
  });

  // initial blank chart
  createChart([0,1], [0,0]);
  log('Interfaz lista. Carga un archivo .asr para comenzar.');

})();
