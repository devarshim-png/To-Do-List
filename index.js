// Taskboard lives in this file.
// Pages are views/list.ejs, views/add.ejs, and views/update.ejs.
// Tasks are saved in data/tasks.json. The same data is served at /api/tasks.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3200;
const DATA_FILE = process.env.TASKS_FILE || path.join(__dirname, 'data', 'tasks.json');
const PRIORITIES = ['low', 'medium', 'high'];

const NOTICES = {
  created: 'Task added.',
  updated: 'Changes saved.',
  deleted: 'Task removed.',
  done: 'Marked done.',
  reopened: 'Task reopened.',
};

const blank = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  status: 'open',
};

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayISO() {
  return isoDate(new Date());
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function formatToday() {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDue(dueDate, overdue, today) {
  if (!isRealDate(dueDate)) return 'No due date';
  const [year, month, day] = dueDate.split('-').map(Number);
  const options = { day: 'numeric', month: 'short' };
  if (year !== new Date().getFullYear()) options.year = 'numeric';
  const formatted = new Intl.DateTimeFormat('en-IN', options).format(new Date(year, month - 1, day));
  if (overdue) return `Overdue · ${formatted}`;
  if (dueDate === today) return `Due today · ${formatted}`;
  return `Due ${formatted}`;
}

function seedTasks() {
  const now = new Date().toISOString();
  const task = (fields) => ({
    id: randomUUID(),
    description: '',
    dueDate: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  });

  return [
    task({
      title: 'Walk through this Node.js POC',
      description: 'Show the board, add a task, then open the JSON API.',
      priority: 'high',
      dueDate: todayISO(),
      status: 'open',
    }),
    task({
      title: 'Write down questions from the review',
      description: 'Capture follow-ups while they are still fresh.',
      priority: 'medium',
      dueDate: addDays(2),
      status: 'open',
    }),
    task({
      title: 'Share the repo link',
      description: 'Send the GitHub link after the walkthrough.',
      priority: 'low',
      dueDate: addDays(-1),
      status: 'open',
    }),
    task({
      title: 'Install Express and EJS',
      description: 'The first version had list, add, and update pages.',
      priority: 'low',
      dueDate: addDays(-4),
      status: 'done',
    }),
  ];
}

function writeTasks(tasks) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(tasks, null, 2)}\n`);
  fs.renameSync(tempFile, DATA_FILE);
}

function readTasks() {
  if (!fs.existsSync(DATA_FILE)) writeTasks(seedTasks());
  const tasks = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(tasks)) throw new Error('Task store must be a JSON list.');
  return tasks;
}

function presentTask(task, today) {
  const priority = PRIORITIES.includes(task.priority) ? task.priority : 'medium';
  const status = task.status === 'done' ? 'done' : 'open';
  const dueDate = isRealDate(task.dueDate) ? task.dueDate : null;
  const overdue = status !== 'done' && Boolean(dueDate) && dueDate < today;
  return {
    id: task.id,
    title: task.title || 'Untitled',
    description: task.description || '',
    priority,
    priorityLabel: priority.charAt(0).toUpperCase() + priority.slice(1),
    dueDate,
    dueLabel: formatDue(dueDate, overdue, today),
    status,
    overdue,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function summarize(tasks) {
  const open = tasks.filter((task) => task.status !== 'done');
  return {
    total: tasks.length,
    open: open.length,
    done: tasks.length - open.length,
    overdue: tasks.filter((task) => task.overdue).length,
  };
}

function sortTasks(tasks) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

function listTasks(query = {}) {
  const allowed = new Set(['all', 'open', 'done', 'overdue']);
  const status = allowed.has(query.status) ? query.status : 'all';
  const q = String(query.q ?? '').trim().slice(0, 80);
  const today = todayISO();
  const all = readTasks().map((task) => presentTask(task, today));
  const needle = q.toLowerCase();
  const tasks = sortTasks(all.filter((task) => {
    if (status === 'open' && task.status === 'done') return false;
    if (status === 'done' && task.status !== 'done') return false;
    if (status === 'overdue' && !task.overdue) return false;
    if (!needle) return true;
    return `${task.title} ${task.description}`.toLowerCase().includes(needle);
  }));
  return { tasks, stats: summarize(all), status, q };
}

function getTask(id) {
  const task = readTasks().find((item) => item.id === id);
  return task ? presentTask(task, todayISO()) : null;
}

function createTask(value) {
  if (!value?.title) throw new Error('A task needs a title.');
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title: value.title,
    description: value.description || '',
    priority: value.priority || 'medium',
    dueDate: value.dueDate || null,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  const tasks = readTasks();
  tasks.push(task);
  writeTasks(tasks);
  return presentTask(task, todayISO());
}

function updateTask(id, value) {
  const tasks = readTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  tasks[index] = {
    ...tasks[index],
    title: value.title,
    description: value.description || '',
    priority: value.priority,
    dueDate: value.dueDate || null,
    status: value.status === 'done' ? 'done' : 'open',
    updatedAt: new Date().toISOString(),
  };
  writeTasks(tasks);
  return presentTask(tasks[index], todayISO());
}

function toggleTask(id) {
  const tasks = readTasks();
  const task = tasks.find((item) => item.id === id);
  if (!task) return null;
  task.status = task.status === 'done' ? 'open' : 'done';
  task.updatedAt = new Date().toISOString();
  writeTasks(tasks);
  return presentTask(task, todayISO());
}

function deleteTask(id) {
  const tasks = readTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  const [removed] = tasks.splice(index, 1);
  writeTasks(tasks);
  return presentTask(removed, todayISO());
}

function validateTask(input, { allowStatus = false } = {}) {
  const body = input && typeof input === 'object' ? input : {};
  const errors = {};
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const priority = String(body.priority ?? 'medium').trim().toLowerCase();
  const dueRaw = String(body.dueDate ?? '').trim();

  if (!title) errors.title = 'Add a title.';
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters.';

  if (description.length > 1000) errors.description = 'Keep the description under 1,000 characters.';
  if (!PRIORITIES.includes(priority)) errors.priority = 'Choose low, medium, or high.';

  let dueDate = null;
  if (dueRaw) {
    if (!isRealDate(dueRaw)) errors.dueDate = 'Use a real date.';
    else dueDate = dueRaw;
  }

  let status = 'open';
  if (allowStatus) {
    const rawStatus = String(body.status ?? 'open').trim().toLowerCase();
    if (rawStatus !== 'open' && rawStatus !== 'done') errors.status = 'Choose open or done.';
    else status = rawStatus;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      description,
      priority: PRIORITIES.includes(priority) ? priority : 'medium',
      dueDate,
      status,
    },
    values: { title, description, priority, dueDate: dueRaw, status },
  };
}

function safeReturn(value) {
  if (typeof value !== 'string' || value.length > 200) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  const url = new URL(value, 'http://taskboard.local');
  url.searchParams.delete('notice');
  return `${url.pathname}${url.search}`;
}

function withNotice(target, notice) {
  const url = new URL(safeReturn(target), 'http://taskboard.local');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

function filterHref(status, q) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (q) params.set('q', q);
  const search = params.toString();
  return search ? `/?${search}` : '/';
}

function textPage(res, status, heading, message) {
  res.status(status).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading} · Taskboard</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="wrap">
    <h1>${heading}</h1>
    <p class="lead">${message}</p>
    <p><a class="btn" href="/">Back to tasks</a></p>
  </main>
</body>
</html>`);
}

