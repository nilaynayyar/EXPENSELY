-- Create categories table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  icon text,
  created_at timestamp with time zone default now()
);

-- Pre-populate default categories
insert into public.categories (name, icon) values
  ('Food', 'restaurant'),
  ('Travel', 'directions_car'),
  ('Shopping', 'shopping_bag'),
  ('Software', 'code'),
  ('Utilities', 'lightbulb'),
  ('Entertainment', 'movie'),
  ('Health', 'medical_services'),
  ('Others', 'more_horiz')
on conflict (name) do nothing;

-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'User',
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create expenses table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  date date not null default current_date,
  store text not null,
  status text not null default 'Pending' check (status in ('Verified', 'Pending')),
  amount numeric(12,2) not null check (amount >= 0),
  receipt_url text,
  created_at timestamp with time zone default now()
);

-- Create groups table
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  icon_bg text,
  icon_color text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Create group_members table
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  primary key (group_id, profile_id)
);

-- Create group_expenses table
create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  date date not null default current_date,
  created_at timestamp with time zone default now()
);

-- Create budgets table
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  limit_amount numeric(12,2) not null check (limit_amount >= 0),
  spent_amount numeric(12,2) not null default 0.0 check (spent_amount >= 0),
  month date not null default date_trunc('month', current_date)::date,
  created_at timestamp with time zone default now(),
  unique (user_id, category_id, month)
);

-- Create indexes for performance optimization
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_category_id on public.expenses(category_id);
create index if not exists idx_group_members_profile_id on public.group_members(profile_id);
create index if not exists idx_group_expenses_group_id on public.group_expenses(group_id);
create index if not exists idx_group_expenses_payer_id on public.group_expenses(payer_id);
create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_budgets_category_id on public.budgets(category_id);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.budgets enable row level security;

-- Security helper function to check group membership
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.group_members
    where group_id = gid and profile_id = uid
  );
end;
$$ language plpgsql security definer;

-- RLS Policies

-- Profiles Policies
create policy "Allow profile select for authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Allow profile update for owners"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Categories Policies
create policy "Allow categories select for authenticated users"
  on public.categories for select
  to authenticated
  using (true);

-- Expenses Policies
create policy "Allow expenses access for owners"
  on public.expenses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Groups Policies
create policy "Allow groups access for members"
  on public.groups for all
  to authenticated
  using (public.is_group_member(id, auth.uid()))
  with check (public.is_group_member(id, auth.uid()));

create policy "Allow group creation for authenticated users"
  on public.groups for insert
  to authenticated
  with check (true);

-- Group Members Policies
create policy "Allow group members access for members"
  on public.group_members for all
  to authenticated
  using (public.is_group_member(group_id, auth.uid()))
  with check (public.is_group_member(group_id, auth.uid()));

-- Group Expenses Policies
create policy "Allow group expenses access for members"
  on public.group_expenses for all
  to authenticated
  using (public.is_group_member(group_id, auth.uid()))
  with check (public.is_group_member(group_id, auth.uid()));

-- Budgets Policies
create policy "Allow budgets access for owners"
  on public.budgets for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profile Creation Trigger on Sign Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
