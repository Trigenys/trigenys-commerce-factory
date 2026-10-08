begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  whatsapp_number text,
  country_code text,
  currency_code text not null default 'XAF',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stores_slug_unique
  on public.stores (lower(slug));

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create or replace function private.owns_merchant(target_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchants merchant
    where merchant.id = target_merchant_id
      and merchant.owner_user_id = auth.uid()
  );
$$;

create or replace function private.owns_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store
    join public.merchants merchant on merchant.id = store.merchant_id
    where store.id = target_store_id
      and merchant.owner_user_id = auth.uid()
  );
$$;

create or replace function private.is_store_member(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.owns_store(target_store_id)
    or exists (
      select 1
      from public.store_members membership
      where membership.store_id = target_store_id
        and membership.user_id = auth.uid()
    );
$$;

revoke all on function private.owns_merchant(uuid) from public;
revoke all on function private.owns_store(uuid) from public;
revoke all on function private.is_store_member(uuid) from public;
grant execute on function private.owns_merchant(uuid) to authenticated;
grant execute on function private.owns_store(uuid) to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

drop trigger if exists merchants_set_updated_at on public.merchants;
create trigger merchants_set_updated_at
before update on public.merchants
for each row execute function private.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function private.set_updated_at();

create or replace function private.add_store_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.store_members (store_id, user_id, role)
  select new.id, merchant.owner_user_id, 'owner'
  from public.merchants merchant
  where merchant.id = new.merchant_id
  on conflict (store_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.add_store_owner_membership() from public;

drop trigger if exists stores_add_owner_membership on public.stores;
create trigger stores_add_owner_membership
after insert on public.stores
for each row execute function private.add_store_owner_membership();

alter table public.merchants enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;

drop policy if exists merchants_select_owner on public.merchants;
create policy merchants_select_owner
on public.merchants
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists merchants_insert_owner on public.merchants;
create policy merchants_insert_owner
on public.merchants
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists merchants_update_owner on public.merchants;
create policy merchants_update_owner
on public.merchants
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists merchants_delete_owner on public.merchants;
create policy merchants_delete_owner
on public.merchants
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists stores_select_member on public.stores;
create policy stores_select_member
on public.stores
for select
to authenticated
using (private.is_store_member(id));

drop policy if exists stores_insert_owner on public.stores;
create policy stores_insert_owner
on public.stores
for insert
to authenticated
with check (private.owns_merchant(merchant_id));

drop policy if exists stores_update_member on public.stores;
create policy stores_update_member
on public.stores
for update
to authenticated
using (private.is_store_member(id))
with check (private.is_store_member(id));

drop policy if exists stores_delete_owner on public.stores;
create policy stores_delete_owner
on public.stores
for delete
to authenticated
using (private.owns_store(id));

drop policy if exists store_members_select_related on public.store_members;
create policy store_members_select_related
on public.store_members
for select
to authenticated
using (
  user_id = auth.uid()
  or private.owns_store(store_id)
);

drop policy if exists store_members_insert_owner on public.store_members;
create policy store_members_insert_owner
on public.store_members
for insert
to authenticated
with check (private.owns_store(store_id));

drop policy if exists store_members_update_owner on public.store_members;
create policy store_members_update_owner
on public.store_members
for update
to authenticated
using (private.owns_store(store_id))
with check (private.owns_store(store_id));

drop policy if exists store_members_delete_owner on public.store_members;
create policy store_members_delete_owner
on public.store_members
for delete
to authenticated
using (private.owns_store(store_id));

commit;
