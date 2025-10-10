// netlify/functions/refine.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error:'Use POST' }) };
    const payload = JSON.parse(event.body || '{}');
    const content = payload.content || '';
    const lines = content.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !/^#/.test(l));
    const xs = [], ys = [];
    for (const line of lines) {
      const parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2) continue;
      const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (!isFinite(x) || !isFinite(y)) continue;
      xs.push(x); ys.push(y);
    }
    if (xs.length < 5) return { statusCode: 400, body: JSON.stringify({ error:'No hay datos numéricos suficientes' }) };

    // smoothing simple (media movil)
    function smooth(arr, w=5) {
      const out = new Array(arr.length).fill(0);
      for (let i=0;i<arr.length;i++){
        let s=0,c=0;
        for (let j=Math.max(0,i-Math.floor(w/2)); j<=Math.min(arr.length-1,i+Math.floor(w/2)); j++){
          s += arr[j]; c++;
        }
        out[i] = s/c;
      }
      return out;
    }
    const ys_s = smooth(ys,5);
    const sorted = [...ys_s].sort((a,b)=>a-b);
    const med = sorted[Math.floor(sorted.length/2)];
    const thr = med + (Math.max(...ys_s)-med) * 0.12;

    const peaks = [];
    for (let i=1;i<ys_s.length-1;i++){
      if (ys_s[i] > ys_s[i-1] && ys_s[i] > ys_s[i+1] && ys_s[i] > thr) {
        let left=i, right=i;
        const half = ys_s[i]/2;
        while (left>0 && ys_s[left] > half) left--;
        while (right<ys_s.length-1 && ys_s[right] > half) right++;
        // area (trap) on original ys
        let area=0;
        for (let k=Math.max(0,left); k<Math.min(ys.length-1,right); k++){
          area += 0.5 * (ys[k]+ys[k+1]) * (xs[k+1]-xs[k]);
        }
        const fwhm = xs[Math.min(xs.length-1,right)] - xs[Math.max(0,left)];
        peaks.push({ index:i, twoTheta: xs[i], intensity: ys[i], fwhm: Math.abs(fwhm), area: Math.abs(area) });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ peaks }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};

