import 'dotenv/config';
import db from './server/services/sheets.js';

async function verify() {
  console.log('--- ĐANG KIỂM TRA GOOGLE SHEETS ---');
  console.log('Sheet ID:', process.env.GOOGLE_SHEETS_ID);
  try {
    const students = await db.getAll('students');
    console.log('Tìm thấy', students.length, 'người trong bảng students:');
    students.forEach(s => {
      console.log(`- [${s.role}] ${s.full_name} (${s.email})`);
    });
  } catch (err) {
    console.error('Lỗi khi đọc Sheet:', err.message);
  }
}

verify();
