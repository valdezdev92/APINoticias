require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const scraperRoutes = require('./routes/scraper');
const articlesRoutes = require('./routes/articles');
const { runPipeline, isPipelineRunning } = require('./services/pipelineService');
const { PIPELINE_TIMEOUT_MS } = require('./config/constants');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (expectedKey && key !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/scraper', scraperRoutes);
app.use('/api/articles', articlesRoutes);

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`API Noticias corriendo en puerto ${PORT}`));

const cronExpression = process.env.SCRAPE_CRON || '*/30 * * * *';
if (cron.validate(cronExpression)) {
  cron.schedule(cronExpression, async () => {
    if (isPipelineRunning()) {
      logger.warn('[cron] Pipeline ya en ejecución, saltando ciclo');
      return;
    }
    logger.info(`[cron] Ejecutando pipeline programado: ${cronExpression}`);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Pipeline timeout')), PIPELINE_TIMEOUT_MS)
    );
    try {
      await Promise.race([runPipeline(), timeout]);
    } catch (err) {
      logger.error(`[cron] Error en pipeline: ${err.message}`);
    }
  });
  logger.info(`[cron] Tarea programada: "${cronExpression}"`);
} else {
  logger.warn(`[cron] Expresión cron inválida: "${cronExpression}". El cron no se iniciará.`);
}
