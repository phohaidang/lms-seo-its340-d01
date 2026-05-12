import { Router } from 'express';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/sheets.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/auth.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import multer from 'multer';

// Setup file upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXAMS_DIR = join(__dirname, '..', 'data', 'exams');
const EVIDENCE_DIR = join(__dirname, '..', '..', 'data', 'evidence');
const UPLOAD_DIR = join(__dirname, '..', 'data', 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// Change to memory storage for Serverless / Google Drive upload
const upload = multer({ storage: multer.memoryStorage() });

function loadExam(examId) {
  const filePath = join(EXAMS_DIR, `${examId}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

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
 * GET /api/exams/:examId
 * Get exam paper (random variant, shuffled, NO answers)
 */
router.get('/:examId', authenticate, async (req, res) => {
  try {
    const examId = req.params.examId;
    const exam = loadExam(examId);
    
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy đề thi' });
    }
    
    // Check if already attempted
    const existing = await db.findOne('exam_attempts',
      a => a.student_id === req.user.student_id && a.exam_id === examId
    );
    if (existing) {
      return res.status(409).json({
        error: 'Bạn đã làm bài kiểm tra này rồi',
        result: { score: existing.score, submitted_at: existing.submitted_at }
      });
    }
    
    // Random variant
    const variants = exam.variants;
    const variant = Math.floor(Math.random() * variants.length);
    const paper = variants[variant];
    
    // Shuffle questions, strip answers
    const questions = shuffle(paper.questions).map(q => {
      const { correct, explanation, ...rest } = q;
      if (q.type === 'mc') {
        return { ...rest, options: shuffle(q.options) };
      }
      return rest;
    });
    
    res.json({
      exam_id: examId,
      variant: variant + 1,
      title: exam.title,
      time_limit_minutes: exam.time_limit_minutes,
      total_questions: questions.length,
      scope: exam.scope,
      questions
    });
  } catch (err) {
    console.error('Exam get error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * POST /api/exams/:examId/submit
 * Submit exam — graded server-side, full record saved for evidence
 */
router.post('/:examId/submit', authenticate, async (req, res) => {
  try {
    const examId = req.params.examId;
    const { answers, variant, started_at } = req.body;
    
    // Check duplicate
    const existing = await db.findOne('exam_attempts',
      a => a.student_id === req.user.student_id && a.exam_id === examId
    );
    if (existing) {
      return res.status(409).json({ error: 'Bạn đã nộp bài rồi' });
    }
    
    const exam = loadExam(examId);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi' });
    
    const paper = exam.variants[(variant || 1) - 1];
    if (!paper) return res.status(400).json({ error: 'Đề không hợp lệ' });
    
    // Grade
    let correctCount = 0;
    for (const ans of answers) {
      const q = paper.questions.find(q => q.id === ans.question_id);
      if (q && ans.selected === q.correct) correctCount++;
    }
    
    const totalQuestions = paper.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 10 * 100) / 100;
    
    // Save full evidence record
    const attempt = {
      attempt_id: uuidv4(),
      student_id: req.user.student_id,
      student_name: req.user.full_name,
      exam_id: examId,
      variant: variant || 1,
      questions_received: JSON.stringify(paper.questions.map(q => ({ id: q.id, question: q.question, options: q.options }))),
      answers_submitted: JSON.stringify(answers),
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      started_at: started_at || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      duration_seconds: started_at ? Math.round((Date.now() - new Date(started_at).getTime()) / 1000) : null,
      ip_address: req.ip
    };
    
    await db.append('exam_attempts', attempt);
    
    res.json({
      message: 'Nộp bài thành công!',
      score,
      total_questions: totalQuestions,
      correct_count: correctCount
    });
  } catch (err) {
    console.error('Exam submit error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/exams/:examId/my-result
 * Student views own result (score only)
 */
router.get('/:examId/my-result', authenticate, async (req, res) => {
  try {
    const attempt = await db.findOne('exam_attempts',
      a => a.student_id === req.user.student_id && a.exam_id === req.params.examId
    );
    
    if (!attempt) {
      return res.status(404).json({ error: 'Chưa có kết quả' });
    }
    
    res.json({
      score: parseFloat(attempt.score),
      total_questions: parseInt(attempt.total_questions),
      correct_count: parseInt(attempt.correct_count),
      variant: parseInt(attempt.variant),
      submitted_at: attempt.submitted_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/exams/:examId/admin/results
 * Admin: view all exam results
 */
router.get('/:examId/admin/results', authenticate, adminOnly, async (req, res) => {
  try {
    const results = await db.find('exam_attempts', a => a.exam_id === req.params.examId);
    res.json(results.map(r => ({
      student_id: r.student_id,
      student_name: r.student_name,
      variant: parseInt(r.variant),
      score: parseFloat(r.score),
      total_questions: parseInt(r.total_questions),
      correct_count: parseInt(r.correct_count),
      submitted_at: r.submitted_at,
      duration_seconds: parseInt(r.duration_seconds)
    })));
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/exams/:examId/export-word
 * Export Exam to Word document
 */
router.get('/:examId/export-word', async (req, res) => {
  try {
    const examId = req.params.examId;
    const exam = loadExam(examId);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi' });

    // Build the document
    const baseQuestions = exam.variants[0].questions; // use variant 1 as standard
    
    // helper to shuffle array
    const shuffleArray = (array) => {
       const newArr = [...array];
       for (let i = newArr.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
       }
       return newArr;
    };
    
    const variants = [];
    const answerKeys = [];
    
    for (let variantIndex = 1; variantIndex <= 4; variantIndex++) {
        // Shuffle questions
        let shuffledQuestions = shuffleArray(baseQuestions);
        
        let keys = [];
        let curVariantQuestions = shuffledQuestions.map((q, idx) => {
             // Extract options A, B, C, D string array
             let baseOpts = q.options.map(o => o.substring(3).trim()); // remove "A. ", "B. "
             let charMap = {0: 'A', 1: 'B', 2: 'C', 3:'D'};
             let reverseCharMap = {'A':0, 'B':1, 'C':2, 'D':3, 'a':0, 'b':1, 'c':2, 'd':3};
             
             let correctIdx = reverseCharMap[q.correct || 'A'];
             
             // shuffle options
             let mappedOpts = baseOpts.map((text, ogIdx) => ({ text, isCorrect: ogIdx === correctIdx }));
             let shuffledOpts = shuffleArray(mappedOpts);
             
             let finalOpts = shuffledOpts.map((optObj, newIdx) => {
                 if (optObj.isCorrect) {
                     keys.push(`Câu ${idx + 1}: ${charMap[newIdx]}`);
                 }
                 return `${charMap[newIdx]}. ${optObj.text}`;
             });
             
             return {
                 question: q.question,
                 options: finalOpts
             };
        });
        
        variants.push(curVariantQuestions);
        answerKeys.push({ variant: variantIndex, keys });
    }
    
    let docChildren = [];
    
    variants.forEach((questions, variantIndex) => {
      docChildren.push(
        new Paragraph({
          text: `ĐỀ THI: ${exam.title.toUpperCase()} — ĐỀ 0${variantIndex + 1}`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: `Scope: ${exam.scope} | Thời gian: ${exam.time_limit_minutes} phút`,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: `Hướng dẫn: ${exam.instructions}`,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { after: 400 } }),
        new Paragraph({
          children: [
            new TextRun({ text: "Họ và tên SV: ..................................................... MSSV: ............................" }),
          ]
        }),
        new Paragraph({ text: '', spacing: { after: 400 } }),
      );

      questions.forEach((q, index) => {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `Câu ${index + 1}: ${q.question}`, bold: true })],
            spacing: { before: 200, after: 100 }
          })
        );
        
        q.options.forEach(opt => {
          docChildren.push(
            new Paragraph({
              text: opt,
              indent: { left: 720 }
            })
          );
        });
      });
      
      docChildren.push(new Paragraph({ children: [new PageBreak()] }));
    });
    
    docChildren.push(
      new Paragraph({
        text: `ĐÁP ÁN ĐỀ THI: ${exam.title.toUpperCase()}`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
      })
    );
    
    answerKeys.forEach(ak => {
        docChildren.push(
            new Paragraph({
               text: `ĐÁP ÁN ĐỀ 0${ak.variant}`,
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 100 }
            }),
            new Paragraph({
               text: ak.keys.join("  |  ")
            })
        );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${examId}-phong-thi.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Word export error:', error);
    res.status(500).json({ error: 'Lỗi tạo file Word' });
  }
});

/**
 * POST /api/exams/:examId/upload-word
 * Upload filled exam word doc
 */
router.post('/:examId/upload-word', authenticate, upload.single('examFile'), async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng đính kèm file Word (.docx)' });
    }
    
    // Check file extension basic
    if(!req.file.originalname.endsWith('.docx') && !req.file.originalname.endsWith('.doc')) {
       return res.status(400).json({ error: 'Chỉ hỗ trợ file .doc / .docx' });
    }

    // Format new file name: [MSSV]_[HoTen]_[MaDeThi]_Backup.docx
    const { student_id, full_name } = req.user;
    const cleanName = (full_name || 'Hoc_Vien').replace(/[^a-zA-Z0-9]/g, '');
    const driveFileName = `${student_id}_${cleanName}_${examId}_Backup.docx`;

    // Upload to Google Drive using the memory buffer
    const driveLink = await db.uploadToDrive(driveFileName, req.file.mimetype, req.file.buffer);

    // Save fallback record to DB
    const fallbackRecord = {
      id: uuidv4(),
      exam_id: examId,
      student_id: req.user.student_id,
      file_path: driveLink,
      original_name: req.file.originalname,
      uploaded_at: new Date().toISOString(),
      status: 'pending_manual_grade'
    };
    
    await db.append('manual_grades', fallbackRecord); 

    res.json({ message: 'Tải tệp thành công. Bài thi sẽ được chấm thủ công.', data: fallbackRecord });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Lỗi đồng bộ tệp lên mạng. Vui lòng trực tiếp gửi file cho giảng viên.' });
  }
});

export default router;
