import { api } from '../../api.js';

export async function renderEbookTest(app, { id, level }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  const test = await api.get(`/ebook/chapters/${id}/test/${level}`);
  const answers = {};

  const levelColors = { 1: 'level-1', 2: 'level-2', 3: 'level-3' };
  const levelIcons = { 1: '🎯', 2: '📝', 3: '🚀' };

  app.innerHTML = `
    <div class="container page">
      <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center">
        <a href="#/ebook/chapter/${id}" class="btn btn-sm btn-ghost">← Quay lại Chương ${id}</a>
        <span class="level-badge ${levelColors[level]}">${levelIcons[level]} Level ${level} — ${test.bloom_level}</span>
      </div>

      <div class="page-header">
        <h1 class="page-title">${test.name}</h1>
        <p class="page-subtitle">${test.description} · Chương ${test.chapter}</p>
      </div>

      <form id="test-form">
        ${test.questions.map((q, idx) => `
          <div class="card" style="margin-bottom:1.5rem" id="question-${q.id}">
            <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
              <span class="badge badge-accent">Câu ${idx + 1}</span>
              ${q.concept_ref ? `<span class="badge badge-info">${q.concept_ref}</span>` : ''}
            </div>
            <h4 style="margin-bottom:1rem;line-height:1.6">${q.question}</h4>

            ${q.type === 'mc' ? `
              <div class="quiz-options" data-qid="${q.id}">
                ${q.options.map((opt, i) => `
                  <div class="quiz-option" data-qid="${q.id}" data-value="${opt.charAt(0)}" onclick="selectOption(this)">
                    <div class="quiz-option-letter">${opt.charAt(0)}</div>
                    <div style="font-size:0.92rem">${opt}</div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div>
                ${q.rubric ? `
                  <div class="alert alert-info" style="margin-bottom:0.75rem">
                    <strong>Gợi ý rubric:</strong> ${q.rubric}
                  </div>
                ` : ''}
                <textarea class="form-input essay-input" data-qid="${q.id}"
                  placeholder="Viết câu trả lời của bạn... (${q.max_words ? `tối đa ${q.max_words} từ` : ''})"
                  rows="${level === 3 ? 10 : 6}"></textarea>
              </div>
            `}
          </div>
        `).join('')}

        <div style="display:flex;gap:1rem;justify-content:center;padding:1rem 0">
          <button type="submit" class="btn btn-primary btn-lg" id="btn-submit">
            ✅ Nộp bài Level ${level}
          </button>
        </div>
      </form>

      <div id="result-area" style="display:none"></div>
    </div>
  `;

  // MC selection handler
  window.selectOption = (el) => {
    const qid = el.dataset.qid;
    const value = el.dataset.value;
    
    // Deselect siblings
    el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    answers[qid] = value;
  };

  // Form submit
  document.getElementById('test-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Đang nộp bài...';

    // Collect answers
    const submitAnswers = test.questions.map(q => {
      if (q.type === 'mc') {
        return { question_id: q.id, selected: answers[q.id] || null };
      } else {
        const textarea = document.querySelector(`.essay-input[data-qid="${q.id}"]`);
        return { question_id: q.id, text: textarea?.value || '' };
      }
    });

    try {
      const result = await api.post(`/ebook/chapters/${id}/test/${level}/submit`, { answers: submitAnswers });

      const resultArea = document.getElementById('result-area');
      resultArea.style.display = 'block';
      document.getElementById('test-form').style.display = 'none';

      if (result.graded) {
        resultArea.innerHTML = `
          <div class="card card-success" style="text-align:center;padding:3rem">
            <div style="font-size:3rem;margin-bottom:1rem">🎉</div>
            <h2>Điểm của bạn: ${result.score}/10</h2>
            <p style="color:var(--text-secondary);margin-top:0.5rem">
              Đúng ${result.correct_count}/${result.total_questions} câu
            </p>
            <p style="color:var(--text-muted);margin-top:1rem;font-size:0.85rem">
              Đáp án đúng sẽ được giảng viên giải thích trên lớp
            </p>
            <div style="margin-top:1.5rem;display:flex;gap:0.5rem;justify-content:center">
              <a href="#/ebook/chapter/${id}" class="btn btn-secondary">← Quay lại chương</a>
              ${parseInt(level) < 3 ? `<a href="#/ebook/chapter/${id}/test/${parseInt(level)+1}" class="btn btn-primary">Level ${parseInt(level)+1} →</a>` : ''}
            </div>
          </div>
        `;
      } else {
        resultArea.innerHTML = `
          <div class="card card-warning" style="text-align:center;padding:3rem">
            <div style="font-size:3rem;margin-bottom:1rem">📝</div>
            <h2>Bài đã được lưu!</h2>
            <p style="color:var(--text-secondary);margin-top:0.5rem">
              ${result.message}
            </p>
            <div style="margin-top:1.5rem">
              <a href="#/ebook/chapter/${id}" class="btn btn-secondary">← Quay lại chương</a>
            </div>
          </div>
        `;
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = `✅ Nộp bài Level ${level}`;
      alert(err.message);
    }
  });

  return () => { delete window.selectOption; };
}
