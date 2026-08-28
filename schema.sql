-- =========================================================
-- Ledger — Supabase schema
-- Paste this entire file into Supabase Dashboard → SQL Editor
-- → New query → Run. Safe to run once on a fresh project.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- PROFILES
-- One row per authenticated user. Created automatically by
-- a trigger the moment someone signs up (see below) — the
-- app never has to insert a profile row itself.
-- ---------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null default 'New User',
  avatar_color text not null default '#6D5AE6',
  currency     text not null default 'EGP',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can see basic profile info of others (needed to
-- show member names inside a shared group). Nothing sensitive is
-- exposed here beyond name/email/avatar color.
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- CATEGORIES
-- user_id = null  → shared default category (visible to everyone, read-only)
-- user_id = uuid  → a category the user created themselves
-- ---------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6D5AE6',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "See default and own categories"
  on public.categories for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "Create own categories"
  on public.categories for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Update own categories"
  on public.categories for update
  to authenticated
  using (user_id = auth.uid());

create policy "Delete own categories"
  on public.categories for delete
  to authenticated
  using (user_id = auth.uid());

insert into public.categories (user_id, name, color) values
  (null, 'Food',           '#E5484D'),
  (null, 'Rent',           '#6D5AE6'),
  (null, 'Transportation', '#3B82F6'),
  (null, 'Entertainment',  '#F59E0B'),
  (null, 'Shopping',       '#EC4899'),
  (null, 'Education',      '#17A398'),
  (null, 'Health',         '#84CC16'),
  (null, 'Bills',          '#64748B'),
  (null, 'Other',          '#A78BFA');

-- ---------------------------------------------------------
-- GROUPS + GROUP MEMBERS
-- ---------------------------------------------------------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#6D5AE6',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Members can view their groups"
  on public.groups for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid())
  );

create policy "Any user can create a group"
  on public.groups for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their groups"
  on public.groups for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can delete their groups"
  on public.groups for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "Members can view their group's membership"
  on public.group_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
    or exists (select 1 from public.group_members gm2 where gm2.group_id = group_id and gm2.user_id = auth.uid())
  );

create policy "Owners add members"
  on public.group_members for insert
  to authenticated
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Owners remove members or members leave"
  on public.group_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- Automatically add the creator of a group as its first (owner) member.
create or replace function public.handle_new_group()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- ---------------------------------------------------------
-- EXPENSES
-- group_id null   → personal expense, visible only to its owner
-- group_id set    → shared expense, visible to every group member
-- ---------------------------------------------------------
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  title       text not null,
  amount      numeric(12,2) not null check (amount > 0),
  date        date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "View own expenses and group expenses"
  on public.expenses for select
  to authenticated
  using (
    user_id = auth.uid()
    or (group_id is not null and exists (
      select 1 from public.group_members gm where gm.group_id = expenses.group_id and gm.user_id = auth.uid()
    ))
  );

create policy "Insert own expenses into own groups"
  on public.expenses for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      group_id is null
      or exists (select 1 from public.group_members gm where gm.group_id = expenses.group_id and gm.user_id = auth.uid())
    )
  );

create policy "Update own expenses"
  on public.expenses for update
  to authenticated
  using (user_id = auth.uid());

create policy "Delete own expenses"
  on public.expenses for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------
-- REALTIME
-- Lets the app live-update when a group member adds/edits/
-- deletes an expense, without a manual refresh.
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
