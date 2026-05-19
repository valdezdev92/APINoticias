const pLimit = require('p-limit');
const logger = require('../utils/logger');
const { rewriteArticle } = require('./aiService');
const { publishArticle } = require('./publishService');

const scrapers = {
  'tiempo.com.mx': require('../scrapers/tiempoMx'),
  'laparadoja.com.mx': require('../scrapers/laParadoja'),
  'laopcion.com.mx': require('../scrapers/laOpcion'),
  'entrelineas.com.mx': require('../scrapers/entrelineas'),
};

const DEFAULT_SOURCES = ['tiempo.com.mx'];

const LIMIT_PER_SOURCE = parseInt(process.env.MAX_ARTICLES_PER_SOURCE || '5', 10);
// Limit concurrent OpenAI calls to avoid rate limits
const aiConcurrency = pLimit(2);

async function runPipeline(sources = DEFAULT_SOURCES) {
  const results = { scraped: 0, processed: 0, published: 0, errors: [] };

  logger.info(`[pipeline] Iniciando pipeline para fuentes: ${sources.join(', ')}`);

  for (const source of sources) {
    const scraper = scrapers[source];
    if (!scraper) {
      logger.warn(`[pipeline] Fuente desconocida: ${source}`);
      continue;
    }

    let rawArticles = [];
    try {
      rawArticles = await scraper.scrape(LIMIT_PER_SOURCE);
      results.scraped += rawArticles.length;
    } catch (err) {
      logger.error(`[pipeline] Error scraping ${source}: ${err.message}`);
      results.errors.push({ source, stage: 'scrape', error: err.message });
      continue;
    }

    // Process each article through AI and then publish
    const tasks = rawArticles.map((raw) =>
      aiConcurrency(async () => {
        try {
          const rewritten = await rewriteArticle(raw);
          results.processed++;

          const published = await publishArticle({
            title: rewritten.title,
            excerpt: rewritten.excerpt,
            body: rewritten.body,
            category: raw.category,
            image_url: raw.image,
            author: process.env.AUTHOR_NAME || 'Redacción',
          });

          if (published) results.published++;
        } catch (err) {
          logger.error(`[pipeline] Error en artículo "${raw.title}": ${err.message}`);
          results.errors.push({ source, title: raw.title, stage: 'ai/publish', error: err.message });
        }
      })
    );

    await Promise.all(tasks);
  }

  logger.info(
    `[pipeline] Finalizado — scrapeados: ${results.scraped}, procesados: ${results.processed}, publicados: ${results.published}, errores: ${results.errors.length}`
  );
  return results;
}

module.exports = { runPipeline, availableSources: Object.keys(scrapers), defaultSources: DEFAULT_SOURCES };
