import 'dotenv/config';
const key = process.env.GOOGLE_PRIVATE_KEY;
console.log('--- KEY TRƯỚC KHI XỬ LÝ ---');
console.log(key.substring(0, 50) + '...');
console.log('--- KEY SAU KHI XỬ LÝ (REPLACE \\n) ---');
const processed = key?.replace(/\\n/g, '\n').replace(/"/g, '');
console.log(processed.substring(0, 50) + '...');
if (processed.includes('\n')) {
  console.log('✅ Đã nhận diện được ký tự xuống dòng.');
} else {
  console.log('❌ Vẫn chưa nhận diện được ký tự xuống dòng.');
}
