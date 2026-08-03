AR LOGO V14 AUTO CAMERA + AUTO REDIRECT

- หน้าเว็บตรวจ targets-all.mind แล้วลองเปิดกล้องทันที
- ถ้า Safari/Browser บล็อก จะแสดงปุ่มแตะเปิดกล้องเป็น fallback
- เมื่อพบโลโก้ต่อเนื่อง ระบบใช้ window.location.assign ไปยัง URL ทันที
- ไม่มี Modal และไม่มีปุ่มยืนยันเปิดวิดีโอ
- ผู้ใช้ครั้งแรกยังต้องกดอนุญาตกล้องจาก Browser

ตั้งค่า: แก้ js/config.js และวาง targets-all.mind ข้าง index.html
หาก Compile ใหม่ ให้เพิ่ม mindRevision
