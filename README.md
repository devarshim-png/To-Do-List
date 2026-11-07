# Taskboard

A small Node.js task list built with Express and EJS. The browser pages and the JSON API read and write the same file, `data/tasks.json`.

## Run

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3200.

The first start creates `data/tasks.json` with a few sample tasks. That folder is not committed. To use another port:

```bash
PORT=4000 npm start
```

If you start the app with nodemon, `nodemon.json` ignores `data/` so saving a task does not restart the server.

## Pages

| Page | What it does |
| --- | --- |
| `/` | Task list, with open, done, and overdue counts. Filter with All, Open, Done, or Overdue. |
| `/add` | Add a task. A title is required. Priority and due date are optional. |
| `/tasks/:id/edit` | Change a task, including whether it is open or done. |

From the list you can mark a task done, reopen it, edit it, or delete it. **New task** in the top bar opens the add page.

## Project files

| File | Role |
| --- | --- |
| `index.js` | Express server, task storage, page routes, and the JSON API |
| `views/list.ejs` | Task list |
| `views/add.ejs` | New task form |
| `views/update.ejs` | Edit form |
| `views/navbar.ejs` | Top bar |
| `public/style.css` | Layout and styles |
| `data/tasks.json` | Saved tasks, created on first run |

## JSON API

`GET /api` lists the endpoints. `GET /api/tasks` returns the same tasks as the board.

```bash
curl http://localhost:3200/api/tasks
```

```bash
curl -X POST http://localhost:3200/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Write the recap","priority":"high","dueDate":"2026-11-10"}'
```

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks. Optional query: `status=all\|open\|done\|overdue` |
| `POST` | `/api/tasks` | Create a task |
| `GET` | `/api/tasks/:id` | Read one task |
| `PUT` | `/api/tasks/:id` | Replace the editable fields |
| `DELETE` | `/api/tasks/:id` | Remove a task |

A task has `title`, `description`, `priority` (`low`, `medium`, or `high`), `dueDate` (`YYYY-MM-DD` or empty), and `status` (`open` or `done`).
