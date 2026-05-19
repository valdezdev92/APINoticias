const logger = require('../utils/logger');
const { MIN_ARTICLE_BODY_LENGTH } = require('../config/constants');

const CATEGORY_PATTERNS = [
  [/deporte|futbol|fútbol|béisbol|beisbol/, 'deportes'],
  [/internacional|mundial|eeuu|estados unidos/, 'internacional'],
  [/estado|tamaulipas|nuevo leon|coahuila|nuevo laredo/, 'estatal'],
  [/nacional|país|mexico|méxico/, 'nacional'],
];

function detectCategory(title, body) {
  const text = (title + ' ' + (body || '')).toLowerCase();
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return 'general';
}

async function runScrape(sourceName, fetchLinks, scrapeArticle, limit = 5) {
  logger.info(`[${sourceName}] Iniciando scraping...`);
  const links = await fetchLinks(limit);
  logger.info(`[${sourceName}] ${links.length} URLs encontradas`);

  const articles = [];
  for (const url of links) {
    try {
      const article = await scrapeArticle(url);
      if (article.title && article.body.length > MIN_ARTICLE_BODY_LENGTH) {
        articles.push(article);
      }
    } catch (err) {
      logger.warn(`[${sourceName}] Error en ${url}: ${err.message}`);
    }
  }

  logger.info(`[${sourceName}] ${articles.length} artículos extraídos`);
  return articles;
}

module.exports = { detectCategory, runScrape };
