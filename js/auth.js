// ============================================================
// biletakas — Auth & Profil Yönetimi
// ============================================================

var AppState = {
  user: null,       // Supabase auth user
  profile: null,     // profiles tablosu satırı
  ready: false,       // ilk auth kontrolü tamamlandı mı
};

// Login gerektiren bir aksiyon varsa, login sonrası otomatik devam etmek için
var _pendingAction = null;

function requireAuth(actionFn) {
  if (AppState.user) {
    actionFn();
  } else {
    _pendingAction = actionFn;
    openLoginModal();
  }
}

/* ---------- Profil oluşturma / okuma ---------- */
async function ensureProfile(user) {
  if (!sb || !user) return null;

  var existing = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing.error) {
    console.error('[biletakas] Profil okunamadı:', existing.error);
    return null;
  }
  if (existing.data) {
    return existing.data;
  }

  // Profil yok -> anonim kullanıcı adıyla oluştur
  var username = generateAnonymousUsername();
  var insertRes = await sb.from('profiles').insert({
    id: user.id,
    username: username,
    display_name: username,
    email_verified: !!user.email_confirmed_at,
    phone_verified: false,
    instagram_verified: false,
    admin_verified: false,
    sales_count: 0,
    purchase_count: 0,
  }).select().single();

  if (insertRes.error) {
    // Yarış durumu: başka bir istek zaten oluşturmuş olabilir, tekrar oku
    var retry = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (retry.data) return retry.data;
    console.error('[biletakas] Profil oluşturulamadı:', insertRes.error);
    return null;
  }
  return insertRes.data;
}

async function refreshProfile() {
  if (!AppState.user) {
    AppState.profile = null;
    return;
  }
  AppState.profile = await ensureProfile(AppState.user);
}

/* ---------- Kayıt / Giriş / Çıkış ---------- */
async function signUpWithEmail(email, password) {
  if (!sb) throw new Error('Supabase bağlantısı hazır değil.');
  var res = await sb.auth.signUp({ email: email, password: password });
  if (res.error) throw res.error;
  return res.data;
}

async function signInWithEmail(email, password) {
  if (!sb) throw new Error('Supabase bağlantısı hazır değil.');
  var res = await sb.auth.signInWithPassword({ email: email, password: password });
  if (res.error) throw res.error;
  return res.data;
}

async function signOutUser() {
  if (!sb) return;
  await sb.auth.signOut();
}

/* ---------- Auth durum dinleyici ---------- */
async function initAuth() {
  if (!sb) {
    AppState.ready = true;
    updateAuthUI();
    return;
  }

  var sessionRes = await sb.auth.getSession();
  var session = sessionRes.data ? sessionRes.data.session : null;
  AppState.user = session ? session.user : null;
  if (AppState.user) {
    await refreshProfile();
  }
  AppState.ready = true;
  updateAuthUI();
  document.dispatchEvent(new CustomEvent('biletakas:auth-ready'));

  sb.auth.onAuthStateChange(async function (event, session) {
    AppState.user = session ? session.user : null;
    if (AppState.user) {
      await refreshProfile();
    } else {
      AppState.profile = null;
    }
    updateAuthUI();
    document.dispatchEvent(new CustomEvent('biletakas:auth-changed'));

    if (AppState.user && _pendingAction) {
      var fn = _pendingAction;
      _pendingAction = null;
      fn();
    }
  });
}

/* ---------- UI Güncelleme ---------- */
function updateAuthUI() {
  var loggedOutEl = document.getElementById('auth-logged-out');
  var loggedInEl = document.getElementById('auth-logged-in');
  var usernameEl = document.getElementById('auth-username');
  var adminBtn = document.getElementById('btn-admin-panel');

  if (AppState.user && AppState.profile) {
    if (loggedOutEl) loggedOutEl.classList.add('hidden');
    if (loggedInEl) loggedInEl.classList.remove('hidden');
    if (usernameEl) usernameEl.textContent = AppState.profile.display_name || AppState.profile.username;
    if (adminBtn) adminBtn.classList.toggle('hidden', !AppState.profile.admin_verified);
  } else {
    if (loggedOutEl) loggedOutEl.classList.remove('hidden');
    if (loggedInEl) loggedInEl.classList.add('hidden');
    if (adminBtn) adminBtn.classList.add('hidden');
  }
}

