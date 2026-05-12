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

async function rebuildAndImport() {
  const spreadsheetId = process.argv[2];
  const relativeFilePath = process.argv[3];

  if (!spreadsheetId || !relativeFilePath) {
    console.error('❌ Vui lòng cung cấp: [SpreadsheetID] [Đường dẫn file .md]');
    process.exit(1);
  }

  const filePath = join(__dirname, '..', relativeFilePath);
  console.log(`🧹 Đang xử lý: ${relativeFilePath} -> ${spreadsheetId}`);
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Xóa toàn bộ dữ liệu cũ
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'students!A1:Z1000'
    });

    // 2. Định nghĩa Tiêu đề chuẩn
    const headers = [
      'student_id', 
      'email', 
      'full_name', 
      'password_hash', 
      'role', 
      'created_at', 
      'last_login', 
      'must_change_password'
    ];

    // 3. Chuẩn bị dữ liệu sinh viên từ file .md
    const content = fs.readFileSync(filePath, 'utf-8');
    const rowRegex = /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi;
    
    const rows = [headers]; // Dòng đầu tiên là tiêu đề
    let match;
    while ((match = rowRegex.exec(content)) !== null) {
      const student_id = match[2].trim();
      const full_name = `${decodeHTML(match[3])} ${decodeHTML(match[4])}`.replace(/\s+/g, ' ').trim();
      const hash = await bcrypt.hash(student_id, 10);
      rows.push([
        student_id,
        `${student_id}@st.hub.edu.vn`,
        full_name,
        hash,
        'student',
        new Date().toISOString(),
        '',
        'TRUE' // must_change_password
      ]);
    }

    // 4. Ghi toàn bộ lên Google Sheets
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'students!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });

    console.log(`✅ ĐÃ XONG! Đã nạp ${rows.length - 1} sinh viên.`);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  }
}

rebuildAndImport();
