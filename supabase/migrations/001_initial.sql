-- Apply once in the Supabase SQL editor. All amounts are integer minor units.
begin;
create table public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check (char_length(trim(title)) between 1 and 120),
 amount bigint not null check (amount between 1 and 99999999999),
 type text not null check (type in ('expense','income')),
 category text not null check (category in ('Food & drinks','Shopping','Transport','Housing','Health','Entertainment','Travel','Education','Salary','Other')),
 account text not null check (account in ('Debit card','Credit card','Bank','Cash','Other')),
 date date not null,
 notes text not null default '' check (char_length(notes)<=1000),
 created_at timestamptz not null default now()
);
create index transactions_owner_date on public.transactions(user_id,date desc,id);
create table public.budgets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 category text not null check (category in ('Food & drinks','Shopping','Transport','Housing','Health','Entertainment','Travel','Education','Salary','Other')),
 amount bigint not null check (amount between 1 and 99999999999),
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 unique(user_id,category,month)
);
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
revoke all on public.transactions,public.budgets from anon;
grant select,insert,update,delete on public.transactions,public.budgets to authenticated;
create policy "Own transactions only" on public.transactions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own budgets only" on public.budgets for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
commit;
