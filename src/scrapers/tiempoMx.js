const cheerio = require('cheerio');
const httpClient = require('../utils/httpClient');
const { detectCategory, runScrape } = require('./baseScraper');

const SOURCE = 'tiempo.com.mx';
const BASE_URL = 'https://www.tiempo.com.mx';

async function fetchArticleLinks(limit) {
  const { data } = await httpClient.get(BASE_URL);
  const $ = cheerio.load(data);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (!href.startsWith('/') && !href.startsWith('http')) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const parts = full.replace(BASE_URL, '').split('/').filter(Boolean);
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
    for (const sel of ['.entry-content', '.post-content', '.article-body']) {
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

  return { title, body, image, url, source: SOURCE, category: detectCategory(title, body) };
}

async function scrape(limit = 5) {
  return runScrape(SOURCE, fetchArticleLinks, scrapeArticle, limit);
}

module.exports = { scrape };
