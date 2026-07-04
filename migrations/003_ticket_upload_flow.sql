-- ============================================================
-- biletakas — Bilet Yükleme & Güvenli Ödeme Akışı
-- Supabase SQL Editor'de çalıştırın (002_transactions.sql sonrası).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Yeni kolonlar
-- ------------------------------------------------------------
alter table public.transactions
  add column if not exists ticket_file_path text,
  add column if not exists ticket_uploaded_at timestamptz,
  add column if not exists ticket_verified_at timestamptz,
  add column if not exists buyer_payment_notified_at timestamptz;

create index if not exists transactions_ticket_verified_at_idx
  on public.transactions (ticket_verified_at desc)
  where ticket_verified_at is not null;

create index if not exists transactions_ticket_uploaded_at_idx
  on public.transactions (ticket_uploaded_at desc)
  where ticket_uploaded_at is not null;

create index if not exists transactions_buyer_payment_notified_idx
  on public.transactions (buyer_payment_notified_at desc)
  where buyer_payment_notified_at is not null;

-- ------------------------------------------------------------
-- 2) Status constraint güncellemeleri
-- ------------------------------------------------------------
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
      -- eski değerler (geriye dönük)
      'waiting_ticket',
      'ticket_received',
      'delivered_to_buyer'
    ));

alter table public.transactions
  add constraint transactions_payment_status_check
    check (payment_status in ('waiting_payment', 'payment_received', 'refunded'));

alter table public.transactions
  add constraint transactions_completion_status_check
    check (completion_status in ('pending', 'buyer_confirmed', 'completed', 'cancelled'));

-- Mevcut kayıtları yeni akışa taşı
update public.transactions
set
  ticket_status = case ticket_status
    when 'waiting_ticket' then 'waiting_ticket_upload'
    when 'ticket_received' then 'ticket_verified'
    when 'delivered_to_buyer' then 'ticket_sent_to_buyer'
    else ticket_status
  end,
  payment_status = case
    when ticket_status in ('waiting_ticket', 'waiting_ticket_upload', 'ticket_uploaded')
      and payment_status = 'waiting_payment' then 'waiting_payment'
    else payment_status
  end
where ticket_status in ('waiting_ticket', 'ticket_received', 'delivered_to_buyer')
   or ticket_status is not null;

update public.transactions
set ticket_verified_at = coalesce(ticket_verified_at, updated_at, created_at)
where ticket_status in ('ticket_verified', 'ticket_received', 'ticket_sent_to_buyer', 'delivered_to_buyer')
  and ticket_verified_at is null
  and ticket_file_path is not null;

-- ------------------------------------------------------------
-- 3) Yeni transaction varsayılanları (trigger güncelle)
-- ------------------------------------------------------------
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
      'waiting_ticket_upload',
      'pending'
    )
    on conflict (offer_id) do nothing;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4) Satıcı / alıcı güncelleme RLS
-- ------------------------------------------------------------
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
-- 5) Storage bucket
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

-- Dosya yolundan transaction erişim kontrolü: {transaction_id}/dosya.ext
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
    and v_txn.ticket_status = 'ticket_sent_to_buyer' then
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

-- Storage RLS
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
