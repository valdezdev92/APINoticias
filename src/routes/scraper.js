const express = require('express');
const router = express.Router();
const { runPipeline, availableSources } = require('../services/pipelineService');
const logger = require('../utils/logger');

// Track active run to avoid concurrent executions
let running = false;

// GET /api/scraper/sources — list available sources
router.get('/sources', (req, res) => {
  res.json({ sources: availableSources });
});

// POST /api/scraper/run — trigger pipeline manually
// Body (optional): { "sources": ["tiempo.com.mx", "laparadoja.com.mx"] }
router.post('/run', async (req, res) => {
  if (running) {
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

  running = true;
  // Respond immediately and run in background
  res.json({ message: 'Pipeline iniciado', sources: selectedSources });

  try {
    const results = await runPipeline(selectedSources);
    logger.info(`[route] Pipeline completado: ${JSON.stringify(results)}`);
  } catch (err) {
    logger.error(`[route] Pipeline falló: ${err.message}`);
  } finally {
    running = false;
  }
});

// GET /api/scraper/status — check if pipeline is running
router.get('/status', (req, res) => {
  res.json({ running });
});

module.exports = router;
