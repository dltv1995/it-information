/*
 * แก้ข้อมูลเฉพาะไฟล์นี้
 *
 * สำคัญ:
 * 1. รวมภาพโลโก้ทั้งหมด Compile พร้อมกันเป็น targets-all.mind เพียงไฟล์เดียว
 * 2. ลำดับภาพตอน Compile ต้องตรงกับ targetIndex ด้านล่าง
 * 3. หาก Compile ใหม่ ให้เพิ่ม MIND_REVISION เพื่อป้องกัน Cache
 */

window.AR_CONFIG = {
  mindFile: "./targets-all.mind",
  mindRevision: 1,
  foundDelay: 350,
  reopenCooldown: 1200
};

window.AR_TARGETS = [
  {
    targetIndex: 0,
    title: "หน่วยงานที่ 1",
    description: "วิดีโอแนะนำหน่วยงานที่ 1",
    linkUrl: "https://drive.google.com/file/d/1ca0sW0dnE03lvCHtZCTE5ynLQGfx1QRz/view?usp=sharing"
  },
  {
    targetIndex: 1,
    title: "หน่วยงานที่ 2",
    description: "วิดีโอแนะนำหน่วยงานที่ 2",
    linkUrl: "https://drive.google.com/file/d/16bFIdBUgPCX3hbTivfhry9mVPNVoTX9L/view?usp=sharing"
  },
  {
    targetIndex: 2,
    title: "หน่วยงานที่ 3",
    description: "วิดีโอแนะนำหน่วยงานที่ 3",
    linkUrl: "https://drive.google.com/file/d/1Dy3r17t--th4kqRXPU-sXoswBJsRjH8Y/view?usp=sharing"
  },
  {
    targetIndex: 3,
    title: "หน่วยงานที่ 4",
    description: "วิดีโอแนะนำหน่วยงานที่ 4",
    linkUrl: "https://drive.google.com/file/d/1k05FzNplvuT-m0CCUYD6oBa6zwZipFfC/view?usp=sharing"
  },
  {
    targetIndex: 4,
    title: "หน่วยงานที่ 5",
    description: "วิดีโอแนะนำหน่วยงานที่ 5",
    linkUrl: "https://drive.google.com/file/d/1IFLhDmYhDhi5Hp3_yGaMCLJ5HDWkqyCA/view?usp=sharing"
  },
  {
    targetIndex: 5,
    title: "หน่วยงานที่ 6",
    description: "วิดีโอแนะนำหน่วยงานที่ 6",
    linkUrl: "https://drive.google.com/file/d/1RrhXe_-SzBTob9u1FaBtVxVZmFIW3ZR5/view?usp=sharing"
  },
  {
    targetIndex: 6,
    title: "หน่วยงานที่ 7",
    description: "วิดีโอแนะนำหน่วยงานที่ 7",
    linkUrl: "https://drive.google.com/file/d/1J1DDB3Ah7mmZangvwo0oq_sHQDuq1c1g/view?usp=sharing"
  }
];
