
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Altimus Stock to avoid CORS
  app.get("/api/stock", async (req, res) => {
    try {
      const url = 'https://estoque.altimus.com.br/api/estoquexml?estoque=997c9e91-40d7-4bec-95cb-68e18a2668a3';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch from Altimus');
      const xml = await response.text();
      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch stock' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
