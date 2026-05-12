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
  { id: 1, chapter: 'Ch.1 §1.1-1.3', title: 'Tổng quan về SEO & Search Engine', topics: 'Cơ chế hoạt động của Google, Các loại SEO, Quy trình SEO tổng thể', clo: 'CLO1', textbook: 'SEO Fundamentals', duration: '5 tiết' },
  { id: 2, chapter: 'Ch.2 §2.1-2.4', title: 'Nghiên cứu Từ khóa (Keyword Research)', topics: 'User Intent, Công cụ nghiên cứu từ khóa, Lập kế hoạch từ khóa', clo: 'CLO1, CLO2', textbook: 'Keyword Research Guide', duration: '5 tiết' },
  { id: 3, chapter: 'Ch.3 §3.1-3.3', title: 'SEO On-page & Tối ưu nội dung', topics: 'Thẻ Meta, Cấu trúc bài viết chuẩn SEO, Tối ưu hình ảnh', clo: 'CLO2', textbook: 'On-page Optimization', duration: '5 tiết' },
  { id: 4, chapter: 'Ch.4 §4.1-4.2', title: 'Technical SEO & Trải nghiệm người dùng', topics: 'Sitemap, Robots.txt, Page Speed, Core Web Vitals', clo: 'CLO2, CLO3', textbook: 'Technical SEO Audit', duration: '5 tiết' },
  { id: 5, chapter: 'Ch.5 §5.1-5.3', title: 'SEO Off-page & Xây dựng liên kết', topics: 'Backlinks, Topical Authority, Social Signals', clo: 'CLO3', textbook: 'Link Building Strategies', duration: '5 tiết' },
  { id: 6, chapter: 'Ch.6 §6.1-6.2', title: 'Đo lường & Báo cáo SEO', topics: 'Google Search Console, Google Analytics, Báo cáo thứ hạng', clo: 'CLO1-3', textbook: 'SEO Reporting', duration: '5 tiết' }
];

/**
 * GET /api/courses/sessions
 * List all sessions
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
  
  res.json({
    ...session,
    hasLesson: existsSync(join(lessonsDir, `buoi-${id}.html`)),
    hasSlide: existsSync(join(slidesDir, `buoi-${id}.pdf`))
  });
});

export default router;
