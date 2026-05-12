/**
 * generate-questions-ai.js
 *
 * Tự động sinh câu hỏi quiz từ file HTML bài giảng bằng Google Gemini AI.
 * Áp dụng workflow /generate-quiz (xem .agent/workflows/generate-quiz.md)
 *
 * Usage:
 *   node scripts/generate-questions-ai.js <session_number> <path_to_html>
 *
 * Examples:
 *   node scripts/generate-questions-ai.js 1 "../../../03-Domains/Teaching/Social Commerce/Lessons/Buoi1_GioiThieu_SocialCommerce.html"
 *   node scripts/generate-questions-ai.js 2 ./client/public/lessons/Buoi2_CongCu_NenTang.html
 *
 * Requires: GEMINI_API_KEY trong .env
 *   → Lấy miễn phí tại: https://aistudio.google.com/apikey (không cần thẻ tín dụng)
 *   → Thêm vào .env: GEMINI_API_KEY=AIza...
 *
 * Free tier: 1,500 requests/ngày, 1M tokens/phút — đủ dùng cho toàn bộ năm học
 *
 * Output:
 *   server/data/questions/session-N.json  ← tự động lưu (sau khi user review)
 *   In ra màn hình để review trước
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const QUESTIONS_DIR = join(__dirname, '..', 'server', 'data', 'questions');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function stripHtml(html) {
  // Giữ lại text, loại bỏ tags, normalize whitespace
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... nội dung đã được cắt bớt để fit context window ...]';
}

function printBox(lines) {
  const width = Math.max(...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  console.log(`\n╔${border}╗`);
  for (const line of lines) console.log(`║  ${line.padEnd(width - 2)}  ║`);
  console.log(`╚${border}╝\n`);
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(`  ${question}: `, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

// ─────────────────────────────────────────────
// Build prompt theo /generate-quiz workflow
// ─────────────────────────────────────────────

function buildPrompt(sessionId, lessonText) {
  const courseName = process.env.COURSE_NAME || 'Môn học';
  return `Bạn là trợ lý soạn câu hỏi quiz cho hệ thống LMS đại học. 
Môn học: **${courseName}**
Nhiệm vụ: đọc nội dung bài giảng và sinh 5-7 câu hỏi cốt lõi cho Buổi ${sessionId}.

## NGUYÊN TẮC

Bloom's Taxonomy Level: **Hiểu/Giải thích (Level 2)** và một phần **Áp dụng (Level 3)**
- KHÔNG tạo câu hỏi kiểm tra ghi nhớ thuần tuý
- Options sai phải HỢP LÝ — sinh viên phải suy nghĩ mới loại được
- Câu essay phải đặt trong tình huống thực tế Việt Nam

## PHÂN PHỐI

Sinh đúng theo tỷ lệ:
- 3-4 câu **MC** (trắc nghiệm 4 lựa chọn A/B/C/D)
- 1-2 câu **TF** (Đúng/Sai — phát biểu học thuật chính xác từ bài)
- 1 câu **essay** (tự luận ngắn — tình huống thực tế)

## FORMAT OUTPUT

Trả về **chỉ JSON** (không có text khác), theo schema sau:

\`\`\`json
{
  "session": ${sessionId},
  "chapter": "[Tên chương từ nội dung bài, ví dụ: Ch.1 §1.1]",
  "title": "[Tên buổi học — lấy từ <title> hoặc <h1> của bài]",
  "time_limit_minutes": 10,
  "questions": [
    {
      "id": "s${sessionId}-mc1",
      "type": "mc",
      "question": "[Câu hỏi bắt đầu bằng động từ: Phân biệt / Xác định / Giải thích / So sánh / Nhận diện]",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct": "A|B|C|D",
      "explanation": "[Tại sao đáp án đúng — và sai lầm phổ biến cần tránh — 1-2 câu]"
    }
  ],
  "discussion_questions": [
    {
      "id": "s${sessionId}-essay1",
      "type": "essay",
      "question": "[Câu hỏi mở — tình huống thực tế sinh viên Việt Nam]",
      "sample_answer": "[Đáp án mẫu 3-5 câu]",
      "rubric": {
        "excellent": "[Tiêu chí xuất sắc]",
        "acceptable": "[Tiêu chí đạt]",
        "insufficient": "[Tiêu chí chưa đạt]"
      }
    }
  ]
}
\`\`\`

## NỘI DUNG BÀI GIẢNG

${lessonText}

---
Bây giờ hãy sinh câu hỏi. Chỉ trả về JSON, không có text khác.`;
}

// ─────────────────────────────────────────────
// Gọi Google Gemini API (native fetch, Node 18+)
// Free tier: gemini-2.0-flash — 1,500 req/ngày
// ─────────────────────────────────────────────

async function callGeminiAPI(prompt, attempt = 1) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được set trong .env');
  }

  if (attempt === 1) console.log('  🤖 Đang gọi Gemini API (gemini-2.0-flash)...\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    })
  });

  // Xử lý 429 Rate Limit — tự động retry
  if (response.status === 429) {
    const maxRetries = 3;
    if (attempt > maxRetries) {
      throw new Error(`Gemini API vẫn bị rate limit sau ${maxRetries} lần thử. Vui lòng chờ vài phút rồi thử lại.`);
    }
    // Đọc thời gian retry từ response nếu có
    const errData = await response.json().catch(() => ({}));
    const retryMatch = JSON.stringify(errData).match(/retry in (\d+)/i);
    const waitSecs = retryMatch ? parseInt(retryMatch[1]) + 2 : attempt * 15;

    console.log(`  ⏳ Rate limit (429). Tự động thử lại sau ${waitSecs}s... (lần ${attempt}/${maxRetries})\n`);
    await new Promise(r => setTimeout(r, waitSecs * 1000));
    return callGeminiAPI(prompt, attempt + 1);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || response.statusText;
    throw new Error(`Gemini API error ${response.status}: ${msg}`);
  }

  const data = await response.json();

  // Parse Gemini response structure
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini trả về response rỗng hoặc bị block (kiểm tra safety settings)');
  }

  return text;
}

// ─────────────────────────────────────────────
// Parse JSON từ response của Claude
// ─────────────────────────────────────────────

function parseQuestionsFromResponse(text) {
  // Thử lấy JSON block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                    text.match(/```\s*([\s\S]*?)```/) ||
                    [null, text];

  const jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Thử tìm object { ... } trong text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    throw new Error(`Không parse được JSON từ response: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// Validate & hiển thị preview
// ─────────────────────────────────────────────

function validateAndPreview(bank) {
  const issues = [];

  if (!bank.questions || !Array.isArray(bank.questions)) {
    issues.push('❌ Thiếu mảng questions');
  } else {
    bank.questions.forEach((q, i) => {
      if (!q.id) issues.push(`  Câu ${i+1}: thiếu id`);
      if (!['mc', 'tf'].includes(q.type)) issues.push(`  Câu ${i+1}: type không hợp lệ (${q.type})`);
      if (!q.question) issues.push(`  Câu ${i+1}: thiếu question`);
      if (q.type === 'mc' && (!q.options || q.options.length !== 4)) {
        issues.push(`  Câu ${i+1}: MC phải có đúng 4 options`);
      }
      if (!q.correct) issues.push(`  Câu ${i+1}: thiếu correct`);
    });
  }

  // Preview
  console.log('\n  ─────────────────────────────────────────────────');
  console.log(`  📌 Buổi ${bank.session}: ${bank.title}`);
  console.log(`  📂 ${bank.chapter} | ⏱ ${bank.time_limit_minutes} phút`);
  console.log(`  ❓ ${bank.questions?.length || 0} câu quiz + ${bank.discussion_questions?.length || 0} câu thảo luận`);
  console.log('  ─────────────────────────────────────────────────\n');

  const allQ = [...(bank.questions || []), ...(bank.discussion_questions || [])];
  allQ.forEach((q, i) => {
    const typeLabel = q.type === 'mc' ? '📋 MC' : q.type === 'tf' ? '✔️ T/F' : '✏️ Essay';
    console.log(`  ${typeLabel} | ${q.id}`);
    console.log(`     ${q.question}`);
    if (q.type === 'mc') {
      q.options?.forEach(o => {
        const isCorrect = o.startsWith(q.correct + '.');
        console.log(`     ${isCorrect ? '✅' : '  '} ${o}`);
      });
    } else if (q.type === 'tf') {
      console.log(`     Đáp án: ${q.correct === 'A' ? '✅ Đúng' : '❌ Sai'}`);
    }
    if (q.explanation) console.log(`     💡 ${q.explanation}`);
    console.log('');
  });

  if (issues.length > 0) {
    console.log('  ⚠️  Cảnh báo validation:');
    issues.forEach(i => console.log(`     ${i}`));
    console.log('');
  }

  return issues.length === 0;
}

// ─────────────────────────────────────────────
// Xuất prompt để copy-paste (fallback khi không có API key)
// ─────────────────────────────────────────────

function printCopyPastePrompt(sessionId, lessonText) {
  const shortText = truncateText(lessonText, 6000);
  console.log('\n  ══════════════════════════════════════════════');
  console.log('  📋 COPY PROMPT NÀY VÀO CLAUDE / GEMINI / CHATGPT:');
  console.log('  ══════════════════════════════════════════════\n');
  console.log(buildPrompt(sessionId, shortText));
  console.log('\n  ══════════════════════════════════════════════');
  console.log('  → Sau khi có JSON, lưu vào:');
  console.log(`     server/data/questions/session-${sessionId}.json`);
  console.log('  ══════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const [,, sessionIdArg, htmlPathArg] = process.argv;

  if (!sessionIdArg || !htmlPathArg) {
    console.error('\n  Usage: node scripts/generate-questions-ai.js <session_number> <path_to_html>\n');
    console.error('  Example: node scripts/generate-questions-ai.js 1 "./client/public/lessons/Buoi1.html"\n');
    process.exit(1);
  }

  const sessionId = parseInt(sessionIdArg);
  const htmlPath = resolve(htmlPathArg);

  printBox([
    '🎓  LMS Hub — Generate Questions AI',
    `Buổi: ${sessionId}`,
    `File: ${htmlPathArg}`,
  ]);

  // ── Đọc HTML ──
  if (!existsSync(htmlPath)) {
    console.error(`\n  ❌ Không tìm thấy file: ${htmlPath}\n`);
    process.exit(1);
  }

  const html = readFileSync(htmlPath, 'utf-8');
  const lessonText = truncateText(stripHtml(html), 12000);
  console.log(`  ✅ Đọc được ${lessonText.length.toLocaleString()} ký tự từ HTML\n`);

  // ── Kiểm tra API key ──
  if (!process.env.GEMINI_API_KEY) {
    console.log('  ⚠️  Chưa có GEMINI_API_KEY trong .env');
    console.log('     → Lấy miễn phí: https://aistudio.google.com/apikey');
    console.log('     → Xuất prompt để copy-paste thủ công\n');
    printCopyPastePrompt(sessionId, lessonText);
    return;
  }

  // ── Gọi API ──
  let bank;
  try {
    const rawResponse = await callGeminiAPI(buildPrompt(sessionId, lessonText));
    bank = parseQuestionsFromResponse(rawResponse);
    console.log('  ✅ Gemini đã sinh xong câu hỏi\n');
  } catch (err) {
    console.error(`\n  ❌ Lỗi khi gọi Gemini API: ${err.message}\n`);
    console.log('     → Fallback: xuất prompt để copy-paste\n');
    printCopyPastePrompt(sessionId, lessonText);
    return;
  }

  // ── Preview & Validate ──
  const isValid = validateAndPreview(bank);

  // ── Hỏi user trước khi lưu ──
  const confirm = await ask(`Lưu vào session-${sessionId}.json? [y/n/edit]`);

  if (confirm.toLowerCase() === 'n') {
    console.log('\n  ↩️  Đã huỷ. JSON không được lưu.\n');
    return;
  }

  if (confirm.toLowerCase() === 'edit') {
    const editPath = join(QUESTIONS_DIR, `session-${sessionId}.draft.json`);
    if (!existsSync(QUESTIONS_DIR)) mkdirSync(QUESTIONS_DIR, { recursive: true });
    writeFileSync(editPath, JSON.stringify(bank, null, 2), 'utf-8');
    console.log(`\n  📝 Đã lưu bản nháp: ${editPath}`);
    console.log('     Chỉnh sửa xong thì đổi tên thành session-${sessionId}.json\n');
    return;
  }

  // ── Lưu file ──
  if (!existsSync(QUESTIONS_DIR)) mkdirSync(QUESTIONS_DIR, { recursive: true });
  const outputPath = join(QUESTIONS_DIR, `session-${sessionId}.json`);
  writeFileSync(outputPath, JSON.stringify(bank, null, 2), 'utf-8');

  printBox([
    `✅  Đã lưu: session-${sessionId}.json`,
    `❓ ${bank.questions?.length || 0} câu quiz (MC/TF) + ${bank.discussion_questions?.length || 0} câu essay`,
    `📁 ${outputPath}`,
  ]);
}

main().catch(err => {
  console.error('\n  ❌ Lỗi không xử lý được:', err.message);
  process.exit(1);
});
