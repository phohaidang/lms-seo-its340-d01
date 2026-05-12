/**
 * create-questions.js
 *
 * Wizard nhập câu hỏi quiz trực tiếp từ terminal và lưu vào
 * server/data/questions/session-N.json
 *
 * Usage:
 *   node scripts/create-questions.js          → tạo mới / ghi đè
 *   node scripts/create-questions.js --append → thêm câu hỏi vào file đã có
 *
 * Format JSON được tạo ra tương thích 100% với server/routes/quizzes.js
 */

import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONS_DIR = join(__dirname, '..', 'server', 'data', 'questions');
const APPEND_MODE = process.argv.includes('--append');

if (!existsSync(QUESTIONS_DIR)) mkdirSync(QUESTIONS_DIR, { recursive: true });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const hint = defaultValue !== '' ? ` (mặc định: ${defaultValue})` : '';
    rl.question(`  ${question}${hint}: `, (ans) => {
      resolve(ans.trim() || defaultValue);
    });
  });
}

function askRequired(question) {
  return new Promise((resolve) => {
    const retry = () => {
      rl.question(`  ${question}: `, (ans) => {
        if (ans.trim()) resolve(ans.trim());
        else { console.log('  ⚠️  Không được để trống.\n'); retry(); }
      });
    };
    retry();
  });
}

function askChoice(question, choices) {
  return new Promise((resolve) => {
    const choicesStr = choices.join('/');
    const retry = () => {
      rl.question(`  ${question} [${choicesStr}]: `, (ans) => {
        const val = ans.trim().toUpperCase();
        if (choices.includes(val)) resolve(val);
        else { console.log(`  ⚠️  Chỉ nhập: ${choicesStr}\n`); retry(); }
      });
    };
    retry();
  });
}

