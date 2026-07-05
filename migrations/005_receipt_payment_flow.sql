-- ============================================================
-- biletakas — Alıcı Dekont + Admin Ödeme Onayı (MVP)
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) transactions alanları
-- ------------------------------------------------------------
alter table public.transactions
  add column if not exists receipt_file_path text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists payment_note text;

create index if not exists transactions_receipt_uploaded_at_idx
  on public.transactions (receipt_uploaded_at desc)
  where receipt_uploaded_at is not null;

create index if not exists transactions_receipt_file_path_idx
  on public.transactions (receipt_file_path)
  where receipt_file_path is not null;

-- ------------------------------------------------------------
-- 2) payment status constraint genişletme
-- ------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_payment_status_check;

alter table public.transactions
  add constraint transactions_payment_status_check
    check (payment_status in ('waiting_payment', 'receipt_uploaded', 'payment_received', 'payment_rejected', 'refunded'));

-- ------------------------------------------------------------
-- 3) Storage bucket: transaction-receipts
-- ------------------------------------------------------------
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

  return auth.uid() = v_txn.buyer_id
    and v_txn.ticket_status = 'ticket_verified'
    and v_txn.payment_status in ('waiting_payment', 'receipt_uploaded');
end;
$$;

-- ------------------------------------------------------------
-- 4) Storage RLS
-- ------------------------------------------------------------
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
