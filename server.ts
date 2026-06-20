
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import {
  getVehicles,
  renderCatalog,
  renderVehicle,
  renderAbout,
  renderFAQ,
  renderLlms,
  renderSitemap,
  renderRobots,
  findBySlug,
} from "./server/catalog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// OTP (WhatsApp verification code) store.
// The code is generated and verified server-side only — it is never sent to
// the browser — so only the code delivered via WhatsApp can be used to enter.
// In-memory: codes are cleared on restart and assume a single server instance.
// ---------------------------------------------------------------------------
type OtpEntry = { code: string; expiresAt: number; attempts: number };
const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function normalizePhone(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

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

  // API Proxy for n8n Webhooks to avoid CORS.
  // Generates the WhatsApp verification code server-side and forwards it to n8n
  // (field `codigo`) so it can be delivered via WhatsApp. The code is NOT
  // returned to the browser.
  app.post("/api/bolao/lead", async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
      const codigo = generateOtp();
      if (phone) {
        otpStore.set(phone, { code: codigo, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      }

      const response = await fetch("https://n8n.drivvoo.com/webhook/f3f66db5-444d-4ba0-a403-3584c432cf23", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, codigo }),
      });
      // Never echo the code (or n8n's body) back to the client
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Webhook lead proxy error:", error);
      res.status(500).json({ error: "Failed to forward lead to webhook" });
    }
  });

  // Verifies the WhatsApp code. Only the code generated above (and delivered
  // via WhatsApp) is accepted; the code is consumed on success.
  app.post("/api/bolao/verify", (req, res) => {
    const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
    const codigo = String(req.body?.codigo ?? "").replace(/\D/g, "");
    const entry = otpStore.get(phone);

    if (!entry || Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ valid: false, error: "expired" });
    }
    entry.attempts += 1;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return res.status(429).json({ valid: false, error: "too_many_attempts" });
    }
    if (codigo && codigo === entry.code) {
      otpStore.delete(phone);
      return res.json({ valid: true });
    }
    return res.status(400).json({ valid: false, error: "invalid" });
  });

  app.post("/api/bolao/palpite", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ed8336e-1a2a-4681-bf68-3c844c665f2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook palpite proxy error:", error);
      res.status(500).json({ error: "Failed to forward palpite to webhook" });
    }
  });

  app.post("/api/bolao/finalizar", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2196b31c-775d-4d8d-861d-ea65faf321f6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook finalizar proxy error:", error);
      res.status(500).json({ error: "Failed to forward finalizar to webhook" });
    }
  });

  // -------------------------------------------------------------------------
  // AEO/SEO server-rendered catalog (indexable by AI engines + crawlers).
  // Registered BEFORE the SPA catch-all so these paths return real HTML/XML.
  // -------------------------------------------------------------------------
  app.get("/robots.txt", (_req, res) => {
    res.set("Content-Type", "text/plain").send(renderRobots());
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/xml").send(renderSitemap(vehicles));
    } catch (err) {
      console.error("sitemap error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/sobre", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderAbout());
  });

  app.get("/perguntas-frequentes", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderFAQ());
  });

  app.get("/llms.txt", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "text/plain; charset=utf-8").send(renderLlms(vehicles));
    } catch (err) {
      console.error("llms.txt error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderCatalog(vehicles));
    } catch (err) {
      console.error("catalog error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque/:slug", async (req, res, next) => {
    try {
      const vehicles = await getVehicles();
      const vehicle = findBySlug(vehicles, req.params.slug);
      if (!vehicle) return next(); // fall through to SPA / 404
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderVehicle(vehicle));
    } catch (err) {
      console.error("vehicle page error:", err);
      res.status(500).send("error");
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