try {
  readTasks();
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

app.get('/', (req, res) => {
  const { tasks, stats, status, q } = listTasks(req.query);
  const open = tasks.filter((task) => task.status !== 'done');
  const done = tasks.filter((task) => task.status === 'done');
  const groups = [];
  if (open.length) groups.push({ label: 'Open', tasks: open });
  if (done.length) groups.push({ label: 'Done', tasks: done });

  res.render('list', {
    title: 'Tasks',
    page: 'list',
    groups,
    stats,
    q,
    status,
    visibleCount: tasks.length,
    todayLabel: formatToday(),
    returnTo: safeReturn(req.originalUrl),
    clearHref: q ? filterHref(status, '') : '',
    filters: [
      ['all', 'All'],
      ['open', 'Open'],
      ['done', 'Done'],
      ['overdue', 'Overdue'],
    ].map(([key, label]) => ({
      key,
      label,
      href: filterHref(key, q),
      active: key === status,
    })),
  });
});

app.get('/add', (req, res) => {
  res.render('add', {
    title: 'New task',
    page: 'add',
    errors: {},
    values: blank,
    returnTo: safeReturn(req.query.returnTo),
  });
});

app.post('/add', (req, res) => {
  const result = validateTask(req.body);
  const returnTo = safeReturn(req.body.returnTo);
  if (!result.ok) {
    res.status(400).render('add', {
      title: 'New task',
      page: 'add',
      errors: result.errors,
      values: result.values,
      returnTo,
    });
    return;
  }
  createTask(result.value);
  res.redirect(303, withNotice(returnTo, 'created'));
});

app.get('/update', (req, res) => {
  res.redirect('/');
});

app.get('/tasks/:id/edit', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    textPage(res, 404, 'Not on the board', 'That page or task does not exist.');
    return;
  }
  res.render('update', {
    title: 'Edit task',
    page: 'edit',
    task,
    errors: {},
    values: {
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate || '',
      status: task.status,
    },
    returnTo: safeReturn(req.query.returnTo),
  });
});