/* ---------- Login Modal ---------- */
function openLoginModal(mode) {
  var modal = document.getElementById('login-modal');
  openModalEl(modal);
  setLoginModalMode(mode || 'login');
  var emailInput = document.getElementById('login-email');
  if (emailInput) setTimeout(function () { emailInput.focus(); }, 50);
}

function closeLoginModal() {
  var modal = document.getElementById('login-modal');
  closeModalEl(modal);
  _pendingAction = null;
  var form = document.getElementById('login-form');
  if (form) form.reset();
  var err = document.getElementById('login-error');
  if (err) err.classList.add('hidden');
}

function setLoginModalMode(mode) {
  var title = document.getElementById('login-modal-title');
  var submitBtn = document.getElementById('login-submit');
  var switchText = document.getElementById('login-switch-text');
  var switchBtn = document.getElementById('login-switch-btn');
  var form = document.getElementById('login-form');

  form.setAttribute('data-mode', mode);

  if (mode === 'register') {
    title.textContent = 'Kayıt Ol';
    submitBtn.textContent = 'Kayıt Ol';
    switchText.textContent = 'Zaten hesabın var mı?';
    switchBtn.textContent = 'Giriş yap';
  } else {
    title.textContent = 'Giriş Yap';
    submitBtn.textContent = 'Giriş Yap';
    switchText.textContent = 'Hesabın yok mu?';
    switchBtn.textContent = 'Kayıt ol';
  }
}

function wireAuthUI() {
  var loginForm = document.getElementById('login-form');
  var loginClose = document.getElementById('login-close');
  var loginBackdrop = document.getElementById('login-backdrop');
  var loginSwitchBtn = document.getElementById('login-switch-btn');
  var btnOpenLogin = document.getElementById('btn-open-login');
  var btnOpenRegister = document.getElementById('btn-open-register');
  var btnLogout = document.getElementById('btn-logout');
  var loginError = document.getElementById('login-error');

  if (btnOpenLogin) btnOpenLogin.addEventListener('click', function () { openLoginModal('login'); });
  if (btnOpenRegister) btnOpenRegister.addEventListener('click', function () { openLoginModal('register'); });
  if (loginClose) loginClose.addEventListener('click', closeLoginModal);
  if (loginBackdrop) loginBackdrop.addEventListener('click', closeLoginModal);

  if (loginSwitchBtn) {
    loginSwitchBtn.addEventListener('click', function () {
      var form = document.getElementById('login-form');
      var current = form.getAttribute('data-mode');
      setLoginModalMode(current === 'register' ? 'login' : 'register');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var mode = loginForm.getAttribute('data-mode');
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var submitBtn = document.getElementById('login-submit');

      if (!email || !password) return;

      loginError.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60');

      try {
        if (mode === 'register') {
          await signUpWithEmail(email, password);
          showToast('Kayıt başarılı! Giriş yapılıyor…');
        } else {
          await signInWithEmail(email, password);
          showToast('Giriş başarılı, hoş geldin!');
        }
        closeLoginModal();
      } catch (err) {
        loginError.textContent = translateAuthError(err);
        loginError.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async function () {
      await signOutUser();
      showToast('Çıkış yapıldı.');
    });
  }

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('login-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeLoginModal();
    }
  });
}

function translateAuthError(err) {
  var msg = (err && err.message) || '';
  if (msg.indexOf('Invalid login credentials') !== -1) return 'E-posta veya şifre hatalı.';
  if (msg.indexOf('User already registered') !== -1) return 'Bu e-posta ile zaten bir hesap var.';
  if (msg.indexOf('Password should be at least') !== -1) return 'Şifre en az 6 karakter olmalı.';
  if (msg.indexOf('Unable to validate email') !== -1) return 'Geçerli bir e-posta adresi girin.';
  return msg || 'Bir hata oluştu, tekrar deneyin.';
}
