# ExpenseFlow

A corporate expense management platform built with Remix. Employees submit expenses, managers approve them, admins manage the organization.

## Quick Start

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

### Demo Accounts

| Email | Password | Role |
|---|---|---|
| admin@expenseflow.io | admin123 | Admin |
| manager@expenseflow.io | manager123 | Manager |
| john@expenseflow.io | password123 | Employee |
| jane@expenseflow.io | jane2024 | Employee |

## Features

- Submit and track expense reports
- Manager approval workflows with reimbursement tracking
- Receipt upload and import from URL
- Expense search and filtering
- CSV export for accounting
- User management (admin)
- Password reset flow

## CTF Challenge

This application contains **10 security vulnerabilities** of varying severity. Your goal is to find and document each one.

### Rules

- You have the source code — this is a code review challenge
- Each vulnerability is embedded in real business logic, not planted as an obvious backdoor
- Vulnerabilities span the OWASP Top 10 and beyond
- Some are easy to spot, others require understanding the data flow

### Hints

1. **The search bar is powerful** — perhaps too powerful. What happens when the query reaches the database?
2. **Rich text is a feature, not a bug** — or is it? Check how descriptions are rendered.
3. **Your expense, my expense** — does the app always check who's looking?
4. **Profile updates are flexible** — maybe a little too flexible. What fields can you actually set?
5. **Timing is everything** — when two approvals happen at once, who wins?
6. **Follow the file path** — receipt downloads trust the client to name the file. How far can you go?
7. **Admin routes for everyone?** — not every gate is locked equally.
8. **The internet is a big place** — the receipt importer will fetch anything you point it at.
9. **Predictable secrets** — if you know the algorithm, you know the token.
10. **One export to rule them all** — the CSV download might share more than intended.

### Scoring

| Difficulty | Points |
|---|---|
| Easy (obvious on inspection) | 100 |
| Medium (requires tracing data flow) | 200 |
| Hard (requires understanding the full context) | 300 |

Good luck, and happy hunting.

## Development

```bash
npm install
npm run dev
```

## Running Tests

```bash
chmod +x test/smoke.sh
# With Docker:
docker compose up -d --build && sleep 10 && bash test/smoke.sh
# Or locally:
npm run dev & sleep 5 && bash test/smoke.sh
```

## Tech Stack

- [Remix](https://remix.run) v2 (Vite)
- [Tailwind CSS](https://tailwindcss.com)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- TypeScript
- Docker
