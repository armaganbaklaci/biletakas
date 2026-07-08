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
