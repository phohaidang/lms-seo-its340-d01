# Hướng Dẫn Đưa LMS Hub Lên Vercel (Từ A-Z)

Đây là bức tranh tổng quan để bạn hình dung lộ trình: **Cài đặt Google Service "Con Bot"** ➡️ **Kết nối vào dữ liệu của bạn** ➡️ **Đẩy Code lên GitHub** ➡️ **Triển khai lên Vercel**. 
Đừng lo nếu bạn chưa làm bao giờ, hãy làm lần lượt từng bước bên dưới. Chậm mà chắc.

---

## BƯỚC 1: TẠO "CON BOT" TRUNG GIAN TRÊN GOOGLE CLOUD
Vì ứng dụng của bạn không chạy ở máy tính cá nhân nữa mà chạy trên mây (Vercel), nó cần phải có thẻ căn cước (Con Bot) để Google cho phép mở trang Google Sheets/Drive của bạn.

1. Truy cập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Đăng nhập bằng Gmail của bạn. Tiếp tục bấm nút **Select a Project** (ở góc trái trên cùng) ➡️ chọn **New Project** ➡️ Đặt tên (VD: `LMS-Hub-Production`) ➡️ Tạo.
3. Ở thanh công cụ tìm kiếm trên cùng của Google Cloud, gõ chữ `Google Sheets API` ➡️ Chọn kết quả đầu tiên ➡️ Nhấn **Enable**.
4. Tiếp tục tìm chữ `Google Drive API` ➡️ Nhấn **Enable**.
5. Chọn mục **APIs & Services** (ở menu bên trái) ➡️ Chọn **Credentials**.
6. Ấn núi dấu cộng **Create Credentials** trên cùng ➡️ Hãy chọn dòng **Service Account**.
   - Tên: Đặt `lms-bot`. Nút Xong.
   - Bảng tiếp theo: **Bỏ qua** luôn không cần chọn Role gì cả.
7. Khi tạo xong, bên dưới màn hình sẽ xuất hiện con Bot bạn vừa tạo. Nó có dạng một địa chỉ Email (VD: `lms-bot@lms-hub-...gserviceaccount.com`). **=> Hãy COPY dòng Email này ra Note.** Đây là thông số `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
8. Bấm vào cái Email đó ➡️ Chuyển sang Tab **Keys** ➡️ Nút **Add Key** ➡️ **Create New Key** ➡️ Mặc định là **JSON** ➡️ Bấm Create.
9. Trình duyệt tự tải xuống một file Text. Mở nó ra, bạn tìm dòng có chữ `"private_key": "-----BEGIN PRIVATE KEY-----...\n"`. **=> Hãy COPY Nguyên dải chữ khổng lồ đó.** Đây là thông số `GOOGLE_PRIVATE_KEY` của ta.

---

## BƯỚC 2: CẤP QUYỀN CHO CON BOT VÀO CƠ SỞ DỮ LIỆU CỦA BẠN
Con Bot vừa tạo chưa có quyền xem bất cứ file nào của bạn. Ta cần chủ động chỉ định cho nó.

1. **Với Data Điểm thi (Google Sheets):**
   - Bạn lập 1 bảng Excel nháp trên Google Drive (đặt tên `LMS Database`).
   - Mở bảng Excel đó ra. Bấm nút **Share (Chia sẻ)** góc tay phải.
   - Ở ô tìm người, dán cái **Email của Con Bot** (bạn vừa copy ở Bước 1) vào, cấp quyền **Editor (Người chỉnh sửa)** và lưu lại.
   - Nhìn lên Thanh Địa chỉ Trang Web của cái bảng Excel này, copy đoạn mã chữ hầm bà lằng nằm giữa `/d/` và `/edit`. VD: `https://docs.google.com/spreadsheets/d/1BxiMVs0X_.../edit` thì ID là cái dải `1BxiMVs...`. **=> COPY LẠI.** Đây là cái `GOOGLE_SHEETS_ID`.

2. **Với Nơi nộp File Word dự phòng (Google Drive):**
   - Về lại Google Drive của bạn. Tạo 1 thư mục tên `LMS_Backup_Exams`.
   - Right Click vào thư mục ➡️ Bấm **Share**. Dán **Email của Con Bot** vào ➡️ Cấp quyền **Editor**. Rất quan trọng! Thao tác này tương tự trên.
   - Nhìn trên đường link trình duyệt của thư mục này. Thông thường nó trông thế này: `https://drive.google.com/drive/folders/ABCDEF123456`. Dải `ABCDEF123456` chính là Data ID cần lưu. **=> COPY LẠI.** Đây là dải `GOOGLE_DRIVE_FOLDER_ID`.

---

## BƯỚC 3: ĐẨY CODE LÊN GITHUB
1. Mở Github Desktop (hoặc Terminal trên VSCode).
2. Kiểm tra xem file ẩn `.env` trong thư mục gốc đã có trong danh sách `.gitignore` chưa. Nếu mọi thứ xanh sách, hãy làm 2 lệnh:
   - Commit Toàn bộ: Viết tên "Chuẩn bị Đẩy lên Vercel".
   - Push Origin (Đẩy code lên).
   *Lưu ý:* Phải để `Repository` trên GitHub chịu trách nhiệm quản lý dòng Code này nằm ở chế độ **Private (Riêng tư)** nhé để bảo mật bài thi!

---

## BƯỚC 4: PUSH NÚT VERCEL CUỐI CÙNG LÊN INTERNET
1. Vào trang web [Vercel.com](https://vercel.com/) ➡️ Đăng nhập hoặc tạo mới thông qua thẳng nút **Continue with GitHub**.
2. Ở Dashboard, bấm mũi tên đen kế bên chữ **Add New...** ➡️ Chọn **Project**.
3. Vercel sẽ tự động phát hiện danh sách Source code bên GitHub của bạn. Bạn thấy hiện `lms-hub` ➡️ Ấn chữ **Import**.
4. Màn hình Cài Đặt (Configure) mở ra. 
   - **Framework Preset**: Hãy Cứ để Vercel tự nhận (`Vite`).
   - Mở mũi tên chữ **Environment Variables**, ta sẽ chép lại cả thảy 4 dải thông số đã gom góp ở trên như sau. Chép 4 lượt ấn Add liên tục:
     - Dòng 1. Name: `GOOGLE_SHEETS_ID` | Value: *(dán ID Excel)*
     - Dòng 2. Name: `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Value: *(dán Email con Bot)*
     - Dòng 3. Name: `GOOGLE_PRIVATE_KEY` | Value: *(dán toàn bộ chuỗi khổng lồ Key sinh ra ở file tải về)*
     - Dòng 4. Name: `GOOGLE_DRIVE_FOLDER_ID` | Value: *(dán ID thư mục lưu file up load Word)*
5. Cuối cùng: Nhấn cái Nút **Deploy** To đùng! 
6. Chỉ mất đúng 20-30 giây, Màn hình tung pháo hoa chúc mừng LMS Hub của bạn đã online trên Internet với một đường dẫn toàn cầu.

**🎉 XONG RỒI ĐẤY!** Mọi thứ đã hoàn tất. Bạn có thắc mắc chi tiết tại phần nào không?
