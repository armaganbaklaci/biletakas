-- ============================================================
-- biletakas — Final Manual IBAN MVP (Single SQL Script)
-- Supabase SQL Editor'de tek seferde çalıştırın.
-- Bu script mevcut veriyi silmez; idempotent ve uyumlu çalışır.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Helper functions
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.calculate_transaction_pricing(base_amount numeric)
returns table (
  buyer_total_amount numeric,
  service_fee numeric,
  platform_commission numeric,
  seller_payout_amount numeric
)
language sql
stable
set search_path = public
as $$
  select
    round(coalesce(base_amount, 0), 2) as buyer_total_amount,
    round(coalesce(base_amount, 0) * 0.05, 2) as service_fee,
    round(coalesce(base_amount, 0) * 0.05, 2) as platform_commission,
    round(coalesce(base_amount, 0) - (coalesce(base_amount, 0) * 0.05) - (coalesce(base_amount, 0) * 0.05), 2) as seller_payout_amount;
$$;

-- ------------------------------------------------------------
-- 1) profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  instagram_verified boolean not null default false,
  admin_verified boolean not null default false,
  sales_count integer not null default 0,
  purchase_count integer not null default 0,
  phone text,
  identity_status text not null default 'pending',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_verified boolean not null default false,
  add column if not exists identity_status text not null default 'pending',
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  alter column email_verified set default false,
  alter column phone_verified set default false,
  alter column identity_status set default 'pending',
  alter column is_admin set default false;

update public.profiles
set email_verified = coalesce(email_verified, false)
where email_verified is null;

update public.profiles
set phone_verified = coalesce(phone_verified, false)
where phone_verified is null;

update public.profiles
set identity_status = coalesce(identity_status, 'pending')
where identity_status is null;

update public.profiles
set is_admin = coalesce(is_admin, false)
where is_admin is null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_identity_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_identity_status_check
      CHECK (identity_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

drop policy if exists "Profiller herkese açık okunabilir" on public.profiles;
create policy "Profiller herkese açık okunabilir"
  on public.profiles for select
  using (true);

drop policy if exists "Kullanıcı kendi profilini oluşturabilir" on public.profiles;
create policy "Kullanıcı kendi profilini oluşturabilir"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Kullanıcı kendi profilini güncelleyebilir" on public.profiles;
create policy "Kullanıcı kendi profilini güncelleyebilir"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Admin tüm profilleri güncelleyebilir" on public.profiles;
create policy "Admin tüm profilleri güncelleyebilir"
  on public.profiles for update
  using (public.is_panel_admin());

drop policy if exists "Admin tüm profilleri görebilir" on public.profiles;
create policy "Admin tüm profilleri görebilir"
  on public.profiles for select
  using (public.is_panel_admin());

-- ------------------------------------------------------------
-- 2) listings
-- ------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  artist text not null,
  venue text not null,
  city text not null,
  event_datetime timestamptz not null,
  ticket_type text not null,
  quantity integer not null check (quantity > 0),
  price numeric(10,2) not null check (price > 0),
  description text,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'sold')),
  created_at timestamptz not null default now()
);

create index if not exists listings_status_event_idx on public.listings (status, event_datetime);
create index if not exists listings_seller_idx on public.listings (seller_id);

alter table public.listings enable row level security;

drop policy if exists "Aktif ilanlar herkese açık" on public.listings;
create policy "Aktif ilanlar herkese açık"
  on public.listings for select
  using (status = 'active' or seller_id = auth.uid());

drop policy if exists "Giriş yapan kullanıcı ilan oluşturabilir" on public.listings;
create policy "Giriş yapan kullanıcı ilan oluşturabilir"
  on public.listings for insert
  with check (auth.uid() = seller_id);

drop policy if exists "Satıcı kendi ilanını güncelleyebilir" on public.listings;
create policy "Satıcı kendi ilanını güncelleyebilir"
  on public.listings for update
  using (auth.uid() = seller_id);

drop policy if exists "Panel admin tüm ilanları güncelleyebilir" on public.listings;
create policy "Panel admin tüm ilanları güncelleyebilir"
  on public.listings for update
  using (public.is_panel_admin());

