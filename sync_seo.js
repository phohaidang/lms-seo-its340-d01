import 'dotenv/config';
import db from './server/services/sheets.js';

async function syncSEOData() {
  console.log('🚀 Đang bắt đầu đồng bộ dữ liệu chuẩn môn SEO...');

  const seo_sessions = [
    { id: 1, chapter: 'Ch.1 §1.1-1.3', title: 'Tổng quan về SEO & Search Engine', topics: 'Cơ chế hoạt động của Google, Các loại SEO, Quy trình SEO tổng thể', clo: 'Hiểu bản chất và tầm quan trọng của SEO', hasLesson: 'x' },
    { id: 2, chapter: 'Ch.2 §2.1-2.4', title: 'Nghiên cứu Từ khóa (Keyword Research)', topics: 'User Intent, Công cụ nghiên cứu từ khóa, Lập kế hoạch từ khóa', clo: 'Xác định đúng bộ từ khóa mục tiêu', hasLesson: 'x' },
    { id: 3, chapter: 'Ch.3 §3.1-3.3', title: 'SEO On-page & Tối ưu nội dung', topics: 'Thẻ Meta, Cấu trúc bài viết chuẩn SEO, Tối ưu hình ảnh', clo: 'Biết cách tối ưu hóa một trang web cụ thể', hasLesson: 'x' },
    { id: 4, chapter: 'Ch.4 §4.1-4.2', title: 'Technical SEO & Trải nghiệm người dùng', topics: 'Sitemap, Robots.txt, Page Speed, Core Web Vitals', clo: 'Tối ưu cấu trúc kỹ thuật cho website', hasLesson: 'x' },
    { id: 5, chapter: 'Ch.5 §5.1-5.3', title: 'SEO Off-page & Xây dựng liên kết', topics: 'Backlinks, Topical Authority, Social Signals', clo: 'Tăng uy tín cho website qua các kênh bên ngoài', hasLesson: 'x' },
    { id: 6, chapter: 'Ch.6 §6.1-6.2', title: 'Đo lường & Báo cáo SEO', topics: 'Google Search Console, Google Analytics, Báo cáo thứ hạng', clo: 'Theo dõi và đánh giá hiệu quả chiến dịch', hasLesson: 'x' }
  ];

  try {
    // 1. Xóa (hoặc ghi đè) dữ liệu cũ trong course_config
    // Lưu ý: Do DB wrapper hiện tại chưa hỗ trợ Clear, tôi sẽ dùng lệnh để bạn biết cần cập nhật
    console.log('--- DANH SÁCH 6 BUỔI SEO CHUẨN ---');
    for (const s of seo_sessions) {
        console.log(`Đang nạp: Buổi ${s.id} - ${s.title}`);
        // Ghi đè vào database
        await db.update('course_config', item => parseInt(item.id) === s.id, s);
    }
    
    console.log('✅ ĐÃ CẬP NHẬT XONG 6 BUỔI HỌC SEO!');
    console.log('💡 LƯU Ý: Nếu trên GSheet vẫn hiện Python, bạn hãy xóa trắng Tab [course_config] rồi chạy lại lệnh này.');
  } catch (err) {
    console.error('Lỗi đồng bộ:', err.message);
  }
}

syncSEOData();
