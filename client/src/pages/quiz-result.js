import { api } from '../api.js';

export async function renderQuizResult(app, { sessionId }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  const attempts = await api.get('/quizzes/my/attempts');
  const attempt = attempts.find(a => a.session_number === parseInt(sessionId));

  if (!attempt) {
    app.innerHTML = `
      <div class="container page">
        <div class="alert alert-warning">Chưa có kết quả quiz cho buổi ${sessionId}</div>
        <a href="#/quiz/${sessionId}" class="btn btn-primary">Làm Quiz</a>
      </div>
    `;
    return;
  }

  const percent = Math.round((attempt.correct_count / attempt.total_questions) * 100);
  const emoji = percent >= 80 ? '🎉' : percent >= 60 ? '👍' : percent >= 40 ? '😐' : '💪';
  const message = percent >= 80 ? 'Xuất sắc!' : percent >= 60 ? 'Khá tốt!' : percent >= 40 ? 'Cần ôn thêm' : 'Hãy ôn lại kỹ hơn!';

  app.innerHTML = `
    <div class="container page">
      <div class="card" style="max-width:500px;margin:2rem auto;text-align:center;padding:3rem">
        <div style="font-size:4rem;margin-bottom:1rem">${emoji}</div>
        <h1 style="margin-bottom:0.5rem">${message}</h1>

        <div class="stat-value" style="font-size:3.5rem;margin:1.5rem 0">${attempt.score}/10</div>

        <p style="color:var(--text-secondary);font-size:1.1rem">
          Đúng <strong>${attempt.correct_count}</strong> / ${attempt.total_questions} câu (${percent}%)
        </p>

        <div style="margin:2rem 0;padding:1rem;background:var(--warning-light);border-radius:var(--radius-sm)">
          <p style="color:var(--warning);font-size:0.88rem">
            📌 Đáp án đúng sẽ được giảng viên giải thích trên lớp.
            <br>Bạn không thể xem đáp án hoặc làm lại quiz.
          </p>
        </div>

        <div style="display:flex;gap:0.75rem;justify-content:center">
          <a href="#/course" class="btn btn-secondary">📚 Về buổi học</a>
          <a href="#/ebook" class="btn btn-primary">📖 Ôn tập eBook</a>
        </div>
      </div>
    </div>
  `;
}
