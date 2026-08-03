/*
 * แก้ข้อมูลเฉพาะไฟล์นี้
 *
 * id          ต้องไม่ซ้ำกัน
 * title       ชื่อหน่วยงาน
 * mindFile    ต้องตรงกับชื่อไฟล์จริงทุกตัวอักษร
 * driveUrl    ลิงก์ Google Drive
 * logo        รูปโลโก้ที่แสดงหน้าเลือก
 * revision    เปลี่ยนเลขนี้เมื่ออัปโหลด .mind ใหม่ เพื่อป้องกัน Cache
 * targetIndex ถ้า .mind มีภาพเดียว ให้ใช้ 0
 */
window.AR_AGENCIES = [
  {
    id: "agency-1",
    title: "หน่วยงานที่ 1",
    description: "วิดีโอแนะนำหน่วยงานที่ 1",
    mindFile: "./mind/targets.mind",
    driveUrl: "https://drive.google.com/file/d/1ca0sW0dnE03lvCHtZCTE5ynLQGfx1QRz/view?usp=sharing",
    logo: "./logos/agency1.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-2",
    title: "สพฐ",
    description: "วิดีโอแนะนำ สพฐ",
    mindFile: "./mind/targets-2.mind",
    driveUrl: "https://drive.google.com/file/d/16bFIdBUgPCX3hbTivfhry9mVPNVoTX9L/view?usp=sharing",
    logo: "./logos/agency2.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-3",
    title: "อปท",
    description: "วิดีโอแนะนำ อปท",
    mindFile: "./mind/targets-3.mind",
    driveUrl: "https://drive.google.com/file/d/1Dy3r17t--th4kqRXPU-sXoswBJsRjH8Y/view?usp=sharing",
    logo: "./logos/agency3.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-4",
    title: "ตชด",
    description: "วิดีโอแนะนำ ตชด",
    mindFile: "./mind/targets-4.mind",
    driveUrl: "https://drive.google.com/file/d/1k05FzNplvuT-m0CCUYD6oBa6zwZipFfC/view?usp=sharing",
    logo: "./logos/agency4.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-5",
    title: "พศ",
    description: "วิดีโอแนะนำ พศ",
    mindFile: "./mind/targets-5.mind",
    driveUrl: "https://drive.google.com/file/d/1IFLhDmYhDhi5Hp3_yGaMCLJ5HDWkqyCA/view?usp=sharing",
    logo: "./logos/agency5.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-6",
    title: "สช",
    description: "วิดีโอแนะนำ สช",
    mindFile: "./mind/targets-6.mind",
    driveUrl: "https://drive.google.com/file/d/1RrhXe_-SzBTob9u1FaBtVxVZmFIW3ZR5/view?usp=sharing",
    logo: "./logos/agency6.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-7",
    title: "กศน",
    description: "วิดีโอแนะนำ กศน",
    mindFile: "./mind/targets-7.mind",
    driveUrl: "https://drive.google.com/file/d/1J1DDB3Ah7mmZangvwo0oq_sHQDuq1c1g/view?usp=sharing",
    logo: "./logos/agency7.png",
    revision: 1,
    targetIndex: 0
  }
];
