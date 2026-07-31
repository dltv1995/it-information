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
    title: "หน่วยงานที่ 2",
    description: "วิดีโอแนะนำหน่วยงานที่ 2",
    mindFile: "./mind/targets-2.mind",
    driveUrl: "https://drive.google.com/file/d/1KtGq_vBW8OsjZD0tgBAWpvogWHZ2lxfj/view?usp=sharing",
    logo: "./logos/agency2.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-3",
    title: "หน่วยงานที่ 3",
    description: "วิดีโอแนะนำหน่วยงานที่ 3",
    mindFile: "./mind/targets-3.mind",
    driveUrl: "https://drive.google.com/file/d/1gmwAtmeErlxuYv_Ap--B1-Pg7La__Ud7/view?usp=sharing",
    logo: "./logos/agency3.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-4",
    title: "หน่วยงานที่ 4",
    description: "วิดีโอแนะนำหน่วยงานที่ 4",
    mindFile: "./mind/targets-4.mind",
    driveUrl: "https://drive.google.com/file/d/192trhrQfRrEHgiO8nQ5Ts7poyf4pMJ-5/view?usp=sharing",
    logo: "./logos/agency4.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-5",
    title: "หน่วยงานที่ 5",
    description: "วิดีโอแนะนำหน่วยงานที่ 5",
    mindFile: "./mind/targets-5.mind",
    driveUrl: "https://drive.google.com/file/d/1vn8HhUO9orr7AtLya0gLFOC8wLaTIztH/view?usp=sharing",
    logo: "./logos/agency5.png",
    revision: 1,
    targetIndex: 0
  },
  {
    id: "agency-6",
    title: "หน่วยงานที่ 6",
    description: "วิดีโอแนะนำหน่วยงานที่ 6",
    mindFile: "./mind/targets-6.mind",
    driveUrl: "https://drive.google.com/file/d/1nx-07GRZfHHPGJvCq27wKOCbDgW2798A/view?usp=sharing",
    logo: "./logos/agency6.png",
    revision: 1,
    targetIndex: 0
  }
];
