# Ledger — Expense Tracker (with real accounts & shared groups)

A professional, production-shaped expense tracking app: real user accounts,
data synced across every device, color-coded custom categories, and shared
expense groups — built on plain HTML/CSS/JS with Supabase as the backend.
No build step, no framework.

## Setup (required before it will run)

The app needs a Supabase project to talk to. This takes about 5 minutes and
is free.

1. **Create a project** — go to [supabase.com](https://supabase.com), sign
   up, and click **New Project**. Pick any name/region and set a database
   password (you won't need it day-to-day).
2. **Run the schema** — once the project is ready, open the **SQL Editor**
   in the left sidebar, click **New query**, paste the entire contents of
   [`sql/schema.sql`](sql/schema.sql) from this project, and click **Run**.
   This creates every table, security policy, and default category the app
   needs.
3. **Get your API keys** — go to **Project Settings → API**. Copy the
   **Project URL** and the **anon public** key (not `service_role` — that
   one must never appear in frontend code).
4. **Paste them into the app** — open `js/config.js` and replace:
   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   with your actual values.
5. **(Recommended) Disable email confirmation for local testing** — in
   **Authentication → Providers → Email**, turn off "Confirm email" while
   you're testing, so new accounts can sign in immediately. Turn it back on
   before sharing the app publicly.

## Running it

No build tools needed:

```bash
npx serve .
```

Then open the printed URL. (A real HTTP server, rather than double-clicking
`index.html`, is recommended here since the Supabase client behaves more
predictably over `http://` than `file://`.)

To make it live, deploy the folder to any static host (Netlify, Vercel,
GitHub Pages, Cloudflare Pages) exactly as-is — it's already just static
files.

## Features

- **Real accounts** — email/password signup and login via Supabase Auth;
  sessions persist across visits and devices.
- **Dashboard** — total spent, entry count, largest expense, and a
  category-breakdown donut chart, all computed live from your data.
- **Expenses** — add, edit, delete; search by title/notes; filter by
  category or group; sort five ways.
- **Categories** — a set of sensible defaults plus fully custom categories
  with your own name and color.
- **Groups** — create a shared group, invite people by email, and every
  member sees the group's shared expenses and a per-member spending
  breakdown. Updates from other members appear live (no refresh needed).
- **Profile** — display name, avatar color, and currency, editable anytime.
- Responsive: full sidebar on desktop, bottom tab bar with a floating
  add button on mobile.

## Architecture

```
js/
├── config.js    Supabase connection (fill in your own keys)
├── icons.js     Hand-drawn SVG icon set
├── toast.js     Toast notifications
├── auth.js      Sign up / sign in / sign out / session state
├── data.js      Single in-memory store + every Supabase read/write +
│                 derived stats + realtime sync
├── modals.js    Add/edit expense, add category, create group, invite,
│                 confirm — all modal logic
├── views.js     One render function per screen; reads store, writes DOM
├── router.js    Hash-based routing (#/dashboard, #/groups/:id, etc.)
└── app.js       Boots the app: wires auth screen, listens for session
                  changes, starts the router once signed in
```

Data flow is one-directional, same principle as any well-structured CRUD
app: **user action → Supabase call → update in-memory store → re-render
the current view.** `data.js` is the only file that talks to Supabase;
everything else works with the in-memory `store` object.

### Why a real backend changes the security model

With `localStorage`, "security" wasn't really a concern — the data never
left the browser. With a real backend, the database enforces who can see
and change what, using Postgres **Row Level Security** (RLS), defined in
`sql/schema.sql`:

- Personal expenses (`group_id = null`) are visible only to their owner.
- Group expenses are visible to every member of that group, but editable
  only by whoever created them.
- Categories you create are yours alone; the default set is read-only for
  everyone.
- Only a group's owner can add or remove members.

This means even if someone tampered with the frontend JavaScript, the
database itself would still refuse unauthorized reads or writes — the
security boundary lives in Postgres, not in the browser.

## Data Model

```
profiles        (id, email, full_name, avatar_color, currency)
categories      (id, user_id | null, name, color)
groups          (id, name, color, owner_id)
group_members   (group_id, user_id, role)
expenses        (id, user_id, group_id | null, category_id, title,
                 amount, date, notes, created_at)
```

## Limitations

- Group invites require the invited person to already have a Ledger
  account with that email — there's no email-sending step.
- No password reset flow is wired up yet (Supabase supports it; it's a
  small addition if you want it).
- No file/receipt attachments.

## Future Improvements

- Password reset / magic-link sign-in
- Receipt photo attachments (Supabase Storage)
- Recurring expenses
- Per-category monthly budgets with progress bars
- CSV export
- Push/email notifications when a group member adds an expense
