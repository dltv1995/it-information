AR LOGO V12 — READABLE + MIND VERIFY

จุดแก้หลัก
1. เขียน index.html, scan.html, config.js, select.js และ scan.js ใหม่แบบขึ้นบรรทัด อ่านง่าย
2. index.html ไม่ได้ฝังตัวสแกนโดยตรง แต่ select.js จะพาไป scan.html พร้อม agency, id และ revision
3. scan.html โหลด config.js ก่อน แล้ว scan.js สร้าง MindAR Scene ใหม่ด้วย .mind ที่เลือก
4. ตรวจไฟล์ .mind ด้วย fetch ก่อนเปิดกล้อง พร้อมแสดงชื่อไฟล์และขนาดจริง
5. เพิ่ม revision ต่อหน่วยงาน ป้องกัน Chrome/GitHub Pages ใช้ .mind เก่าจาก Cache
6. ตรวจ id จาก URL ป้องกัน index กับข้อมูลหน่วยงานไม่ตรงกัน

หากอัปโหลด .mind ใหม่
- เพิ่ม revision ของหน่วยงานนั้น เช่น 1 เป็น 2
- ชื่อ mindFile ต้องตรงกับไฟล์จริงทุกตัวอักษร
- แต่ละ .mind ที่มีภาพเดียวใช้ targetIndex: 0

ติดตั้ง
- อัปโหลดทุกไฟล์ทับ ar-logo/
- ลบ js/scanner.js เก่า ถ้ายังมี
- ใส่ .mind จริงใน mind/
- เปิด index.html?v=12
