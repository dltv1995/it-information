AR LOGO V13 — AUTO DETECT ALL TARGETS

แนวทางที่ถูกต้อง
- หน้าแรกเป็นหน้าสแกนทันที
- Compile โลโก้ทั้งหมดพร้อมกันเป็น targets-all.mind เพียงไฟล์เดียว
- MindAR ใช้ targetIndex 0 ถึง 5 เพื่อระบุว่าเจอโลโก้ใด
- เมื่อพบแล้วแสดงหน่วยงานและปุ่มเปิดลิงก์ที่กำหนด

ไม่ใช้ไฟล์ .mind แยก 6 ไฟล์ในโหมดอัตโนมัติ เพราะ MindAR Scene หนึ่งตัวโหลด imageTargetSrc เดียว

ติดตั้ง
1. เปิด MindAR Compiler
2. เลือกภาพทั้ง 6 พร้อมกันตามลำดับเดียวกับ AR_TARGETS
3. ดาวน์โหลดและเปลี่ยนชื่อเป็น targets-all.mind
4. วาง targets-all.mind ข้าง index.html
5. แก้ลิงก์ใน js/config.js
6. อัปโหลดทั้งหมดทับ ar-logo/
7. เปิด index.html?v=13

หาก Compile ใหม่ ให้แก้ mindRevision จาก 1 เป็น 2 เพื่อป้องกัน Cache
