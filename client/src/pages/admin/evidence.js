import { api } from '../../api.js';

export async function renderAdminEvidence(app) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  try {
    const overview = await api.get('/evidence/overview');

    app.innerHTML = `
      <div class="container page">
        <div class="page-header">
          <h1 class="page-title">📦 Quản lý Minh chứng</h1>
          <p class="page-subtitle">Xuất dữ liệu bài kiểm tra & quiz cho hồ sơ nhà trường</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-3" style="margin-bottom:2rem">
          <div class="stat-card">
            <div class="stat-value">${overview.total_students}</div>
            <div class="stat-label">Sinh viên</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${overview.total_quiz_attempts}</div>
            <div class="stat-label">Lượt làm quiz</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${overview.exams.length}</div>
            <div class="stat-label">Bài kiểm tra</div>
          </div>
        </div>

        <!-- Exam Evidence -->
        <h3 style="margin-bottom:1rem">📝 Bài kiểm tra quá trình</h3>
        <div class="evidence-panel">
          ${overview.exams.length > 0 ? overview.exams.map(e => `
            <div class="evidence-card">
              <div class="evidence-info">
                <h4>${e.exam_id === 'midterm-1' ? '🔵 Kiểm tra QT 1 (Chương 1-2)' : '🟣 Kiểm tra QT 2 (Chương 3-4)'}</h4>
                <p>${e.total_submissions} bài nộp · TB: ${e.avg_score}/10</p>
              </div>
              <div class="evidence-actions">
                <button class="btn-export" onclick="exportExam('${e.exam_id}')">
                  📊 Xuất Excel
                </button>
              </div>
            </div>
          `).join('') : `
            <div class="card" style="text-align:center;padding:2rem;color:var(--text-muted)">
              Chưa có bài kiểm tra nào được nộp
            </div>
          `}
        </div>

        <!-- Quiz Evidence -->
        <h3 style="margin:2rem 0 1rem">📋 Điểm Quiz (tất cả buổi)</h3>
        <div class="evidence-panel">
          <div class="evidence-card">
            <div class="evidence-info">
              <h4>🟢 Bảng điểm Quiz 9 buổi</h4>
              <p>${overview.total_quiz_attempts} lượt làm · ${overview.total_students} sinh viên</p>
            </div>
            <div class="evidence-actions">
              <button class="btn-export" onclick="exportQuizzes()">
                📊 Xuất Excel
              </button>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="card" style="margin-top:2rem;border-left:3px solid var(--info)">
          <h4 style="color:var(--info);margin-bottom:0.5rem">📌 Hướng dẫn xuất minh chứng</h4>
          <ul style="color:var(--text-secondary);font-size:0.9rem;line-height:1.8;padding-left:1.5rem">
            <li><strong>Excel bài thi</strong>: Gồm 3 sheet — Tổng kết, Chi tiết bài làm, Thống kê</li>
            <li><strong>Excel quiz</strong>: Bảng điểm 9 buổi quiz</li>
            <li>File tự động tải về, sẵn sàng nộp cho phòng đào tạo</li>
            <li>Tên file có timestamp để phân biệt các lần xuất</li>
          </ul>
        </div>
      </div>
    `;

    // Export handlers
    window.exportExam = async (examId) => {
      try {
        const token = localStorage.getItem('lms_token');
        const res = await fetch('/api/evidence/exams/' + examId + '/export', {
          headers: { Authorization: 'Bearer ' + token }
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'evidence_' + examId + '_' + Date.now() + '.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Lỗi xuất: ' + err.message);
      }
    };

    window.exportQuizzes = async () => {
      try {
        const token = localStorage.getItem('lms_token');
        const res = await fetch('/api/evidence/quizzes/export', {
          headers: { Authorization: 'Bearer ' + token }
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quiz_results_' + Date.now() + '.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Lỗi xuất: ' + err.message);
      }
    };

    // Cleanup
    return () => {
      delete window.exportExam;
      delete window.exportQuizzes;
    };

  } catch (err) {
    app.innerHTML = `
      <div class="container page">
        <div class="alert alert-danger">${err.message}</div>
        <a href="#/admin/dashboard" class="btn btn-secondary">← Quay lại Admin</a>
      </div>
    `;
  }
}
