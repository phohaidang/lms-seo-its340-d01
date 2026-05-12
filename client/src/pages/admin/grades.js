import { api } from '../../api.js';

export async function renderAdminGrades(app) {
  app.innerHTML = `<div class="container page"><div class="loading"><div class="spinner"></div></div></div>`;

  const grades = await api.get('/grades/admin/all');

  app.innerHTML = `
    <div class="container page">
      <div class="page-header">
        <h1 class="page-title">📋 Quản lý điểm</h1>
        <p class="page-subtitle">Nhập điểm chuyên cần, tiểu luận, thi cuối kỳ</p>
      </div>

      <div class="alert alert-info" style="margin-bottom:1.5rem">
        Cơ cấu: Chuyên cần 10% + KT Giữa kỳ 20% + Tiểu luận 20% + Thi cuối kỳ 50%
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th>Chuyên cần</th>
              <th>KT Giữa kỳ</th>
              <th>Tiểu luận</th>
              <th>Thi CK</th>
              <th>Tổng</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${grades.map(g => `
              <tr id="row-${g.student_id}">
                <td><code>${g.student_id}</code></td>
                <td>${g.full_name}</td>
                <td><input type="number" class="form-input" style="width:70px;padding:0.3rem 0.5rem" data-sid="${g.student_id}" data-field="attendance" value="${g.manual?.attendance || ''}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="form-input" style="width:70px;padding:0.3rem 0.5rem" data-sid="${g.student_id}" data-field="midterm_essay" value="${g.manual?.midterm_essay || ''}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="form-input" style="width:70px;padding:0.3rem 0.5rem" data-sid="${g.student_id}" data-field="group_project" value="${g.manual?.group_project || ''}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="form-input" style="width:70px;padding:0.3rem 0.5rem" data-sid="${g.student_id}" data-field="final_exam" value="${g.manual?.final_exam || ''}" min="0" max="10" step="0.5"></td>
                <td><strong>${g.manual?.total_score ?? '—'}</strong></td>
                <td><button class="btn btn-sm btn-primary" onclick="saveGrade('${g.student_id}')">💾</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  window.saveGrade = async (studentId) => {
    const row = document.getElementById(`row-${studentId}`);
    const data = { student_id: studentId };
    
    row.querySelectorAll('input').forEach(input => {
      if (input.value) data[input.dataset.field] = parseFloat(input.value);
    });

    try {
      const result = await api.post('/grades/admin/manual', data);
      const totalCell = row.querySelector('td:nth-child(7) strong');
      totalCell.textContent = result.data.total_score;
      
      const btn = row.querySelector('button');
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = '💾'; }, 1500);
    } catch (err) {
      alert(err.message);
    }
  };

  return () => { delete window.saveGrade; };
}