drop policy if exists "Panel admin tüm ilanları görebilir" on public.listings;
create policy "Panel admin tüm ilanları görebilir"
  on public.listings for select
  using (public.is_panel_admin());

-- ------------------------------------------------------------
-- 3) offers
-- ------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists offers_listing_idx on public.offers (listing_id);
create index if not exists offers_buyer_idx on public.offers (buyer_id);

alter table public.offers enable row level security;

drop policy if exists "Alıcı kendi tekliflerini görebilir" on public.offers;
create policy "Alıcı kendi tekliflerini görebilir"
  on public.offers for select
  using (auth.uid() = buyer_id);

drop policy if exists "Satıcı kendi ilanına gelen teklifleri görebilir" on public.offers;
create policy "Satıcı kendi ilanına gelen teklifleri görebilir"
  on public.offers for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = offers.listing_id and l.seller_id = auth.uid()
    )
  );

drop policy if exists "Giriş yapan kullanıcı teklif verebilir" on public.offers;
create policy "Giriş yapan kullanıcı teklif verebilir"
  on public.offers for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "Satıcı kendi ilanına gelen teklifi güncelleyebilir (kabul/red)" on public.offers;
create policy "Satıcı kendi ilanına gelen teklifi güncelleyebilir (kabul/red)"
  on public.offers for update
  using (
    exists (
      select 1 from public.listings l
      where l.id = offers.listing_id and l.seller_id = auth.uid()
    )
  );

drop policy if exists "Panel admin tüm teklifleri görebilir" on public.offers;
create policy "Panel admin tüm teklifleri görebilir"
  on public.offers for select
  using (public.is_panel_admin());

-- ------------------------------------------------------------
-- 4) transactions
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
    check (payment_status in ('waiting_payment', 'receipt_uploaded', 'payment_received', 'payment_rejected', 'refunded')),
  ticket_status text not null default 'waiting_ticket_upload'
    check (ticket_status in ('waiting_ticket_upload','ticket_uploaded','ticket_verified','ticket_sent_to_buyer','ticket_released_to_buyer','waiting_ticket','ticket_received','delivered_to_buyer')),
  completion_status text not null default 'pending'
    check (completion_status in ('pending','buyer_confirmed','money_sent_to_seller','completed','cancelled')),
  admin_note text,
  ticket_file_path text,
  ticket_uploaded_at timestamptz,
  ticket_verified_at timestamptz,
  buyer_payment_notified_at timestamptz,
  ticket_delivered_at timestamptz,
  receipt_file_path text,
  receipt_uploaded_at timestamptz,
  payment_note text,
  dispute_reason text,
  dispute_evidence_path text,
  dispute_status text default 'none',
  dispute_created_at timestamptz,
  seller_payout_amount numeric(12,2),
  platform_commission numeric(12,2),
  service_fee numeric(12,2),
  buyer_total_amount numeric(12,2),
  payout_iban text,
  payout_account_name text,
  payout_receipt_path text,
  payout_sent_at timestamptz,
  payout_status text default 'pending',
  ticket_file_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

alter table public.transactions
  add column if not exists ticket_file_path text,
  add column if not exists ticket_uploaded_at timestamptz,
  add column if not exists ticket_verified_at timestamptz,
  add column if not exists buyer_payment_notified_at timestamptz,
  add column if not exists ticket_delivered_at timestamptz,
  add column if not exists receipt_file_path text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists payment_note text,
  add column if not exists dispute_reason text,
  add column if not exists dispute_evidence_path text,
  add column if not exists dispute_status text,
  add column if not exists dispute_created_at timestamptz,
  add column if not exists seller_payout_amount numeric(12,2),
  add column if not exists platform_commission numeric(12,2),
  add column if not exists service_fee numeric(12,2),
  add column if not exists buyer_total_amount numeric(12,2),
  add column if not exists payout_iban text,
  add column if not exists payout_account_name text,
  add column if not exists payout_receipt_path text,
  add column if not exists payout_sent_at timestamptz,
  add column if not exists payout_status text,
  add column if not exists ticket_file_hash text,
  add column if not exists admin_note text;

alter table public.transactions
  alter column dispute_status set default 'none',
  alter column payout_status set default 'pending';

update public.transactions
set dispute_status = coalesce(dispute_status, 'none')
where dispute_status is null;

