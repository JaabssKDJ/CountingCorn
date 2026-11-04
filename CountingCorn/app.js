// --- SHARED DATA & STATE MANAGEMENT SYSTEM ---
(function (window) {
  const STORAGE_KEY = "counting_corn_app_state";
  const SESSION_KEY = "counting_corn_user_session";

  const INITIAL_STATE = {
    products: [
      { id: 'p1', name: 'Yellow Sweet Corn', price: 45, unit: 'kg', stock: 450, img: '🌽' },
      { id: 'p2', name: 'White Glutinous Corn', price: 50, unit: 'kg', stock: 200, img: '🌾' },
      { id: 'p3', name: 'Young Baby Corn', price: 80, unit: 'kg', stock: 85, img: '🌱' }
    ],
    orders: [
      { id: 'ORD-1001', customer: 'Kristina Abejay', items: [{ id: 'p1', name: 'Yellow Sweet Corn', qty: 10, price: 45 }], total: 450, address: 'Divisoria, Cagayan de Oro', status: 'Pending', lat: 8.4772, lng: 124.6459 }
    ],
    auditLogs: []
  };

  function getState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
      return INITIAL_STATE;
    }
    return JSON.parse(raw);
  }

  function setState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(role) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role, timestamp: Date.now() }));
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  function requireAuth(allowedRole) {
    const session = getSession();
    if (!session || session.role !== allowedRole) {
      window.location.href = "index.html";
    }
  }

  function getBadgeClass(status) {
    if (status === 'Pending') return 'badge-yellow';
    if (status === 'Delivered') return 'badge-green';
    if (status === 'In Transit' || status === 'Dispatched') return 'badge-blue';
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
    getState,
    setState,
    getSession,
    setSession,
    logout,
    requireAuth,
    getBadgeClass,
    showToast
  };
})(window);