// server_static.js - strict static file server (no CSR fallback)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4001;

// Serve everything from project root
app.use(express.static(__dirname, { extensions: ['html'] }));

// Explicit route for add-activity.html to avoid any SPA fallbacks
app.get('/add-activity.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'add-activity.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`Static server listening on http://localhost:${PORT}`);
});
