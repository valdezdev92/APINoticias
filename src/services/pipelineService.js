const pLimit = require('p-limit');
const logger = require('../utils/logger');
const { rewriteArticle } = require('./aiService');
const { publishArticle } = require('./publishService');
const { AI_CONCURRENCY } = require('../config/constants');

const scrapers = {
  'tiempo.com.mx': require('../scrapers/tiempoMx'),
  'laparadoja.com.mx': require('../scrapers/laParadoja'),
  'laopcion.com.mx': require('../scrapers/laOpcion'),
  'entrelineas.com.mx': require('../scrapers/entrelineas'),
};

const LIMIT_PER_SOURCE = parseInt(process.env.MAX_ARTICLES_PER_SOURCE || '5', 10);
const aiConcurrency = pLimit(AI_CONCURRENCY);

let _running = false;

function isPipelineRunning() {
  return _running;
}

async function runPipeline(sources = Object.keys(scrapers)) {
  if (_running) throw new Error('El pipeline ya está en ejecución');
  _running = true;

  const results = { scraped: 0, processed: 0, published: 0, errors: [] };
  logger.info(`[pipeline] Iniciando pipeline para fuentes: ${sources.join(', ')}`);

  try {
    const sourceResults = await Promise.all(
      sources.map(async (source) => {
        const sr = { scraped: 0, processed: 0, published: 0, errors: [] };
        const scraper = scrapers[source];

        if (!scraper) {
          logger.warn(`[pipeline] Fuente desconocida: ${source}`);
          sr.errors.push({ source, stage: 'scrape', error: 'Fuente desconocida' });
          return sr;
        }

        let rawArticles = [];
        try {
          rawArticles = await scraper.scrape(LIMIT_PER_SOURCE);
          sr.scraped = rawArticles.length;
        } catch (err) {
          logger.error(`[pipeline] Error scraping ${source}: ${err.message}`);
          sr.errors.push({ source, stage: 'scrape', error: err.message });
          return sr;
        }

        const tasks = rawArticles.map((raw) =>
          aiConcurrency(async () => {
            try {
              const rewritten = await rewriteArticle(raw);
              sr.processed++;

              const published = await publishArticle({
                title: rewritten.title,
                excerpt: rewritten.excerpt,
                body: rewritten.body,
                category: raw.category,
                image_url: raw.image,
                author: process.env.AUTHOR_NAME || 'Redacción',
              });

              if (published) sr.published++;
            } catch (err) {
              logger.error(`[pipeline] Error en artículo "${raw.title}": ${err.message}`);
              sr.errors.push({ source, title: raw.title, stage: 'ai/publish', error: err.message });
            }
          })
        );

        await Promise.all(tasks);
        return sr;
      })
    );

    for (const sr of sourceResults) {
      results.scraped += sr.scraped;
      results.processed += sr.processed;
      results.published += sr.published;
      results.errors.push(...sr.errors);
    }
  } finally {
    _running = false;
  }

  logger.info(
    `[pipeline] Finalizado — scrapeados: ${results.scraped}, procesados: ${results.processed}, publicados: ${results.published}, errores: ${results.errors.length}`
  );
  return results;
}

module.exports = { runPipeline, isPipelineRunning, availableSources: Object.keys(scrapers) };
