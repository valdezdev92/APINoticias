const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { runPipeline, isPipelineRunning, availableSources } = require('../services/pipelineService');
const logger = require('../utils/logger');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require('../config/constants');

const runLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});

router.get('/sources', (req, res) => {
  res.json({ sources: availableSources });
});

router.post('/run', runLimiter, async (req, res) => {
  if (isPipelineRunning()) {
    return res.status(409).json({ error: 'El pipeline ya está en ejecución. Intenta más tarde.' });
  }

  const { sources } = req.body || {};
  const selectedSources =
    Array.isArray(sources) && sources.length > 0
      ? sources.filter((s) => availableSources.includes(s))
      : availableSources;

  if (selectedSources.length === 0) {
    return res.status(400).json({ error: 'No se encontraron fuentes válidas.', available: availableSources });
  }

  res.json({ message: 'Pipeline iniciado', sources: selectedSources });

  runPipeline(selectedSources)
    .then((results) => logger.info(`[route] Pipeline completado: ${JSON.stringify(results)}`))
    .catch((err) => logger.error(`[route] Pipeline falló: ${err.message}`));
});

router.get('/status', (req, res) => {
  res.json({ running: isPipelineRunning() });
});

module.exports = router;
