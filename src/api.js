import express from 'express';
import { validateTask } from './validate.js';
import { listTasks, getTask, createTask, updateTask, deleteTask } from './store.js';

export const api = express.Router();

api.get('/', (req, res) => {
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

api.get('/tasks', (req, res) => {
  const { tasks, stats, status, q } = listTasks(req.query);
  res.json({ tasks, stats, status, q });
});

api.get('/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

api.post('/tasks', (req, res) => {
  const result = validateTask(req.body ?? {});
  if (!result.ok) {
    res.status(400).json({ errors: result.errors });
    return;
  }
  const task = createTask(result.value);
  res.status(201).location(`/api/tasks/${task.id}`).json({ task });
});

api.put('/tasks/:id', (req, res) => {
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

api.delete('/tasks/:id', (req, res) => {
  const task = deleteTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }
  res.json({ task });
});

api.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});
