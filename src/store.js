// Reads and writes data/tasks.json.
// Routes call these functions. Swap this file later if you move to a database.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPath = path.join(root, 'data', 'tasks.json');

function dataPath() {
  return process.env.TASKS_FILE || defaultPath;
}

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

export function formatToday() {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
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

function write(tasks) {
  const file = dataPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(tasks, null, 2)}\n`);
  fs.renameSync(tempFile, file);
}

export function ensureStore() {
  const file = dataPath();
  if (!fs.existsSync(file)) write(seedTasks());
  const tasks = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(tasks)) throw new Error('Task store must be a JSON list.');
  return tasks;
}

function read() {
  return ensureStore();
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

function presentTask(task, today) {
  const priority = ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium';
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

export function listTasks(query = {}) {
  const allowed = new Set(['all', 'open', 'done', 'overdue']);
  const status = allowed.has(query.status) ? query.status : 'all';
  const q = String(query.q ?? '').trim().slice(0, 80);
  const today = todayISO();
  const all = read().map((task) => presentTask(task, today));
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

export function getTask(id) {
  const task = read().find((item) => item.id === id);
  return task ? presentTask(task, todayISO()) : null;
}

export function createTask(value) {
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
  const tasks = read();
  tasks.push(task);
  write(tasks);
  return presentTask(task, todayISO());
}

export function updateTask(id, value) {
  const tasks = read();
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
  write(tasks);
  return presentTask(tasks[index], todayISO());
}

export function toggleTask(id) {
  const tasks = read();
  const task = tasks.find((item) => item.id === id);
  if (!task) return null;
  task.status = task.status === 'done' ? 'open' : 'done';
  task.updatedAt = new Date().toISOString();
  write(tasks);
  return presentTask(task, todayISO());
}

export function deleteTask(id) {
  const tasks = read();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  const [removed] = tasks.splice(index, 1);
  write(tasks);
  return presentTask(removed, todayISO());
}
