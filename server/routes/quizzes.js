import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/sheets.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const QUESTIONS_DIR = join(__dirname, '..', 'data', 'questions');

/**
 * Load question bank for a session
 */
function loadQuestions(sessionId) {
  const filePath = join(QUESTIONS_DIR, `session-${sessionId}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const router = Router();

/**
 * GET /api/quizzes/:sessionId
 * Get quiz questions for a session (shuffled, NO correct answers)
 */
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const bank = loadQuestions(sessionId);
    
    if (!bank) {
      return res.status(404).json({ error: 'Chưa có quiz cho buổi học này' });
    }
    
    // Check if already attempted
    const existing = await db.findOne('quiz_attempts',
      a => a.student_id === req.user.student_id && parseInt(a.session_number) === sessionId
    );
    
    if (existing) {
      return res.status(409).json({
        error: 'Bạn đã làm quiz này rồi',
        attempt: {
          score: existing.score,
          total_questions: existing.total_questions,
          correct_count: existing.correct_count,
          submitted_at: existing.submitted_at
        }
      });
    }
    
    // Shuffle questions and options, strip correct answers
    const questions = shuffle(bank.questions).map(q => {
      const sanitized = {
        id: q.id,
        type: q.type,
        question: q.question
      };
      
      if (q.type === 'mc') {
        sanitized.options = shuffle(q.options);
      }
      
      return sanitized;
    });
    
    res.json({
      session: sessionId,
      chapter: bank.chapter,
      title: bank.title,
      time_limit_minutes: bank.time_limit_minutes || 10,
      total_questions: questions.length,
      questions
    });
  } catch (err) {
    console.error('Quiz get error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * POST /api/quizzes/:sessionId/submit
 * Submit quiz answers — graded server-side
 */
router.post('/:sessionId/submit', authenticate, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { answers } = req.body;
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Vui lòng gửi câu trả lời' });
    }
    
    // Check duplicate
    const existing = await db.findOne('quiz_attempts',
      a => a.student_id === req.user.student_id && parseInt(a.session_number) === sessionId
    );
    if (existing) {
      return res.status(409).json({ error: 'Bạn đã làm quiz này rồi' });
    }
    
    // Load answer key (server-side only)
    const bank = loadQuestions(sessionId);
    if (!bank) {
      return res.status(404).json({ error: 'Không tìm thấy quiz' });
    }
    
    // Grade
    let correctCount = 0;
    const totalQuestions = bank.questions.length;
    
    for (const ans of answers) {
      const question = bank.questions.find(q => q.id === ans.question_id);
      if (!question) continue;
      
      if (question.type === 'mc' && ans.selected === question.correct) {
        correctCount++;
      } else if (question.type === 'tf' && ans.selected === question.correct) {
        correctCount++;
      }
    }
    
    const score = Math.round((correctCount / totalQuestions) * 10 * 100) / 100;
    
    // Save attempt
    const attempt = {
      attempt_id: uuidv4(),
      student_id: req.user.student_id,
      session_number: sessionId,
      answers_json: JSON.stringify(answers),
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      submitted_at: new Date().toISOString()
    };
    
    await db.append('quiz_attempts', attempt);
    
    // Return score ONLY (no correct answers)
    res.json({
      message: 'Nộp bài thành công!',
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      submitted_at: attempt.submitted_at
    });
  } catch (err) {
    console.error('Quiz submit error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/quizzes/my/attempts
 * Get all quiz attempts for current student
 */
router.get('/my/attempts', authenticate, async (req, res) => {
  try {
    const attempts = await db.find('quiz_attempts',
      a => a.student_id === req.user.student_id
    );
    
    res.json(attempts.map(a => ({
      session_number: parseInt(a.session_number),
      score: parseFloat(a.score),
      total_questions: parseInt(a.total_questions),
      correct_count: parseInt(a.correct_count),
      submitted_at: a.submitted_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/quizzes/admin/statistics
 * Get top 5 missed questions per session
 */
router.get('/admin/statistics', authenticate, adminOnly, async (req, res) => {
  try {
    const attempts = await db.find('quiz_attempts', () => true);
    
    // Group missed questions
    const missedCounts = {}; // { [sessionId]: { [questionId]: count } }
    
    for (const attempt of attempts) {
      const sessionId = attempt.session_number;
      if (!missedCounts[sessionId]) missedCounts[sessionId] = {};
      
      let answers = [];
      try { answers = JSON.parse(attempt.answers_json); } catch(e){}
      
      const bank = loadQuestions(sessionId);
      if (!bank) continue;
      
      for (const ans of answers) {
         const q = bank.questions.find(x => x.id === ans.question_id);
         if (!q) continue;
         if (ans.selected !== q.correct) {
            missedCounts[sessionId][ans.question_id] = (missedCounts[sessionId][ans.question_id] || 0) + 1;
         }
      }
    }
    
    // Format response
    const stats = [];
    for (let i = 1; i <= 9; i++) {
       const bank = loadQuestions(i);
       if (!bank) continue;
       
       const countsForSession = missedCounts[i] || {};
       
       // Map to array and sort
       const missedArr = Object.entries(countsForSession).map(([qId, count]) => {
           const qDef = bank.questions.find(x => x.id === qId);
           return {
               id: qId,
               question: qDef ? qDef.question : "Unknown",
               count: count
           };
       });
       
       missedArr.sort((a, b) => b.count - a.count);
       
       stats.push({
           session: i,
           title: bank.title,
           topMissed: missedArr.slice(0, 5) // Top 5
       });
    }
    
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Lỗi lấy thống kê' });
  }
});

/**
 * GET /api/quizzes/admin/export-overview
 * Export all quiz questions with correct answers & explanations to Word
 */
router.get('/admin/export-overview', async (req, res) => {
   try {
     let docChildren = [
        new Paragraph({
          text: `TỔNG HỢP KIẾN THỨC & CÂU HỎI TRẮC NGHIỆM`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: `Môn: ${process.env.COURSE_NAME} (${process.env.COURSE_CODE})`,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: '', spacing: { after: 400 } }),
     ];
     
     for (let i = 1; i <= 9; i++) {
        const bank = loadQuestions(i);
        if (!bank) continue;
        
        docChildren.push(
           new Paragraph({
               text: `Buổi ${i}: ${bank.title}`,
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 200 }
           })
        );
        
        bank.questions.forEach((q, idx) => {
           docChildren.push(
             new Paragraph({
               children: [new TextRun({ text: `Câu ${idx + 1}: ${q.question}`, bold: true })],
               spacing: { before: 200, after: 100 }
             })
           );
           
           if (q.type === 'mc') {
               q.options.forEach(opt => {
                  const isCorrect = opt.startsWith(q.correct + '.');
                  docChildren.push(
                    new Paragraph({
                       children: [new TextRun({ text: opt, bold: isCorrect, color: isCorrect ? '1d4ed8' : '000000' })],
                       indent: { left: 720 }
                    })
                  );
               });
           } else if (q.type === 'tf') {
               const trueText = `A. Đúng`;
               const falseText = `B. Sai`;
               docChildren.push(
                 new Paragraph({
                   children: [new TextRun({ text: trueText, bold: q.correct==='A', color: q.correct==='A'?'1d4ed8':'000000' })],
                   indent: { left: 720 }
                 }),
                 new Paragraph({
                   children: [new TextRun({ text: falseText, bold: q.correct==='B', color: q.correct==='B'?'1d4ed8':'000000' })],
                   indent: { left: 720 }
                 })
               );
           }
           
           const explanation = q.explanation || "Chưa cập nhật giải thích.";
           docChildren.push(
              new Paragraph({
                  children: [
                     new TextRun({ text: "Giải thích: ", italics: true, bold: true }),
                     new TextRun({ text: explanation, italics: true })
                  ],
                  indent: { left: 720 },
                  spacing: { before: 100, after: 100 }
              })
           );
        });
        
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
     }
     
     const doc = new Document({
        sections: [{ children: docChildren }]
     });
     
     const buffer = await Packer.toBuffer(doc);
     
     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
     res.setHeader('Content-Disposition', `attachment; filename="Tong-Hop-Quizz.docx"`);
     res.send(buffer);
     
   } catch(err) {
      console.error('Word export error:', err);
      res.status(500).json({ error: 'Lỗi tạo file Word' });
   }
});

export default router;
