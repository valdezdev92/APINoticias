# API Noticias

API Node.js para scraping automático de noticias, reescritura con IA (OpenAI) y publicación en Base44.

## Flujo

```
Sitios de noticias → Scraping → OpenAI (reescritura) → Base44 API (publicación)
```

## Fuentes configuradas

- tiempo.com.mx
- laparadoja.com.mx
- laopcion.com.mx
- entrelineas.com.mx

## Instalación en Hostinger (Node.js)

```bash
npm install
cp .env.example .env
# Editar .env con tus claves
```

## Variables de entorno (.env)

| Variable | Descripción |
|---|---|
| `OPENAI_API_KEY` | Clave de OpenAI |
| `OPENAI_MODEL` | Modelo a usar (default: `gpt-4o-mini`) |
| `BASE44_API_KEY` | API key de Base44 |
| `BASE44_APP_ID` | App ID de Base44 |
| `SCRAPE_CRON` | Expresión cron (default: `0 */2 * * *`) |
| `MAX_ARTICLES_PER_SOURCE` | Máximo artículos por fuente (default: 5) |
| `AUTHOR_NAME` | Nombre del autor en las noticias |
| `INTERNAL_API_KEY` | Clave para proteger los endpoints (opcional) |
| `PORT` | Puerto del servidor (default: 3000) |

## Scripts

```bash
# Iniciar servidor
npm start

# Desarrollo con hot-reload
npm run dev

# Ejecutar scraper manualmente (todas las fuentes)
npm run scrape

# Ejecutar scraper para una fuente específica
node src/scripts/runScraper.js tiempo.com.mx
```

## Endpoints

### `GET /health`
Verificar que el servidor está activo.

### `POST /api/scraper/run`
Ejecuta el pipeline manualmente.
```json
// Body opcional para filtrar fuentes:
{ "sources": ["tiempo.com.mx", "laopcion.com.mx"] }
```

### `GET /api/scraper/status`
Verifica si el pipeline está en ejecución.

### `GET /api/scraper/sources`
Lista las fuentes disponibles.

### `GET /api/articles`
Lista artículos desde Base44 (params: `limit`, `skip`, `sort_by`, `q`).

### `GET /api/articles/:id`
Obtiene un artículo por ID.

### `DELETE /api/articles/:id`
Elimina un artículo.

## Autenticación de endpoints

Si defines `INTERNAL_API_KEY` en `.env`, todos los endpoints requieren el header:
```
x-api-key: <tu_clave>
```

## Configuración en Hostinger

1. Sube los archivos (o usa git)
2. En el panel de Node.js de Hostinger, establece `src/index.js` como entry point
3. Configura las variables de entorno en el panel
4. Activa la aplicación
