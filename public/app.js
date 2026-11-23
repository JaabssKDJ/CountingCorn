(function (window) {
  const SESSION_KEY = "counting_corn_user_session";

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(userObj) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...userObj, timestamp: Date.now() }));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  function requireAuth(allowedRoles) {
    const session = getSession();
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!session || !roles.includes(session.role)) {
      window.location.href = "index.html";
    }
    return session;
  }

  async function fetchState() {
    const res = await fetch('/api/state');
    return await res.json();
  }

  function getBadgeClass(status) {
    if (status === 'Pending') return 'badge-yellow';
    if (status === 'Completed') return 'badge-green';
    if (status === 'In Transit' || status === 'Processing') return 'badge-blue';
    return 'bg-slate-100 text-slate-700';
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if (!toast || !msgEl) return;
    msgEl.innerText = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  window.CountingCornApp = {
    getSession,
    setSession,
    logout,
    requireAuth,
    fetchState,
    getBadgeClass,
    showToast
  };
})(window);