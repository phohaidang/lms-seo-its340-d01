import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/sheets.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/feedback/:sessionId
 * Submit anonymous feedback for a session.
 * 
 * DESIGN: Two separate tables ensure privacy:
 *   - session_feedback: anonymous content (no student info)
 *   - attendance_log: student identity + timestamp (no feedback content)
 * Admin can see WHO attended and WHEN, but NOT what they said.
 */
router.post('/:sessionId', authenticate, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { understanding, pace, usefulness, comment } = req.body;

    // Validate required survey fields (1-5 scale)
    if (!understanding || !pace || !usefulness) {
      return res.status(400).json({ error: 'Vui lòng trả lời đầy đủ các câu khảo sát.' });
    }

    // Check if this user already submitted feedback for this session
    const anonHash = Buffer.from(req.user.student_id + '_session_' + sessionId).toString('base64');
    const existing = await db.findOne('session_feedback', f => f.anon_hash === anonHash);
    if (existing) {
      return res.status(409).json({ error: 'Bạn đã gửi đánh giá cho buổi học này rồi.' });
    }

    const now = new Date().toISOString();

    // 1) Save ANONYMOUS feedback (no student identity)
    const feedback = {
      id: uuidv4(),
      session_id: sessionId,
      anon_hash: anonHash,
      understanding: parseInt(understanding),
      pace: parseInt(pace),
      usefulness: parseInt(usefulness),
      comment: (comment || '').trim().substring(0, 1000),
      submitted_at: now
    };
    await db.append('session_feedback', feedback);

    // 2) Save ATTENDANCE record (student identity + timestamp, NO content)
    const attendance = {
      id: uuidv4(),
      session_id: sessionId,
      student_id: req.user.student_id,
      student_name: req.user.full_name,
      checked_in_at: now
    };
    await db.append('attendance_log', attendance);

    res.json({ message: 'Cảm ơn bạn đã góp ý! Phản hồi của bạn hoàn toàn ẩn danh.' });
  } catch (err) {
    console.error('Feedback submit error:', err);
    res.status(500).json({ error: 'Lỗi gửi đánh giá' });
  }
});

/**
 * GET /api/feedback/:sessionId/check
 * Check if current user already submitted feedback for this session
 */
router.get('/:sessionId/check', authenticate, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const anonHash = Buffer.from(req.user.student_id + '_session_' + sessionId).toString('base64');
    const existing = await db.findOne('session_feedback', f => f.anon_hash === anonHash);
    res.json({ submitted: !!existing });
  } catch (err) {
    res.json({ submitted: false });
  }
});

/**
 * GET /api/feedback/my-attendance
 * Get session IDs attended by current student
 */
router.get('/my-attendance', authenticate, async (req, res) => {
  try {
    const logs = await db.find('attendance_log', a => a.student_id === req.user.student_id);
    const attendedSessions = logs.map(l => parseInt(l.session_id));
    res.json(attendedSessions);
  } catch (err) {
    console.error('My attendance error:', err);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu điểm danh' });
  }
});

/**
 * GET /api/feedback/admin/summary
 * Admin-only: Get aggregated feedback statistics for all sessions
 */
router.get('/admin/summary', authenticate, adminOnly, async (req, res) => {
  try {
    const allFeedback = await db.getAll('session_feedback');

    // Group by session
    const grouped = {};
    allFeedback.forEach(f => {
      const sid = f.session_id;
      if (!grouped[sid]) {
        grouped[sid] = { session_id: sid, responses: [], comments: [] };
      }
      grouped[sid].responses.push({
        understanding: parseInt(f.understanding) || 0,
        pace: parseInt(f.pace) || 0,
        usefulness: parseInt(f.usefulness) || 0
      });
      if (f.comment && f.comment.trim()) {
        grouped[sid].comments.push(f.comment);
      }
    });

    // Calculate averages
    const summary = Object.values(grouped).map(g => {
      const n = g.responses.length;
      const avg = (field) => {
        const sum = g.responses.reduce((acc, r) => acc + r[field], 0);
        return Math.round((sum / n) * 10) / 10;
      };
      return {
        session_id: g.session_id,
        total_responses: n,
        avg_understanding: avg('understanding'),
        avg_pace: avg('pace'),
        avg_usefulness: avg('usefulness'),
        comments: g.comments
      };
    }).sort((a, b) => a.session_id - b.session_id);

    res.json(summary);
  } catch (err) {
    console.error('Feedback summary error:', err);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu tổng hợp' });
  }
});

