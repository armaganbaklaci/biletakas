-- ============================================================
-- biletakas — Transaction (Manuel IBAN) Migration
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Yardımcı: is_admin kontrolü
-- ------------------------------------------------------------
create or replace function public.is_panel_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- ------------------------------------------------------------
-- 1) transactions tablosu
-- ------------------------------------------------------------
create sequence if not exists public.transaction_code_seq start 1;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  transaction_code text not null unique,
  payment_method text not null default 'IBAN'
    check (payment_method in ('IBAN', 'IYZICO', 'PAYTR')),
  payment_status text not null default 'waiting_payment'
    check (payment_status in ('waiting_payment', 'payment_received', 'refunded')),
  ticket_status text not null default 'waiting_ticket'
    check (ticket_status in ('waiting_ticket', 'ticket_received', 'delivered_to_buyer')),
  completion_status text not null default 'pending'
    check (completion_status in ('pending', 'buyer_confirmed', 'completed', 'cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_buyer_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_idx on public.transactions (seller_id);
create index if not exists transactions_listing_idx on public.transactions (listing_id);
create index if not exists transactions_payment_status_idx on public.transactions (payment_status);
create index if not exists transactions_ticket_status_idx on public.transactions (ticket_status);
create index if not exists transactions_completion_status_idx on public.transactions (completion_status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_code_idx on public.transactions (transaction_code);

-- updated_at otomatik güncelleme
create or replace function public.set_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_updated_at on public.transactions;
create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_transactions_updated_at();

-- BTK-000001 formatında kod üretimi
create or replace function public.generate_transaction_code()
returns trigger
language plpgsql
as $$
begin
  if new.transaction_code is null or new.transaction_code = '' then
    new.transaction_code := 'BTK-' || lpad(nextval('public.transaction_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_generate_code on public.transactions;
create trigger transactions_generate_code
  before insert on public.transactions
  for each row execute function public.generate_transaction_code();

-- Teklif kabul edilince otomatik transaction oluştur
create or replace function public.create_transaction_on_offer_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select * into v_listing from public.listings where id = new.listing_id;
    if not found then
      raise exception 'Listing not found for offer %', new.id;
    end if;

    insert into public.transactions (
      offer_id,
      listing_id,
      buyer_id,
      seller_id,
      amount,
      transaction_code,
      payment_method,
      payment_status,
      ticket_status,
      completion_status
    ) values (
      new.id,
      new.listing_id,
      new.buyer_id,
      v_listing.seller_id,
      new.amount,
      '',
      'IBAN',
      'waiting_payment',
      'waiting_ticket',
      'pending'
    )
    on conflict (offer_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_create_transaction on public.offers;
create trigger offers_create_transaction
  after update on public.offers
  for each row execute function public.create_transaction_on_offer_accept();

-- ------------------------------------------------------------
-- 2) RLS
-- ------------------------------------------------------------
alter table public.transactions enable row level security;

-- Alıcı kendi işlemlerini görebilir
create policy "Alıcı kendi işlemlerini görebilir"
  on public.transactions for select
  using (auth.uid() = buyer_id);

-- Satıcı kendi işlemlerini görebilir
create policy "Satıcı kendi işlemlerini görebilir"
  on public.transactions for select
  using (auth.uid() = seller_id);

-- Admin tüm işlemleri görebilir
create policy "Admin tüm işlemleri görebilir"
  on public.transactions for select
  using (public.is_panel_admin());

-- Admin işlemleri güncelleyebilir
create policy "Admin işlemleri güncelleyebilir"
  on public.transactions for update
  using (public.is_panel_admin());

-- Trigger security definer ile insert yapar; ek insert policy gerekmez.

-- ------------------------------------------------------------
-- 3) admin_logs (yoksa oluştur) + transaction log erişimi
-- ------------------------------------------------------------
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_logs_created_at_idx on public.admin_logs (created_at desc);
create index if not exists admin_logs_action_idx on public.admin_logs (action);

alter table public.admin_logs enable row level security;

drop policy if exists "Admin logları okuyabilir" on public.admin_logs;
create policy "Admin logları okuyabilir"
  on public.admin_logs for select
  using (public.is_panel_admin());

drop policy if exists "Admin log yazabilir" on public.admin_logs;
create policy "Admin log yazabilir"
  on public.admin_logs for insert
  with check (public.is_panel_admin() or auth.uid() = admin_id);

-- Satıcı teklif kabul ederken log yazabilsin (mevcut offers.js davranışı)
drop policy if exists "Kullanıcı kendi adına log yazabilir" on public.admin_logs;
create policy "Kullanıcı kendi adına log yazabilir"
  on public.admin_logs for insert
  with check (auth.uid() = admin_id);

-- ------------------------------------------------------------
-- 4) profiles.is_admin (yoksa ekle)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Admin profil güncellemesi (is_admin dahil)
drop policy if exists "Admin tüm profilleri güncelleyebilir" on public.profiles;
create policy "Admin tüm profilleri güncelleyebilir"
  on public.profiles for update
  using (public.is_panel_admin());

drop policy if exists "Admin tüm profilleri görebilir" on public.profiles;
create policy "Admin tüm profilleri görebilir"
  on public.profiles for select
  using (public.is_panel_admin());

-- Admin tüm ilanları görebilir (is_admin ile uyumlu)
drop policy if exists "Panel admin tüm ilanları görebilir" on public.listings;
create policy "Panel admin tüm ilanları görebilir"
  on public.listings for select
  using (public.is_panel_admin());

drop policy if exists "Panel admin tüm ilanları güncelleyebilir" on public.listings;
create policy "Panel admin tüm ilanları güncelleyebilir"
  on public.listings for update
  using (public.is_panel_admin());

-- Admin tüm teklifleri görebilir
drop policy if exists "Panel admin tüm teklifleri görebilir" on public.offers;
create policy "Panel admin tüm teklifleri görebilir"
  on public.offers for select
  using (public.is_panel_admin());
