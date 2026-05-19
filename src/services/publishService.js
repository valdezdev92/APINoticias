const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = process.env.BASE44_BASE_URL || 'https://norte-bravo-news.base44.app/api';
const APP_ID = process.env.BASE44_APP_ID;
const API_KEY = process.env.BASE44_API_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'api_key': API_KEY,
  },
  timeout: 10000,
});

// In-memory set of normalized titles published during this process session
const sessionTitles = new Set();

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function articleExists(title) {
  const normalized = normalizeTitle(title);

  if (sessionTitles.has(normalized)) return true;

  try {
    const { data } = await client.get('/entities/Article', {
      params: { q: JSON.stringify({ title }), limit: 1 },
    });
    return Array.isArray(data) ? data.length > 0 : data?.total > 0;
  } catch {
    return false;
  }
}

async function publishArticle({ title, excerpt, body, category, image_url, author }) {
  const duplicate = await articleExists(title);
  if (duplicate) {
    logger.info(`[publishService] Artículo duplicado, omitido: "${title}"`);
    return null;
  }

  const payload = {
    title,
    excerpt: excerpt || '',
    body,
    category,
    author: author || process.env.AUTHOR_NAME || 'Redacción',
    image_url: image_url || '',
    published: true,
    is_featured: false,
  };

  const { data } = await client.post('/entities/Article', payload);
  sessionTitles.add(normalizeTitle(title));
  logger.info(`[publishService] Publicado: "${title}" (id: ${data.id})`);
  return data;
}

module.exports = { publishArticle };
