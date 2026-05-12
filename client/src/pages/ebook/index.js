import { api } from '../../api.js';

export async function renderEbookIndex(app) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  try {
    const data = await api.get('/ebook/chapters');
    
    app.innerHTML = `
      <div class="container page">
        <div class="page-header">
          <h1 class="page-title">📖 eBook — Giới thiệu Khoa học máy tính</h1>
          <p class="page-subtitle">Học theo khung SCQA · Active Recall 3 cấp độ · Bloom's Taxonomy</p>
        </div>

        <div class="grid" style="gap:1.5rem">
          ${data.chapters.map(ch => {
            const progress = ch.progress;
            const conceptPercent = ch.total_concepts > 0
              ? Math.round((progress.concepts_read / ch.total_concepts) * 100) : 0;
            
            return `
              <div class="card" style="cursor:pointer" onclick="location.hash='#/ebook/chapter/${ch.chapter}'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">
                  <div>
                    <span class="badge badge-accent">Chương ${ch.chapter}</span>
                    <h3 style="margin-top:0.5rem">${ch.title}</h3>
                    <p style="color:var(--text-secondary);font-size:0.88rem;margin-top:0.3rem">
                      Buổi ${ch.sessions.join(', ')} · ${ch.total_concepts} khái niệm
                    </p>
                  </div>
                </div>

                <p style="color:var(--text-muted);font-size:0.85rem;font-style:italic;margin-bottom:1rem">
                  "${ch.scqa_preview}"
                </p>

                <div style="margin-bottom:0.75rem">
                  <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:0.3rem">
                    <span>Đã đọc ${progress.concepts_read}/${ch.total_concepts}</span>
                    <span>${conceptPercent}%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${conceptPercent}%"></div>
                  </div>
                </div>

                <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                  <a href="#/ebook/chapter/${ch.chapter}/test/1" class="level-badge level-1" onclick="event.stopPropagation()">
                    🎯 Level 1 ${progress.level_1_score !== null ? `— ${progress.level_1_score}/10` : ''}
                  </a>
                  <a href="#/ebook/chapter/${ch.chapter}/test/2" class="level-badge level-2" onclick="event.stopPropagation()">
                    📝 Level 2 ${progress.level_2_status === 'completed' ? '✅' : progress.level_2_status === 'submitted' ? '🟡' : ''}
                  </a>
                  <a href="#/ebook/chapter/${ch.chapter}/test/3" class="level-badge level-3" onclick="event.stopPropagation()">
                    🚀 Level 3 ${progress.level_3_status === 'completed' ? '✅' : progress.level_3_status === 'submitted' ? '🟡' : ''}
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${data.chapters.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📖</div>
            <h3>eBook đang được chuẩn bị</h3>
            <p>Giảng viên sẽ cập nhật nội dung sớm</p>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    app.innerHTML = `
      <div class="container page">
        <div class="alert alert-warning">
          eBook đang được chuẩn bị. Vui lòng quay lại sau.
        </div>
        <a href="#/dashboard" class="btn btn-secondary">← Về Dashboard</a>
      </div>
    `;
  }
}
