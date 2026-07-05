-- ============================================================
-- biletakas — Manuel IBAN MVP (Database Foundation)
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Yardımcı: admin kontrolü
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
-- 1) profiles alanları
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_verified boolean not null default false,
  add column if not exists identity_status text not null default 'pending';

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  alter column email_verified set default false,
  alter column phone_verified set default false,
  alter column identity_status set default 'pending';

-- identity_status için temel kontrol
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

-- ------------------------------------------------------------
-- 2) transactions alanları
-- ------------------------------------------------------------
alter table public.transactions
  add column if not exists receipt_file_path text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists payment_note text,
  add column if not exists ticket_delivered_at timestamptz,
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
  add column if not exists ticket_file_hash text;

alter table public.transactions
  alter column dispute_status set default 'none',
  alter column payout_status set default 'pending';

-- Eski kayıtlar için varsayılanlar
update public.transactions
set dispute_status = coalesce(dispute_status, 'none')
where dispute_status is null;

update public.transactions
set payout_status = coalesce(payout_status, 'pending')
where payout_status is null;

-- Status constraint'leri genişlet
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
      'waiting_ticket',
      'ticket_received',
      'delivered_to_buyer'
    ));

alter table public.transactions
  add constraint transactions_payment_status_check
    check (payment_status in ('waiting_payment', 'payment_received', 'refunded'));

alter table public.transactions
  add constraint transactions_completion_status_check
    check (completion_status in (
      'pending',
      'buyer_confirmed',
      'money_sent_to_seller',
      'completed',
      'cancelled'
    ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_dispute_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_dispute_status_check
      CHECK (dispute_status IS NULL OR dispute_status IN ('none', 'open', 'under_review', 'resolved', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payout_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payout_status_check
      CHECK (payout_status IS NULL OR payout_status IN ('pending', 'processing', 'sent', 'failed'));
  END IF;
END $$;

create index if not exists transactions_receipt_uploaded_at_idx
  on public.transactions (receipt_uploaded_at desc)
  where receipt_uploaded_at is not null;

create index if not exists transactions_dispute_status_idx
  on public.transactions (dispute_status)
  where dispute_status is not null and dispute_status <> 'none';

create index if not exists transactions_payout_status_idx
  on public.transactions (payout_status)
  where payout_status is not null;

create index if not exists transactions_ticket_file_hash_idx
  on public.transactions (ticket_file_hash)
  where ticket_file_hash is not null;

-- ------------------------------------------------------------
-- 3) seller_payout_methods tablosu
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

create index if not exists seller_payout_methods_user_idx
  on public.seller_payout_methods (user_id);

create index if not exists seller_payout_methods_status_idx
  on public.seller_payout_methods (payout_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists seller_payout_methods_updated_at on public.seller_payout_methods;
create trigger seller_payout_methods_updated_at
  before update on public.seller_payout_methods
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) notifications tablosu
-- ------------------------------------------------------------
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

create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_transaction_idx
  on public.notifications (transaction_id);

drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5) RLS temel policyleri
-- ------------------------------------------------------------
alter table public.seller_payout_methods enable row level security;
alter table public.notifications enable row level security;

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
