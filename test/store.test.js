import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateTask } from '../src/validate.js';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  toggleTask,
  updateTask,
} from '../src/store.js';

const file = path.join(os.tmpdir(), `taskboard-${process.pid}.json`);
process.env.TASKS_FILE = file;

after(() => {
  fs.rmSync(file, { force: true });
});

test('rejects a blank title, a bad priority, and an impossible date', () => {
  const blank = validateTask({ title: '   ' });
  assert.equal(blank.ok, false);
  assert.equal(blank.errors.title, 'Add a title.');

  const badDate = validateTask({ title: 'Ship it', dueDate: '2026-02-31' });
  assert.equal(badDate.ok, false);
  assert.ok(badDate.errors.dueDate);

  const badPriority = validateTask({ title: 'Ship it', priority: 'urgent' });
  assert.equal(badPriority.ok, false);

  const longText = validateTask({ title: 'Ship it', description: 'x'.repeat(1001) });
  assert.equal(longText.ok, false);

  const good = validateTask({
    title: '  Ship it  ',
    priority: 'HIGH',
    description: ' notes ',
    dueDate: '2026-12-01',
    status: 'done',
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, {
    title: 'Ship it',
    description: 'notes',
    priority: 'high',
    dueDate: '2026-12-01',
    status: 'open',
  });

  const done = validateTask({ title: 'Ship it', status: 'done' }, { allowStatus: true });
  assert.equal(done.ok, true);
  assert.equal(done.value.status, 'done');

  const later = validateTask({ title: 'Ship it', status: 'later' }, { allowStatus: true });
  assert.equal(later.ok, false);
});

test('saves tasks on disk and filters them', () => {
  const before = listTasks();
  assert.ok(before.tasks.some((task) => task.title === 'Walk through this Node.js POC'));
  assert.ok(before.stats.overdue >= 1);
  assert.ok(before.stats.done >= 1);

  const open = listTasks({ status: 'open' });
  assert.equal(open.tasks[0].title, 'Share the repo link');
  assert.equal(open.tasks[0].overdue, true);
  assert.ok(open.tasks.every((task) => task.status === 'open'));

  const late = listTasks({ status: 'overdue' });
  assert.ok(late.tasks.some((task) => task.title === 'Share the repo link'));
  assert.ok(late.tasks.every((task) => task.overdue));

  const created = createTask({
    title: 'Temporary test task',
    description: 'Created by the test suite',
    priority: 'high',
    dueDate: null,
  });
  assert.equal(created.status, 'open');
  assert.equal(fs.readFileSync(file, 'utf8').includes('Temporary test task'), true);

  const updated = updateTask(created.id, {
    title: 'Temporary test task',
    description: 'Edited',
    priority: 'low',
    dueDate: null,
    status: 'open',
  });
  assert.equal(updated.description, 'Edited');
  assert.equal(updated.priority, 'low');

  const done = toggleTask(created.id);
  assert.equal(done.status, 'done');
  const reopened = toggleTask(created.id);
  assert.equal(reopened.status, 'open');

  const found = listTasks({ q: 'temporary test' });
  assert.equal(found.tasks.length, 1);
  assert.equal(found.stats.total, before.stats.total + 1);

  assert.equal(getTask('missing-id'), null);
  assert.equal(toggleTask('missing-id'), null);
  assert.equal(deleteTask('missing-id'), null);

  const removed = deleteTask(created.id);
  assert.equal(removed.id, created.id);
  assert.equal(listTasks().stats.total, before.stats.total);

  const projectFile = path.resolve('data/tasks.json');
  if (fs.existsSync(projectFile)) {
    assert.equal(fs.readFileSync(projectFile, 'utf8').includes('Temporary test task'), false);
  }
});
