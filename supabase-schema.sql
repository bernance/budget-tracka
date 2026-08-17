-- Run this after the original Budget Tracker schema if planned_incomes does not exist.
-- It stores planned income separately from actual transactions.

create table if not exists public.planned_incomes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source text not null,
    amount numeric(12, 2) not null check (amount >= 0),
    due_date date not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.planned_incomes enable row level security;

-- The original planned_expenses table needs priority because the UI uses it.
alter table public.planned_expenses add column if not exists priority text not null default 'medium' check (priority in ('high', 'medium', 'low'));

drop policy if exists "Users can view their own planned incomes" on public.planned_incomes;
drop policy if exists "Users can create their own planned incomes" on public.planned_incomes;
drop policy if exists "Users can update their own planned incomes" on public.planned_incomes;
drop policy if exists "Users can delete their own planned incomes" on public.planned_incomes;

create policy "Users can view their own planned incomes"
on public.planned_incomes for select
using (auth.uid() = user_id);

create policy "Users can create their own planned incomes"
on public.planned_incomes for insert
with check (auth.uid() = user_id);

create policy "Users can update their own planned incomes"
on public.planned_incomes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own planned incomes"
on public.planned_incomes for delete
using (auth.uid() = user_id);