/**
 * GET /api/feedback/admin/attendance
 * Admin-only: View attendance records per session (WHO + WHEN, not WHAT they said)
 */
router.get('/admin/attendance', authenticate, adminOnly, async (req, res) => {
  try {
    const allAttendance = await db.getAll('attendance_log');

    // Group by session
    const grouped = {};
    allAttendance.forEach(a => {
      const sid = a.session_id;
      if (!grouped[sid]) {
        grouped[sid] = { session_id: sid, students: [] };
      }
      grouped[sid].students.push({
        student_id: a.student_id,
        student_name: a.student_name,
        checked_in_at: a.checked_in_at
      });
    });

    const result = Object.values(grouped)
      .sort((a, b) => a.session_id - b.session_id)
      .map(g => ({
        ...g,
        total_present: g.students.length,
        students: g.students.sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at))
      }));

  res.json(result);
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu điểm danh' });
  }
});

/**
 * GET /api/feedback/admin/analysis/:sessionId
 * Admin-only: Deep analysis of feedback for a specific session
 * Generates insights, sentiment patterns, and improvement suggestions
 */
router.get('/admin/analysis/:sessionId', authenticate, adminOnly, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const allFeedback = await db.getAll('session_feedback');
    const sessionFeedback = allFeedback.filter(f => parseInt(f.session_id) === sessionId);

    if (sessionFeedback.length === 0) {
      return res.json({ session_id: sessionId, has_data: false });
    }

    const n = sessionFeedback.length;

    // ── 1. Metric Analysis ──
    const metrics = { understanding: [], pace: [], usefulness: [] };
    sessionFeedback.forEach(f => {
      metrics.understanding.push(parseInt(f.understanding) || 0);
      metrics.pace.push(parseInt(f.pace) || 0);
      metrics.usefulness.push(parseInt(f.usefulness) || 0);
    });

    const calcStats = (arr) => {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const dist = [0, 0, 0, 0, 0]; // count for 1-5
      arr.forEach(v => { if (v >= 1 && v <= 5) dist[v - 1]++; });
      const mode = dist.indexOf(Math.max(...dist)) + 1;
      return {
        avg: Math.round(avg * 10) / 10,
        mode,
        distribution: dist,
        low_count: arr.filter(v => v <= 2).length,
        high_count: arr.filter(v => v >= 4).length
      };
    };

    const stats = {
      understanding: calcStats(metrics.understanding),
      pace: calcStats(metrics.pace),
      usefulness: calcStats(metrics.usefulness)
    };

    // ── 2. Generate Metric Insights ──
    const metricInsights = [];

    // Understanding insights
    if (stats.understanding.avg < 2.5) {
      metricInsights.push({
        type: 'warning',
        icon: '🚨',
        title: 'Mức hiểu bài thấp đáng báo động',
        detail: `Trung bình chỉ ${stats.understanding.avg}/5. ${stats.understanding.low_count}/${n} sinh viên cho điểm thấp (1-2). Cần xem lại cách truyền đạt hoặc giảm tải nội dung.`
      });
    } else if (stats.understanding.avg < 3.5) {
      metricInsights.push({
        type: 'caution',
        icon: '⚠️',
        title: 'Mức hiểu bài trung bình',
        detail: `Điểm trung bình ${stats.understanding.avg}/5. Một số sinh viên vẫn gặp khó khăn. Cân nhắc thêm ví dụ thực tế hoặc bài tập minh họa.`
      });
    } else {
      metricInsights.push({
        type: 'success',
        icon: '✅',
        title: 'Sinh viên hiểu bài tốt',
        detail: `Điểm trung bình ${stats.understanding.avg}/5. ${stats.understanding.high_count}/${n} sinh viên đánh giá dễ hiểu — rất tốt!`
      });
    }

    // Pace insights
    if (stats.pace.avg < 2.0) {
      metricInsights.push({ type: 'caution', icon: '🐢', title: 'Tốc độ bị đánh giá quá chậm', detail: `Trung bình ${stats.pace.avg}/5. Đa số sinh viên muốn tiết tấu nhanh hơn. Cân nhắc giảm thời gian giải thích cơ bản.` });
    } else if (stats.pace.avg > 4.0) {
      metricInsights.push({ type: 'caution', icon: '🚀', title: 'Tốc độ bị đánh giá quá nhanh', detail: `Trung bình ${stats.pace.avg}/5. Nhiều sinh viên thấy nhanh quá. Nên dành thêm thời gian cho các khái niệm khó.` });
    } else {
      metricInsights.push({ type: 'success', icon: '👍', title: 'Tốc độ giảng dạy phù hợp', detail: `Trung bình ${stats.pace.avg}/5 — đa số thấy vừa phải.` });
    }

    // Usefulness insights
    if (stats.usefulness.avg < 3.0) {
      metricInsights.push({ type: 'warning', icon: '💡', title: 'Sinh viên chưa thấy nội dung hữu ích', detail: `Trung bình ${stats.usefulness.avg}/5. Cần liên hệ thực tiễn nhiều hơn: case study, demo, hoặc bài tập áp dụng.` });
    } else if (stats.usefulness.avg >= 4.0) {
      metricInsights.push({ type: 'success', icon: '🌟', title: 'Buổi học được đánh giá rất hữu ích!', detail: `Trung bình ${stats.usefulness.avg}/5 — ${stats.usefulness.high_count}/${n} sinh viên cho điểm cao.` });
    }

    // ── 3. Comment Sentiment & Theme Analysis ──
    const comments = sessionFeedback
      .map(f => (f.comment || '').trim())
      .filter(c => c.length > 0);

    const themes = {
      positive: [],    // Khen ngợi
      difficulty: [],  // Khó hiểu
      request: [],     // Yêu cầu thêm
      pace_issue: [],  // Tốc độ
      practical: [],   // Thực hành
      general: []      // Khác
    };

    const positiveKeywords = ['hay', 'tốt', 'thích', 'giỏi', 'dễ hiểu', 'hữu ích', 'tuyệt', 'great', 'good', 'rất hay', 'xuất sắc', 'bổ ích', 'thú vị', 'hấp dẫn', 'cảm ơn', 'thanks'];
    const difficultyKeywords = ['khó', 'khó hiểu', 'chưa hiểu', 'không hiểu', 'phức tạp', 'rối', 'mơ hồ', 'lẫn lộn', 'nhầm', 'confused'];
    const requestKeywords = ['muốn', 'thêm', 'nên', 'cần', 'mong', 'đề xuất', 'góp ý', 'kiến nghị', 'nữa', 'ví dụ', 'giải thích'];
    const paceKeywords = ['nhanh', 'chậm', 'gấp', 'vội', 'kịp', 'từ từ', 'pace', 'tốc độ'];
    const practicalKeywords = ['thực hành', 'thực tế', 'bài tập', 'ứng dụng', 'demo', 'thực tiễn', 'case study', 'practice', 'project'];

    const matchesAny = (text, keywords) => {
      const lower = text.toLowerCase();
      return keywords.some(k => lower.includes(k));
    };

    comments.forEach(c => {
      let categorized = false;
      if (matchesAny(c, positiveKeywords)) { themes.positive.push(c); categorized = true; }
      if (matchesAny(c, difficultyKeywords)) { themes.difficulty.push(c); categorized = true; }
      if (matchesAny(c, requestKeywords)) { themes.request.push(c); categorized = true; }
      if (matchesAny(c, paceKeywords)) { themes.pace_issue.push(c); categorized = true; }
      if (matchesAny(c, practicalKeywords)) { themes.practical.push(c); categorized = true; }
      if (!categorized) { themes.general.push(c); }
    });

    // ── 4. Generate Actionable Suggestions ──
    const suggestions = [];

    if (themes.difficulty.length > 0) {
      suggestions.push({
        icon: '📖',
        action: 'Bổ sung giải thích',
        detail: `${themes.difficulty.length} bình luận phản ánh khó hiểu. Nên thêm ví dụ minh họa, sơ đồ tư duy, hoặc video ngắn giải thích lại các khái niệm trừu tượng.`
      });
    }

    if (themes.practical.length > 0 || stats.usefulness.avg < 3.5) {
      suggestions.push({
        icon: '🔧',
        action: 'Tăng cường thực hành',
        detail: 'Sinh viên cần nhiều cơ hội áp dụng lý thuyết hơn. Cân nhắc thêm bài tập nhóm, case study thực tế, hoặc mini-project ngay trong buổi học.'
      });
    }

    if (themes.request.length > 0) {
      suggestions.push({
        icon: '📝',
        action: 'Đáp ứng yêu cầu cụ thể',
        detail: `${themes.request.length} sinh viên gửi đề xuất/yêu cầu. Xem qua các góp ý bên dưới để tìm nhu cầu cụ thể của lớp.`
      });
    }

    if (stats.pace.avg > 3.8) {
      suggestions.push({
        icon: '⏳',
        action: 'Giảm tốc độ giảng dạy',
        detail: 'Phần lớn sinh viên muốn giảng chậm hơn. Thử chia nhỏ nội dung, dừng lại hỏi "Có ai cần hỏi lại không?" sau mỗi khái niệm lớn.'
      });
    } else if (stats.pace.avg < 2.2) {
      suggestions.push({
        icon: '⚡',
        action: 'Tăng nhịp độ bài giảng',
        detail: 'Sinh viên cảm thấy bài giảng hơi chậm. Cân nhắc bớt phần lý thuyết nền, tập trung vào trọng tâm và tương tác nhiều hơn.'
      });
    }

    if (stats.understanding.avg >= 4.0 && stats.usefulness.avg >= 4.0) {
      suggestions.push({
        icon: '🏆',
        action: 'Duy trì phong cách này!',
        detail: 'Buổi học đạt điểm cao cả về mức hiểu bài lẫn mức hữu ích. Đây là mô hình giảng dạy mẫu — hãy ghi nhận lại cách truyền đạt của buổi này để áp dụng cho các buổi sau.'
      });
    }

    // Overall sentiment score
    const overallScore = Math.round(((stats.understanding.avg + stats.usefulness.avg) / 2) * 10) / 10;
    let overallLabel, overallColor;
    if (overallScore >= 4.0) { overallLabel = 'Tuyệt vời'; overallColor = '#10b981'; }
    else if (overallScore >= 3.0) { overallLabel = 'Khá tốt'; overallColor = '#3b82f6'; }
    else if (overallScore >= 2.0) { overallLabel = 'Cần cải thiện'; overallColor = '#f59e0b'; }
    else { overallLabel = 'Cần thay đổi gấp'; overallColor = '#ef4444'; }

    res.json({
      session_id: sessionId,
      has_data: true,
      total_responses: n,
      total_comments: comments.length,
      overall: { score: overallScore, label: overallLabel, color: overallColor },
      stats,
      metricInsights,
      themes: {
        positive: themes.positive,
        difficulty: themes.difficulty,
        request: themes.request,
        pace_issue: themes.pace_issue,
        practical: themes.practical,
        general: themes.general
      },
      suggestions
    });
  } catch (err) {
    console.error('Feedback analysis error:', err);
    res.status(500).json({ error: 'Lỗi phân tích feedback' });
  }
});

export default router;
