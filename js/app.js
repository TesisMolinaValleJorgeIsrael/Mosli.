// Cuadro 1.

// Cuadro 2.

// Cuadro 3.

// Cuadro 4.

// Cuadro 5.

// Cuadro 6.







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
    log('Archivo cargado: ' + file.name + '  (puntos: '+y.length+')');
  };
  reader.readAsText(file);
});


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
  if(seleccionados.length===0){alert('Selecciona al menos un elemento');return;}
  const csv = 'Composición seleccionada:,'+seleccionados.join('-')+'\nEjemplo de coincidencias descargadas';
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'matches.csv';
  a.click();
  log('Match simulado con elementos: '+seleccionados.join(','));
};


// Video
const splash = document.getElementById('splash');
const app = document.getElementById('app');
const video = document.getElementById('introVideo');
const skip = document.getElementById('skipBtn');

function hideSplash(){
  splash.style.display = 'none';
  app.setAttribute('aria-hidden','false');
}
video.addEventListener('ended', ()=>{ hideSplash(); log('Video terminado. Mostrando aplicación.'); });
skip.addEventListener('click', ()=>{ try{ video.pause(); }catch(e){} hideSplash(); log('Usuario saltó el video.'); });

// If video fails to load or autoplay blocked, hide after short timeout
setTimeout(()=>{ if(!video || video.readyState===0) { hideSplash(); log('Video no disponible — mostrando app.'); } }, 5000);
