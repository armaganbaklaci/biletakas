// ============================================================
// biletakas — Kullanıcı Profil Modalı
// ============================================================

var _profileLoadToken = 0;

document.addEventListener('DOMContentLoaded', wireProfileModalUI);

function wireProfileModalUI() {
  var closeBtn = document.getElementById('profile-close');
  var backdrop = document.getElementById('profile-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', closeProfileModal);
  if (backdrop) backdrop.addEventListener('click', closeProfileModal);

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('profile-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeProfileModal();
    }
  });
}

async function openProfileModal(profileId) {
  if (!profileId || !sb) return;

  var modal = document.getElementById('profile-modal');
  if (!modal) return;

  var token = ++_profileLoadToken;
  renderProfileModalLoading();
  openModalEl(modal);

  var profileRes = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url, created_at, email_verified, phone_verified, instagram_verified, admin_verified, sales_count, purchase_count')
    .eq('id', profileId)
    .maybeSingle();

  if (token !== _profileLoadToken) return;

  if (profileRes.error || !profileRes.data) {
    renderProfileModalError('Profil bilgileri yüklenemedi.');
    return;
  }

  var statsRes = await sb
    .from('profile_public_stats')
    .select('profile_id, successful_sales_count, successful_purchase_count, average_rating, review_count, dispute_count, refund_count, dispute_refund_rate')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (token !== _profileLoadToken) return;

  renderProfileModal(profileRes.data, statsRes && !statsRes.error && statsRes.data ? statsRes.data : null);
}

function closeProfileModal() {
  var modal = document.getElementById('profile-modal');
  closeModalEl(modal);
}

function renderProfileModalLoading() {
  var title = document.getElementById('profile-modal-title');
  var subtitle = document.getElementById('profile-modal-subtitle');
  var body = document.getElementById('profile-modal-body');

  if (title) title.textContent = 'Profil yükleniyor…';
  if (subtitle) subtitle.textContent = 'Kullanıcı bilgileri hazırlanıyor.';
  if (body) {
    body.innerHTML = '<div class="py-10 text-center text-sm text-zinc-400">Profil bilgileri yükleniyor…</div>';
  }
}

function renderProfileModalError(message) {
  var title = document.getElementById('profile-modal-title');
  var subtitle = document.getElementById('profile-modal-subtitle');
  var body = document.getElementById('profile-modal-body');

  if (title) title.textContent = 'Profil bulunamadı';
  if (subtitle) subtitle.textContent = message || 'Bu kullanıcı için profil verisi yok.';
  if (body) {
    body.innerHTML = '<div class="py-10 text-center text-sm text-rose-300">' + escapeHtml(message || 'Profil bilgileri yüklenemedi.') + '</div>';
  }
}

