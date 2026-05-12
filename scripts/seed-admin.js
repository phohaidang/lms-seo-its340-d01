/**
 * Seed Admin Account Script
 * Creates a default admin user for managing the LMS
 * 
 * Usage: node scripts/seed-admin.js
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const MOCK_DB_PATH = join(DATA_DIR, '_mock_db.json');

// Ensure data dir
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Load or create DB
let db = {
  students: [],
  quiz_attempts: [],
  exam_attempts: [],
  manual_grades: [],
  ebook_progress: [],
  course_config: []
};

if (existsSync(MOCK_DB_PATH)) {
  db = JSON.parse(readFileSync(MOCK_DB_PATH, 'utf-8'));
}

// Admin config
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hub.edu.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Giảng viên Admin';

// Check if admin already exists
const existing = db.students?.find(s => s.email === ADMIN_EMAIL);
if (existing) {
  console.log(`\n⚠️  Admin account already exists: ${ADMIN_EMAIL}`);
  console.log(`   Role: ${existing.role}`);
  
  // Force-update role and password
  const hashedPw = await bcrypt.hash(ADMIN_PASSWORD, 10);
  existing.role = 'admin';
  existing.password_hash = hashedPw;
  existing.full_name = ADMIN_NAME;
  writeFileSync(MOCK_DB_PATH, JSON.stringify(db, null, 2));
  console.log('   → Updated role to admin + reset password');
  
  console.log('\nDone!\n');
  process.exit(0);
}

// Create admin user
const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
const adminUser = {
  student_id: 'ADMIN',
  full_name: ADMIN_NAME,
  email: ADMIN_EMAIL,
  password_hash: hashedPassword,
  role: 'admin',
  registered_at: new Date().toISOString()
};

if (!db.students) db.students = [];
db.students.push(adminUser);
writeFileSync(MOCK_DB_PATH, JSON.stringify(db, null, 2));

console.log(`
╔═══════════════════════════════════════╗
║      ✅ Admin Account Created         ║
╠═══════════════════════════════════════╣
║  Email:    ${ADMIN_EMAIL.padEnd(25)} ║
║  Password: ${ADMIN_PASSWORD.padEnd(25)} ║
║  Name:     ${ADMIN_NAME.padEnd(25)} ║
║  Role:     admin                      ║
╚═══════════════════════════════════════╝
`);
