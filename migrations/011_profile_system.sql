-- ============================================================
-- biletakas — Profil Sistemi Migration
-- Profil fotoğrafı, değerlendirme tablosu ve public profil istatistikleri
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) profiles genişletme
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 2) profile_reviews
-- ------------------------------------------------------------
create table if not exists public.profile_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewed_user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  unique (reviewed_user_id, reviewer_id, transaction_id)
);

create index if not exists profile_reviews_reviewed_user_idx on public.profile_reviews (reviewed_user_id);
create index if not exists profile_reviews_reviewer_idx on public.profile_reviews (reviewer_id);
create index if not exists profile_reviews_created_at_idx on public.profile_reviews (created_at desc);

alter table public.profile_reviews enable row level security;

drop policy if exists "Profile yorumları herkese açık okunabilir" on public.profile_reviews;
create policy "Profile yorumları herkese açık okunabilir"
  on public.profile_reviews for select
  using (true);

drop policy if exists "Kullanıcı kendi yorumu oluşturabilir" on public.profile_reviews;
create policy "Kullanıcı kendi yorumu oluşturabilir"
  on public.profile_reviews for insert
  with check (auth.uid() = reviewer_id and auth.uid() <> reviewed_user_id);

-- ------------------------------------------------------------
-- 3) Public profil istatistikleri
-- ------------------------------------------------------------
create or replace view public.profile_public_stats as
select
  p.id as profile_id,
  coalesce(s.successful_sales_count, 0)::integer as successful_sales_count,
  coalesce(b.successful_purchase_count, 0)::integer as successful_purchase_count,
  coalesce(r.average_rating, 0)::numeric(3,2) as average_rating,
  coalesce(r.review_count, 0)::integer as review_count,
  coalesce(d.dispute_count, 0)::integer as dispute_count,
  coalesce(d.refund_count, 0)::integer as refund_count,
  case
    when coalesce(s.successful_sales_count, 0) = 0 then 0::numeric(5,2)
    else round(((coalesce(d.dispute_count, 0)::numeric + coalesce(d.refund_count, 0)::numeric) / nullif(coalesce(s.successful_sales_count, 0), 0)) * 100, 2)
  end as dispute_refund_rate
from public.profiles p
left join lateral (
  select count(*)::integer as successful_sales_count
  from public.transactions t
  where t.seller_id = p.id
    and t.completion_status = 'completed'
) s on true
left join lateral (
  select count(*)::integer as successful_purchase_count
  from public.transactions t
  where t.buyer_id = p.id
    and t.completion_status = 'completed'
) b on true
left join lateral (
  select
    round(coalesce(avg(pr.rating), 0)::numeric, 2) as average_rating,
    count(*)::integer as review_count
  from public.profile_reviews pr
  where pr.reviewed_user_id = p.id
) r on true
left join lateral (
  select
    count(*) filter (
      where coalesce(t.dispute_status, 'none') in ('open', 'under_review', 'resolved', 'rejected')
    )::integer as dispute_count,
    count(*) filter (
      where coalesce(t.payment_status, '') = 'refunded'
        or coalesce(t.completion_status, '') = 'cancelled'
    )::integer as refund_count
  from public.transactions t
  where t.seller_id = p.id
) d on true;

grant select on public.profile_public_stats to anon, authenticated;

-- ------------------------------------------------------------
-- 4) Profil fotoğrafları bucket'ı
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "Profil fotoğrafları herkese açık okunabilir" on storage.objects;
create policy "Profil fotoğrafları herkese açık okunabilir"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

drop policy if exists "Kullanıcı kendi profil fotoğrafını yükleyebilir" on storage.objects;
create policy "Kullanıcı kendi profil fotoğrafını yükleyebilir"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "Kullanıcı kendi profil fotoğrafını güncelleyebilir" on storage.objects;
create policy "Kullanıcı kendi profil fotoğrafını güncelleyebilir"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "Kullanıcı kendi profil fotoğrafını silebilir" on storage.objects;
create policy "Kullanıcı kendi profil fotoğrafını silebilir"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
    and auth.uid()::text = split_part(name, '/', 1)
  );