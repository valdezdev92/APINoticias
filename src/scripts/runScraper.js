require('dotenv').config();
const { runPipeline, availableSources } = require('../services/pipelineService');
const logger = require('../utils/logger');

// Usage: node src/scripts/runScraper.js [source1] [source2] ...
// Example: node src/scripts/runScraper.js tiempo.com.mx laopcion.com.mx
const args = process.argv.slice(2);
const sources = args.length > 0 ? args : availableSources;

logger.info(`Ejecutando pipeline manualmente para: ${sources.join(', ')}`);

runPipeline(sources)
  .then((results) => {
    logger.info(`Resultados: ${JSON.stringify(results, null, 2)}`);
    process.exit(0);
  })
  .catch((err) => {
    logger.error(`Error fatal: ${err.message}`);
    process.exit(1);
  });
