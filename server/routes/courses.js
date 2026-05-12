import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Course session metadata
const SESSIONS = [
  { id: 1, chapter: 'Ch.1 §1.1-1.3', title: 'Giới thiệu & Python cơ bản', topics: 'Biến, Kiểu dữ liệu, Toán tử số học, Nhập/Xuất dữ liệu', clo: 'CLO1', textbook: 'Ch.1-2 Think Python', duration: '5 tiết (250 phút)' },
  { id: 2, chapter: 'Ch.2 §2.1-2.4', title: 'Cấu trúc điều khiển & Vòng lặp', topics: 'If-elif-else, Vòng lặp for, while, Logic Operators', clo: 'CLO1, CLO2', textbook: 'Ch.3-4 Think Python', duration: '5 tiết (250 phút)' },
  { id: 3, chapter: 'Ch.3 §3.1-3.3', title: 'Hàm, Phân rã & Trừu tượng', topics: 'Def, Return, Scope, Parameters, Abstraction, Decomposition', clo: 'CLO1, CLO2', textbook: 'Ch.5-6 Think Python', duration: '5 tiết (250 phút)' },
  { id: 4, chapter: 'Ch.3-4', title: 'Đệ quy, Chuỗi & Lập trình phòng thủ', topics: 'Recursion, String Methods, try/except, assert + Kiểm tra giữa kỳ 1', clo: 'CLO1, CLO2, CLO3', textbook: 'Ch.7-8 Think Python', duration: '5 tiết (250 phút)', hasExam: true, examId: 'midterm-1' },
  { id: 5, chapter: 'Ch.5', title: 'Lớp, Đối tượng & OOP', topics: 'Class, Instance, __init__, Inheritance, Overriding', clo: 'CLO2, CLO3', textbook: 'Ch.9-10 Think Python', duration: '5 tiết (250 phút)' },
  { id: 6, chapter: 'Ch.6', title: 'Độ hiệu quả (Big-O) & Tổng kết', topics: 'Big-O, Search Algorithms, List vs Set, Tối ưu hóa + Kiểm tra giữa kỳ 2', clo: 'CLO1-3', textbook: 'Ch.11 Think Python', duration: '5 tiết (250 phút)', hasExam: true, examId: 'midterm-2' }
];

/**
 * GET /api/courses/sessions
 * List all 9 sessions
 */
router.get('/sessions', authenticate, (req, res) => {
  res.json({
    course: {
      code: process.env.COURSE_CODE,
      name: process.env.COURSE_NAME,
      total_sessions: SESSIONS.length,
      chapters: 4
    },
    sessions: SESSIONS
  });
});

/**
 * GET /api/courses/sessions/:id
 * Get single session metadata
 */
router.get('/sessions/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const session = SESSIONS.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy buổi học' });
  }
  
  // Check if lesson/slide files exist
  const lessonsDir = join(__dirname, '..', '..', 'client', 'public', 'lessons');
  const slidesDir = join(__dirname, '..', '..', 'client', 'public', 'slides');
  
  const paddedId = id.toString().padStart(2, '0');
  
  res.json({
    ...session,
    hasLesson: existsSync(join(lessonsDir, `Buoi_${paddedId}.html`)),
    hasSlide: existsSync(join(slidesDir, `Buoi_${paddedId}.pdf`))
  });
});

export default router;
