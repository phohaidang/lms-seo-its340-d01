/**
 * Simple hash-based SPA Router
 */

const routes = {};
let currentCleanup = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}

export function getParams() {
  const hash = window.location.hash.slice(1);
  const parts = hash.split('/').filter(Boolean);
  return parts;
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/login';
  const app = document.getElementById('app');
  
  // Clean up previous page
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  
  // Find matching route
  let matched = null;
  let params = {};
  
  for (const [pattern, handler] of Object.entries(routes)) {
    const regex = pattern
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')
      .replace(/\//g, '\\/');
    
    const match = hash.match(new RegExp(`^${regex}$`));
    if (match) {
      matched = handler;
      params = match.groups || {};
      break;
    }
  }
  
  if (matched) {
    try {
      const result = await matched(app, params);
      if (typeof result === 'function') {
        currentCleanup = result;
      }
    } catch (err) {
      console.error('Route error:', err);
      app.innerHTML = `
        <div class="container page">
          <div class="alert alert-danger">
            <strong>Lỗi:</strong> ${err.message}
          </div>
        </div>
      `;
    }
  } else {
    app.innerHTML = `
      <div class="container page">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2>Không tìm thấy trang</h2>
          <p>Trang bạn tìm không tồn tại</p>
          <br>
          <a href="#/dashboard" class="btn btn-primary">Về trang chủ</a>
        </div>
      </div>
    `;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
