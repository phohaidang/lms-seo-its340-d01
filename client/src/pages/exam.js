import { api, getUser } from '../api.js';

export async function renderExam(app, { examId }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  try {
    const exam = await api.get(`/exams/${examId}`);
    const answers = {};
    let timeLeft = exam.time_limit_minutes * 60;
    const startedAt = new Date().toISOString();
    let violations = 0;
    let submitted = false;

    // ── Strict Mode UI ──
    app.innerHTML = `
      <div class="exam-strict-overlay" id="exam-overlay">
        <div class="exam-strict-container">

          <!-- Header -->
          <div class="exam-header" id="exam-header">
            <div class="exam-header-left">
              <div class="exam-title-badge">📝 KIỂM TRA QUÁ TRÌNH</div>
              <h2 class="exam-title">${exam.title}</h2>
              <p class="exam-scope">${exam.scope} · ${exam.total_questions} câu · Không sử dụng tài liệu</p>
            </div>
            <div class="exam-header-right">
              <div class="exam-timer" id="exam-timer">
                <span class="timer-icon">⏱</span>
                <span class="timer-value" id="timer-value">${formatTime(timeLeft)}</span>
              </div>
              <div class="exam-violations" id="violations-display" style="display:none">
                ⚠️ Vi phạm: <span id="violations-count">0</span>/3
              </div>
            </div>
          </div>

          <!-- Questions -->
          <form id="exam-form">
            ${exam.questions.map((q, idx) => `
              <div class="exam-question-card" id="eq-${q.id}">
                <div class="exam-question-number">
                  <span class="eq-num">${idx + 1}</span>
                  <span class="eq-total">/ ${exam.total_questions}</span>
                </div>
                <h4 class="exam-question-text">${q.question}</h4>

                <div class="exam-options">
                  ${q.options.map(opt => `
                    <div class="exam-option" data-qid="${q.id}" data-value="${opt.charAt(0)}" onclick="selectExamOption(this)">
                      <div class="exam-option-radio"></div>
                      <div class="exam-option-text">${opt}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}

            <!-- Question Navigator -->
            <div class="exam-navigator" id="exam-navigator">
              <div class="exam-nav-title">📋 Bản đồ câu hỏi</div>
              <div class="exam-nav-grid">
                ${exam.questions.map((q, idx) => `
                  <a class="exam-nav-item" href="#eq-${q.id}" data-qid="${q.id}" id="nav-${q.id}">${idx + 1}</a>
                `).join('')}
              </div>
              <div class="exam-nav-legend">
                <span><span class="nav-dot answered"></span> Đã trả lời</span>
                <span><span class="nav-dot unanswered"></span> Chưa trả lời</span>
              </div>
            </div>

            <!-- Submit -->
            <div class="exam-submit-area">
              <div class="exam-progress-text" id="exam-progress">Đã trả lời: 0/${exam.total_questions}</div>
              <button type="submit" class="btn btn-primary btn-lg exam-submit-btn" id="btn-exam-submit">
                📤 Nộp bài kiểm tra
              </button>
              <p class="exam-warning-text">⚠️ Bài thi sẽ tự động nộp khi hết giờ. Không thể làm lại.</p>
              
              <hr style="margin: 1.5rem 0; opacity: 0.2">
              <div class="exam-offline-fallback" style="text-align: left; background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                <h4 style="margin-bottom: 0.5rem; color: #f59e0b;">🚨 Dự phòng sự cố (Offline/Mất mạng)</h4>
                <p style="font-size: 0.85rem; margin-bottom: 1rem">Nếu gặp sự cố không thể thao tác trên web, bạn có thể tải đề Word và nộp lại file bài làm tại đây.</p>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <a href="${api.baseUrl}/exams/${examId}/export-word" target="_blank" class="btn btn-sm btn-secondary">📥 Tải đề Word</a>
                  <input type="file" id="exam-word-upload" accept=".doc,.docx" style="display:none" onchange="uploadWordExam(event)">
                  <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('exam-word-upload').click()">📤 Nộp bài bằng file Word</button>
                  <span id="upload-status" style="font-size: 0.85rem; color: var(--accent-primary)"></span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    // ── Timer ──
    const timerEl = document.getElementById('timer-value');
    const timerContainer = document.getElementById('exam-timer');
    const timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = formatTime(timeLeft);

      if (timeLeft <= 300) timerContainer.classList.add('timer-warning');
      if (timeLeft <= 60) timerContainer.classList.add('timer-danger');

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        submitExam();
      }
    }, 1000);

    // ── Option Selection ──
    window.selectExamOption = (el) => {
      const qid = el.dataset.qid;
      const value = el.dataset.value;

      el.parentElement.querySelectorAll('.exam-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      answers[qid] = value;

      // Update navigator
      const navItem = document.getElementById(`nav-${qid}`);
      if (navItem) navItem.classList.add('answered');

      // Update progress
      const answered = Object.keys(answers).length;
      document.getElementById('exam-progress').textContent =
        `Đã trả lời: ${answered}/${exam.total_questions}`;
    };

    // ── Strict Mode: Anti-cheat Detection ──
    const violationsEl = document.getElementById('violations-display');
    const violationsCount = document.getElementById('violations-count');

    function recordViolation(reason) {
      if (submitted) return;
      violations++;
      violationsEl.style.display = 'flex';
      violationsCount.textContent = violations;

      if (violations >= 3) {
        alert('⛔ Bạn đã vi phạm 3 lần. Bài thi sẽ được nộp tự động.');
        submitExam();
      } else {
        alert(`⚠️ Cảnh báo (${violations}/3): ${reason}. Lần vi phạm thứ 3 bài sẽ tự động nộp!`);
      }
    }

    // Detect tab visibility change
    function onVisibilityChange() {
      if (document.hidden && !submitted) {
        recordViolation('Bạn đã chuyển tab hoặc cửa sổ khác');
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Detect window blur
    function onWindowBlur() {
      if (!submitted) {
        recordViolation('Bạn đã rời khỏi cửa sổ thi');
      }
    }
    window.addEventListener('blur', onWindowBlur);

    // Block right-click
    function onContextMenu(e) { e.preventDefault(); }
    document.addEventListener('contextmenu', onContextMenu);

    // Block copy/paste shortcuts
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        recordViolation('Sử dụng phím tắt không được phép');
      }
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    // ── Submit Logic ──
    async function submitExam() {
      if (submitted) return;
      submitted = true;
      clearInterval(timerInterval);

      const btn = document.getElementById('btn-exam-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Đang nộp bài...'; }

      const submitAnswers = exam.questions.map(q => ({
        question_id: q.id,
        selected: answers[q.id] ?? null
      }));

      try {
        const result = await api.post(`/exams/${examId}/submit`, {
          answers: submitAnswers,
          variant: exam.variant,
          started_at: startedAt,
          violations
        });

        // Show result
        app.innerHTML = `
          <div class="container page" style="max-width:600px;margin:auto;padding-top:3rem">
            <div class="card" style="text-align:center;padding:3rem 2rem">
              <div style="font-size:3rem;margin-bottom:1rem">✅</div>
              <h2 style="margin-bottom:0.5rem">Nộp bài thành công!</h2>
              <p style="color:var(--text-secondary);margin-bottom:2rem">${exam.title}</p>

              <div class="exam-result-score">
                <div class="result-big-score">${result.score}</div>
                <div class="result-label">/ 10 điểm</div>
              </div>

              <div style="display:flex;gap:2rem;justify-content:center;margin:2rem 0">
                <div>
                  <div style="font-size:1.5rem;font-weight:700;color:var(--accent-primary)">${result.correct_count}</div>
                  <div style="font-size:0.85rem;color:var(--text-muted)">Đúng</div>
                </div>
                <div>
                  <div style="font-size:1.5rem;font-weight:700;color:var(--text-secondary)">${result.total_questions - result.correct_count}</div>
                  <div style="font-size:0.85rem;color:var(--text-muted)">Sai</div>
                </div>
                <div>
                  <div style="font-size:1.5rem;font-weight:700;color:${violations > 0 ? '#f59e0b' : 'var(--accent-primary)'}">${violations}</div>
                  <div style="font-size:0.85rem;color:var(--text-muted)">Vi phạm</div>
                </div>
              </div>

              <a href="#/grades" class="btn btn-primary" style="margin-top:1rem">📋 Xem bảng điểm</a>
              <a href="#/course" class="btn btn-secondary" style="margin-top:0.5rem">← Quay lại buổi học</a>
            </div>
          </div>
        `;
      } catch (err) {
        alert('Lỗi nộp bài: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '📤 Nộp bài kiểm tra'; }
        submitted = false;
      }
    }

    // Form submit handler
    document.getElementById('exam-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const unanswered = exam.questions.filter(q => answers[q.id] === undefined).length;
      if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa trả lời. Xác nhận nộp bài?`)) return;
      if (!confirm('Bạn chắc chắn muốn nộp bài? Không thể làm lại!')) return;
      submitExam();
    });

    // Fallback Upload Handler
    window.uploadWordExam = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm(`Xác nhận nộp bài dự phòng bằng file: ${file.name}?`)) return;

      const formData = new FormData();
      formData.append('examFile', file);
      
      const statusEl = document.getElementById('upload-status');
      statusEl.textContent = "⏳ Đang tải lên...";
      statusEl.style.color = "var(--text-secondary)";

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${api.baseUrl}/exams/${examId}/upload-word`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.error || 'Upload thất bại');
        statusEl.textContent = "✅ " + result.message;
        statusEl.style.color = "green";
        
        // Disable regular submit after word upload
        const btn = document.getElementById('btn-exam-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Đã nộp bài thủ công'; }
        submitted = true;
        clearInterval(timerInterval);
        
      } catch (err) {
        statusEl.textContent = "❌ " + err.message;
        statusEl.style.color = "red";
      }
    };

    // Cleanup
    return () => {
      clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      delete window.selectExamOption;
      delete window.uploadWordExam;
    };

  } catch (err) {
    if (err.message.includes('đã làm')) {
      try {
        const result = await api.get(`/exams/${examId}/my-result`);
        app.innerHTML = `
          <div class="container page" style="max-width:600px;margin:auto;padding-top:3rem">
            <div class="card" style="text-align:center;padding:3rem 2rem">
              <div style="font-size:3rem;margin-bottom:1rem">📋</div>
              <h2>Bạn đã làm bài kiểm tra này</h2>
              <div class="exam-result-score" style="margin:2rem 0">
                <div class="result-big-score">${result.score}</div>
                <div class="result-label">/ 10 điểm</div>
              </div>
              <p style="color:var(--text-muted)">Nộp lúc: ${new Date(result.submitted_at).toLocaleString('vi-VN')}</p>
              <a href="#/grades" class="btn btn-primary" style="margin-top:1rem">📋 Xem bảng điểm</a>
            </div>
          </div>
        `;
      } catch { location.hash = '#/grades'; }
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
