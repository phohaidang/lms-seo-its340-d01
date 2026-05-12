import { api, getUser } from '../api.js';

export async function renderCourse(app) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;
  const user = getUser() || {};
  
  const data = await api.get('/courses/sessions');
  const quizAttempts = await api.get('/quizzes/my/attempts');
  
  const quizMap = {};
  quizAttempts.forEach(a => { quizMap[a.session_number] = a; });

  // Check attendance
  let attendanceSet = new Set();
  try {
    const attendanceData = await api.get('/feedback/my-attendance');
    attendanceSet = new Set(attendanceData);
  } catch {}

  // Check exam results
  const examResults = {};
  for (const s of data.sessions) {
    if (s.hasExam && s.examId) {
      try {
        const result = await api.get(`/exams/${s.examId}/my-result`);
        examResults[s.examId] = result;
      } catch {}
    }
  }

  app.innerHTML = `
    <div class="container page">
      <div class="page-header">
        <h1 class="page-title">📚 ${data.course.name}</h1>
        <p class="page-subtitle">${data.course.code} — ${data.course.total_sessions} buổi học · ${data.course.chapters} chương</p>
      </div>
      
      ${user.role === 'admin' ? `
      <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color)">
        <h3 style="margin-bottom: 1rem">🛠 Công cụ quyền Quản trị (Giảng viên)</h3>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap">
          <a href="/api/quizzes/admin/export-overview" target="_blank" class="btn btn-secondary">
            📥 Tải Tổng Hợp Quizz (Word)
          </a>
          <button class="btn btn-primary" id="btnStatsModal">
            📊 Thống Kê Quizz Sinh Viên
          </button>
        </div>
      </div>
      ` : ''}

      <div class="course-timeline">
        ${data.sessions.map(s => {
          const quiz = quizMap[s.id];
          const examResult = s.examId ? examResults[s.examId] : null;
          return `
            <div class="card" style="margin-bottom: 1rem; cursor: pointer" onclick="location.hash='#/course/lesson/${s.id}'">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem">
                <div>
                  <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.4rem">
                    <span class="badge badge-accent">Buổi ${s.id}</span>
                    <span class="badge badge-info">${s.chapter}</span>
                    ${user.role === 'student' ? (
                      attendanceSet.has(s.id) 
                        ? '<span class="badge badge-success">✅ Có mặt</span>' 
                        : '<span class="badge badge-danger">❌ Vắng</span>'
                    ) : ''}
                    ${s.hasExam ? '<span class="badge badge-danger">Có kiểm tra</span>' : ''}
                  </div>
                  <h3 style="margin-bottom:0.3rem">${s.title}</h3>
                  <p style="color:var(--text-secondary);font-size:0.88rem">${s.topics}</p>
                </div>
                <div style="display:flex; gap:0.5rem; flex-shrink:0; flex-wrap:wrap; align-items:center">
                  <a href="#/course/lesson/${s.id}" class="btn btn-sm btn-secondary" onclick="event.stopPropagation()">📄 Chi tiết</a>
                  ${quiz
                    ? `<span class="badge badge-success">Quiz: ${quiz.score}/10</span>`
                    : `<a href="#/quiz/${s.id}" class="btn btn-sm btn-primary" onclick="event.stopPropagation()">📝 Làm Quiz</a>`
                  }
                  ${s.hasExam && s.examId ? (
                    user.role === 'admin' 
                      ? `<a href="/api/exams/${s.examId}/export-word" target="_blank" class="btn btn-sm btn-secondary" onclick="event.stopPropagation()">📥 Giảng viên: Tải Đề Word</a>`
                      : (examResult
                          ? `<span class="badge badge-success">KT: ${examResult.score}/10</span>`
                          : `<a href="#/exam/${s.examId}" class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#ef4444,#f97316);box-shadow:0 2px 12px rgba(239,68,68,0.3)" onclick="event.stopPropagation()">🏫 Vào phòng thi</a>`)
                  ) : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Admin stats modal logic
  if (user.role === 'admin') {
    const btnStats = document.getElementById('btnStatsModal');
    if (btnStats) {
      btnStats.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        let existingModal = document.getElementById('admin-stats-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'admin-stats-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        
        modal.innerHTML = `
          <div class="card" style="width: 90%; max-width: 800px; max-height: 80vh; overflow-y: auto; background: var(--bg-card); position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.15)">
             <button id="closeStats" style="position: absolute; right: 1.5rem; top: 1.5rem; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary)">&times;</button>
             <h2 style="margin-bottom: 1.5rem; padding-right: 2rem">📊 Tần suất làm sai Quizz của Sinh viên</h2>
             <div id="stats-content" style="min-height: 200px; display: flex; flex-direction: column;">
               <div style="flex:1; display:flex; align-items:center; justify-content:center"><div class="spinner"></div></div>
             </div>
          </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('closeStats').addEventListener('click', () => modal.remove());
        
        try {
          const stats = await api.get('/quizzes/admin/statistics');
          let html = '';
          stats.forEach(st => {
            if (st.topMissed.length > 0) {
               html += `
                 <div style="margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h3 style="color: var(--primary-color);">Buổi ${st.session}: ${st.title}</h3>
                    <ul style="list-style: none; padding: 0; margin-top: 1rem;">
                       ${st.topMissed.map((q, idx) => `
                          <li style="margin-bottom: 0.8rem; padding: 1rem; background: var(--bg-app); border-radius: 8px;">
                             <strong style="color: #ef4444; display:block; margin-bottom:0.4rem">
                                Top ${idx + 1} (${q.count} lượt sai)
                             </strong> 
                             <div style="line-height: 1.5">${q.question}</div>
                          </li>
                       `).join('')}
                    </ul>
                 </div>
               `;
            }
          });
          
          if (!html) html = '<p style="text-align:center; margin-top:2rem">Chưa có dữ liệu bài làm làm sai của sinh viên.</p>';
          document.getElementById('stats-content').innerHTML = html;
          document.getElementById('stats-content').style.display = 'block'; // reset flex
        } catch(err) {
          document.getElementById('stats-content').innerHTML = '<p style="color:red; text-align:center">Lỗi lấy dữ liệu thống kê!</p>';
        }
      });
    }
  }
}

