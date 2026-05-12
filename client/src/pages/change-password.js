import { api, getUser, setUser } from '../api.js';
import { navigate } from '../router.js';

export function renderChangePassword(app) {
  const user = getUser();
  const isMandatory = user?.must_change_password;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">🔑</div>
          <h1>Đổi mật khẩu</h1>
          <p>${isMandatory ? 'Bạn cần đổi mật khẩu mặc định để tiếp tục.' : 'Cập nhật mật khẩu mới cho tài khoản.'}</p>
        </div>

        <div id="pw-error" class="alert alert-danger" style="display:none"></div>
        <div id="pw-success" class="alert alert-success" style="display:none"></div>

        <form id="pw-form">
          <div class="form-group">
            <label class="form-label">Mật khẩu hiện tại</label>
            <input type="password" class="form-input" name="currentPassword" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Mật khẩu mới</label>
            <input type="password" class="form-input" name="newPassword" placeholder="Tối thiểu 6 ký tự" required minlength="6">
          </div>

          <div class="form-group">
            <label class="form-label">Xác nhận mật khẩu mới</label>
            <input type="password" class="form-input" name="confirmPassword" required>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" id="pw-submit">
            💾 Lưu mật khẩu mới
          </button>
          
          ${!isMandatory ? `
            <div style="text-align:center; margin-top:1rem">
              <a href="#/dashboard" class="btn btn-ghost">Bỏ qua</a>
            </div>
          ` : ''}
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('pw-form');
  const errorEl = document.getElementById('pw-error');
  const successEl = document.getElementById('pw-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('pw-submit');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    if (data.newPassword !== data.confirmPassword) {
      errorEl.textContent = 'Mật khẩu xác nhận không khớp.';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    errorEl.style.display = 'none';

    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });

      successEl.textContent = 'Đổi mật khẩu thành công! Đang chuyển hướng...';
      successEl.style.display = 'block';
      
      // Update local user state
      const updatedUser = { ...user, must_change_password: false };
      setUser(updatedUser);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
    }
  });
}
