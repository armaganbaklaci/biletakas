-- ============================================================
-- biletakas — Dispute ve İade Akışı
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

alter table public.transactions
  add column if not exists dispute_reason text,
  add column if not exists dispute_evidence_path text,
  add column if not exists dispute_status text,
  add column if not exists dispute_created_at timestamptz;

alter table public.transactions
  alter column dispute_status set default 'none';

update public.transactions
set dispute_status = coalesce(dispute_status, 'none')
where dispute_status is null;

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

create index if not exists transactions_dispute_created_at_idx
  on public.transactions (dispute_created_at desc)
  where dispute_created_at is not null;

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

create policy "Dispute kanıtı okuma"
  on storage.objects for select
  using (
    bucket_id = 'transaction-receipts'
    and public.can_access_dispute_evidence(name)
  );
