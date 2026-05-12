/**
 * scaffold-new-course.js
 * 
 * Wizard tự động nhân bản lms-hub thành một deployment độc lập
 * cho một môn học mới.
 * 
 * Usage: node scripts/scaffold-new-course.js
 * 
 * Skill: 04-Skills/lms-scaffold/SKILL.md
 * SOP:   04-Skills/lms-scaffold/SOP.md
 */

import { createInterface } from 'readline';
import {
  existsSync, mkdirSync, copyFileSync,
  readdirSync, statSync, writeFileSync, readFileSync
} from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Template root = lms-hub (thư mục cha của scripts/)
const TEMPLATE_ROOT = resolve(__dirname, '..');
const PROJECTS_ROOT = resolve(TEMPLATE_ROOT, '..');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const hint = defaultValue ? ` (mặc định: ${defaultValue})` : '';
    rl.question(`  ${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function copyDirRecursive(src, dest, excludes = []) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src);
  for (const entry of entries) {
    if (excludes.includes(entry)) continue;

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludes);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function generateJwtSecret() {
  // Generate a random 64-char hex string without crypto module dependency issues
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function printBox(lines) {
  const width = Math.max(...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  console.log(`\n╔${border}╗`);
  for (const line of lines) {
    console.log(`║  ${line.padEnd(width - 2)}  ║`);
  }
  console.log(`╚${border}╝\n`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log('\n');
  printBox([
    '🎓  LMS Hub — Scaffold New Course',
    'Nhân bản hệ thống LMS cho môn học mới',
    '',
    'Skill: 04-Skills/lms-scaffold/SKILL.md',
  ]);

  console.log('  Trả lời các câu hỏi bên dưới. Nhấn Enter để dùng giá trị mặc định.\n');

  // ── Thu thập thông tin ──
  const folderName = await ask('Tên thư mục cho môn mới', 'lms-new-course');
  const courseCode = await ask('Mã môn học (COURSE_CODE)', 'ITS000');
  const courseName = await ask('Tên môn học đầy đủ (tiếng Việt)', 'Môn học mới');
  const localPort  = await ask('Port local', '3001');
  const adminEmail = await ask('Email admin (giảng viên)', 'admin@hub.edu.vn');
  const adminName  = await ask('Tên giảng viên', 'ThS. Giảng Viên');
  const adminPass  = await ask('Mật khẩu admin ban đầu', 'admin2026');
  const emailDomain= await ask('Domain email sinh viên được đăng ký', 'hub.edu.vn');

  const destRoot = join(PROJECTS_ROOT, folderName);

  // ── Kiểm tra xung đột ──
  if (existsSync(destRoot)) {
    console.error(`\n  ❌ Thư mục đã tồn tại: ${destRoot}`);
    console.error('     Xoá hoặc đổi tên trước khi chạy lại wizard.\n');
    rl.close();
    process.exit(1);
  }

  console.log('\n  ⏳ Đang scaffold...\n');

  // ── Copy codebase ──
  const EXCLUDES_ROOT = ['node_modules', '.env', 'data', 'test_final.docx'];
  copyDirRecursive(TEMPLATE_ROOT, destRoot, EXCLUDES_ROOT);
  console.log('  ✅ Copied codebase (không kèm node_modules, .env, data)');

  // ── Tạo cấu trúc data/ rỗng ──
  const dataDirs = [
    'server/data/questions',
    'server/data/ebook',
    'server/data/exams',
    'server/data/uploads',
    'data',
  ];
  for (const dir of dataDirs) {
    mkdirSync(join(destRoot, dir), { recursive: true });
  }
  // Tạo _mock_db.json rỗng
  writeFileSync(
    join(destRoot, 'data', '_mock_db.json'),
    JSON.stringify({ students: [], quiz_attempts: [], exam_attempts: [], manual_grades: [], ebook_progress: [], course_config: [] }, null, 2)
  );
  console.log('  ✅ Khởi tạo data/ directories');

  // ── Tạo client/public/lessons/ rỗng ──
  mkdirSync(join(destRoot, 'client', 'public', 'lessons'), { recursive: true });
  mkdirSync(join(destRoot, 'client', 'public', 'slides'), { recursive: true });
  console.log('  ✅ Khởi tạo client/public/lessons/ (trống — thêm HTML bài giảng vào đây)');

  // ── Viết .env ──
  const jwtSecret = generateJwtSecret();
  const envContent = `# Environment Configuration — ${courseCode} ${courseName}
# Được tạo tự động bởi scaffold-new-course.js vào ${new Date().toISOString()}
# KHÔNG commit file này lên git!

# Server
PORT=${localPort}
NODE_ENV=development

# JWT — UNIQUE cho mỗi deployment!
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h

# Google Sheets
GOOGLE_SHEETS_ID=your-spreadsheet-id-here
GOOGLE_SERVICE_ACCOUNT_EMAIL=lms-sheets-bot@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your-private-key-here
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id-here

# Admin
ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPass}
ADMIN_NAME=${adminName}

