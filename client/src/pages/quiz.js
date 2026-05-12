import { api } from '../api.js';

export async function renderQuiz(app, { sessionId }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  try {
    const quiz = await api.get(`/quizzes/${sessionId}`);
    const answers = {};
    let timeLeft = quiz.time_limit_minutes * 60;

    app.innerHTML = `
      <div class="container page">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;position:sticky;top:64px;background:var(--bg-primary);padding:1rem 0;z-index:50">
          <div>
            <span class="badge badge-accent">Buổi ${quiz.session}</span>
            <h2 style="margin-top:0.3rem">${quiz.title}</h2>
          </div>
          <div class="timer" id="quiz-timer">⏱ ${formatTime(timeLeft)}</div>
        </div>

        <form id="quiz-form">
          ${quiz.questions.map((q, idx) => `
            <div class="card" style="margin-bottom:1.25rem">
              <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
                <span class="badge badge-info">Câu ${idx + 1}/${quiz.total_questions}</span>
                <span class="badge">${q.type === 'mc' ? 'Trắc nghiệm' : 'Đúng/Sai'}</span>
              </div>
              <h4 style="margin-bottom:1rem;line-height:1.6">${q.question}</h4>

              ${q.type === 'mc' ? `
                <div>
                  ${q.options.map(opt => `
                    <div class="quiz-option" data-qid="${q.id}" data-value="${opt.charAt(0)}" onclick="selectQuizOption(this)">
                      <div class="quiz-option-letter">${opt.charAt(0)}</div>
                      <div style="font-size:0.92rem">${opt}</div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="display:flex;gap:0.75rem">
                  <div class="quiz-option" data-qid="${q.id}" data-value="true" onclick="selectQuizOption(this)" style="flex:1;justify-content:center">
                    <strong>✅ Đúng (True)</strong>
                  </div>
                  <div class="quiz-option" data-qid="${q.id}" data-value="false" onclick="selectQuizOption(this)" style="flex:1;justify-content:center">
                    <strong>❌ Sai (False)</strong>
                  </div>
                </div>
              `}
            </div>
          `).join('')}

          <div style="text-align:center;padding:1.5rem 0">
            <button type="submit" class="btn btn-primary btn-lg" id="btn-quiz-submit">
              ✅ Nộp bài quiz
            </button>
          </div>
        </form>
      </div>
    `;

    // Timer
    const timerEl = document.getElementById('quiz-timer');
    const timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;

      if (timeLeft <= 300) timerEl.className = 'timer warning';
      if (timeLeft <= 60) timerEl.className = 'timer danger';

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        document.getElementById('quiz-form').dispatchEvent(new Event('submit'));
      }
    }, 1000);

    // Option selection
    window.selectQuizOption = (el) => {
      const qid = el.dataset.qid;
      let value = el.dataset.value;
      if (value === 'true') value = true;
      else if (value === 'false') value = false;

      el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      answers[qid] = value;
    };

    // Submit
    document.getElementById('quiz-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInterval(timerInterval);

      const unanswered = quiz.questions.filter(q => answers[q.id] === undefined).length;
      if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa trả lời. Nộp bài?`)) return;

      const btn = document.getElementById('btn-quiz-submit');
      btn.disabled = true;
      btn.textContent = 'Đang nộp...';

      const submitAnswers = quiz.questions.map(q => ({
        question_id: q.id,
        selected: answers[q.id] ?? null
      }));

      try {
        const result = await api.post(`/quizzes/${sessionId}/submit`, { answers: submitAnswers });
        location.hash = `#/quiz/${sessionId}/result`;
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = '✅ Nộp bài quiz';
      }
    });

    return () => {
      clearInterval(timerInterval);
      delete window.selectQuizOption;
    };

  } catch (err) {
    if (err.message.includes('đã làm')) {
      location.hash = `#/quiz/${sessionId}/result`;
    } else {
      app.innerHTML = `
        <div class="container page">
          <div class="alert alert-warning">${err.message}</div>
          <a href="#/course" class="btn btn-secondary">← Quay lại</a>
        </div>
      `;
    }
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
