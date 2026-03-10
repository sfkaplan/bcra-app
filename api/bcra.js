// api/bcra.js — Proxy serverless hacia la API del BCRA
// Usa https nativo con rejectUnauthorized:false (BCRA tiene cert autofirmado)

import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { variable = '4', desde, hasta } = req.query;

  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta)  params.set('hasta', hasta);
  const query = [...params].length ? '?' + params.toString() : '';
  const path  = `/estadisticas/v4.0/monetarias/${variable}${query}`;

  try {
    const data = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'api.bcra.gob.ar',
          path,
          method: 'GET',
          agent,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        },
        (response) => {
          let body = '';
          response.on('data', chunk => body += chunk);
          response.on('end', () => {
            try { resolve({ status: response.statusCode, json: JSON.parse(body) }); }
            catch { reject(new Error('Respuesta no es JSON válido')); }
          });
        }
      );
      request.on('error', reject);
      request.end();
    });

    if (data.status !== 200) {
      return res.status(data.status).json({ error: `BCRA respondió con ${data.status}` });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data.json);

  } catch (err) {
    console.error('Error proxy BCRA:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
