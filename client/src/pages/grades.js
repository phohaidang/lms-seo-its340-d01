import { api } from '../api.js';

export async function renderGrades(app) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  const grades = await api.get('/grades/me');

  app.innerHTML = `
    <div class="container page">
      <div class="page-header">
        <h1 class="page-title">📋 Bảng điểm cá nhân</h1>
        <p class="page-subtitle">BAF737 — Giới thiệu Khoa học máy tính</p>
      </div>

      <!-- Quiz Scores -->
      <div style="margin-bottom:2rem">
        <h2 style="margin-bottom:1rem">📝 Điểm Quiz (ôn tập)</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Buổi</th><th>Điểm</th><th>Ngày làm</th></tr></thead>
            <tbody>
              ${[1,2,3,4,5,6].map(s => {
                const q = grades.quizzes.find(q => q.session === s);
                return `
                  <tr>
                    <td>Buổi ${s}</td>
                    <td>${q ? `<span class="badge ${q.score >= 8 ? 'badge-success' : q.score >= 5 ? 'badge-warning' : 'badge-danger'}">${q.score}/10</span>` : '<span style="color:var(--text-muted)">Chưa làm</span>'}</td>
                    <td style="color:var(--text-muted);font-size:0.85rem">${q ? new Date(q.submitted_at).toLocaleDateString('vi-VN') : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Exam Scores -->
      ${grades.exams.length > 0 ? `
        <div style="margin-bottom:2rem">
          <h2 style="margin-bottom:1rem">📋 Điểm Kiểm tra</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Bài kiểm tra</th><th>Điểm</th><th>Ngày</th></tr></thead>
              <tbody>
                ${grades.exams.map(e => `
                  <tr>
                    <td>${e.exam_id === 'midterm-1' ? 'Giữa kỳ 1' : e.exam_id === 'midterm-2' ? 'Giữa kỳ 2' : e.exam_id}</td>
                    <td><span class="badge badge-accent">${e.score}/10</span></td>
                    <td style="color:var(--text-muted);font-size:0.85rem">${new Date(e.submitted_at).toLocaleDateString('vi-VN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Final Grades -->
      ${grades.manual ? `
        <div>
          <h2 style="margin-bottom:1rem">🎓 Điểm tổng kết</h2>
          <div class="grid grid-4">
            <div class="stat-card">
              <div class="stat-value">${grades.manual.attendance ?? '—'}</div>
              <div class="stat-label">Chuyên cần (10%)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${grades.manual.midterm_essay ?? '—'}</div>
              <div class="stat-label">KT Giữa kỳ (20%)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${grades.manual.group_project ?? '—'}</div>
              <div class="stat-label">Tiểu luận (20%)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="font-size:2.5rem">${grades.manual.total_score ?? '—'}</div>
              <div class="stat-label">TỔNG KẾT</div>
            </div>
          </div>
        </div>
      ` : `
        <div class="alert alert-info">
          Điểm tổng kết sẽ được cập nhật khi giảng viên hoàn tất chấm điểm.
        </div>
      `}
    </div>
  `;
}
