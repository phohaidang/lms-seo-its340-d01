import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/sheets.js';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EBOOK_DIR = join(__dirname, '..', 'data', 'ebook');

function loadChapter(chapterId) {
  const filePath = join(EBOOK_DIR, `chapter-${chapterId}.json`);
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
 * GET /api/ebook/chapters
 * List all chapters with progress
 */
router.get('/chapters', authenticate, async (req, res) => {
  try {
    const chapters = [];
    for (let i = 1; i <= 4; i++) {
      const ch = loadChapter(i);
      if (!ch) continue;
      
      // Get progress for this student
      const progress = await db.findOne('ebook_progress',
        p => p.student_id === req.user.student_id && parseInt(p.chapter) === i
      );
      
      chapters.push({
        chapter: ch.chapter,
        title: ch.title,
        sessions: ch.sessions,
        total_concepts: ch.concepts?.length || 0,
        scqa_preview: ch.scqa?.situation?.substring(0, 120) + '...',
        progress: progress ? {
          concepts_read: parseInt(progress.concepts_read || 0),
          level_1_score: progress.level_1_score || null,
          level_2_status: progress.level_2_status || 'not_started',
          level_3_status: progress.level_3_status || 'not_started'
        } : {
          concepts_read: 0,
          level_1_score: null,
          level_2_status: 'not_started',
          level_3_status: 'not_started'
        }
      });
    }
    
    res.json({ chapters });
  } catch (err) {
    console.error('eBook chapters error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/ebook/chapters/:id
 * Full chapter content (SCQA + concepts + cases, NO test answers)
 */
router.get('/chapters/:id', authenticate, (req, res) => {
  const chapter = loadChapter(parseInt(req.params.id));
  if (!chapter) {
    return res.status(404).json({ error: 'Không tìm thấy chương' });
  }
  
  // Send chapter content WITHOUT test correct answers
  const safe = {
    ...chapter,
    tests: chapter.tests ? {
      level_1: {
        ...chapter.tests.level_1,
        questions: chapter.tests.level_1?.questions?.map(q => {
          const { correct, explanation, ...rest } = q;
          return rest;
        })
      },
      level_2: {
        ...chapter.tests.level_2,
        questions: chapter.tests.level_2?.questions?.map(q => {
          const { correct, ...rest } = q;
          return rest;
        })
      },
      level_3: chapter.tests.level_3
    } : null
  };
  
  res.json(safe);
});

/**
 * GET /api/ebook/chapters/:id/test/:level
 * Get test questions for a specific level
 */
router.get('/chapters/:id/test/:level', authenticate, (req, res) => {
  const chapter = loadChapter(parseInt(req.params.id));
  if (!chapter) {
    return res.status(404).json({ error: 'Không tìm thấy chương' });
  }
  
  const level = `level_${req.params.level}`;
  const test = chapter.tests?.[level];
  if (!test) {
    return res.status(404).json({ error: 'Không tìm thấy bài test' });
  }
  
  const questions = test.questions.map(q => {
    const { correct, explanation, ...rest } = q;
    if (q.type === 'mc') {
      return { ...rest, options: shuffle(q.options) };
    }
    return rest;
  });
  
  res.json({
    chapter: chapter.chapter,
    level: parseInt(req.params.level),
    name: test.name,
    description: test.description,
    bloom_level: test.bloom_level,
    questions
  });
});

/**
 * POST /api/ebook/chapters/:id/test/:level/submit
 * Submit test answers
 */
router.post('/chapters/:id/test/:level/submit', authenticate, async (req, res) => {
  try {
    const chapterId = parseInt(req.params.id);
    const level = parseInt(req.params.level);
    const { answers } = req.body;
    
    const chapter = loadChapter(chapterId);
    if (!chapter) return res.status(404).json({ error: 'Không tìm thấy chương' });
    
    const testKey = `level_${level}`;
    const test = chapter.tests?.[testKey];
    if (!test) return res.status(404).json({ error: 'Không tìm thấy test' });
    
    let result = {};
    
    if (level === 1) {
      // Auto-grade MC
      let correct = 0;
      const total = test.questions.length;
      
      for (const ans of answers) {
        const q = test.questions.find(q => q.id === ans.question_id);
        if (q && ans.selected === q.correct) correct++;
      }
      
      const score = Math.round((correct / total) * 10 * 100) / 100;
      result = { score, correct_count: correct, total_questions: total, graded: true };
    } else {
      // Level 2 & 3: save essay, GV grades later
      result = { graded: false, message: 'Bài đã được lưu. Giảng viên sẽ chấm điểm.' };
    }
    
    // Save attempt
    const attempt = {
      attempt_id: uuidv4(),
      student_id: req.user.student_id,
      chapter: chapterId,
      level,
      answers_json: JSON.stringify(answers),
      score: result.score || null,
      graded: result.graded,
      submitted_at: new Date().toISOString()
    };
    
    await db.append('ebook_progress', attempt);
    
    // Update progress summary
    await db.update('ebook_progress',
      p => p.student_id === req.user.student_id && parseInt(p.chapter) === chapterId && !p.level,
      { [`level_${level}_score`]: result.score, [`level_${level}_status`]: result.graded ? 'completed' : 'submitted' }
    );
    
    res.json({ message: 'Nộp bài thành công!', ...result });
  } catch (err) {
    console.error('eBook test submit error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/ebook/my-progress
 * Get overall eBook progress
 */
router.get('/my-progress', authenticate, async (req, res) => {
  try {
    const progress = await db.find('ebook_progress',
      p => p.student_id === req.user.student_id
    );
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

export default router;
