// ============================================================
// biletakas — Bildirim Sistemi
// ============================================================

var _notificationListCache = [];
var _notificationRefreshTimer = null;

function notificationLabel(type) {
  var labels = {
    new_offer: 'Yeni teklif',
    offer_accepted: 'Teklif kabul edildi',
    payment_pending: 'Ödeme bekleniyor',
    payment_received: 'Ödeme alındı',
    ticket_uploaded: 'Bilet yüklendi',
    ticket_delivered: 'Bilet teslim edildi',
    dispute_opened: 'İtiraz açıldı',
    transaction_completed: 'İşlem tamamlandı',
    payment_approved: 'Ödeme alındı',
    ticket_released: 'Bilet teslim edildi',
    refund_approved: 'İade onaylandı',
    additional_evidence_requested: 'Ek kanıt istendi',
    seller_paid: 'Satıcıya ödeme yapıldı'
  };
  return labels[type] || type || 'Bildirim';
}

function wireNotificationsUI() {
  var btnOpen = document.getElementById('btn-notifications');
  var btnClose = document.getElementById('notifications-close');
  var backdrop = document.getElementById('notifications-backdrop');
  var btnMarkAll = document.getElementById('notifications-mark-all');

  if (btnOpen && !btnOpen.dataset.wired) {
    btnOpen.dataset.wired = '1';
    btnOpen.addEventListener('click', openNotificationsModal);
  }

  if (btnClose && !btnClose.dataset.wired) {
    btnClose.dataset.wired = '1';
    btnClose.addEventListener('click', closeNotificationsModal);
  }

  if (backdrop && !backdrop.dataset.wired) {
    backdrop.dataset.wired = '1';
    backdrop.addEventListener('click', closeNotificationsModal);
  }

  if (btnMarkAll && !btnMarkAll.dataset.wired) {
    btnMarkAll.dataset.wired = '1';
    btnMarkAll.addEventListener('click', function () {
      markAllNotificationsRead();
    });
  }

  if (!wireNotificationsUI._listenersAttached) {
    wireNotificationsUI._listenersAttached = true;
    document.addEventListener('biletakas:auth-ready', refreshNotificationsState);
    document.addEventListener('biletakas:auth-changed', refreshNotificationsState);
    document.addEventListener('click', function (e) {
      var item = e.target.closest && e.target.closest('.notification-item');
      if (!item) return;
      var id = item.getAttribute('data-id');
      if (!id) return;
      markNotificationRead(id);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refreshNotificationsState();
    });
  }

  refreshNotificationsState();

  if (!_notificationRefreshTimer) {
    _notificationRefreshTimer = setInterval(function () {
      refreshNotificationsState();
    }, 30000);
  }
}

async function refreshNotificationsState() {
  if (!sb || !AppState.user) {
    updateNotificationBadge(0);
    return;
  }

  var countRes = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', AppState.user.id)
    .eq('is_read', false);

  updateNotificationBadge(countRes.error ? 0 : (countRes.count || 0));
}

function updateNotificationBadge(count) {
  var badge = document.getElementById('notifications-badge');
  var button = document.getElementById('btn-notifications');
  var value = Number(count || 0);

  if (badge) {
    badge.textContent = value > 99 ? '99+' : String(value);
    badge.classList.toggle('hidden', value <= 0);
  }

  if (button) {
    button.classList.toggle('text-amber-300', value > 0);
    button.classList.toggle('text-zinc-400', value <= 0);
  }
}

async function openNotificationsModal() {
  requireAuth(async function () {
    var modal = document.getElementById('notifications-modal');
    var list = document.getElementById('notifications-list');
    if (!modal || !list) return;

    list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
    openModalEl(modal);
    await loadNotifications();
  });
}

function closeNotificationsModal() {
  var modal = document.getElementById('notifications-modal');
  closeModalEl(modal);
}

async function loadNotifications() {
  if (!sb || !AppState.user) return;

  var res = await sb
    .from('notifications')
    .select('id, user_id, transaction_id, type, title, message, is_read, created_at, read_at, metadata')
    .eq('user_id', AppState.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (res.error) {
    console.error('[biletakas] Bildirimler çekilemedi:', res.error);
    renderNotificationsList([]);
    return;
  }

  _notificationListCache = res.data || [];
  renderNotificationsList(_notificationListCache);
  await refreshNotificationsState();
}

function renderNotificationsList(items) {
  var list = document.getElementById('notifications-list');
  var title = document.getElementById('notifications-modal-title');
  var unreadCount = (items || []).filter(function (item) { return !item.is_read; }).length;

  if (title) {
    title.textContent = 'Bildirimler' + (unreadCount > 0 ? ' (' + unreadCount + ')' : '');
  }

  if (!list) return;

  if (!items || items.length === 0) {
    list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz bildirimin yok.</p>';
    return;
  }

  list.innerHTML = items.map(function (item) {
    var unread = !item.is_read;
    var typeLabel = notificationLabel(item.type);
    return ''
      + '<button type="button" class="notification-item w-full text-left rounded-2xl border p-4 transition-colors ' + (unread ? 'bg-accent/10 border-accent/20' : 'bg-surface-700/60 border-white/5 hover:border-white/10') + '" data-id="' + escapeHtml(item.id) + '">' 
        + '<div class="flex items-start justify-between gap-3">'
          + '<div class="min-w-0 flex-1">'
            + '<div class="flex items-center gap-2">'
              + '<span class="text-xs px-2 py-0.5 rounded-full border ' + (unread ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-zinc-800 border-white/10 text-zinc-400') + '">' + escapeHtml(typeLabel) + '</span>'
              + (unread ? '<span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>' : '')
            + '</div>'
            + '<p class="mt-2 text-sm font-semibold text-white">' + escapeHtml(item.title || '-') + '</p>'
            + '<p class="mt-1 text-sm text-zinc-400 leading-relaxed">' + escapeHtml(item.message || '-') + '</p>'
          + '</div>'
          + '<span class="shrink-0 text-[11px] text-zinc-500">' + escapeHtml(formatNotificationDate(item.created_at)) + '</span>'
        + '</div>'
      + '</button>';
  }).join('');
}

async function markNotificationRead(notificationId) {
  if (!sb || !AppState.user || !notificationId) return;

  var item = _notificationListCache.find(function (row) { return row.id === notificationId; });
  if (item && item.is_read) return;

  var res = await sb
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', AppState.user.id)
    .select('id')
    .maybeSingle();

  if (res.error) {
    console.warn('[biletakas] Bildirim okundu işaretlenemedi:', res.error);
    return;
  }

  if (item) item.is_read = true;
  renderNotificationsList(_notificationListCache);
  await refreshNotificationsState();
}

async function markAllNotificationsRead() {
  if (!sb || !AppState.user) return;

  var res = await sb
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', AppState.user.id)
    .eq('is_read', false);

  if (res.error) {
    console.warn('[biletakas] Bildirimler toplu işaretlenemedi:', res.error);
    return;
  }

  _notificationListCache = _notificationListCache.map(function (item) {
    item.is_read = true;
    return item;
  });
  renderNotificationsList(_notificationListCache);
  await refreshNotificationsState();
}

async function createNotification(userId, type, title, message, transactionId, metadata) {
  if (!sb || !userId || !type || !title || !message) return;

  try {
    await sb.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_transaction_id: transactionId || null,
      p_metadata: metadata || {}
    });
  } catch (err) {
    console.warn('[biletakas] Bildirim oluşturulamadı:', err);
  }
}

function formatNotificationDate(value) {
  if (!value) return '-';
  var date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}