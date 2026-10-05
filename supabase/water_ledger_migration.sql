-- ============================================================
-- سجل وحسابات ومصروفات وايت الماء الحلو — Water Tanker Daily Ledger & Expenses Migration
-- Run this in Supabase SQL Editor
-- (Idempotent: Safe to run multiple times without errors)
-- ============================================================

-- 1. Create Water Expenses Table
create table if not exists public.water_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in ('ديزل', 'صيانة وقطع غيار', 'زيوت وغسيل', 'أخرى')),
  amount numeric not null check (amount > 0),
  notes text,
  receipt_image_url text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.water_expenses enable row level security;

-- Policies: Admin Full Access
drop policy if exists "Admin manage water expenses" on public.water_expenses;
create policy "Admin manage water expenses" on public.water_expenses 
  for all using (public.is_admin());

-- 2. Manual/Offline Trips Table (if driver made extra trips not ordered on web)
create table if not exists public.water_manual_trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null default current_date,
  tanker_size text not null default 'عايدي',
  amount numeric not null check (amount >= 0),
  notes text,
  created_at timestamptz default now()
);

alter table public.water_manual_trips enable row level security;
drop policy if exists "Admin manage manual trips" on public.water_manual_trips;
create policy "Admin manage manual trips" on public.water_manual_trips 
  for all using (public.is_admin());