function renderProfileModal(profile, stats) {
  var title = document.getElementById('profile-modal-title');
  var subtitle = document.getElementById('profile-modal-subtitle');
  var body = document.getElementById('profile-modal-body');
  if (!body) return;

  var salesCount = Number((stats && stats.successful_sales_count != null ? stats.successful_sales_count : profile.sales_count) || 0);
  var purchaseCount = Number((stats && stats.successful_purchase_count != null ? stats.successful_purchase_count : profile.purchase_count) || 0);
  var ratingAverage = Number((stats && stats.average_rating != null ? stats.average_rating : 0) || 0);
  var reviewCount = Number((stats && stats.review_count != null ? stats.review_count : 0) || 0);
  var disputeRefundRate = Number((stats && stats.dispute_refund_rate != null ? stats.dispute_refund_rate : 0) || 0);
  var tierLabel = getSellerTierLabel(salesCount);
  var memberSince = formatProfileDate(profile.created_at);
  var displayName = profile.display_name || profile.username || 'Kullanıcı';
  var username = profile.username || '-';
  var avatarHtml = renderProfileAvatar(profile, displayName);

  if (title) title.textContent = displayName;
  if (subtitle) subtitle.textContent = '@' + username + ' · Üyelik: ' + memberSince;

  body.innerHTML =
    '<div class="space-y-5">' +
      '<div class="flex flex-col sm:flex-row sm:items-center gap-4">' +
        avatarHtml +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex flex-wrap items-center gap-2">'
            + '<h4 class="font-display text-2xl font-bold text-white leading-tight">' + escapeHtml(displayName) + '</h4>'
            + (tierLabel ? '<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-accent/20 to-violet-500/20 border border-accent/30 text-accent-light">' + escapeHtml(tierLabel) + '</span>' : '')
            + (profile.admin_verified ? '<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Topluluk Üyesi</span>' : '')
          + '</div>'
          + '<p class="mt-1 text-sm text-zinc-400">@' + escapeHtml(username) + '</p>'
          + '<div class="mt-3 flex flex-wrap gap-2">'
            + profileVerificationBadge(profile.email_verified, 'E-posta doğrulandı', 'E-posta doğrulanmadı')
            + profileVerificationBadge(profile.phone_verified, 'Telefon doğrulandı', 'Telefon doğrulanmadı')
            + profileVerificationBadge(profile.instagram_verified, 'Instagram doğrulandı', 'Instagram doğrulanmadı')
          + '</div>'
        + '</div>'
      + '</div>'

      + '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">'
        + profileMetricCard('Başarılı satış', formatSalesCountLabel(salesCount), 'Onaylanmış işlemler')
        + profileMetricCard('Başarılı alış', purchaseCount > 0 ? purchaseCount + ' alış' : '0 alış', 'Onaylanmış işlemler')
        + profileMetricCard('Ortalama puan', reviewCount > 0 ? ratingAverage.toFixed(1) + ' / 5' : '0.0 / 5', reviewCount > 0 ? reviewCount + ' değerlendirme' : 'Değerlendirme yok')
        + profileMetricCard('Değerlendirme', reviewCount > 0 ? reviewCount.toString() : '0', 'Toplam yorum')
        + profileMetricCard('Dispute / iade', disputeRefundRate.toFixed(1) + '%', 'İşlem bazlı oran')
        + profileMetricCard('Üyelik tarihi', memberSince, 'İlk kayıt tarihi')
      + '</div>'

      + '<div class="rounded-2xl border border-white/10 bg-white/5 p-4">'
        + '<p class="text-xs uppercase tracking-wide text-zinc-500 mb-2">Rozet özeti</p>'
        + '<div class="flex flex-wrap gap-2">'
          + (tierLabel ? '<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent/15 border border-accent/30 text-accent-light">' + escapeHtml(tierLabel) + '</span>' : '<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 border border-white/10 text-zinc-400">Rozet yok</span>')
          + (profile.admin_verified ? '<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Topluluk Üyesi</span>' : '')
        + '</div>'
      + '</div>'
    + '</div>';
}

function profileMetricCard(label, value, helper) {
  return ''
    + '<div class="rounded-2xl border border-white/10 bg-surface-700/70 p-4">'
      + '<p class="text-[11px] uppercase tracking-wide text-zinc-500">' + escapeHtml(label) + '</p>'
      + '<p class="mt-2 font-display text-lg font-bold text-white">' + escapeHtml(value) + '</p>'
      + '<p class="mt-1 text-xs text-zinc-500">' + escapeHtml(helper) + '</p>'
    + '</div>';
}

function profileVerificationBadge(active, yesLabel, noLabel) {
  if (active) {
    return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">✓ ' + escapeHtml(yesLabel) + '</span>';
  }
  return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 border border-white/10 text-zinc-400">' + escapeHtml(noLabel) + '</span>';
}

function renderProfileAvatar(profile, displayName) {
  var initials = getProfileInitials(displayName);
  var imageUrl = profile.avatar_url || '';

  if (imageUrl) {
    return '<div class="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border border-white/10 bg-surface-700"><img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(displayName) + ' profil fotoğrafı" class="w-full h-full object-cover" /></div>';
  }

  return '<div class="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-accent/40 to-violet-700/80 border border-accent/20 flex items-center justify-center text-white font-display text-2xl font-bold">' + escapeHtml(initials) + '</div>';
}

function getProfileInitials(name) {
  var parts = String(name || 'Kullanıcı').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function formatProfileDate(value) {
  if (!value) return '-';
  var date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
}