-- ============================================================
-- biletakas — Bilet Teslim ve Güvenli İndirme Akışı
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) transactions alanı
-- ------------------------------------------------------------
alter table public.transactions
  add column if not exists ticket_delivered_at timestamptz;

create index if not exists transactions_ticket_delivered_at_idx
  on public.transactions (ticket_delivered_at desc)
  where ticket_delivered_at is not null;

-- ------------------------------------------------------------
-- 2) ticket status constraint genişletme
-- ------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_ticket_status_check;

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

-- ------------------------------------------------------------
-- 3) Storage policy genişletme (varsa koru)
-- ------------------------------------------------------------
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

-- Mevcut storage policy'leri değiştirmeden aynı isimlerle tekrar oluştur
-- Eğer policy zaten varsa, drop/create ile güncellenir.
drop policy if exists "Ticket dosyası okuma" on storage.objects;
create policy "Ticket dosyası okuma"
  on storage.objects for select
  using (
    bucket_id = 'transaction-tickets'
    and public.can_access_ticket_storage(name)
  );
