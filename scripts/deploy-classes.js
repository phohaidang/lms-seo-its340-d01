/**
 * deploy-classes.js
 * 
 * Tự động nhân bản LMS cho từng lớp dựa trên danh sách sinh viên (.md)
 * trong thư mục client/public/Class/
 */

import {
  existsSync, mkdirSync, copyFileSync,
  readdirSync, statSync, writeFileSync, readFileSync
} from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_ROOT = resolve(__dirname, '..');
const PROJECTS_ROOT = resolve(SOURCE_ROOT, '..');
const CLASS_DIR = join(SOURCE_ROOT, 'client', 'public', 'Class');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function copyDirRecursive(src, dest, excludes = []) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src);
  for (const entry of entries) {
    if (excludes.includes(entry)) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) copyDirRecursive(srcPath, destPath, excludes);
    else copyFileSync(srcPath, destPath);
  }
}

function generateJwtSecret() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// ─────────────────────────────────────────────
// Main Logic
// ─────────────────────────────────────────────

async function deploy() {
  console.log('\n🚀 Starting Bulk Deployment for Classes...\n');

  if (!existsSync(CLASS_DIR)) {
    console.error('❌ Không tìm thấy thư mục Class tại:', CLASS_DIR);
    return;
  }

  const files = readdirSync(CLASS_DIR).filter(f => f.endsWith('.md'));
  console.log(`🔍 Tìm thấy ${files.length} file danh sách lớp.\n`);

  for (const file of files) {
    const filePath = join(CLASS_DIR, file);
    const content = readFileSync(filePath, 'utf-8');

    // 1. Trích xuất mã lớp (Lớp học phần: BAF737_252_L10)
    const classCodeMatch = content.match(/Lớp học phần:\s*([^<]+)/);
    const classCode = classCodeMatch ? classCodeMatch[1].trim() : file.replace('.xls.md', '');
    const folderName = `lms-${classCode.toLowerCase().replace(/_/g, '-')}`;
    const destRoot = join(PROJECTS_ROOT, folderName);

    console.log(`📦 Deploying [${classCode}] -> ${folderName}...`);

    if (existsSync(destRoot)) {
      console.warn(`  ⚠️ Thư mục ${folderName} đã tồn tại. Bỏ qua.`);
      continue;
    }

    // 2. Clone codebase
    const EXCLUDES = ['node_modules', '.env', 'data', '.git', '.vercel'];
    copyDirRecursive(SOURCE_ROOT, destRoot, EXCLUDES);

    // 3. Parse danh sách sinh viên
    // Regex cho format: <td ...>MSSV</td> ... <td>Ho lot</td> <td>Ten</td>
    const students = [];
    const studentRegex = /<tr>\s*<td[^>]*>\d+<\/td>\s*<td[^>]*class="studyprogram_normal_dl">(\d+)<\/td>\s*<td[^>]*>.*?<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/g;
    
    let match;
    const defaultPasswordHash = await bcrypt.hash('123456', 10); // Placeholder, will update later

    while ((match = studentRegex.exec(content)) !== null) {
      const mssv = match[1].trim();
      const fullName = (match[2].trim() + ' ' + match[3].trim()).replace(/\s+/g, ' ');
      
      // Password mặc định là MSSV
      const passwordHash = await bcrypt.hash(mssv, 10);

      students.push({
        student_id: mssv,
        email: `${mssv}@st.hub.edu.vn`,
        full_name: fullName,
        password_hash: passwordHash,
        role: 'student',
        must_change_password: true, // Ép đổi pass lần đầu
        created_at: new Date().toISOString(),
        last_login: null
      });
    }

    console.log(`  👥 Trích xuất thành công ${students.length} sinh viên.`);

    // 4. Khởi tạo Database cho lớp mới
    const dataDir = join(destRoot, 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    
    // Thêm Admin mặc định
    const adminUser = {
      student_id: 'ADMIN',
      full_name: process.env.ADMIN_NAME || 'ThS. Phó Hải Đăng',
      email: process.env.ADMIN_EMAIL || 'dangph@hub.edu.vn',
      password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin2026', 10),
      role: 'admin',
      registered_at: new Date().toISOString()
    };

    writeFileSync(
      join(dataDir, '_mock_db.json'),
      JSON.stringify({ 
        students: [adminUser, ...students], 
        quiz_attempts: [], 
        exam_attempts: [], 
        manual_grades: [], 
        ebook_progress: [], 
        course_config: [],
        attendance_log: [],
        session_feedback: []
      }, null, 2)
    );

    // 5. Tạo .env cho lớp mới
    const envContent = readFileSync(join(SOURCE_ROOT, '.env'), 'utf-8')
      .replace(/COURSE_CODE=.*/, `COURSE_CODE=${classCode}`)
      .replace(/JWT_SECRET=.*/, `JWT_SECRET=${generateJwtSecret()}`)
      .replace(/PORT=.*/, `PORT=${3001 + files.indexOf(file)}`); // Tăng port để chạy song song nếu cần
    
    writeFileSync(join(destRoot, '.env'), envContent);
    
    // 6. Cập nhật package.json
    const pkg = JSON.parse(readFileSync(join(destRoot, 'package.json'), 'utf-8'));
    pkg.name = folderName;
    writeFileSync(join(destRoot, 'package.json'), JSON.stringify(pkg, null, 2));

    console.log(`  ✅ Hoàn tất deploy lớp ${classCode}.\n`);
  }

  console.log('🎉 Bulk Deployment Finished!');
}

deploy().catch(console.error);
