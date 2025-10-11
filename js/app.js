// video
// js/app.js — Transición de Video y UI (Configuración)
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
  }

  // If user interacts, retry autoplay
  function onFirstUserInteraction(){ tryAutoplay(); window.removeEventListener('click', onFirstUserInteraction); }
  window.addEventListener('click', onFirstUserInteraction);
  tryAutoplay();
// Setup chart with stronger interactivity
  const ctx = document.getElementById('xrdChart').getContext('2d');
  let gridVisible = true;

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Intensidad', data: [], borderColor: 'blue', backgroundColor: 'rgba(0,0,0,0)', pointRadius: 0, borderWidth: 1.8 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'nearest' },
      plugins: {
        legend:{ display:false },
        tooltip: { enabled:true, mode:'nearest', intersect:false },
        zoom: {
          limits: { x: { min: null, max: null }, y: { min: null, max: null } },
          pan: { enabled: true, mode: 'xy', modifierKey: null, threshold: 5 },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: true },
            drag: { enabled: true, modifierKey: null, mode: 'xy' },
            mode: 'xy'
          }
        }
      },
      scales: {
        x: { title: { display: true, text: '2θ', color: '#000' }, ticks: { color: '#000' }, grid: { display: true, color: '#e8e8e8' } },
        y: { title: { display: true, text: 'Intensidad', color: '#000' }, ticks: { color: '#000' }, grid: { display: true, color: '#e8e8e8' } }
      }
    }
  });

  function log(msg){
    const p = document.getElementById('logText');
    p.textContent += `\n${msg}`;
    p.scrollTop = p.scrollHeight;
  }

  // File parsing and plotting
  document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.trim().split(/\r?\n/);
      const x = [], y = [];
      for(let line of lines){
        const parts = line.trim().split(/\s+/);
        if(parts.length<2) continue;
        const a = Number(parts[0]), b = Number(parts[1]);
        if(!isNaN(a)&&!isNaN(b)){x.push(a);y.push(b);}
      }
      chart.data.labels = x;
      chart.data.datasets[0].data = y;
      chart.update();
      fitToData();
      log('Archivo cargado: ' + file.name + '  (puntos: '+y.length+')');
    };
    reader.readAsText(file);
  });

  document.getElementById('btnProcesar').onclick=()=>log('Procesando datos...');
  document.getElementById('btnPicos').onclick=()=>log('Detectando picos...');
  document.getElementById('btnFit').onclick=()=>log('Ejecutando Fit...');

  // Diseño menu
  const drop = document.querySelector('.dropdown');
  document.getElementById('btnDiseno').addEventListener('click', ()=> drop.classList.toggle('open'));

  // Descargar imagen actual de la grafica (PNG)
  document.getElementById('descargarImg').addEventListener('click', ()=>{
    try{
      const url = chart.toBase64Image();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grafica.png';
      a.click();
      log('Descarga de imagen iniciada.');
    }catch(e){ log('Error al descargar imagen: '+e); }
  });

  // Restaurar zoom (double click also resets)
  document.getElementById('restaurarZoom').addEventListener('click', ()=>{
    if(chart.resetZoom) chart.resetZoom();
    else { chart.options.scales.x.min = undefined; chart.options.scales.x.max = undefined; chart.options.scales.y.min = undefined; chart.options.scales.y.max = undefined; chart.update(); }
    log('Zoom restaurado.');
  });
  // double click to reset
  document.getElementById('xrdChart').addEventListener('dblclick', ()=>{ if(chart.resetZoom) chart.resetZoom(); log('Zoom restaurado (doble click).'); });

  // Quitar / poner cuadricula
  document.getElementById('quitarCuadricula').addEventListener('click', ()=>{
    gridVisible = !gridVisible;
    chart.options.scales.x.grid.display = gridVisible;
    chart.options.scales.y.grid.display = gridVisible;
    chart.update();
    log('Cuadricula ' + (gridVisible ? 'mostrada' : 'ocultada') + '.');
  });

  // Fullscreen for the grafica div
  const graficaEl = document.getElementById('grafica');
  document.getElementById('btnFullscreen').addEventListener('click', async ()=>{
    try{
      if(!document.fullscreenElement) await graficaEl.requestFullscreen();
      else await document.exitFullscreen();
    }catch(e){ log('Error pantalla completa: '+e); }
  });

  // Fit to data: set scales min/max to data extents
  function fitToData(){
    const data = chart.data.datasets[0].data;
    if(!data || data.length===0) return;
    const minY = Math.min(...data);
    const maxY = Math.max(...data);
    // x from labels
    const labels = chart.data.labels.map(v=>Number(v));
    const minX = Math.min(...labels);
    const maxX = Math.max(...labels);
    chart.options.scales.x.min = minX;
    chart.options.scales.x.max = maxX;
    chart.options.scales.y.min = Math.max(0, minY - (maxY-minY)*0.05);
    chart.options.scales.y.max = maxY + (maxY-minY)*0.05;
    chart.update();
    log('Ajustado a datos.');
  }
  document.getElementById('btnFitData').addEventListener('click', ()=>fitToData());

  // Tabla periódica simple
  const elementos = ['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn'];
  const tablaDiv = document.getElementById('tablaPeriodica');
  for(let el of elementos){
    const div = document.createElement('div');
    div.textContent = el;
    div.classList.add('elemento');
    div.onclick = ()=>div.classList.toggle('seleccionado');
    tablaDiv.appendChild(div);
  }

  document.getElementById('btnMatch').onclick=()=>{
    const seleccionados = [...document.querySelectorAll('.elemento.seleccionado')].map(e=>e.textContent);
    // Replaced alert() with log() as per instructions
    if(seleccionados.length===0){ log('ERROR: Selecciona al menos un elemento'); return;}
    const csv = 'Composición seleccionada:,'+seleccionados.join('-')+'\nEjemplo de coincidencias descargadas';
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'matches.csv';
    a.click();
    log('Match simulado con elementos: '+seleccionados.join(','));
  };
  
})();
