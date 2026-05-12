import { google } from 'googleapis';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function decodeHTML(str) {
  return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&nbsp;/g, ' ')
            .trim();
}

async function directImport() {
  console.log('🚀 Bắt đầu Import Trực Tiếp (Bypass System)...');
  
  const filePath = join(__dirname, '../client/public/Class/BAF737_252_L10.xls.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  const rowRegex = /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi;
  
  const students = [];
  let match;
  while ((match = rowRegex.exec(content)) !== null) {
    const student_id = match[2].trim();
    const full_name = `${decodeHTML(match[3])} ${decodeHTML(match[4])}`.replace(/\s+/g, ' ').trim();
    const hash = await bcrypt.hash(student_id, 10);
    students.push([
      student_id,
      `${student_id}@st.hub.edu.vn`,
      full_name,
      hash,
      'student',
      new Date().toISOString(),
      ''
    ]);
  }

  console.log(`📦 Đã chuẩn bị ${students.length} sinh viên.`);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'students!A:G',
      valueInputOption: 'RAW',
      requestBody: { values: students }
    });
    console.log(`✅ THÀNH CÔNG RỰC RỠ! Đã nạp ${students.length} người lên Google Sheets.`);
    console.log(`Dòng được cập nhật: ${res.data.updates.updatedRange}`);
  } catch (err) {
    console.error('❌ Lỗi nạp dữ liệu:', err.message);
  }
}

directImport();
