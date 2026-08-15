import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { handleApiRoute } from './src/server/apiHandler';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// API routes
app.use('/api', async (req, res, next) => {
  try {
    await handleApiRoute(req, res);
  } catch (err) {
    next(err);
  }
});

// Static assets
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShortsForge AI server listening on http://0.0.0.0:${PORT}`);
});