function printBox(lines) {
  const width = Math.max(...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  console.log(`\n╔${border}╗`);
  for (const line of lines) console.log(`║  ${line.padEnd(width - 2)}  ║`);
  console.log(`╚${border}╝\n`);
}

function printSeparator(label = '') {
  const line = '─'.repeat(50);
  if (label) console.log(`\n  ──── ${label} ${'─'.repeat(Math.max(0, 44 - label.length))}\n`);
  else console.log(`\n  ${line}\n`);
}

// ─────────────────────────────────────────────
// Nhập câu hỏi MC (trắc nghiệm 4 lựa chọn)
// ─────────────────────────────────────────────

async function enterMCQuestion(sessionId, questionIndex) {
  console.log(`\n  📝 Câu hỏi #${questionIndex} — Trắc nghiệm (MC)\n`);

  const question = await askRequired('Nội dung câu hỏi');
  console.log('');

  const optA = await askRequired('A. Lựa chọn A');
  const optB = await askRequired('B. Lựa chọn B');
  const optC = await askRequired('C. Lựa chọn C');
  const optD = await askRequired('D. Lựa chọn D');
  console.log('');

  const correct = await askChoice('Đáp án đúng', ['A', 'B', 'C', 'D']);
  const explanation = await ask('Giải thích đáp án (Enter để bỏ qua)', '');

  return {
    id: `s${sessionId}-mc${questionIndex}`,
    type: 'mc',
    question,
    options: [
      `A. ${optA}`,
      `B. ${optB}`,
      `C. ${optC}`,
      `D. ${optD}`
    ],
    correct,
    ...(explanation && { explanation })
  };
}

// ─────────────────────────────────────────────
// Nhập câu hỏi T/F (Đúng/Sai)
// ─────────────────────────────────────────────

async function enterTFQuestion(sessionId, questionIndex) {
  console.log(`\n  📝 Câu hỏi #${questionIndex} — Đúng/Sai (T/F)\n`);

  const question = await askRequired('Nội dung câu (phát biểu để SV đánh giá Đúng/Sai)');
  console.log('');
  console.log('  A = Đúng (True)   |   B = Sai (False)');
  const correct = await askChoice('Đáp án', ['A', 'B']);
  const explanation = await ask('Giải thích đáp án (Enter để bỏ qua)', '');

  return {
    id: `s${sessionId}-tf${questionIndex}`,
    type: 'tf',
    question,
    correct,
    ...(explanation && { explanation })
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  printBox([
    '📝  LMS Hub — Create Questions Wizard',
    APPEND_MODE ? 'Chế độ: THÊM câu hỏi vào file đã có' : 'Chế độ: TẠO MỚI (ghi đè nếu đã có)',
    '',
    'Để thêm vào file sẵn có: node scripts/create-questions.js --append',
  ]);

  // ── Chọn buổi học ──
  const sessionIdStr = await askRequired('Buổi học số (1-9)');
  const sessionId = parseInt(sessionIdStr);
  if (isNaN(sessionId) || sessionId < 1 || sessionId > 99) {
    console.error('\n  ❌ Số buổi không hợp lệ.\n');
    rl.close(); process.exit(1);
  }

  const filePath = join(QUESTIONS_DIR, `session-${sessionId}.json`);

  // ── Load dữ liệu nếu là append mode ──
  let bank;
  if (APPEND_MODE && existsSync(filePath)) {
    bank = JSON.parse(readFileSync(filePath, 'utf-8'));
    console.log(`\n  ✅ Đã load session-${sessionId}.json — hiện có ${bank.questions.length} câu hỏi.`);
  } else {
    if (APPEND_MODE) {
      console.log(`\n  ℹ️  Chưa có session-${sessionId}.json — sẽ tạo mới.`);
    }
    const chapter = await ask('Tên chương (ví dụ: Ch.1 §1.1)', `Ch.${Math.ceil(sessionId / 2)}`);
    const title   = await askRequired('Tên buổi học');
    const timeStr = await ask('Thời gian làm bài (phút)', '10');

    bank = {
      session: sessionId,
      chapter,
      title,
      time_limit_minutes: parseInt(timeStr) || 10,
      questions: []
    };
  }

  // Đếm MC và TF hiện có để đánh số đúng
  let mcCount = bank.questions.filter(q => q.type === 'mc').length;
  let tfCount  = bank.questions.filter(q => q.type === 'tf').length;

  // ── Vòng lặp nhập câu hỏi ──
  console.log('\n');
  printSeparator('Bắt đầu nhập câu hỏi');
  console.log('  Nhấn Enter không nhập gì tại bước "Thêm câu tiếp?" để dừng.\n');

  while (true) {
    const typeRaw = await askChoice(
      'Loại câu hỏi  [MC = trắc nghiệm | TF = đúng/sai | X = xong]',
      ['MC', 'TF', 'X']
    );

    if (typeRaw === 'X') break;

    let q;
    if (typeRaw === 'MC') {
      mcCount++;
      q = await enterMCQuestion(sessionId, mcCount);
    } else {
      tfCount++;
      q = await enterTFQuestion(sessionId, tfCount);
    }

    bank.questions.push(q);

    console.log(`\n  ✅ Đã thêm: [${q.type.toUpperCase()}] ${q.question.slice(0, 60)}...`);
    console.log(`     ID: ${q.id}  |  Đáp án: ${q.correct}`);
    console.log(`     Tổng hiện tại: ${bank.questions.length} câu (${mcCount} MC + ${tfCount} T/F)\n`);
  }

  // ── Lưu file ──
  if (bank.questions.length === 0) {
    console.log('\n  ⚠️  Chưa có câu nào được nhập. File không được tạo.\n');
    rl.close(); return;
  }

  writeFileSync(filePath, JSON.stringify(bank, null, 2), 'utf-8');

  printBox([
    `✅  Đã lưu: session-${sessionId}.json`,
    '',
    `📌 Buổi:      ${bank.title}`,
    `📂 Chapter:   ${bank.chapter}`,
    `⏱️  Thời gian: ${bank.time_limit_minutes} phút`,
    `❓ Tổng câu:  ${bank.questions.length} (${mcCount} MC + ${tfCount} T/F)`,
    '',
    `📁 ${filePath}`,
  ]);

  console.log('  📋 Kiểm tra nhanh với server:\n');
  console.log('     npm run dev');
  console.log(`     curl http://localhost:3000/api/quizzes/${sessionId}  (cần token auth)\n`);

  rl.close();
}

main().catch(err => {
  console.error('\n  ❌ Lỗi:', err.message);
  rl.close();
  process.exit(1);
});
