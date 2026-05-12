import { Router } from 'express';
import db from '../services/sheets.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/grades/me
 * Student: view own grades
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Quiz scores
    const quizAttempts = await db.find('quiz_attempts',
      a => a.student_id === req.user.student_id
    );
    
    // Exam scores
    const examAttempts = await db.find('exam_attempts',
      a => a.student_id === req.user.student_id
    );
    
    // Manual grades (attendance, group project, final)
    const manual = await db.findOne('manual_grades',
      g => g.student_id === req.user.student_id
    );
    
    res.json({
      quizzes: quizAttempts.map(a => ({
        session: parseInt(a.session_number),
        score: parseFloat(a.score),
        submitted_at: a.submitted_at
      })),
      exams: examAttempts.map(a => ({
        exam_id: a.exam_id,
        score: parseFloat(a.score),
        submitted_at: a.submitted_at
      })),
      manual: manual ? {
        attendance: manual.attendance ? parseFloat(manual.attendance) : null,
        midterm_essay: manual.midterm_essay ? parseFloat(manual.midterm_essay) : null,
        group_project: manual.group_project ? parseFloat(manual.group_project) : null,
        final_exam: manual.final_exam ? parseFloat(manual.final_exam) : null,
        total_score: manual.total_score ? parseFloat(manual.total_score) : null
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/grades/admin/all
 * Admin: view all student grades
 */
router.get('/admin/all', authenticate, adminOnly, async (req, res) => {
  try {
    const students = await db.getAll('students');
    const quizAttempts = await db.getAll('quiz_attempts');
    const examAttempts = await db.getAll('exam_attempts');
    const manualGrades = await db.getAll('manual_grades');
    
    const grades = students
      .filter(s => s.role !== 'admin')
      .map(s => {
        const studentQuizzes = quizAttempts.filter(a => a.student_id === s.student_id);
        const studentExams = examAttempts.filter(a => a.student_id === s.student_id);
        const manual = manualGrades.find(g => g.student_id === s.student_id);
        
        const avgQuiz = studentQuizzes.length > 0
          ? studentQuizzes.reduce((sum, a) => sum + parseFloat(a.score), 0) / studentQuizzes.length
          : null;
        
        return {
          student_id: s.student_id,
          full_name: s.full_name,
          email: s.email,
          quiz_avg: avgQuiz ? Math.round(avgQuiz * 100) / 100 : null,
          quiz_count: studentQuizzes.length,
          exams: studentExams.map(e => ({ exam_id: e.exam_id, score: parseFloat(e.score) })),
          manual: manual || null
        };
      });
    
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * POST /api/grades/admin/manual
 * Admin: set manual grades for a student
 */
router.post('/admin/manual', authenticate, adminOnly, async (req, res) => {
  try {
    const { student_id, attendance, midterm_essay, group_project, final_exam } = req.body;
    
    if (!student_id) {
      return res.status(400).json({ error: 'Thiếu MSSV' });
    }
    
    const existing = await db.findOne('manual_grades', g => g.student_id === student_id);
    
    const data = {
      student_id,
      attendance: attendance ?? existing?.attendance ?? '',
      midterm_essay: midterm_essay ?? existing?.midterm_essay ?? '',
      group_project: group_project ?? existing?.group_project ?? '',
      final_exam: final_exam ?? existing?.final_exam ?? '',
      updated_at: new Date().toISOString()
    };
    
    // Calculate total (weights: attendance 10%, midterm 20%, group 20%, final 50%)
    const a = parseFloat(data.attendance) || 0;
    const m = parseFloat(data.midterm_essay) || 0;
    const g = parseFloat(data.group_project) || 0;
    const f = parseFloat(data.final_exam) || 0;
    data.total_score = Math.round((a * 0.1 + m * 0.2 + g * 0.2 + f * 0.5) * 100) / 100;
    
    if (existing) {
      await db.update('manual_grades', g => g.student_id === student_id, data);
    } else {
      await db.append('manual_grades', data);
    }
    
    res.json({ message: 'Cập nhật điểm thành công', data });
  } catch (err) {
    console.error('Grade update error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

export default router;
