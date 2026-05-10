# Commission Tracker

I built this project in 2 days to practice working with a modern
full-stack architecture. The goal was to build something real —
an internal dashboard that handles sales tracking, commission
calculations, and role-based access control.

---

## What it does

Sales agents close deals on new homes. Someone needs to track those
deals, calculate commissions, and give managers visibility into
performance. That's what this app does.

Admins can add sales, approve them, mark commissions as paid, and
add new agents. Agents can log in and see only their own sales and
commission data — read only.

---

## Stack

- **Next.js + TypeScript** — main framework
- **Tailwind CSS** — styling
- **Radix UI** — modals and UI components
- **Lucide** — icons
- **Sonner** — toast notifications
- **Recharts** — bar chart for commission visualization
- **Supabase** — PostgreSQL database and REST API
- **React Query** — caching stat card data
- **React Hook Form + Zod** — form handling and validation

---

## Why I made certain decisions

I used Supabase Client for the stat cards instead of GraphQL because
it handles aggregations like sum and count much more cleanly. GraphQL
was the right tool for relational queries, Supabase Client was the
right tool for calculations. I didn't force one tool to do everything.

I used TypeScript throughout because this app deals with commission
calculations — a wrong type means an agent gets paid the wrong amount.
TypeScript catches that at compile time, not in production.

---

## Features

**Admin**

- View all sales across all agents
- Approve pending sales
- Mark approved sales as paid
- Add new sales with a validated form
- Add new agents
- See commission totals in real time

**Agent**

- See only their own sales
- See only their own commission stats
- Read only — no admin actions

---

## Database

Three tables — agents, sales, commissions. When a sale is marked
as paid, the commission record gets a paid_at timestamp. That's
what drives the "Commissions Paid" stat card.

---

## What's next

I'm working on adding authentication using Supabase Auth. The plan
is no public registration — admins create agent accounts from the
dashboard, agents receive an email invitation to set their password.
After login, role-based redirects handle the rest. The data filtering
is already built, it just needs to be tied to a real authenticated
user instead of the demo toggle.

---

## Running locally

```bash
git clone https://github.com/alaarajab/commission-tracker.git
npm install
# add my Supabase keys to .env.local (later)
npm run dev
```
