-- ============================================================
-- biletakas — İşlem Sonrası Değerlendirme Migration
-- Alıcı/satıcı karşılıklı değerlendirme, profil ortalama puanı ve yorum özetleri
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) profiles özet puan alanları
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists review_count integer not null default 0;

-- ------------------------------------------------------------
-- 2) profile_reviews politika ve kısıtlar
-- ------------------------------------------------------------
alter table public.profile_reviews
  add column if not exists updated_at timestamptz;

update public.profile_reviews
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

create or replace function public.recalculate_profile_review_stats(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(3,2);
  v_count integer;
begin
  select
    round(coalesce(avg(rating), 0)::numeric, 2),
    count(*)::integer
  into v_avg, v_count
  from public.profile_reviews
  where reviewed_user_id = p_profile_id;

  update public.profiles
  set average_rating = coalesce(v_avg, 0),
      review_count = coalesce(v_count, 0)
  where id = p_profile_id;
end;
$$;

create or replace function public.set_profile_review_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalculate_profile_review_stats(old.reviewed_user_id);
    return old;
  end if;

  perform public.recalculate_profile_review_stats(new.reviewed_user_id);
  if (tg_op = 'UPDATE' and old.reviewed_user_id is distinct from new.reviewed_user_id) then
    perform public.recalculate_profile_review_stats(old.reviewed_user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_reviews_set_updated_at on public.profile_reviews;
create trigger profile_reviews_set_updated_at
  before insert or update on public.profile_reviews
  for each row execute function public.set_profile_review_updated_at();

drop trigger if exists profile_reviews_sync_stats on public.profile_reviews;
create trigger profile_reviews_sync_stats
  after insert or update or delete on public.profile_reviews
  for each row execute function public.sync_profile_review_stats();

drop policy if exists "Kullanıcı kendi yorumu oluşturabilir" on public.profile_reviews;
create policy "Kullanıcı kendi yorumu oluşturabilir"
  on public.profile_reviews for insert
  with check (
    auth.uid() = reviewer_id
    and auth.uid() <> reviewed_user_id
    and exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and t.completion_status = 'completed'
        and ((t.buyer_id = auth.uid() and t.seller_id = reviewed_user_id)
          or (t.seller_id = auth.uid() and t.buyer_id = reviewed_user_id))
    )
  );

drop policy if exists "Kullanıcı kendi yorumunu güncelleyebilir" on public.profile_reviews;
create policy "Kullanıcı kendi yorumunu güncelleyebilir"
  on public.profile_reviews for update
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);

drop policy if exists "Kullanıcı kendi yorumunu silebilir" on public.profile_reviews;
create policy "Kullanıcı kendi yorumunu silebilir"
  on public.profile_reviews for delete
  using (auth.uid() = reviewer_id);

-- ------------------------------------------------------------
-- 3) Özet görünüm güncellemesi
-- ------------------------------------------------------------
create or replace view public.profile_public_stats as
select
  p.id as profile_id,
  coalesce(s.successful_sales_count, 0)::integer as successful_sales_count,
  coalesce(b.successful_purchase_count, 0)::integer as successful_purchase_count,
  coalesce(p.average_rating, 0)::numeric(3,2) as average_rating,
  coalesce(p.review_count, 0)::integer as review_count,
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
