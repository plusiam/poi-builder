// Google Identity Services 래퍼

const Auth = (() => {
  let _idToken = null;
  let _user = null;
  let _onLoginCallbacks = [];

  function init(onLogin) {
    if (onLogin) _onLoginCallbacks.push(onLogin);

    // 저장된 토큰 복원
    const saved = sessionStorage.getItem('poi_token');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.exp * 1000 > Date.now()) {
          _idToken = parsed.token;
          _user = parsed.user;
          _onLoginCallbacks.forEach(cb => cb(_user));
          return;
        }
      } catch (_) {}
      sessionStorage.removeItem('poi_token');
    }

    // GIS 버튼 렌더링
    google.accounts.id.initialize({
      client_id: CONFIG.CLIENT_ID,
      callback: _handleCredential,
      auto_select: true,
    });

    const btnEl = document.getElementById('google-signin-btn');
    if (btnEl) {
      google.accounts.id.renderButton(btnEl, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'ko',
      });
    }

    google.accounts.id.prompt();
  }

  function _handleCredential(response) {
    _idToken = response.credential;
    const payload = JSON.parse(atob(_idToken.split('.')[1]));
    _user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    sessionStorage.setItem('poi_token', JSON.stringify({
      token: _idToken,
      user: _user,
      exp: payload.exp,
    }));
    _onLoginCallbacks.forEach(cb => cb(_user));
  }

  function getToken() { return _idToken; }
  function getUser() { return _user; }
  function isLoggedIn() { return !!_idToken; }

  function logout() {
    _idToken = null;
    _user = null;
    sessionStorage.removeItem('poi_token');
    google.accounts.id.disableAutoSelect();
    window.location.href = 'login.html';
  }

  return { init, getToken, getUser, isLoggedIn, logout };
})();
