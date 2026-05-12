import { api } from '../../api.js';

export async function renderEbookChapter(app, { id }) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;
  
  const chapter = await api.get(`/ebook/chapters/${id}`);
  
  app.innerHTML = `
    <div class="container page">
      <div style="margin-bottom:1.5rem">
        <a href="#/ebook" class="btn btn-sm btn-ghost">← Mục lục eBook</a>
      </div>

      <div class="page-header">
        <span class="badge badge-accent">Chương ${chapter.chapter}</span>
        <h1 class="page-title" style="margin-top:0.5rem">${chapter.title}</h1>
        <p class="page-subtitle">Buổi ${chapter.sessions?.join(', ')} · ${chapter.concepts?.length || 0} khái niệm cốt lõi</p>
      </div>

      <!-- SCQA Framework -->
      <div style="margin-bottom:2.5rem">
        <h2 style="margin-bottom:1rem">🧭 Khung SCQA</h2>
        <div class="scqa-flow">
          <div class="scqa-step scqa-s">
            <div class="scqa-step-label">Situation — Bối cảnh</div>
            <p>${chapter.scqa?.situation || ''}</p>
          </div>
          <div class="scqa-step scqa-c">
            <div class="scqa-step-label">Complication — Vấn đề</div>
            <p>${chapter.scqa?.complication || ''}</p>
          </div>
          <div class="scqa-step scqa-q">
            <div class="scqa-step-label">Question — Câu hỏi trung tâm</div>
            <p><strong>${chapter.scqa?.question || ''}</strong></p>
          </div>
          <div class="scqa-step scqa-a">
            <div class="scqa-step-label">Answer — Câu trả lời</div>
            <p>${chapter.scqa?.answer || ''}</p>
          </div>
        </div>
      </div>

      <!-- Core Concepts -->
      <div style="margin-bottom:2.5rem">
        <h2 style="margin-bottom:1rem">💎 Khái niệm cốt lõi</h2>
        <div class="grid" style="gap:0.75rem">
          ${(chapter.concepts || []).map(c => `
            <div class="concept-card" id="concept-${c.id}">
              <span class="concept-term">${c.term}</span>
              <div>
                <p class="concept-def">${c.definition}</p>
                ${c.key_points ? `
                  <ul style="margin-top:0.5rem;padding-left:1.2rem;color:var(--text-secondary);font-size:0.88rem">
                    ${c.key_points.map(p => `<li>${p}</li>`).join('')}
                  </ul>
                ` : ''}
                ${c.case_study ? `
                  <div style="margin-top:0.75rem;padding:0.75rem 1rem;background:var(--info-light);border-radius:var(--radius-sm);border-left:3px solid var(--info)">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--info);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.3rem">📋 Case Study — ${c.case_study.title}</div>
                    <p style="font-size:0.88rem;color:var(--text-secondary)">${c.case_study.context}</p>
                    ${c.case_study.lesson_learned ? `
                      <p style="font-size:0.85rem;color:var(--text-primary);margin-top:0.4rem;font-weight:600">
                        → ${c.case_study.lesson_learned}
                      </p>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 3-Level Tests -->
      <div>
        <h2 style="margin-bottom:1rem">🧠 Active Recall — Tự kiểm tra</h2>
        <div class="grid grid-3">
          <a href="#/ebook/chapter/${id}/test/1" class="card" style="text-decoration:none;border-left:3px solid var(--level-1)">
            <div class="level-badge level-1" style="margin-bottom:0.5rem">🎯 Level 1</div>
            <h4>${chapter.tests?.level_1?.name || 'Nắm rõ khái niệm'}</h4>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.3rem">
              ${chapter.tests?.level_1?.description || 'Trắc nghiệm — Bạn nhớ đúng không?'}
            </p>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem">
              Bloom: ${chapter.tests?.level_1?.bloom_level || 'Remember'}
            </p>
          </a>
          <a href="#/ebook/chapter/${id}/test/2" class="card" style="text-decoration:none;border-left:3px solid var(--level-2)">
            <div class="level-badge level-2" style="margin-bottom:0.5rem">📝 Level 2</div>
            <h4>${chapter.tests?.level_2?.name || 'Giải thích'}</h4>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.3rem">
              ${chapter.tests?.level_2?.description || 'Tự luận — Giải thích bằng lời bạn'}
            </p>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem">
              Bloom: ${chapter.tests?.level_2?.bloom_level || 'Understand / Analyze'}
            </p>
          </a>
          <a href="#/ebook/chapter/${id}/test/3" class="card" style="text-decoration:none;border-left:3px solid var(--level-3)">
            <div class="level-badge level-3" style="margin-bottom:0.5rem">🚀 Level 3</div>
            <h4>${chapter.tests?.level_3?.name || 'Vận dụng'}</h4>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.3rem">
              ${chapter.tests?.level_3?.description || 'Lên kế hoạch thực tế'}
            </p>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem">
              Bloom: ${chapter.tests?.level_3?.bloom_level || 'Apply / Create'}
            </p>
          </a>
        </div>
      </div>

      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border)">
        ${parseInt(id) > 1 ? `<a href="#/ebook/chapter/${parseInt(id)-1}" class="btn btn-secondary">← Chương ${parseInt(id)-1}</a>` : '<div></div>'}
        ${parseInt(id) < 4 ? `<a href="#/ebook/chapter/${parseInt(id)+1}" class="btn btn-primary">Chương ${parseInt(id)+1} →</a>` : '<div></div>'}
      </div>
    </div>
  `;
}
