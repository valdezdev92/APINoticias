require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const scraperRoutes = require('./routes/scraper');
const articlesRoutes = require('./routes/articles');
const { runPipeline } = require('./services/pipelineService');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const app = express();
app.use(express.json());

// Simple API key middleware for incoming requests
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

// Scheduled cron job — default: every 2 hours
const cronExpression = process.env.SCRAPE_CRON || '*/5 * * * *';
if (cron.validate(cronExpression)) {
  cron.schedule(cronExpression, async () => {
    logger.info(`[cron] Ejecutando pipeline programado: ${cronExpression}`);
    try {
      await runPipeline();
    } catch (err) {
      logger.error(`[cron] Error en pipeline: ${err.message}`);
    }
  });
  logger.info(`[cron] Tarea programada: "${cronExpression}"`);
} else {
  logger.warn(`[cron] Expresión cron inválida: "${cronExpression}". El cron no se iniciará.`);
}
