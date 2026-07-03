-- ============================================================
-- biletakas — Supabase Şema (SQL Editor'de çalıştırın)
-- ============================================================

-- Gerekli eklenti (gen_random_uuid için)
create extension if not exists "pgcrypto";

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
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiller herkese açık okunabilir"
  on public.profiles for select
  using (true);

create policy "Kullanıcı kendi profilini oluşturabilir"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Kullanıcı kendi profilini güncelleyebilir"
  on public.profiles for update
  using (auth.uid() = id);

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

create policy "Aktif ilanlar herkese açık"
  on public.listings for select
  using (status = 'active' or seller_id = auth.uid());

create policy "Giriş yapan kullanıcı ilan oluşturabilir"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "Satıcı kendi ilanını güncelleyebilir"
  on public.listings for update
  using (auth.uid() = seller_id);

-- Not: Admin onay/red işlemleri için ayrıca aşağıdaki gibi bir
-- politika ekleyebilirsiniz (admin_verified=true olan kullanıcılar
-- tüm ilanları güncelleyebilsin):
create policy "Admin tüm ilanları güncelleyebilir"
  on public.listings for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.admin_verified = true
    )
  );

create policy "Admin tüm ilanları görebilir"
  on public.listings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.admin_verified = true
    )
  );

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

create policy "Alıcı kendi tekliflerini görebilir"
  on public.offers for select
  using (auth.uid() = buyer_id);

create policy "Satıcı kendi ilanına gelen teklifleri görebilir"
  on public.offers for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = offers.listing_id and l.seller_id = auth.uid()
    )
  );

create policy "Giriş yapan kullanıcı teklif verebilir"
  on public.offers for insert
  with check (auth.uid() = buyer_id);

create policy "Satıcı kendi ilanına gelen teklifi güncelleyebilir (kabul/red)"
  on public.offers for update
  using (
    exists (
      select 1 from public.listings l
      where l.id = offers.listing_id and l.seller_id = auth.uid()
    )
  );

-- ============================================================
-- Notlar
-- ============================================================
-- 1) İlk admin kullanıcıyı elle atamanız gerekir, örnek:
--    update public.profiles set admin_verified = true where username = 'KullaniciAdi';
--
-- 2) email_verified alanını otomatik senkronize etmek isterseniz,
--    Supabase'de bir trigger/edge function ile auth.users tablosundaki
--    email_confirmed_at değişimini public.profiles tablosuna yansıtabilirsiniz.
--
-- 3) offers.expires_at süresi dolan teklifleri "expired" durumuna
--    çekmek için bir cron/scheduled edge function eklemeniz önerilir
--    (örn. pg_cron ile her saat: update offers set status='expired'
--    where status='pending' and expires_at < now();).
-- ============================================================
