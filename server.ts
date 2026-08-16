import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { handleApiRoute } from './src/server/apiHandler';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Direct streaming API routes BEFORE json body-parser to avoid buffering whole video into V8 heap
  app.post('/api/upload-video-binary', async (req, res, next) => {
    try {
      await handleApiRoute(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API routes FIRST
  app.use('/api', async (req, res, next) => {
    try {
      await handleApiRoute(req, res);
    } catch (err) {
      next(err);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShortsForge AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