app.post('/tasks/:id/edit', (req, res) => {
  const existing = getTask(req.params.id);
  if (!existing) {
    textPage(res, 404, 'Not on the board', 'That page or task does not exist.');
    return;
  }
  const result = validateTask(req.body, { allowStatus: true });
  const returnTo = safeReturn(req.body.returnTo);
  if (!result.ok) {
    res.status(400).render('update', {
      title: 'Edit task',
      page: 'edit',
      task: existing,
      errors: result.errors,
      values: result.values,
      returnTo,
    });
    return;
  }
  updateTask(req.params.id, result.value);
  res.redirect(303, withNotice(returnTo, 'updated'));
});

app.post('/tasks/:id/toggle', (req, res) => {
  const task = toggleTask(req.params.id);
  if (!task) {
    textPage(res, 404, 'Not on the board', 'That page or task does not exist.');
    return;
  }
  const notice = task.status === 'done' ? 'done' : 'reopened';
  res.redirect(303, withNotice(req.body.returnTo, notice));
});

app.post('/tasks/:id/delete', (req, res) => {
  const task = deleteTask(req.params.id);
  if (!task) {
    textPage(res, 404, 'Not on the board', 'That page or task does not exist.');
    return;
  }
  res.redirect(303, withNotice(req.body.returnTo, 'deleted'));
});

app.get('/tasks/:id', (req, res) => {
  res.redirect(`/tasks/${encodeURIComponent(req.params.id)}/edit`);
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Taskboard',
    storage: 'data/tasks.json',
    try: 'Open /api/tasks to see the same tasks as the board.',
    endpoints: [
      { method: 'GET', path: '/api/tasks', query: 'status=all|open|done|overdue and q=search are optional' },
      {
        method: 'POST',
        path: '/api/tasks',
        body: { title: 'Write the recap', priority: 'high', description: '', dueDate: '2026-11-07' },
      },
      { method: 'GET', path: '/api/tasks/:id' },
      { method: 'PUT', path: '/api/tasks/:id' },
      { method: 'DELETE', path: '/api/tasks/:id' },
    ],
  });
});

app.get('/api/tasks', (req, res) => {
  const { tasks, stats, status, q } = listTasks(req.query);
  res.json({ tasks, stats, status, q });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

app.post('/api/tasks', (req, res) => {
  const result = validateTask(req.body ?? {});
  if (!result.ok) {
    res.status(400).json({ errors: result.errors });
    return;
  }
  const task = createTask(result.value);
  res.status(201).location(`/api/tasks/${task.id}`).json({ task });
});

app.put('/api/tasks/:id', (req, res) => {
  if (!getTask(req.params.id)) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  const result = validateTask(req.body ?? {}, { allowStatus: true });
  if (!result.ok) {
    res.status(400).json({ errors: result.errors });
    return;
  }
  res.json({ task: updateTask(req.params.id, result.value) });
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = deleteTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  textPage(res, 404, 'Not on the board', 'That page or task does not exist.');
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error(error);
  if (req.originalUrl.startsWith('/api') && error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Send valid JSON.' });
    return;
  }
  if (req.originalUrl.startsWith('/api')) {
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
  textPage(res, 500, 'Something went wrong', 'The terminal where Node is running has the details.');
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
