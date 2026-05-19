const cheerio = require('cheerio');
const httpClient = require('../utils/httpClient');
const logger = require('../utils/logger');

const BASE_URL = 'https://www.tiempo.com.mx';

async function fetchArticleLinks(limit) {
  const { data } = await httpClient.get(BASE_URL);
  const $ = cheerio.load(data);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    // Skip relative hrefs without leading slash (e.g. "hits/123")
    if (!href.startsWith('/') && !href.startsWith('http')) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const path = full.replace(BASE_URL, '');
    const parts = path.split('/').filter(Boolean);
    // Article URLs follow /category/slug/ — exactly 2 path segments
    if (full.startsWith(BASE_URL) && parts.length === 2 && !full.includes('static')) {
      links.add(full.split('?')[0]);
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
    const paras = $('article p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40 && !t.startsWith('.') && !t.startsWith('{'));
    if (paras.length) return paras.join('\n\n');
    const selectors = ['.entry-content', '.post-content', '.article-body'];
    for (const sel of selectors) {
      const text = $(sel).first().text().trim();
      if (text.length > 200) return text;
    }
    return '';
  })();

  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    $('img.featured').first().attr('src') ||
    '';

  const category = detectCategory($, title);

  return { title, body, image, url, source: 'tiempo.com.mx', category };
}

function detectCategory($, title) {
  const text = (title + ' ' + $('body').text()).toLowerCase();
  if (/deporte|futbol|fútbol|béisbol|beisbol/.test(text)) return 'deportes';
  if (/nacional|país|mexico|méxico/.test(text)) return 'nacional';
  if (/internacional|mundial|eeuu|estados unidos/.test(text)) return 'internacional';
  if (/estado|tamaulipas|nuevo leon|coahuila/.test(text)) return 'estatal';
  return 'general';
}

async function scrape(limit = 5) {
  logger.info('[tiempo.com.mx] Iniciando scraping...');
  const links = await fetchArticleLinks(limit);
  logger.info(`[tiempo.com.mx] ${links.length} URLs encontradas`);

  const articles = [];
  for (const url of links) {
    try {
      const article = await scrapeArticle(url);
      if (article.title && article.body.length > 100) {
        articles.push(article);
      }
    } catch (err) {
      logger.warn(`[tiempo.com.mx] Error en ${url}: ${err.message}`);
    }
  }
  logger.info(`[tiempo.com.mx] ${articles.length} artículos extraídos`);
  return articles;
}

module.exports = { scrape };
