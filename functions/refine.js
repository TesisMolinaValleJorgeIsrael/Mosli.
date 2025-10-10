// functions/refine.js
const Busboy = require('busboy');

/**
 * Netlify Function: recibe multipart/form-data con 'file' y 'meta'.
 * Responde JSON { message, filename, fields, result_url? }
 */
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType) return { statusCode: 400, body: 'Missing Content-Type' };

  return new Promise((resolve) => {
    const bb = new Busboy({ headers: { 'content-type': contentType } });
    let fileBuffer = null;
    let fileName = null;
    const fields = {};

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (d) => chunks.push(d));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        fileName = filename;
      });
    });

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('finish', async () => {
      // Aquí deberías:
      // 1) Persistir fileBuffer a storage (S3, etc) o pasar a tu servicio Python
      // 2) Llamar a tu servicio Python para ejecutar el refinamiento (Rietveld/Le Bail)
      // 3) Devolver una URL al resultado (plot, JSON) o el JSON directamente
      //
      // Por ahora devolvemos resumen de recepción (placeholder)
      const response = {
        message: 'Archivo recibido (placeholder). Integra aquí tu pipeline Python.',
        filename: fileName || 'uploaded.asr',
        fields,
        // Ejemplo: si integras con un bucket S3, aquí devolverías la URL del plot final:
        // result_url: 'https://mi-bucket.s3.amazonaws.com/results/plot123.png'
      };
      resolve({ statusCode: 200, body: JSON.stringify(response) });
    });

    const isBase64 = event.isBase64Encoded;
    const body = isBase64 ? Buffer.from(event.body, 'base64') : Buffer.from(event.body || '', 'utf8');
    bb.end(body);
  });
};
