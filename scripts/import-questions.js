/**
 * Import Questions — Parse testbank from HTML lesson plans
 * 
 * Reads the HTML lesson files and extracts MC/TF questions from the
 * "Câu hỏi Testbank liên quan" sections at the end of each file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source: lesson HTML files from the vault
const LESSONS_SOURCE = join(__dirname, '..', 'client', 'public', 'lessons');
const OUTPUT_DIR = join(__dirname, '..', 'server', 'data', 'questions');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const SESSION_META = [
  { id: 1, chapter: 'Ch.1', title: 'Buổi 1 — Tổng quan SEO & Thuật toán Google' },
  { id: 2, chapter: 'Ch.1', title: 'Buổi 2 — Nghiên cứu từ khóa & Phân tích đối thủ' },
  { id: 3, chapter: 'Ch.2', title: 'Buổi 3 — SEO On-page & Kỹ thuật tối ưu nội dung' },
  { id: 4, chapter: 'Ch.2', title: 'Buổi 4 — SEO Technical & Cấu trúc website' },
  { id: 5, chapter: 'Ch.3', title: 'Buổi 5 — SEO Off-page & Xây dựng liên kết' },
  { id: 6, chapter: 'Ch.3', title: 'Buổi 6 — Đo lường, Phân tích & Báo cáo SEO' }
];

const HTML_FILES = [
  'buoi-1.html',
  'buoi-2.html',
  'buoi-3.html',
  'buoi-4.html',
  'buoi-5.html',
  'buoi-6.html'
];

console.log('📝 Importing questions from HTML lesson plans...\n');

let totalQuestions = 0;

for (let i = 0; i < HTML_FILES.length; i++) {
  const meta = SESSION_META[i];
  const filePath = join(LESSONS_SOURCE, HTML_FILES[i]);
  
  if (!existsSync(filePath)) {
    console.log(`  ⚠️ File not found: ${HTML_FILES[i]}`);
    continue;
  }
  
  const html = readFileSync(filePath, 'utf-8');
  const questions = [];
  
  // Extract MC questions: "MC: description → answer (Đáp án: X)"
  const mcRegex = /MC:\s*(.+?)(?:\(Đáp án:\s*([A-D])\))/g;
  let match;
  
  while ((match = mcRegex.exec(html)) !== null) {
    const questionText = match[1].trim().replace(/\s*→\s*/, ' → ');
    const correct = match[2];
    
    questions.push({
      id: `s${meta.id}-mc${questions.length + 1}`,
      type: 'mc',
      question: questionText,
      options: [
        `A. ${extractOption(questionText, 'A')}`,
        `B. ${extractOption(questionText, 'B')}`,
        `C. ${extractOption(questionText, 'C')}`,
        `D. ${extractOption(questionText, 'D')}`
      ],
      correct: correct
    });
  }
  
  // Extract T/F questions
  const tfRegex = /T\/F:\s*["""](.+?)["""].*?→\s*(True|False)/g;
  while ((match = tfRegex.exec(html)) !== null) {
    questions.push({
      id: `s${meta.id}-tf${questions.length + 1}`,
      type: 'tf',
      question: match[1].trim(),
      correct: match[2].toLowerCase() === 'true'
    });
  }
  
  // Save to JSON
  const output = {
    session: meta.id,
    chapter: meta.chapter,
    title: meta.title,
    time_limit_minutes: 10,
    questions
  };
  
  const outputPath = join(OUTPUT_DIR, `session-${meta.id}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  totalQuestions += questions.length;
  console.log(`  ✅ Buổi ${meta.id}: ${questions.length} câu hỏi → session-${meta.id}.json`);
}

console.log(`\n🎯 Tổng cộng: ${totalQuestions} câu hỏi đã import`);
console.log(`📁 Output: ${OUTPUT_DIR}`);

function extractOption(text, letter) {
  // Simplified — in real version, parse from full question context
  return `Option ${letter}`;
}
