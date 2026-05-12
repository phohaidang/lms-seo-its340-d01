import { api, getUser } from '../api.js';

export async function renderLesson(app, { id }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;
  
  const user = getUser();
  const session = await api.get(`/courses/sessions/${id}`);
  
  // Parse chapter id from session (e.g. "Ch.1 §1.1" -> 1, "Ch.2" -> 2)
  const chapterMatch = session.chapter.match(/Ch\.(\d+)/i);
  const chapterId = chapterMatch ? parseInt(chapterMatch[1]) : 1;
  const isStudent = user.role !== 'admin';
    let ebookConceptsHTML = '';
  if (isStudent) {
    try {
      const allChapters = await api.get('/ebook/chapters');
      const chapterData = await api.get(`/ebook/chapters/${chapterId}`);
      if (chapterData && chapterData.chapter) {
         const concepts = chapterData.concepts || [];
         ebookConceptsHTML = concepts.map(c => `
           <div class="card" style="margin-bottom:1rem; border-left: 4px solid var(--primary-color)">
             <div class="card-header" style="padding-bottom: 0.5rem">
               <span class="badge badge-primary" style="font-size: 0.7rem">Khái niệm</span>
               <h4 style="margin: 0.3rem 0; color: var(--primary-color)">${c.term}</h4>
             </div>
             <div class="card-body" style="padding-top: 0">
               <p style="font-size: 0.92rem; margin-bottom: 0.5rem"><strong>Định nghĩa:</strong> ${c.definition}</p>
               <ul style="font-size: 0.88rem; color: var(--text-secondary); margin: 0; padding-left: 1.2rem">
                 ${c.key_points.map(kp => `<li>${kp}</li>`).join('')}
               </ul>
             </div>
           </div>
         `).join('');
      }
    } catch(err) {
      console.error("Failed fetching ebook data", err);
    }
    
    // Improved extraction logic for Student View
    try {
      const paddedId = id.toString().padStart(2, '0');
      const origHtmlReq = await fetch(`/lessons/Buoi_${paddedId}.html`);
      if (origHtmlReq.ok) {
         const rawHtml = await origHtmlReq.text();
         const parser = new DOMParser();
         const doc = parser.parseFromString(rawHtml, "text/html");
         
         const extractSection = (titleKeywords) => {
            // Find the header element that matches keywords (case-insensitive)
            const headers = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .section-label'));
            const element = headers.find(h => titleKeywords.some(k => h.textContent.toLowerCase().includes(k.toLowerCase())));
            
            if (element) {
               // Collect siblings until next header or HR
               const content = [];
               let current = element.nextElementSibling;
               while (current && !['H1', 'H2', 'H3', 'HR'].includes(current.tagName) && !current.classList.contains('section-label')) {
                  // Clean up potential absolute positioning or weird styles from original HTML
                  if (current.style) {
                     current.style.position = 'static';
                     current.style.width = 'auto';
                     current.style.margin = '1rem 0';
                  }
                  content.push(current.outerHTML);
                  current = current.nextElementSibling;
               }
               return content.join('').trim();
            }
            return null;
         };

         session.fullObjectives = extractSection(['Mục tiêu']);
         session.scqaContent = extractSection(['SCQA']);
         session.homeworkContent = extractSection(['Bài tập về nhà', 'BTVN']);
      }
    } catch(err) {
      console.error("Failed parsing HTML content", err);
    }
  }

  const paddedId = id.toString().padStart(2, '0');

  app.innerHTML = `
    <div class="container page">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:2rem">
        <div>
          <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem">
            <a href="#/course" class="btn btn-sm btn-ghost" style="padding-left:0">← Course Hub</a>
            <span class="badge badge-accent">Buổi ${session.id}</span>
            <span class="badge badge-info">${session.chapter}</span>
          </div>
          <h1 class="page-title">${session.title}</h1>
        </div>
        <div style="display:flex;gap:0.75rem">
          ${!isStudent ? `<button class="btn btn-secondary" id="btn-lesson" onclick="showTab('lesson')">📄 Kịch bản dạy</button>` : ''}
          ${!isStudent ? `<button class="btn btn-secondary" id="btn-slide" onclick="showTab('slide')">📊 Slide</button>` : ''}
          <a href="#/quiz/${session.id}" class="btn btn-primary">📝 Làm Quiz Online</a>
        </div>
      </div>

      <div id="content-lesson" class="content-tab" style="display: ${isStudent ? 'none' : 'block'}">
        ${!isStudent ? (session.hasLesson
          ? `<iframe src="/lessons/Buoi_${paddedId}.html" style="width:100%;height:80vh;border:1px solid var(--border);border-radius:var(--radius-md);background:white"></iframe>`
          : `<div class="alert alert-warning">Giáo án chưa được upload cho buổi này</div>`) : ''}
      </div>

      <div id="content-slide" class="content-tab" style="display:none">
        ${!isStudent ? (session.hasSlide
          ? `<embed src="/slides/Buoi_${paddedId}.pdf" type="application/pdf" style="width:100%;height:80vh;border:1px solid var(--border);border-radius:var(--radius-md)">`
          : `<div class="alert alert-warning">Slide chưa được convert cho buổi này</div>`) : ''}
      </div>

      ${isStudent ? `
      <div class="student-lesson-view">
         <!-- Section 1: Objectives & Context -->
         <div class="grid" style="grid-template-columns: 1.5fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem">
            <div class="card card-accent">
               <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.25rem">
                  <h3 style="margin:0; display:flex; align-items:center; gap:0.5rem">🎯 Mục tiêu buổi học</h3>
               </div>
               <div class="card-body" style="padding:0">
                  ${session.fullObjectives ? session.fullObjectives : `
                  <p><strong>Nội dung:</strong> ${session.topics}</p>
                  <p><strong>Chuẩn đầu ra:</strong> ${session.clo}</p>
                  `}
               </div>
            </div>
            
            <div class="card" style="background: var(--bg-secondary); border-style: dashed">
               <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.25rem">
                  <h3 style="margin:0; color: var(--warning)">💡 Bối cảnh thực tế</h3>
               </div>
               <div class="card-body" style="padding:0; font-size: 0.95rem; line-height: 1.7">
                  ${session.scqaContent || '<p class="text-muted">Đang cập nhật bối cảnh cho buổi học này...</p>'}
               </div>
            </div>
         </div>

         <!-- Section 2: Core Concepts -->
         <div style="margin-bottom: 2.5rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem">
               <div>
                  <h2 style="margin:0">📚 Hệ thống khái niệm cốt lõi</h2>
                  <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem">Trích xuất từ học liệu chuẩn của chương ${session.chapter}</p>
               </div>
            </div>
            <div class="concepts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem">
               ${ebookConceptsHTML || '<div class="alert alert-info">Chưa có khái niệm đặc thù cho phần này.</div>'}
            </div>
         </div>

         <!-- Section 3: Homework -->
         ${session.homeworkContent ? `
         <div class="card" style="background: var(--bg-glass); border: 2px solid var(--accent); position: relative; overflow: hidden">
            <div style="position:absolute; top:0; right:0; padding: 0.5rem 1rem; background: var(--accent); color:white; font-size: 0.7rem; font-weight:800; border-radius: 0 0 0 12px">NHIỆM VỤ</div>
            <div class="card-header" style="margin-bottom: 1rem">
               <h3 style="margin:0">🏠 Bài tập & Chuẩn bị</h3>
            </div>
            <div class="card-body" style="padding:0">
               ${session.homeworkContent}
            </div>
         </div>
         ` : ''}

         <!-- Anonymous Feedback Section -->
         <div id="feedback-section" style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border)">
            <div id="feedback-loading" style="text-align:center; padding: 2rem"><div class="spinner"></div></div>
         </div>
      </div>
