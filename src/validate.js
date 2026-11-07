// Checks a form or JSON body. The pages and the API both use this.

const PRIORITIES = ['low', 'medium', 'high'];

export function validateTask(input, { allowStatus = false } = {}) {
  const body = input && typeof input === 'object' ? input : {};
  const errors = {};

  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const priority = String(body.priority ?? 'medium').trim().toLowerCase();
  const dueRaw = String(body.dueDate ?? '').trim();

  if (!title) errors.title = 'Add a title.';
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters.';

  if (description.length > 1000) {
    errors.description = 'Keep the description under 1,000 characters.';
  }

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
    values: {
      title,
      description,
      priority,
      dueDate: dueRaw,
      status,
    },
  };
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
