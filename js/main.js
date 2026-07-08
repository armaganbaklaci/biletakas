// ============================================================
// biletakas — Uygulama Başlangıcı
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  wireNotificationsUI();
  wireAuthUI();
  wireListingsUI();
  wireOfferModalUI();
  wireMyOffersUI();
  wireMyTransactionsUI();

  if (typeof wireAdminUI === 'function') {
    wireAdminUI();
  }

  initAuth();
  loadAndRenderListings();
});