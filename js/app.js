// app.js - interacción mínima, Chart.js con pan-drag
document.addEventListener('DOMContentLoaded', ()=>{

  // ---------- Periodic grid (simplificada: primeros 30 elementos)
  const elements = [
    "H","He","Li","Be","B","C","N","O","F","Ne",
    "Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca",
    "Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn"
  ];
  const grid = document.getElementById('periodicGrid');
  const selected = new Set();
  elements.forEach(sym=>{
    const d = document.createElement('div');
    d.className='elem';
    d.textContent=sym;
    d.dataset.sym = sym;
    d.addEventListener('click', ()=> {
      if(selected.has(sym)){ selected.delete(sym); d.classList.remove('selected'); }
      else { selected.add(sym); d.classList.add('selected'); }
      log(`Elementos seleccionados: ${[...selected].join(', ')}`);
    });
    grid.appendChild(d);
  });

  // ---------- Log helper
  const logEl = document.getElementById('logOutput');
  function log(msg){
    const ts = new Date().toLocaleTimeString();
    logEl.textContent = `[${ts}] ${msg}\n` + logEl.textContent;
  }

  // ---------- Chart.js inicial
  const ctx = document.getElementById('xrdChart').getContext('2d');
  // sample data
  const sampleX = Array.from({length:500},(_,i)=>i*0.05 + 10);
  const sampleY = sampleX.map(x => Math.exp(-((x-30)**2)/10) * (Math.random()*0.6+0.7) * 100);
  const chart = new Chart(ctx, {
    type:'line',
    data:{
      labels: sampleX,
      datasets:[{
        label:'Intensidad',
        data: sampleY,
        borderWidth:1,
        pointRadius:0
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{ title:{display:true,text:'2θ (°)'} },
        y:{ title:{display:true,text:'Intensidad'} }
      },
      plugins:{
        zoom:{
          pan:{
            enabled:true,
            mode:'x',
            modifierKey:'shift', // opcional: require Shift + drag para pan; cambia o quita esta línea para permitir solo drag
            // para permitir pan manteniendo apretado sin modificador: quita modifierKey
            threshold:10,
            onPan: ({chart})=> { /* opcional */ }
          },
          zoom:{ wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' }
        }
      },
      interaction:{intersect:false,mode:'nearest'}
    }
  });

  // Si quieres que el pan funcione con solo arrastrar (sin shift), cambia la opción modifierKey arriba a undefined.
  // Hacemos que el botón Pan toggle active/desactive el modifier:
  const panToggle = document.getElementById('panToggle');
  panToggle.addEventListener('click', ()=>{
    const z = chart.options.plugins.zoom.pan;
    if(z.modifierKey){
      z.modifierKey = undefined;
      panToggle.textContent = 'Pan (drag) ON';
    } else {
      z.modifierKey = 'shift';
      panToggle.textContent = 'Pan (shift+drag)';
    }
    chart.update('none');
  });

  // Zoom buttons
  document.getElementById('zoomIn').addEventListener('click', ()=> {
    chart.zoom(1.25);
  });
  document.getElementById('zoomOut').addEventListener('click', ()=> {
    chart.zoom(0.8);
  });
  document.getElementById('resetZoom').addEventListener('click', ()=> {
    chart.resetZoom();
  });

  // ---------- File upload handling (simple)
  const fileAsr = document.getElementById('fileAsr');
  fileAsr.addEventListener('change', async (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    log(`Cargando ${f.name} (${Math.round(f.size/1024)} kB)`);
    const text = await f.text();
    // parse minimal: busca pares angulo,intensidad por líneas (depende formato .asr)
    const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const data = [];
    for(const L of lines){
      const parts = L.split(/\s+/);
      if(parts.length>=2){
        const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
        if(!isNaN(a) && !isNaN(b)) data.push([a,b]);
      }
    }
    if(data.length>0){
      // ordenar por ángulo y actualizar gráfica
      data.sort((a,b)=>a[0]-b[0]);
      chart.data.labels = data.map(d=>d[0]);
      chart.data.datasets[0].data = data.map(d=>d[1]);
      chart.update();
      log(`Archivo parseado: ${data.length} puntos.`);
    } else {
      log('No se detectaron pares numéricos en el archivo. Revisa el formato .asr');
    }
  });

  // ---------- Procesado, detección de picos y fit (placeholders)
  document.getElementById('btnProcess').addEventListener('click', ()=> {
    log('Procesado de datos ejecutado (placeholder).');
    // aquí llamarías tu función de pretratamiento (baseline, smoothing, etc.)
  });
  document.getElementById('btnDetectPeaks').addEventListener('click', ()=> {
    log('Detección de picos ejecutada (placeholder).');
    // implementa peak finding y pinta markers en la gráfica
  });
  document.getElementById('btnFit').addEventListener('click', ()=> {
    log('Ajuste (fit) ejecutado (placeholder).');
  });
  document.getElementById('btnReset').addEventListener('click', ()=> {
    chart.resetZoom();
    log('Gráfica reseteada');
  });
  document.getElementById('btnDownloadChart').addEventListener('click', ()=>{
    const a = document.createElement('a');
    a.href = document.getElementById('xrdChart').toDataURL('image/png',1.0);
    a.download = 'xrd_chart.png';
    a.click();
    log('Descarga de PNG iniciada.');
  });

  // ---------- Buscar 10 similares desde COD (stub)
  document.getElementById('btnGetMatches').addEventListener('click', async ()=>{
    const sels = [...selected];
    if(sels.length===0){ log('Selecciona al menos un elemento para buscar coincidencias.'); return; }
    log(`Buscando 10 matches para: ${sels.join(', ')} (stub)`);
    // === Opción recomendada: llamar a tu backend con POST al endpoint /api/cod_matches
    // Ejemplo (no funcional aquí) - reemplaza URL por tu backend:
    /*
    const resp = await fetch('/api/cod_matches', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({elements:sels, top:10})
    });
    const result = await resp.json();
    // result podría contener links o archivos para descargar; muestra en log.
    log('Matches recibidos: ' + JSON.stringify(result));
    */
    log('Nota: para descargar automáticamente CIFs/entradas de COD necesitas implementar un endpoint de backend que consulte la API del COD y devuelva los archivos o un ZIP. ¿Quieres que te provea un ejemplo de backend en Python para eso?');
  });

  // Inicial log
  log('Interfaz lista.');
});
