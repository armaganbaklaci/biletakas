alter table public.notifications enable row level security;

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

drop policy if exists "Kullanıcı kendi bildirimlerini ekleyebilir" on public.notifications;
create policy "Kullanıcı kendi bildirimlerini ekleyebilir"
  on public.notifications for insert
  with check (auth.uid() = user_id or public.is_panel_admin());
