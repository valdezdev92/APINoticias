const cheerio = require('cheerio');
const httpClient = require('../utils/httpClient');
const logger = require('../utils/logger');

const BASE_URL = 'https://entrelineas.com.mx';

async function fetchArticleLinks(limit) {
  const { data } = await httpClient.get(BASE_URL);
  const $ = cheerio.load(data);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (full.startsWith(BASE_URL) && full !== BASE_URL && full !== `${BASE_URL}/`) {
      const path = full.replace(BASE_URL, '');
      const parts = path.split('/').filter(Boolean);
      // Articles are at /slug/ (1 segment) — exclude section pages and utility pages
      if (parts.length === 1 && !/^(page|categoria|tag|category|author|crealo|deportes|local|seguridad|mexico|espectaculos|columna|mundo|videos|#)/.test(parts[0])) {
        links.add(full.split('?')[0]);
      }
    }
  });

  return [...links].slice(0, limit);
}

async function scrapeArticle(url) {
  const { data } = await httpClient.get(url);
  const $ = cheerio.load(data);

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';

  const body = (() => {
    // Site uses Elementor — content lives in the post-content widget
    const elementorContent = $('[data-widget_type="theme-post-content.default"], .elementor-widget-theme-post-content');
    if (elementorContent.length) {
      const paras = elementorContent.find('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 40);
      if (paras.length) return paras.join('\n\n');
      const text = elementorContent.first().text().trim();
      if (text.length > 200) return text;
    }
    // Fallback: largest Elementor text block
    let best = '';
    $('[class*="elementor-element"]').each((_, el) => {
      const text = $(el).clone().children('[class*="elementor"]').remove().end().text().trim();
      if (text.length > best.length && text.length < 5000) best = text;
    });
    if (best.length > 200) return best;
    const selectors = ['.entry-content', '.post-content', '.single-content'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text.length > 200) return text;
    }
    return '';
  })();

  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    '';

  return { title, body, image, url, source: 'entrelineas.com.mx', category: detectCategory(title, body) };
}

function detectCategory(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  if (/deporte|futbol|fútbol/.test(text)) return 'deportes';
  if (/internacional|mundial/.test(text)) return 'internacional';
  if (/estado|tamaulipas/.test(text)) return 'estatal';
  if (/nacional|mexico|méxico/.test(text)) return 'nacional';
  return 'general';
}

async function scrape(limit = 5) {
  logger.info('[entrelineas.com.mx] Iniciando scraping...');
  const links = await fetchArticleLinks(limit);
  logger.info(`[entrelineas.com.mx] ${links.length} URLs encontradas`);

  const articles = [];
  for (const url of links) {
    try {
      const article = await scrapeArticle(url);
      if (article.title && article.body.length > 100) {
        articles.push(article);
      }
    } catch (err) {
      logger.warn(`[entrelineas.com.mx] Error en ${url}: ${err.message}`);
    }
  }
  logger.info(`[entrelineas.com.mx] ${articles.length} artículos extraídos`);
  return articles;
}

module.exports = { scrape };
