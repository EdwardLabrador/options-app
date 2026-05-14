const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  try {
    const { ticker, riesgo, contratos, tipo, capital } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker requerido' });

    const today = new Date();
    const exp = new Date(today);
    exp.setDate(today.getDate() + 7);
    const expStr = exp.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

    const prompt = `Eres un analista experto en opciones del mercado de EE.UU. Analiza ${ticker} y recomienda una opción semanal. Tipo: ${tipo}. Riesgo: ${riesgo}. Capital: ${capital}. Contratos: ${contratos}. Fecha hoy: ${today.toLocaleDateString('es-MX')}. Expiración máx: ${expStr}.

Responde SOLO con JSON válido sin markdown ni texto extra:
{
  "ticker": "${ticker}",
  "precio_actual": "precio en USD",
  "tendencia": "Alcista o Bajista o Lateral",
  "sentimiento": "Positivo o Negativo o Neutro",
  "recomendacion": "CALL o PUT o NEUTRAL",
  "confianza": número 1-100,
  "strike": "precio del strike",
  "expiracion": "fecha exacta",
  "prima": "prima estimada",
  "costo_total": "costo total para ${contratos} contratos",
  "take_profit": "precio take profit +50%",
  "stop_loss": "precio stop loss -50%",
  "nivel_riesgo": número 1-10,
  "analisis_tecnico": "2-3 oraciones sobre RSI soporte resistencia",
  "analisis_fundamental": "2-3 oraciones sobre fundamentos",
  "justificacion": "2-3 oraciones justificando la recomendación",
  "catalistas": ["catalizador 1", "catalizador 2", "catalizador 3"],
  "riesgos": ["riesgo 1", "riesgo 2"]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Eres un analista experto en opciones financieras. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let raw = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
    raw = raw.replace(/```json|```/g, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Respuesta inválida del modelo' });

    const result = JSON.parse(match[0]);
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
