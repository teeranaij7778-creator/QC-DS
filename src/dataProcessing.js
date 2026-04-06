// ฟังก์ชันสำหรับคำนวณ Crosstabulation หรือหา % ของข้อมูล
export const calculateCrosstab = (data, rowVars, colVars, pctType = 'row', aggType = 'count', valueVars = []) => {
  // แปลงให้เป็น Array เสมอ เพื่อรองรับทั้งแบบตัวเดียวและหลายตัว
  const rVars = Array.isArray(rowVars) ? rowVars : [rowVars];
  const cVars = Array.isArray(colVars) ? colVars : [colVars];

  if (rVars.length === 0 || cVars.length === 0 || !data || data.length === 0) {
    return null;
  }

  // กรองเอาเฉพาะข้อมูลที่มีครบทุกตัวแปรที่เลือก (ตัด Row ที่มีค่าว่างทิ้ง)
  const validData = data.filter(item => {
    return [...rVars, ...cVars].every(v => item[v] !== null && item[v] !== undefined && item[v] !== '');
  });
  
  if (validData.length === 0) return null;

  // ฟังก์ชันสำหรับต่อ String กรณีมีหลายตัวแปร (เช่น "ชาย ❯ 20-30")
  const makeKey = (item, vars) => vars.map(v => String(item[v])).join(' ❯ ');

  // หา Categories (กลุ่ม) ที่เกิดจากการประกอบตัวแปร และเรียงลำดับ
  const rowCategories = [...new Set(validData.map(item => makeKey(item, rVars)))].sort();
  const colCategories = [...new Set(validData.map(item => makeKey(item, cVars)))].sort();

  const table = {};
  let totalCount = 0;
  const rowTotals = {};
  const colTotals = {};
  const vVar = valueVars.length > 0 ? valueVars[0] : null;

  // 1. สร้างโครงตารางเปล่าๆ และ rowTotal เริ่มต้น
  for (const r of rowCategories) {
    table[r] = {};
    rowTotals[r] = { count: 0, sum: 0, avgCount: 0, average: 0 };
    for (const c of colCategories) {
      table[r][c] = { count: 0, percentage: 0, sum: 0, avgCount: 0, average: 0 };
    }
  }

  for (const c of colCategories) {
    colTotals[c] = { count: 0, sum: 0, avgCount: 0, average: 0 };
  }
  let totalSum = 0;
  let totalAvgCount = 0;

  // 2. วนลูปนับจำนวนข้อมูลในแต่ละช่อง
  for (const item of validData) {
    const rowValue = makeKey(item, rVars);
    const colValue = makeKey(item, cVars);

    if (table[rowValue] && table[rowValue][colValue]) {
        table[rowValue][colValue].count++;
        rowTotals[rowValue].count++;
        colTotals[colValue].count++;
        totalCount++;
        
        if (aggType === 'average' && vVar) {
            const rawVal = parseFloat(item[vVar]);
            if (!isNaN(rawVal)) {
                table[rowValue][colValue].sum += rawVal;
                table[rowValue][colValue].avgCount++;
                rowTotals[rowValue].sum += rawVal;
                rowTotals[rowValue].avgCount++;
                colTotals[colValue].sum += rawVal;
                colTotals[colValue].avgCount++;
                totalSum += rawVal;
                totalAvgCount++;
            }
        }
    }
  }

  // 3. คำนวณ % และสร้างชุดข้อมูลสำหรับกราฟแท่ง
  const chartData = [];
  for (const r of rowCategories) {
    const chartRow = { name: String(r) };
    for (const c of colCategories) {
      const cell = table[r][c];
      if (aggType === 'average') {
        cell.average = cell.avgCount > 0 ? (cell.sum / cell.avgCount).toFixed(2) : "0.00";
        chartRow[String(c)] = parseFloat(cell.average);
      } else {
        let pct = 0;
        if (pctType === 'row' && rowTotals[r].count > 0) {
          pct = (cell.count / rowTotals[r].count) * 100;
        } else if (pctType === 'col' && colTotals[c].count > 0) {
          pct = (cell.count / colTotals[c].count) * 100;
        } else if (pctType === 'total' && totalCount > 0) {
          pct = (cell.count / totalCount) * 100;
        }
        cell.percentage = pct.toFixed(1);
        chartRow[String(c)] = parseFloat(cell.percentage);
      }
    }
    
    if (aggType === 'average') {
      rowTotals[r].average = rowTotals[r].avgCount > 0 ? (rowTotals[r].sum / rowTotals[r].avgCount).toFixed(2) : "0.00";
    }
    chartData.push(chartRow);
  }

  const grandTotalAverage = totalAvgCount > 0 ? (totalSum / totalAvgCount).toFixed(2) : "0.00";
  if (aggType === 'average') {
    for (const c of colCategories) {
      colTotals[c].average = colTotals[c].avgCount > 0 ? (colTotals[c].sum / colTotals[c].avgCount).toFixed(2) : "0.00";
    }
  }

  return { rowCategories, colCategories, table, rowTotals, colTotals, totalCount, grandTotalAverage, chartData, pctType, aggType };
};