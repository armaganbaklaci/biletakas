-- ============================================================
-- biletakas — Dispute Sistemi Migration
-- İtiraz nedeni, açıklama ve admin tarafından ek kanıt talebi
-- ============================================================

create extension if not exists "pgcrypto";

alter table public.transactions
  add column if not exists dispute_category text,
  add column if not exists dispute_description text,
  add column if not exists dispute_requested_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_dispute_category_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_dispute_category_check
      CHECK (
        dispute_category IS NULL OR dispute_category IN (
          'invalid_ticket',
          'left_at_gate',
          'used_before',
          'wrong_ticket',
          'other'
        )
      );
  END IF;
END $$;

create index if not exists transactions_dispute_category_idx
  on public.transactions (dispute_category)
  where dispute_category is not null;

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz;

create index if not exists notifications_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_transaction_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications;
begin
  insert into public.notifications (
    user_id,
    transaction_id,
    type,
    title,
    message,
    metadata,
    is_read,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_transaction_id,
    p_type,
    p_title,
    p_message,
    coalesce(p_metadata, '{}'::jsonb),
    false,
    now(),
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, text, uuid, jsonb) to anon, authenticated;

