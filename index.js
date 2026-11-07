// Taskboard
// 1. Browser pages: src/pages.js and views/
// 2. JSON API: src/api.js
// 3. Saved tasks: data/tasks.json via src/store.js

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './src/api.js';
import { pages } from './src/pages.js';
import { ensureStore } from './src/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3200;

const NOTICES = {
  created: 'Task added.',
  updated: 'Changes saved.',
  deleted: 'Task removed.',
  done: 'Marked done.',
  reopened: 'Task reopened.',
};

try {
  ensureStore();
} catch (error) {
  console.error('Could not open the task store.');
  console.error(error);
  process.exit(1);
}

const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('json spaces', 2);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode}`);
  });
  next();
});

app.use((req, res, next) => {
  const key = Array.isArray(req.query.notice) ? req.query.notice.at(-1) : req.query.notice;
  res.locals.notice = NOTICES[key] || null;
  res.locals.page = '';
  next();
});

app.use('/api', api);
app.use(pages);

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  res.status(404).render('not-found', { title: 'Not found' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error(error);
  const apiRequest = req.originalUrl.startsWith('/api');
  if (apiRequest && error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Send valid JSON.' });
    return;
  }
  if (apiRequest) {
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
  res.status(500).render('error', { title: 'Something went wrong' });
});

const server = app.listen(PORT, () => {
  console.log(`Taskboard running at http://localhost:${PORT}`);
  console.log(`JSON API at http://localhost:${PORT}/api/tasks`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT.`);
    process.exit(1);
  }
  throw error;
});
