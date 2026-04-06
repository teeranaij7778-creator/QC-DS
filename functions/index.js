/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const xlsx = require("xlsx");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();
const db = admin.firestore();

// ทำงานอัตโนมัติเมื่อมีไฟล์ใหม่โยนขึ้น Storage
exports.processExcelUpload = functions.region("asia-southeast1").runWith({ memory: "1GB", timeoutSeconds: 300 }).storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  
  // ตรวจสอบให้แน่ใจว่าทำงานเฉพาะไฟล์ที่ขึ้นต้นด้วย uploads/excel/ เท่านั้น
  if (!filePath.startsWith("uploads/excel/")) {
    console.log("ข้าม: ไม่ใช่ไฟล์ที่อัปโหลดจาก Dashboard");
    return null;
  }
  
  const parts = filePath.split('/');
  if (parts.length < 4) {
    console.log("ข้าม: ไม่พบ Project ID ใน Path");
    return null;
  }
  const projectId = parts[2];

  const bucket = admin.storage().bucket(object.bucket);
  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

  try {
    // 1. ดาวน์โหลดไฟล์ Excel เข้ามาในพื้นที่ชั่วคราวของเซิร์ฟเวอร์
    await bucket.file(filePath).download({ destination: tempFilePath });
    console.log(`ดาวน์โหลดไฟล์ ${filePath} สำเร็จ กำลังเริ่มอ่านข้อมูล...`);

    // 2. แปลงข้อมูล Excel ด้วยไลบรารี xlsx
    const workbook = xlsx.readFile(tempFilePath);
    const allFormattedData = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(worksheet, { defval: null });

      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        let obj = {};
        let hasData = false;
        let respondentId = null;

        for (const key in row) {
          const cleanKey = String(key).trim();
          if (!cleanKey || cleanKey.startsWith('__EMPTY')) continue;

          let val = row[key];
          if (val !== null && val !== '') hasData = true;

          if (cleanKey.toUpperCase() === 'RESPONDENT_ID' && val !== null && val !== undefined) {
            respondentId = String(val).trim().replace(/\//g, '_');
          }

          const safeKey = cleanKey.replace(/[\.\/\[\]]/g, '_');
          obj[safeKey] = val;
        }
        
        if (!hasData) continue;
        if (respondentId && respondentId !== '-' && respondentId !== 'NULL') {
          obj._id = respondentId;
        }
        allFormattedData.push(obj);
      }
      
      // พัก Event Loop ระหว่างเปลี่ยนชีต ป้องกันไม่ให้แอปค้างจน Network (gRPC) ตัดการเชื่อมต่อ
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (allFormattedData.length === 0) {
      console.log("ไม่พบข้อมูลที่จะต้องอัปโหลด");
      fs.unlinkSync(tempFilePath);
      return null;
    }

    // 3. Batch Write เข้า Database (ลดขนาดและเพิ่มเวลาพัก)
    const chunks = [];
    const CHUNK_SIZE = 250;
    for (let i = 0; i < allFormattedData.length; i += CHUNK_SIZE) {
      chunks.push(allFormattedData.slice(i, i + CHUNK_SIZE));
    }

    let uploadedCount = 0;
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(item => {
        // หาค่า ID 
        const baseId = item._id || db.collection("interview_responses").doc().id;
        const docId = `${projectId}_${baseId}`;
        const itemToSave = { ...item, projectId };
        delete itemToSave._id;
        
        // ลบค่า undefined
        Object.keys(itemToSave).forEach(k => itemToSave[k] === undefined && delete itemToSave[k]);
        
        const docRef = db.collection("interview_responses").doc(docId); // <--- และแก้ชื่อ Collection ตรงนี้ด้วยครับ
        batch.set(docRef, itemToSave, { merge: true });
      });
      await batch.commit();
      uploadedCount += chunk.length;
      
      // หน่วงเวลา 200ms ระหว่างรอบ ป้องกันยิง Request รัวจนทะลุ Limit ของ Firestore
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ อัปโหลดและ Sync ข้อมูลจำนวน ${uploadedCount} รายการ สำเร็จ!`);

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการประมวลผล Excel:", error);
  } finally {
    // 4. ลบไฟล์ชั่วคราวทิ้งทุกครั้งเมื่อทำงานจบ
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }

  return null;
});