const cheerio = require('cheerio');
const httpClient = require('../utils/httpClient');
const { detectCategory, runScrape } = require('./baseScraper');

const SOURCE = 'laopcion.com.mx';
const BASE_URL = 'https://laopcion.com.mx';

async function fetchArticleLinks(limit) {
  const { data } = await httpClient.get(BASE_URL);
  const $ = cheerio.load(data);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (full.startsWith(BASE_URL) && full !== BASE_URL && full !== `${BASE_URL}/`) {
      if (!/\/(page|categoria|tag|category|author)\//i.test(full) && full.split('/').length >= 5) {
        links.add(full.split('?')[0]);
      }
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
    for (const sel of ['.entry-content', '.post-content', '.article-content', 'article']) {
      const text = $(sel).first().text().trim();
      if (text.length > 200) return text;
    }
    return $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
  })();

  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    '';

  return { title, body, image, url, source: SOURCE, category: detectCategory(title, body) };
}

async function scrape(limit = 5) {
  return runScrape(SOURCE, fetchArticleLinks, scrapeArticle, limit);
}

module.exports = { scrape };
