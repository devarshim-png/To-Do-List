import express from 'express';
import { validateTask } from './validate.js';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
  formatToday,
} from './store.js';

export const pages = express.Router();

const blank = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  status: 'open',
};

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

function renderMissing(res) {
  res.status(404).render('not-found', { title: 'Not found' });
}

pages.get('/', (req, res) => {
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

pages.get('/add', (req, res) => {
  res.render('add', {
    title: 'New task',
    page: 'add',
    errors: {},
    values: blank,
    returnTo: safeReturn(req.query.returnTo),
  });
});

pages.post('/add', (req, res) => {
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

pages.get('/update', (req, res) => {
  res.redirect('/');
});

pages.get('/tasks/:id/edit', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    renderMissing(res);
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

pages.post('/tasks/:id/edit', (req, res) => {
  const existing = getTask(req.params.id);
  if (!existing) {
    renderMissing(res);
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

pages.post('/tasks/:id/toggle', (req, res) => {
  const task = toggleTask(req.params.id);
  if (!task) {
    renderMissing(res);
    return;
  }
  const notice = task.status === 'done' ? 'done' : 'reopened';
  res.redirect(303, withNotice(req.body.returnTo, notice));
});

pages.post('/tasks/:id/delete', (req, res) => {
  const task = deleteTask(req.params.id);
  if (!task) {
    renderMissing(res);
    return;
  }
  res.redirect(303, withNotice(req.body.returnTo, 'deleted'));
});

pages.get('/tasks/:id', (req, res) => {
  res.redirect(`/tasks/${encodeURIComponent(req.params.id)}/edit`);
});
