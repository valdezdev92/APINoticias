const cheerio = require('cheerio');
const httpClient = require('../utils/httpClient');
const { detectCategory, runScrape } = require('./baseScraper');

const SOURCE = 'entrelineas.com.mx';
const BASE_URL = 'https://entrelineas.com.mx';

async function fetchArticleLinks(limit) {
  const { data } = await httpClient.get(BASE_URL);
  const $ = cheerio.load(data);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (full.startsWith(BASE_URL) && full !== BASE_URL && full !== `${BASE_URL}/`) {
      const parts = full.replace(BASE_URL, '').split('/').filter(Boolean);
      if (
        parts.length === 1 &&
        !/^(page|categoria|tag|category|author|crealo|deportes|local|seguridad|mexico|espectaculos|columna|mundo|videos|#)/.test(parts[0])
      ) {
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
    // Site uses Elementor — content lives in the post-content widget
    const elementorContent = $('[data-widget_type="theme-post-content.default"], .elementor-widget-theme-post-content');
    if (elementorContent.length) {
      const paras = elementorContent
        .find('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 40);
      if (paras.length) return paras.join('\n\n');
      const text = elementorContent.first().text().trim();
      if (text.length > 200) return text;
    }
    let best = '';
    $('[class*="elementor-element"]').each((_, el) => {
      const text = $(el).clone().children('[class*="elementor"]').remove().end().text().trim();
      if (text.length > best.length && text.length < 5000) best = text;
    });
    if (best.length > 200) return best;
    for (const sel of ['.entry-content', '.post-content', '.single-content']) {
      const text = $(sel).first().text().trim();
      if (text.length > 200) return text;
    }
    return '';
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
