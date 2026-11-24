import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbFilePath = path.join(dataDir, 'dataguard-db.json');

function ensureDataDir(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readDb(): unknown | null {
  try {
    if (!fs.existsSync(dbFilePath)) return null;
    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeDb(payload: unknown): void {
  ensureDataDir();
  const tmpPath = `${dbFilePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dbFilePath);
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'dataguard-ai', timestamp: new Date().toISOString() });
  });

  app.get('/api/state', (_req, res) => {
    const state = readDb();
    if (!state) {
      res.status(404).json({ error: 'No persisted state yet' });
      return;
    }
    res.json({ state });
  });

  app.put('/api/state', (req, res) => {
    if (!req.body || !req.body.state) {
      res.status(400).json({ error: 'Missing state payload' });
      return;
    }
    writeDb(req.body.state);
    res.json({ ok: true });
  });

  app.post('/api/reset', (req, res) => {
    if (req.body && req.body.state) {
      writeDb(req.body.state);
    } else if (fs.existsSync(dbFilePath)) {
      fs.unlinkSync(dbFilePath);
    }
    res.json({ ok: true });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(rootDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`DataGuard AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