# Course
COURSE_CODE=${courseCode}
COURSE_NAME=${courseName}
ALLOWED_EMAIL_DOMAIN=${emailDomain}
`;
  writeFileSync(join(destRoot, '.env'), envContent);
  console.log('  ✅ Tạo .env với config môn học');

  // ── Cập nhật package.json ──
  const pkgPath = join(destRoot, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.name = folderName;
  pkg.description = `Learning Management System — ${courseName} (${courseCode})`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  ✅ Cập nhật package.json');

  // ── Cập nhật import-questions.js với placeholder ──
  const importQuestionsPath = join(destRoot, 'scripts', 'import-questions.js');
  if (existsSync(importQuestionsPath)) {
    let content = readFileSync(importQuestionsPath, 'utf-8');
    // Thay LESSONS_SOURCE path
    content = content.replace(
      /const LESSONS_SOURCE = .+;/,
      `const LESSONS_SOURCE = 'd:\\\\PARA\\\\Projects\\\\second-brain\\\\03-Domains\\\\Teaching\\\\${courseName}\\\\Lessons';`
    );
    // Reset SESSION_META và HTML_FILES về placeholder
    content = content.replace(
      /const SESSION_META = \[[\s\S]*?\];/,
      `const SESSION_META = [\n  // TODO: Thêm metadata các buổi học\n  // { id: 1, chapter: 'Ch.1', title: 'Buổi 1 — Tên buổi' },\n];`
    );
    content = content.replace(
      /const HTML_FILES = \[[\s\S]*?\];/,
      `const HTML_FILES = [\n  // TODO: Thêm tên file HTML tương ứng\n  // 'Buoi1_TenBuoi.html',\n];`
    );
    writeFileSync(importQuestionsPath, content);
    console.log('  ✅ Cập nhật import-questions.js (placeholder sẵn để điền)');
  }

  // ── Tạo .gitignore nếu chưa có ──
  const gitignorePath = join(destRoot, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, 'node_modules/\n.env\nserver/data/\ndata/\ndist/\n');
    console.log('  ✅ Tạo .gitignore');
  }

  // ── In hướng dẫn tiếp theo ──
  printBox([
    `✅  Scaffold hoàn tất!`,
    '',
    `📁 Thư mục: ${destRoot}`,
    `📌 Môn:     ${courseName} (${courseCode})`,
    `🔑 JWT:     ${jwtSecret.slice(0, 16)}... (unique, đã lưu vào .env)`,
  ]);

  console.log('  📋 Các bước tiếp theo:\n');
  console.log(`  1. Install dependencies:`);
  console.log(`     cd ${destRoot}`);
  console.log(`     npm install\n`);
  console.log(`  2. Thêm lesson HTML vào:`);
  console.log(`     ${join(destRoot, 'client', 'public', 'lessons', '/')}\n`);
  console.log(`  3. Cập nhật SESSION_META và HTML_FILES trong:`);
  console.log(`     scripts/import-questions.js\n`);
  console.log(`  4. Import quiz questions:`);
  console.log(`     npm run import:questions\n`);
  console.log(`  5. Setup Google Sheets (xem SOP.md Bước 4)\n`);
  console.log(`  6. Seed admin & test:`);
  console.log(`     npm run seed:admin`);
  console.log(`     npm run dev\n`);
  console.log(`  7. Deploy lên Vercel (xem SOP.md Bước 6)\n`);
  console.log(`  📖 SOP đầy đủ: d:\\PARA\\Projects\\second-brain\\04-Skills\\lms-scaffold\\SOP.md\n`);

  rl.close();
}

main().catch((err) => {
  console.error('\n  ❌ Lỗi:', err.message);
  rl.close();
  process.exit(1);
});
