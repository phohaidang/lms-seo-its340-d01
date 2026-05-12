import { api, getUser } from '../api.js';

export async function renderDashboard(app) {
  const user = getUser();
  
  app.innerHTML = `
    <div class="container page">
      <div class="page-header">
        <h1 class="page-title">Xin chào, ${user.full_name}! 👋</h1>
        <p class="page-subtitle">BAF737 — Giới thiệu Khoa học máy tính | ĐH Ngân Hàng TP.HCM</p>
      </div>

      <div class="grid grid-4" id="stats">
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
      </div>

      <div style="margin-top: 2rem">
        <h2 style="margin-bottom: 1rem">🚀 Truy cập nhanh</h2>
        <div class="grid grid-3">
          <a href="#/course" class="card" style="text-decoration:none">
            <h3>📚 Buổi học</h3>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:0.5rem">
              Xem giáo án, slide 6 buổi học
            </p>
          </a>
          <a href="#/ebook" class="card" style="text-decoration:none">
            <h3>📖 eBook</h3>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:0.5rem">
              Ôn tập theo SCQA + 3-Level Test
            </p>
          </a>
          <a href="#/grades" class="card" style="text-decoration:none">
            <h3>📋 Bảng điểm</h3>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:0.5rem">
              Xem điểm quiz, kiểm tra, tổng kết
            </p>
          </a>
        </div>
      </div>
    </div>
  `;

  // Load stats
  try {
    const [quizzes, grades] = await Promise.all([
      api.get('/quizzes/my/attempts'),
      api.get('/grades/me')
    ]);

    const quizDone = quizzes.length;
    const avgScore = quizzes.length > 0
      ? (quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length).toFixed(1)
      : '—';
    const examsDone = grades.exams?.length || 0;
    const totalScore = grades.manual?.total_score ?? '—';

    document.getElementById('stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${quizDone}/6</div>
        <div class="stat-label">Quiz đã làm</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgScore}</div>
        <div class="stat-label">Điểm TB Quiz</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${examsDone}</div>
        <div class="stat-label">Bài kiểm tra</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalScore}</div>
        <div class="stat-label">Điểm tổng kết</div>
      </div>
    `;
  } catch (err) {
    document.getElementById('stats').innerHTML = `
      <div class="alert alert-warning" style="grid-column: 1/-1">
        Chưa có dữ liệu. Hãy bắt đầu làm quiz!
      </div>
    `;
  }
}
