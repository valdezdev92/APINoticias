const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE_URL = process.env.BASE44_BASE_URL || 'https://norte-bravo-news.base44.app/api';
const API_KEY = process.env.BASE44_API_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'api_key': API_KEY },
  timeout: 10000,
});

// GET /api/articles — list articles from Base44
router.get('/', async (req, res) => {
  try {
    const { limit = 20, skip = 0, sort_by = '-created_date', q } = req.query;
    const params = { limit, skip, sort_by };
    if (q) params.q = q;
    const { data } = await client.get('/entities/Article', { params });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Error consultando artículos', detail: err.message });
  }
});

// GET /api/articles/:id — get single article
router.get('/:id', async (req, res) => {
  try {
    const { data } = await client.get(`/entities/Article/${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Artículo no encontrado', detail: err.message });
  }
});

// DELETE /api/articles/:id — delete article
router.delete('/:id', async (req, res) => {
  try {
    await client.delete(`/entities/Article/${req.params.id}`);
    res.json({ message: 'Artículo eliminado' });
  } catch (err) {
    res.status(502).json({ error: 'Error eliminando artículo', detail: err.message });
  }
});

module.exports = router;
