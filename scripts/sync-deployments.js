/**
 * sync-deployments.js
 * 
 * Script đồng bộ mã nguồn chuẩn từ template sang tất cả các deployment khác.
 * Giúp cập nhật tính năng và sửa lỗi cho 10+ lớp cùng lúc.
 * 
 * Usage: node scripts/sync-deployments.js [--dry-run]
 */

import {
  existsSync, mkdirSync, copyFileSync,
  readdirSync, statSync, writeFileSync, readFileSync
} from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────
// Cấu hình đồng bộ
// ─────────────────────────────────────────────

const SOURCE_ROOT = resolve(__dirname, '..');
const PROJECTS_ROOT = resolve(SOURCE_ROOT, '..');
const SOURCE_NAME = basename(SOURCE_ROOT);

const IS_DRY_RUN = process.argv.includes('--dry-run');

// Danh sách các file/thư mục CORE cần đồng bộ (Ghi đè)
const CORE_PATHS = [
  'client/src',
  'client/index.html',
  'server',
  'scripts',
  'vercel.json',
  '.gitignore',
  'package.json' // Sẽ được merge thông minh, không ghi đè thô bạo
];

// Danh sách các file/thư mục CẤM ghi đè (Dữ liệu riêng của lớp)
const PROTECTED_PATHS = [
  '.env',
  'data',
  'server/data',
  'client/public/lessons',
  'client/public/slides',
  'node_modules',
  '.git',
  '.vercel'
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function copyRecursive(src, dest) {
  // Kiểm tra xem đường dẫn có bị cấm không
  const relativePath = src.replace(SOURCE_ROOT, '').replace(/^[\\\/]/, '').replace(/\\/g, '/');
  if (PROTECTED_PATHS.some(p => relativePath.startsWith(p))) {
    return;
  }

  const stat = statSync(src);
  if (stat.isDirectory()) {
    if (!existsSync(dest)) {
      if (!IS_DRY_RUN) mkdirSync(dest, { recursive: true });
    }
    const entries = readdirSync(src);
    for (const entry of entries) {
      copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    // Đặc biệt cho package.json, ta sẽ merge thay vì copy
    if (basename(src) === 'package.json') {
       mergePackageJson(src, dest);
       return;
    }
    
    if (!IS_DRY_RUN) copyFileSync(src, dest);
  }
}

function mergePackageJson(srcPath, destPath) {
  if (!existsSync(destPath)) {
    if (!IS_DRY_RUN) copyFileSync(srcPath, destPath);
    return;
  }

  const srcPkg = JSON.parse(readFileSync(srcPath, 'utf-8'));
  const destPkg = JSON.parse(readFileSync(destPath, 'utf-8'));

  // Giữ lại các thông tin nhận diện của đích
  const merged = {
    ...srcPkg,
    name: destPkg.name,
    description: destPkg.description,
    version: destPkg.version,
    // Ưu tiên scripts của nguồn (vì ta muốn đồng bộ logic chạy)
    scripts: { ...destPkg.scripts, ...srcPkg.scripts },
    // Hợp nhất dependencies
    dependencies: { ...destPkg.dependencies, ...srcPkg.dependencies },
    devDependencies: { ...destPkg.devDependencies, ...srcPkg.devDependencies }
  };

  if (!IS_DRY_RUN) {
    writeFileSync(destPath, JSON.stringify(merged, null, 2) + '\n');
  }
}

function printBox(lines, color = '36') {
  const width = Math.max(...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  console.log(`\x1b[${color}m╔${border}╗`);
  for (const line of lines) {
    console.log(`║  ${line.padEnd(width - 2)}  ║`);
  }
  console.log(`╚${border}╝\x1b[0m`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  printBox([
    '🔄  LMS Hub — Deployment Sync Tool',
    `Nguồn chuẩn: ${SOURCE_NAME}`,
    IS_DRY_RUN ? '⚠️  CHẾ ĐỘ CHẠY THỬ (DRY RUN)' : '🚀 ĐANG ĐỒNG BỘ THẬT'
  ]);

  const allFolders = readdirSync(PROJECTS_ROOT);
  const targets = allFolders.filter(f => 
    f.startsWith('lms-') && 
    f !== SOURCE_NAME && 
    statSync(join(PROJECTS_ROOT, f)).isDirectory()
  );

  if (targets.length === 0) {
    console.log('  ❌ Không tìm thấy deployment nào khác để đồng bộ (phải bắt đầu bằng lms-).');
    return;
  }

  console.log(`  🔍 Tìm thấy ${targets.length} target(s): ${targets.join(', ')}\n`);

  for (const target of targets) {
    const destRoot = join(PROJECTS_ROOT, target);
    console.log(`  ⏳ Syncing to [${target}]...`);
    
    for (const p of CORE_PATHS) {
      const srcPath = join(SOURCE_ROOT, p);
      const destPath = join(destRoot, p);
      
      if (existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
      }
    }
    console.log(`  ✅ [${target}] updated.\n`);
  }

  printBox([
    '🎉 ĐỒNG BỘ HOÀN TẤT!',
    `Đã cập nhật ${targets.length} deployments.`,
    'Lưu ý: Chạy "npm install" ở các thư mục target nếu có dependency mới.'
  ], '32');
}

main().catch(err => {
  console.error('\n  ❌ Lỗi:', err.message);
  process.exit(1);
});
