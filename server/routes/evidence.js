import { Router } from 'express';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import db from '../services/sheets.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EVIDENCE_DIR = join(__dirname, '..', '..', 'data', 'evidence');

// Ensure evidence dir exists
if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });

const router = Router();

/**
 * GET /api/evidence/exams/:examId/export
 * Admin: export all exam attempts as Excel + ZIP
 */
router.get('/exams/:examId/export', authenticate, adminOnly, async (req, res) => {
  try {
    const examId = req.params.examId;
    const attempts = await db.find('exam_attempts', a => a.exam_id === examId);

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Chưa có bài làm nào cho kỳ thi này' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Hub — ITS717';
    workbook.created = new Date();

    // ── Sheet 1: Summary ──
    const summary = workbook.addWorksheet('Tổng kết', {
      properties: { tabColor: { argb: '7C3AED' } }
    });

    summary.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'MSSV', key: 'student_id', width: 15 },
      { header: 'Họ tên', key: 'student_name', width: 25 },
      { header: 'Đề', key: 'variant', width: 6 },
      { header: 'Số câu đúng', key: 'correct', width: 13 },
      { header: 'Tổng câu', key: 'total', width: 10 },
      { header: 'Điểm (thang 10)', key: 'score', width: 16 },
      { header: 'Thời gian làm (phút)', key: 'duration', width: 20 },
      { header: 'Thời gian nộp', key: 'submitted_at', width: 22 },
      { header: 'IP', key: 'ip', width: 18 }
    ];

    // Header style
    summary.getRow(1).font = { bold: true, size: 11 };
    summary.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'EDE9FE' }
    };

    attempts.forEach((a, idx) => {
      summary.addRow({
        stt: idx + 1,
        student_id: a.student_id,
        student_name: a.student_name,
        variant: parseInt(a.variant),
        correct: parseInt(a.correct_count),
        total: parseInt(a.total_questions),
        score: parseFloat(a.score),
        duration: a.duration_seconds ? Math.round(parseInt(a.duration_seconds) / 60 * 10) / 10 : '—',
        submitted_at: new Date(a.submitted_at).toLocaleString('vi-VN'),
        ip: a.ip_address || '—'
      });
    });

    // Stats row
    const scores = attempts.map(a => parseFloat(a.score));
    const avgScore = (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    summary.addRow({});
    summary.addRow({ student_id: 'TB', score: parseFloat(avgScore) });
    summary.addRow({ student_id: 'Cao nhất', score: maxScore });
    summary.addRow({ student_id: 'Thấp nhất', score: minScore });
    summary.addRow({ student_id: 'Tổng SV', score: attempts.length });

    // ── Sheet 2: Detail (each student's answers) ──
    const detail = workbook.addWorksheet('Chi tiết bài làm', {
      properties: { tabColor: { argb: '10B981' } }
    });

    detail.columns = [
      { header: 'MSSV', key: 'student_id', width: 15 },
      { header: 'Họ tên', key: 'student_name', width: 25 },
      { header: 'Câu hỏi ID', key: 'question_id', width: 15 },
      { header: 'Đáp án SV chọn', key: 'student_answer', width: 16 },
      { header: 'Đáp án đúng', key: 'correct_answer', width: 14 },
      { header: 'Kết quả', key: 'result', width: 10 }
    ];

    detail.getRow(1).font = { bold: true, size: 11 };
    detail.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'D1FAE5' }
    };

    // Load exam to get correct answers
    const { readFileSync } = await import('fs');
    const examData = JSON.parse(readFileSync(
      join(__dirname, '..', 'data', 'exams', `${examId}.json`), 'utf-8'
    ));

    for (const attempt of attempts) {
      let studentAnswers = [];
      try { studentAnswers = JSON.parse(attempt.answers_submitted); } catch {}

      const variant = examData.variants[(parseInt(attempt.variant) || 1) - 1];
      if (!variant) continue;

      for (const ans of studentAnswers) {
        const question = variant.questions.find(q => q.id === ans.question_id);
        detail.addRow({
          student_id: attempt.student_id,
          student_name: attempt.student_name,
          question_id: ans.question_id,
          student_answer: ans.selected || '(không trả lời)',
          correct_answer: question?.correct || '?',
          result: ans.selected === question?.correct ? '✓ Đúng' : '✗ Sai'
        });
      }
    }

    // ── Sheet 3: Statistics ──
    const stats = workbook.addWorksheet('Thống kê', {
      properties: { tabColor: { argb: 'F59E0B' } }
    });

    stats.columns = [
      { header: 'Thống kê', key: 'label', width: 30 },
      { header: 'Giá trị', key: 'value', width: 20 }
    ];

    stats.getRow(1).font = { bold: true, size: 11 };

    stats.addRow({ label: 'Mã đề thi', value: examId });
    stats.addRow({ label: 'Tên bài thi', value: examData.title });
    stats.addRow({ label: 'Phạm vi', value: examData.scope });
    stats.addRow({ label: 'Thời gian (phút)', value: examData.time_limit_minutes });
    stats.addRow({ label: 'Tổng sinh viên', value: attempts.length });
    stats.addRow({ label: 'Điểm trung bình', value: parseFloat(avgScore) });
    stats.addRow({ label: 'Điểm cao nhất', value: maxScore });
    stats.addRow({ label: 'Điểm thấp nhất', value: minScore });
    stats.addRow({ label: 'Tỷ lệ >= 5.0', value: `${scores.filter(s => s >= 5).length}/${scores.length} (${Math.round(scores.filter(s => s >= 5).length / scores.length * 100)}%)` });
    stats.addRow({ label: 'Tỷ lệ >= 8.0', value: `${scores.filter(s => s >= 8).length}/${scores.length} (${Math.round(scores.filter(s => s >= 8).length / scores.length * 100)}%)` });
    stats.addRow({ label: 'Ngày xuất', value: new Date().toLocaleString('vi-VN') });

    // Send as Excel download
    const filename = `evidence_${examId}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Evidence export error:', err);
    res.status(500).json({ error: 'Lỗi xuất minh chứng: ' + err.message });
  }
});

/**
 * GET /api/evidence/quizzes/export
 * Admin: export all quiz attempts as Excel
 */
router.get('/quizzes/export', authenticate, adminOnly, async (req, res) => {
  try {
    const attempts = await db.getAll('quiz_attempts');
    const students = await db.getAll('students');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Hub — ITS717';

    const sheet = workbook.addWorksheet('Quiz Results');
    sheet.columns = [
      { header: 'MSSV', key: 'student_id', width: 15 },
      { header: 'Họ tên', key: 'student_name', width: 25 },
      ...Array.from({ length: 9 }, (_, i) => ({
        header: `Buổi ${i + 1}`, key: `s${i + 1}`, width: 10
      })),
      { header: 'TB Quiz', key: 'avg', width: 10 }
    ];

    sheet.getRow(1).font = { bold: true, size: 11 };
    sheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'DBEAFE' }
    };

    const studentMap = {};
    for (const s of students.filter(s => s.role !== 'admin')) {
      studentMap[s.student_id] = { name: s.full_name, scores: {} };
    }

    for (const a of attempts) {
      if (studentMap[a.student_id]) {
        studentMap[a.student_id].scores[parseInt(a.session_number)] = parseFloat(a.score);
      }
    }

    for (const [sid, data] of Object.entries(studentMap)) {
      const row = { student_id: sid, student_name: data.name };
      let total = 0, count = 0;
      for (let i = 1; i <= 9; i++) {
        row[`s${i}`] = data.scores[i] ?? '—';
        if (data.scores[i] !== undefined) { total += data.scores[i]; count++; }
      }
      row.avg = count > 0 ? Math.round(total / count * 100) / 100 : '—';
      sheet.addRow(row);
    }

    const filename = `quiz_results_all_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Quiz export error:', err);
    res.status(500).json({ error: 'Lỗi xuất dữ liệu quiz' });
  }
});

/**
 * GET /api/evidence/overview
 * Admin: get evidence overview (what's available)
 */
router.get('/overview', authenticate, adminOnly, async (req, res) => {
  try {
    const examAttempts = await db.getAll('exam_attempts');
    const quizAttempts = await db.getAll('quiz_attempts');
    const students = await db.getAll('students');

    const exams = {};
    for (const a of examAttempts) {
      if (!exams[a.exam_id]) exams[a.exam_id] = { count: 0, scores: [] };
      exams[a.exam_id].count++;
      exams[a.exam_id].scores.push(parseFloat(a.score));
    }

    res.json({
      total_students: students.filter(s => s.role !== 'admin').length,
      total_quiz_attempts: quizAttempts.length,
      exams: Object.entries(exams).map(([id, data]) => ({
        exam_id: id,
        total_submissions: data.count,
        avg_score: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length * 100) / 100,
        exportable: true
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

export default router;
