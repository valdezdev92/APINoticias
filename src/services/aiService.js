const OpenAI = require('openai');
const logger = require('../utils/logger');
const { AI_MAX_RETRIES, AI_RETRY_BASE_MS } = require('../config/constants');

let _openai = null;
function getClient() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no está definida en las variables de entorno');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `Eres un editor de noticias profesional para un periódico digital mexicano.
Tu tarea es reescribir noticias con un estilo propio, atractivo y periodístico.

Reglas importantes:
- Reescribe la noticia completamente con tus propias palabras, sin copiar el texto original.
- Mantén todos los hechos, datos y cifras exactas.
- Usa un español claro, directo y periodístico.
- El título debe ser impactante y conciso (máximo 12 palabras).
- El excerpt debe ser un resumen de 2-3 oraciones que enganche al lector.
- El body debe ser el cuerpo completo de la noticia, bien estructurado en párrafos.
- No añadas información que no esté en el texto original.
- Responde ÚNICAMENTE con un JSON válido, sin texto adicional.`;

async function withRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit = err?.status === 429 || String(err?.message).includes('429');
      if (!isRateLimit || attempt === AI_MAX_RETRIES) throw err;
      const delay = AI_RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn(`[aiService] Rate limit, reintentando en ${delay}ms (intento ${attempt + 1}/${AI_MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function rewriteArticle(raw) {
  const userPrompt = `Reescribe la siguiente noticia y devuelve un JSON con esta estructura exacta:
{
  "title": "string",
  "excerpt": "string",
  "body": "string"
}

NOTICIA ORIGINAL:
Titular: ${raw.title}
Contenido: ${raw.body.slice(0, 3000)}`;

  try {
    const content = await withRetry(async () => {
      const response = await getClient().chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });
      return response.choices[0].message.content.trim();
    });

    const clean = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.title || !parsed.body) {
      throw new Error('Respuesta de IA incompleta: faltan campos title o body');
    }

    return parsed;
  } catch (err) {
    logger.error(`[aiService] Error procesando "${raw.title}": ${err.message}`);
    return {
      title: raw.title,
      excerpt: raw.body.slice(0, 200),
      body: raw.body,
    };
  }
}

module.exports = { rewriteArticle };