update public.transactions
set payout_status = coalesce(payout_status, 'pending')
where payout_status is null;

update public.transactions
set ticket_status = case ticket_status
  when 'waiting_ticket' then 'waiting_ticket_upload'
  when 'ticket_received' then 'ticket_verified'
  when 'delivered_to_buyer' then 'ticket_sent_to_buyer'
  else ticket_status
end
where ticket_status in ('waiting_ticket','ticket_received','delivered_to_buyer');

update public.transactions
set ticket_verified_at = coalesce(ticket_verified_at, updated_at, created_at)
where ticket_status in ('ticket_verified','ticket_received','ticket_sent_to_buyer','delivered_to_buyer','ticket_released_to_buyer')
  and ticket_verified_at is null
  and ticket_file_path is not null;

create index if not exists transactions_buyer_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_idx on public.transactions (seller_id);
create index if not exists transactions_listing_idx on public.transactions (listing_id);
create index if not exists transactions_payment_status_idx on public.transactions (payment_status);
create index if not exists transactions_ticket_status_idx on public.transactions (ticket_status);
create index if not exists transactions_completion_status_idx on public.transactions (completion_status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_code_idx on public.transactions (transaction_code);
create index if not exists transactions_ticket_verified_at_idx on public.transactions (ticket_verified_at desc) where ticket_verified_at is not null;
create index if not exists transactions_ticket_uploaded_at_idx on public.transactions (ticket_uploaded_at desc) where ticket_uploaded_at is not null;
create index if not exists transactions_buyer_payment_notified_idx on public.transactions (buyer_payment_notified_at desc) where buyer_payment_notified_at is not null;
create index if not exists transactions_ticket_delivered_at_idx on public.transactions (ticket_delivered_at desc) where ticket_delivered_at is not null;
create index if not exists transactions_receipt_uploaded_at_idx on public.transactions (receipt_uploaded_at desc) where receipt_uploaded_at is not null;
create index if not exists transactions_receipt_file_path_idx on public.transactions (receipt_file_path) where receipt_file_path is not null;
create index if not exists transactions_dispute_created_at_idx on public.transactions (dispute_created_at desc) where dispute_created_at is not null;
create index if not exists transactions_dispute_status_idx on public.transactions (dispute_status) where dispute_status is not null and dispute_status <> 'none';
create index if not exists transactions_payout_status_idx on public.transactions (payout_status) where payout_status is not null;
create index if not exists transactions_ticket_file_hash_idx on public.transactions (ticket_file_hash) where ticket_file_hash is not null;

-- Status constraint updates (safe + compatible)
alter table public.transactions drop constraint if exists transactions_ticket_status_check;
alter table public.transactions drop constraint if exists transactions_payment_status_check;
alter table public.transactions drop constraint if exists transactions_completion_status_check;

alter table public.transactions
  add constraint transactions_ticket_status_check
    check (ticket_status in (
      'waiting_ticket_upload',
      'ticket_uploaded',
      'ticket_verified',
      'ticket_sent_to_buyer',
      'ticket_released_to_buyer',
      'waiting_ticket',
      'ticket_received',
      'delivered_to_buyer'
    ));

alter table public.transactions
  add constraint transactions_payment_status_check
    check (payment_status in ('waiting_payment','receipt_uploaded','payment_received','payment_rejected','refunded'));

alter table public.transactions
  add constraint transactions_completion_status_check
    check (completion_status in ('pending','buyer_confirmed','money_sent_to_seller','completed','cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_dispute_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_dispute_status_check
      CHECK (dispute_status IS NULL OR dispute_status IN ('none','open','under_review','resolved','rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payout_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payout_status_check
      CHECK (payout_status IS NULL OR payout_status IN ('pending','processing','sent','failed'));
  END IF;
END $$;

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

create or replace function public.create_transaction_on_offer_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_pricing record;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select * into v_listing from public.listings where id = new.listing_id;
    if not found then
      raise exception 'Listing not found for offer %', new.id;
    end if;

    select * into v_pricing from public.calculate_transaction_pricing(v_listing.price);

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
      completion_status,
      buyer_total_amount,
      service_fee,
      platform_commission,
      seller_payout_amount,
      payout_status
    ) values (
      new.id,
      new.listing_id,
      new.buyer_id,
      v_listing.seller_id,
      new.amount,
      '',
      'IBAN',
      'waiting_payment',
      'waiting_ticket_upload',
      'pending',
      v_pricing.buyer_total_amount,
      v_pricing.service_fee,
      v_pricing.platform_commission,
      v_pricing.seller_payout_amount,
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

update public.transactions
set
  buyer_total_amount = coalesce(buyer_total_amount, coalesce(l.price, amount)),
  service_fee = coalesce(service_fee, round(coalesce(l.price, amount) * 0.05, 2)),
  platform_commission = coalesce(platform_commission, round(coalesce(l.price, amount) * 0.05, 2)),
  seller_payout_amount = coalesce(seller_payout_amount, round(coalesce(l.price, amount) - (coalesce(l.price, amount) * 0.05) - (coalesce(l.price, amount) * 0.05), 2)),
  payout_status = coalesce(payout_status, 'pending')
from public.listings l
where public.transactions.listing_id = l.id
  and (
    buyer_total_amount is null
    or service_fee is null
    or platform_commission is null
    or seller_payout_amount is null
  );

update public.transactions
set
  buyer_total_amount = coalesce(buyer_total_amount, amount),
  service_fee = coalesce(service_fee, round(coalesce(amount, 0) * 0.05, 2)),
  platform_commission = coalesce(platform_commission, round(coalesce(amount, 0) * 0.05, 2)),
  seller_payout_amount = coalesce(seller_payout_amount, round(coalesce(amount, 0) - (coalesce(amount, 0) * 0.05) - (coalesce(amount, 0) * 0.05), 2)),
  payout_status = coalesce(payout_status, 'pending')
where id not in (
  select t.id from public.transactions t
  join public.listings l on l.id = t.listing_id
);

drop policy if exists "Alıcı kendi işlemlerini görebilir" on public.transactions;
create policy "Alıcı kendi işlemlerini görebilir"
  on public.transactions for select
  using (auth.uid() = buyer_id);

drop policy if exists "Satıcı kendi işlemlerini görebilir" on public.transactions;
create policy "Satıcı kendi işlemlerini görebilir"
  on public.transactions for select
  using (auth.uid() = seller_id);

drop policy if exists "Admin tüm işlemleri görebilir" on public.transactions;
create policy "Admin tüm işlemleri görebilir"
  on public.transactions for select
  using (public.is_panel_admin());

drop policy if exists "Admin işlemleri güncelleyebilir" on public.transactions;
create policy "Admin işlemleri güncelleyebilir"
  on public.transactions for update
  using (public.is_panel_admin());

drop policy if exists "Satıcı bilet yükleyebilir" on public.transactions;
create policy "Satıcı bilet yükleyebilir"
  on public.transactions for update
  using (
    auth.uid() = seller_id
    and ticket_status in ('waiting_ticket_upload', 'ticket_uploaded')
    and completion_status = 'pending'
  )
  with check (
    auth.uid() = seller_id
    and ticket_status = 'ticket_uploaded'
    and ticket_file_path is not null
    and ticket_uploaded_at is not null
  );

drop policy if exists "Alıcı ödeme bildirebilir" on public.transactions;
create policy "Alıcı ödeme bildirebilir"
  on public.transactions for update
  using (
    auth.uid() = buyer_id
    and ticket_status = 'ticket_verified'
    and payment_status = 'waiting_payment'
    and completion_status = 'pending'
  )
  with check (
    auth.uid() = buyer_id
    and ticket_status = 'ticket_verified'
    and payment_status = 'waiting_payment'
    and buyer_payment_notified_at is not null
  );

drop policy if exists "Alıcı işlemi onaylayabilir" on public.transactions;
create policy "Alıcı işlemi onaylayabilir"
  on public.transactions for update
  using (
    auth.uid() = buyer_id
    and ticket_status = 'ticket_sent_to_buyer'
    and payment_status = 'payment_received'
    and completion_status = 'pending'
  )
  with check (
    auth.uid() = buyer_id
    and completion_status = 'buyer_confirmed'
  );

-- ------------------------------------------------------------
-- 5) admin_logs
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

drop policy if exists "Kullanıcı kendi adına log yazabilir" on public.admin_logs;
create policy "Kullanıcı kendi adına log yazabilir"
  on public.admin_logs for insert
  with check (auth.uid() = admin_id);

-- ------------------------------------------------------------
-- 6) seller payout methods + notifications
-- ------------------------------------------------------------
create table if not exists public.seller_payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  iban text not null,
  account_name text,
  bank_name text,
  phone text,
  email text,
  is_verified boolean not null default false,
  payout_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_payout_methods_user_idx on public.seller_payout_methods (user_id);
create index if not exists seller_payout_methods_status_idx on public.seller_payout_methods (payout_status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
create index if not exists notifications_transaction_idx on public.notifications (transaction_id);

alter table public.seller_payout_methods enable row level security;
alter table public.notifications enable row level security;

drop trigger if exists seller_payout_methods_updated_at on public.seller_payout_methods;
create trigger seller_payout_methods_updated_at
  before update on public.seller_payout_methods
  for each row execute function public.set_updated_at();

drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

drop policy if exists "Kullanıcı kendi ödeme yöntemlerini görebilir" on public.seller_payout_methods;
create policy "Kullanıcı kendi ödeme yöntemlerini görebilir"
  on public.seller_payout_methods for select
  using (auth.uid() = user_id);

drop policy if exists "Admin tüm ödeme yöntemlerini görebilir" on public.seller_payout_methods;
create policy "Admin tüm ödeme yöntemlerini görebilir"
  on public.seller_payout_methods for select
  using (public.is_panel_admin());

drop policy if exists "Kullanıcı kendi ödeme yöntemlerini ekleyebilir" on public.seller_payout_methods;
create policy "Kullanıcı kendi ödeme yöntemlerini ekleyebilir"
  on public.seller_payout_methods for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi ödeme yöntemlerini güncelleyebilir" on public.seller_payout_methods;
create policy "Kullanıcı kendi ödeme yöntemlerini güncelleyebilir"
  on public.seller_payout_methods for update
  using (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi bildirimlerini görebilir" on public.notifications;
create policy "Kullanıcı kendi bildirimlerini görebilir"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Admin tüm bildirimleri görebilir" on public.notifications;
create policy "Admin tüm bildirimleri görebilir"
  on public.notifications for select
  using (public.is_panel_admin());

drop policy if exists "Kullanıcı kendi bildirimlerini güncelleyebilir" on public.notifications;
create policy "Kullanıcı kendi bildirimlerini güncelleyebilir"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi bildirimlerini ekleyebilir" on public.notifications;
create policy "Kullanıcı kendi bildirimlerini ekleyebilir"
  on public.notifications for insert
  with check (auth.uid() = user_id or public.is_panel_admin());

-- ------------------------------------------------------------
-- 7) storage buckets and policies
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-tickets',
  'transaction-tickets',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-receipts',
  'transaction-receipts',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_ticket_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
  v_txn public.transactions%rowtype;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  begin
    v_txn_id := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_txn from public.transactions where id = v_txn_id;
  if not found then
    return false;
  end if;

  if public.is_panel_admin() then
    return true;
  end if;

  if auth.uid() = v_txn.seller_id then
    return true;
  end if;

  if auth.uid() = v_txn.buyer_id
    and v_txn.payment_status = 'payment_received'
    and v_txn.ticket_status in ('ticket_sent_to_buyer', 'ticket_released_to_buyer', 'delivered_to_buyer') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_upload_ticket_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
  v_txn public.transactions%rowtype;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  begin
    v_txn_id := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_txn from public.transactions where id = v_txn_id;
  if not found then
    return false;
  end if;

  return auth.uid() = v_txn.seller_id
    and v_txn.ticket_status in ('waiting_ticket_upload', 'ticket_uploaded')
    and v_txn.completion_status = 'pending';
end;
$$;

create or replace function public.can_access_receipt_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
  v_txn public.transactions%rowtype;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  begin
    v_txn_id := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_txn from public.transactions where id = v_txn_id;
  if not found then
    return false;
  end if;

  if public.is_panel_admin() then
    return true;
  end if;

  if auth.uid() = v_txn.buyer_id then
    return true;
  end if;

  if auth.uid() = v_txn.seller_id and v_txn.payment_status in ('payment_received', 'payment_rejected') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_upload_receipt_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
  v_txn public.transactions%rowtype;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  begin
    v_txn_id := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_txn from public.transactions where id = v_txn_id;
  if not found then
    return false;
  end if;

  if public.is_panel_admin() then
    return true;
  end if;

  return auth.uid() = v_txn.buyer_id
    and v_txn.ticket_status = 'ticket_verified'
    and v_txn.payment_status in ('waiting_payment', 'receipt_uploaded');
end;
$$;

create or replace function public.can_access_dispute_evidence(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_txn_id uuid;
  v_txn public.transactions%rowtype;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  begin
    v_txn_id := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  select * into v_txn from public.transactions where id = v_txn_id;
  if not found then
    return false;
  end if;

  if public.is_panel_admin() then
    return true;
  end if;

  return auth.uid() = v_txn.buyer_id or auth.uid() = v_txn.seller_id;
end;
$$;

drop policy if exists "Ticket dosyası okuma" on storage.objects;
create policy "Ticket dosyası okuma"
  on storage.objects for select
  using (
    bucket_id = 'transaction-tickets'
    and public.can_access_ticket_storage(name)
  );

drop policy if exists "Satıcı ticket yükleyebilir" on storage.objects;
create policy "Satıcı ticket yükleyebilir"
  on storage.objects for insert
  with check (
    bucket_id = 'transaction-tickets'
    and public.can_upload_ticket_storage(name)
  );

drop policy if exists "Satıcı ticket güncelleyebilir" on storage.objects;
create policy "Satıcı ticket güncelleyebilir"
  on storage.objects for update
  using (
    bucket_id = 'transaction-tickets'
    and public.can_upload_ticket_storage(name)
  )
  with check (
    bucket_id = 'transaction-tickets'
    and public.can_upload_ticket_storage(name)
  );

drop policy if exists "Satıcı ticket silebilir" on storage.objects;
create policy "Satıcı ticket silebilir"
  on storage.objects for delete
  using (
    bucket_id = 'transaction-tickets'
    and public.can_upload_ticket_storage(name)
  );

drop policy if exists "Dekont dosyası okuma" on storage.objects;
create policy "Dekont dosyası okuma"
  on storage.objects for select
  using (
    bucket_id = 'transaction-receipts'
    and public.can_access_receipt_storage(name)
  );

drop policy if exists "Alıcı dekont yükleyebilir" on storage.objects;
create policy "Alıcı dekont yükleyebilir"
  on storage.objects for insert
  with check (
    bucket_id = 'transaction-receipts'
    and public.can_upload_receipt_storage(name)
  );

drop policy if exists "Alıcı dekont güncelleyebilir" on storage.objects;
create policy "Alıcı dekont güncelleyebilir"
  on storage.objects for update
  using (
    bucket_id = 'transaction-receipts'
    and public.can_upload_receipt_storage(name)
  )
  with check (
    bucket_id = 'transaction-receipts'
    and public.can_upload_receipt_storage(name)
  );

drop policy if exists "Alıcı dekont silebilir" on storage.objects;
create policy "Alıcı dekont silebilir"
  on storage.objects for delete
  using (
    bucket_id = 'transaction-receipts'
    and public.can_upload_receipt_storage(name)
  );

drop policy if exists "Dispute kanıtı okuma" on storage.objects;
create policy "Dispute kanıtı okuma"
  on storage.objects for select
  using (
    bucket_id = 'transaction-receipts'
    and public.can_access_dispute_evidence(name)
  );

-- ------------------------------------------------------------
-- 8) Final compatibility updates
-- ------------------------------------------------------------
update public.transactions
set payment_status = coalesce(payment_status, 'waiting_payment')
where payment_status is null;

update public.transactions
set ticket_status = coalesce(ticket_status, 'waiting_ticket_upload')
where ticket_status is null;

update public.transactions
set completion_status = coalesce(completion_status, 'pending')
where completion_status is null;

-- ------------------------------------------------------------
-- Summary:
-- - profiles/listings/offers/transactions/admin_logs/seller_payout_methods/notifications
-- - transaction pricing + payout + dispute fields
-- - ticket/receipt/dispute storage buckets and RLS
-- - buyer/seller/admin access rules preserved
-- ------------------------------------------------------------