: 2rem; border-top: 2px solid var(--border-color)">
           <div id="feedback-loading" style="text-align:center"><div class="spinner"></div></div>
         </div>
      </div>
      ` : `
      <!-- Admin: Feedback Summary + Analysis + Attendance for this session -->
      <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color)">
        <h3 style="margin-bottom: 1rem">💬 Phản hồi ẩn danh của Sinh viên — Buổi ${id}</h3>
        <div id="admin-feedback-summary">
          <div style="text-align:center"><div class="spinner"></div></div>
        </div>
      </div>
      <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color)">
        <h3 style="margin-bottom: 1rem">🔍 Phân tích Insight & Gợi ý Cải tiến — Buổi ${id}</h3>
        <div id="admin-analysis-panel">
          <div style="text-align:center"><div class="spinner"></div></div>
        </div>
      </div>
      <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color)">
        <h3 style="margin-bottom: 1rem">📋 Điểm danh qua Feedback — Buổi ${id}</h3>
        <div id="admin-attendance-panel">
          <div style="text-align:center"><div class="spinner"></div></div>
        </div>
      </div>
      `}
    </div>
  `;

  // ── Feedback Logic ──
  if (isStudent) {
    const fbSection = document.getElementById('feedback-section');
    try {
      const checkRes = await api.get(`/feedback/${id}/check`);
      if (checkRes.submitted) {
        fbSection.innerHTML = `
          <div class="card" style="text-align:center; padding: 2rem; background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))">
            <div style="font-size: 2.5rem; margin-bottom: 0.8rem">✅</div>
            <h3 style="margin-bottom: 0.4rem; color: var(--success-color)">Cảm ơn bạn đã góp ý!</h3>
            <p style="color: var(--text-secondary)">Phản hồi ẩn danh của bạn cho buổi này đã được ghi nhận.</p>
          </div>
        `;
      } else {
        fbSection.innerHTML = renderFeedbackForm(id);
        attachFeedbackHandlers(id, fbSection);
      }
    } catch {
      fbSection.innerHTML = renderFeedbackForm(id);
      attachFeedbackHandlers(id, fbSection);
    }
  } else {
    // Admin view: load feedback summary
    const summaryEl = document.getElementById('admin-feedback-summary');
    try {
      const allSummary = await api.get('/feedback/admin/summary');
      const sessionSummary = allSummary.find(s => parseInt(s.session_id) === parseInt(id));
      if (!sessionSummary || sessionSummary.total_responses === 0) {
        summaryEl.innerHTML = '<div class="alert alert-info">Chưa có phản hồi nào từ sinh viên cho buổi này.</div>';
      } else {
        const s = sessionSummary;
        const barStyle = (val) => `background: linear-gradient(90deg, var(--primary-color) ${val * 20}%, var(--bg-tertiary) ${val * 20}%); height: 8px; border-radius: 4px; margin: 0.3rem 0;`;
        summaryEl.innerHTML = `
          <div class="card" style="margin-bottom: 1.5rem">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem">
              <h4 style="margin: 0">📊 Tổng hợp ${s.total_responses} phản hồi</h4>
              <span class="badge badge-accent">${s.total_responses} sinh viên</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem">
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem">
                  <span>🧠 Mức độ hiểu bài</span>
                  <strong>${s.avg_understanding}/5</strong>
                </div>
                <div style="${barStyle(s.avg_understanding)}"></div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem">
                  <span>⏱ Tốc độ giảng dạy</span>
                  <strong>${s.avg_pace}/5</strong>
                </div>
                <div style="${barStyle(s.avg_pace)}"></div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem">
                  <span>💡 Mức hữu ích</span>
                  <strong>${s.avg_usefulness}/5</strong>
                </div>
                <div style="${barStyle(s.avg_usefulness)}"></div>
              </div>
            </div>
          </div>
          ${s.comments.length > 0 ? `
          <div class="card">
            <h4 style="margin-bottom: 1rem">💬 Góp ý từ sinh viên (${s.comments.length} bình luận)</h4>
            <div style="display: flex; flex-direction: column; gap: 0.8rem">
              ${s.comments.map(c => `
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid var(--primary-color); font-style: italic; line-height: 1.6">
                  "${c}"
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        `;
      }
    } catch(err) {
      summaryEl.innerHTML = '<div class="alert alert-warning">Không thể tải dữ liệu phản hồi.</div>';
    }

    // Admin view: load analysis
    const analysisEl = document.getElementById('admin-analysis-panel');
    try {
      const analysis = await api.get(`/feedback/admin/analysis/${id}`);
      if (!analysis.has_data) {
        analysisEl.innerHTML = '<div class="alert alert-info">Chưa có dữ liệu để phân tích cho buổi này.</div>';
      } else {
        const typeColors = { warning: '#ef4444', caution: '#f59e0b', success: '#10b981' };
        const themeLabels = {
          positive: { icon: '😊', label: 'Phản hồi tích cực', color: '#10b981' },
          difficulty: { icon: '😟', label: 'Phản ánh khó khăn', color: '#ef4444' },
          request: { icon: '📝', label: 'Yêu cầu / Đề xuất', color: '#8b5cf6' },
          pace_issue: { icon: '⏱', label: 'Về tốc độ giảng dạy', color: '#f59e0b' },
          practical: { icon: '🔧', label: 'Cần thêm thực hành', color: '#3b82f6' },
          general: { icon: '💭', label: 'Góp ý khác', color: '#6b7280' }
        };

        // Overall score banner
        let html = `
          <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, ${analysis.overall.color}15, ${analysis.overall.color}08); border-left: 4px solid ${analysis.overall.color}">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem">
              <div>
                <h4 style="margin: 0 0 0.3rem; color: ${analysis.overall.color}">${analysis.overall.label}</h4>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem">Điểm tổng hợp: <strong>${analysis.overall.score}/5</strong> · ${analysis.total_responses} phản hồi · ${analysis.total_comments} bình luận</p>
              </div>
              <div style="font-size: 3rem; line-height: 1">${analysis.overall.score >= 4 ? '🌟' : analysis.overall.score >= 3 ? '👍' : analysis.overall.score >= 2 ? '⚠️' : '🚨'}</div>
            </div>
          </div>
        `;

        // Metric Insights
        if (analysis.metricInsights.length > 0) {
          html += '<div style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 1.5rem">';
          analysis.metricInsights.forEach(insight => {
            const color = typeColors[insight.type] || '#6b7280';
            html += '<div class="card" style="padding: 1rem; border-left: 3px solid ' + color + '">'
              + '<div style="font-weight: 600; margin-bottom: 0.3rem">' + insight.icon + ' ' + insight.title + '</div>'
              + '<div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5">' + insight.detail + '</div>'
              + '</div>';
          });
          html += '</div>';
        }

        // Actionable Suggestions
        if (analysis.suggestions.length > 0) {
          html += '<div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.04))">';
          html += '<h4 style="margin: 0 0 1rem">🎯 Gợi ý Hành động Cải tiến</h4>';
          html += '<div style="display: flex; flex-direction: column; gap: 0.8rem">';
          analysis.suggestions.forEach(s => {
            html += '<div style="display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.8rem; background: var(--bg-app); border-radius: 8px">'
              + '<div style="font-size: 1.5rem; flex-shrink: 0">' + s.icon + '</div>'
              + '<div>'
              + '<div style="font-weight: 600; margin-bottom: 0.2rem">' + s.action + '</div>'
              + '<div style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5">' + s.detail + '</div>'
              + '</div></div>';
          });
          html += '</div></div>';
        }

        // Themed Comments
        const activeThemes = Object.entries(analysis.themes).filter(([_, arr]) => arr.length > 0);
        if (activeThemes.length > 0) {
          html += '<div class="card"><h4 style="margin: 0 0 1rem">📂 Bình luận phân loại theo chủ đề</h4>';
          activeThemes.forEach(([key, comments]) => {
            const t = themeLabels[key];
            html += '<div style="margin-bottom: 1.2rem">'
              + '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.5rem">'
              + '<span style="font-size: 1.1rem">' + t.icon + '</span>'
              + '<span style="font-weight: 600; color: ' + t.color + '">' + t.label + '</span>'
              + '<span class="badge" style="background: ' + t.color + '22; color: ' + t.color + '; font-size: 0.75rem">' + comments.length + '</span>'
              + '</div>'
              + '<div style="display: flex; flex-direction: column; gap: 0.4rem; padding-left: 1.5rem">';
            comments.forEach(c => {
              html += '<div style="padding: 0.6rem 0.8rem; background: var(--bg-tertiary); border-radius: 6px; font-size: 0.88rem; line-height: 1.5; font-style: italic; border-left: 2px solid ' + t.color + '40">'
                + '"' + c + '"</div>';
            });
            html += '</div></div>';
          });
          html += '</div>';
        }

        analysisEl.innerHTML = html;
      }
    } catch(err) {
      analysisEl.innerHTML = '<div class="alert alert-warning">Không thể tải dữ liệu phân tích.</div>';
    }

    // Admin view: load attendance
    const attendanceEl = document.getElementById('admin-attendance-panel');
    try {
      const allAttendance = await api.get('/feedback/admin/attendance');
      const sessionAttendance = allAttendance.find(a => parseInt(a.session_id) === parseInt(id));
      if (!sessionAttendance || sessionAttendance.total_present === 0) {
        attendanceEl.innerHTML = '<div class="alert alert-info">Chưa có sinh viên nào điểm danh cho buổi này.</div>';
      } else {
        const a = sessionAttendance;
        attendanceEl.innerHTML = `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem">
              <h4 style="margin: 0">✅ ${a.total_present} sinh viên có mặt</h4>
              <span class="badge badge-success">${a.total_present} điểm danh</span>
            </div>
            <div style="overflow-x: auto">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-color); text-align: left">
                    <th style="padding: 0.6rem 0.8rem">#</th>
                    <th style="padding: 0.6rem 0.8rem">MSSV</th>
                    <th style="padding: 0.6rem 0.8rem">Họ và Tên</th>
                    <th style="padding: 0.6rem 0.8rem">Ngày giờ điểm danh</th>
                  </tr>
                </thead>
                <tbody>
                  ${a.students.map((st, idx) => {
                    const dt = new Date(st.checked_in_at);
                    const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return `
                    <tr style="border-bottom: 1px solid var(--border-color)">
                      <td style="padding: 0.6rem 0.8rem">${idx + 1}</td>
                      <td style="padding: 0.6rem 0.8rem"><code>${st.student_id}</code></td>
                      <td style="padding: 0.6rem 0.8rem">${st.student_name}</td>
                      <td style="padding: 0.6rem 0.8rem">
                        <span class="badge badge-info">${dateStr}</span>
                        <span style="margin-left: 0.3rem; color: var(--text-secondary)">${timeStr}</span>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } catch(err) {
      attendanceEl.innerHTML = '<div class="alert alert-warning">Không thể tải dữ liệu điểm danh.</div>';
    }
  }

  window.showTab = (tab) => {
    document.querySelectorAll('.content-tab').forEach(el => el.style.display = 'none');
    document.getElementById(`content-${tab}`).style.display = 'block';
  };

  return () => { delete window.showTab; };
}

// ── Helper: Render feedback form HTML ──
function renderFeedbackForm(sessionId) {
  const scaleLabels = {
    understanding: ['😟 Rất khó hiểu', '😕 Khó hiểu', '😐 Bình thường', '😊 Dễ hiểu', '🤩 Rất dễ hiểu'],
    pace:          ['🐢 Quá chậm', '🚶 Hơi chậm', '👍 Vừa phải', '🏃 Hơi nhanh', '🚀 Quá nhanh'],
    usefulness:    ['😞 Không hữu ích', '🤔 Ít hữu ích', '😐 Tạm được', '😊 Hữu ích', '🌟 Rất hữu ích']
  };

  const renderScale = (name, labels) => `
    <div style="margin-bottom: 1.5rem">
      <label style="font-weight: 600; display: block; margin-bottom: 0.6rem">
        ${name === 'understanding' ? '🧠 Mức độ hiểu bài:' : name === 'pace' ? '⏱ Tốc độ giảng dạy:' : '💡 Buổi học hữu ích thế nào?'}
      </label>
      <div style="display: flex; gap: 0.4rem; flex-wrap: wrap">
        ${labels.map((lbl, i) => `
          <label style="flex: 1; min-width: 100px; cursor: pointer">
            <input type="radio" name="${name}" value="${i + 1}" style="display: none" class="fb-radio">
            <div class="fb-option" data-name="${name}" data-value="${i + 1}" style="
              text-align: center; padding: 0.6rem 0.4rem; border-radius: 8px;
              border: 2px solid var(--border-color); font-size: 0.8rem;
              transition: all 0.2s ease; user-select: none;
            ">
              ${lbl}
            </div>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  return `
    <div class="card" style="background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(236,72,153,0.05))">
      <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem">
        <div style="font-size: 2rem">💬</div>
        <div>
          <h3 style="margin: 0">Góp ý buổi học (Ẩn danh)</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.2rem 0 0">
            Phản hồi hoàn toàn ẩn danh — giúp giảng viên cải thiện chất lượng giảng dạy.
          </p>
        </div>
      </div>

      <form id="feedback-form">
        ${renderScale('understanding', scaleLabels.understanding)}
        ${renderScale('pace', scaleLabels.pace)}
        ${renderScale('usefulness', scaleLabels.usefulness)}

        <div style="margin-bottom: 1.5rem">
          <label style="font-weight: 600; display: block; margin-bottom: 0.6rem">
            ✍️ Cảm nghĩ hoặc góp ý thêm <span style="color: var(--text-secondary); font-weight: 400">(không bắt buộc)</span>
          </label>
          <textarea id="fb-comment" rows="4" placeholder="Ví dụ: Em muốn thầy/cô giải thích thêm phần..., Buổi học hôm nay em thấy..." 
            style="width: 100%; padding: 0.8rem 1rem; border: 2px solid var(--border-color); border-radius: 8px;
            background: var(--bg-app); color: var(--text-primary); font-size: 0.95rem; resize: vertical;
            font-family: inherit; line-height: 1.5; transition: border-color 0.2s"
          ></textarea>
          <div style="text-align: right; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem">
            <span id="fb-char-count">0</span>/1000 ký tự
          </div>
        </div>

        <button type="submit" id="fb-submit" class="btn btn-primary" style="width: 100%; padding: 0.8rem; font-size: 1rem">
          🔒 Gửi đánh giá ẩn danh
        </button>
      </form>
    </div>
  `;
}

// ── Helper: Attach event listeners for feedback form ──
function attachFeedbackHandlers(sessionId, container) {
  // Scale option click handler
  container.querySelectorAll('.fb-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const name = opt.dataset.name;
      // Clear siblings
      container.querySelectorAll(`.fb-option[data-name="${name}"]`).forEach(sib => {
        sib.style.borderColor = 'var(--border-color)';
        sib.style.background = 'transparent';
        sib.style.fontWeight = 'normal';
      });
      // Highlight selected
      opt.style.borderColor = 'var(--primary-color)';
      opt.style.background = 'rgba(99,102,241,0.1)';
      opt.style.fontWeight = '600';
      // Check the hidden radio
      opt.closest('label').querySelector('input').checked = true;
    });
  });

  // Character counter
  const textarea = container.querySelector('#fb-comment');
  const counter = container.querySelector('#fb-char-count');
  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      counter.textContent = len;
      counter.style.color = len > 900 ? '#ef4444' : 'var(--text-secondary)';
      if (len > 1000) textarea.value = textarea.value.substring(0, 1000);
    });
  }

  // Submit
  const form = container.querySelector('#feedback-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const understanding = form.querySelector('input[name="understanding"]:checked')?.value;
    const pace = form.querySelector('input[name="pace"]:checked')?.value;
    const usefulness = form.querySelector('input[name="usefulness"]:checked')?.value;
    const comment = form.querySelector('#fb-comment')?.value || '';

    if (!understanding || !pace || !usefulness) {
      alert('Vui lòng chọn đánh giá cho cả 3 câu khảo sát trước khi gửi.');
      return;
    }

    const btn = form.querySelector('#fb-submit');
    btn.disabled = true;
    btn.textContent = '⏳ Đang gửi...';

    try {
      const res = await api.post(`/feedback/${sessionId}`, { understanding, pace, usefulness, comment });
      container.innerHTML = `
        <div class="card" style="text-align:center; padding: 2rem; background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem">✅</div>
          <h3 style="margin-bottom: 0.4rem; color: var(--success-color)">Cảm ơn bạn đã góp ý!</h3>
          <p style="color: var(--text-secondary)">${res.message}</p>
        </div>
      `;
    } catch (err) {
      alert('Lỗi: ' + err.message);
      btn.disabled = false;
      btn.textContent = '🔒 Gửi đánh giá ẩn danh';
    }
  });
}
