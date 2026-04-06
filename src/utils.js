import { RESULT_COLORS, MONTH_ORDER } from './constants';

export const formatResultDisplay = (text) => (text ? text.split('(')[0].trim() : '-');

export const getResultColor = (fullText) => {
  if (!fullText) return '#94a3b8';
  for (const [key, color] of Object.entries(RESULT_COLORS)) {
    if (fullText.startsWith(key)) return color;
  }
  return '#94a3b8';
};

export const getDriveId = (url) => {
  if (!url) return null;
  const strUrl = String(url);
  const driveMatch = strUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return driveMatch[1];
  const idMatch = strUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (strUrl.includes('drive.google.com') && idMatch && idMatch[1]) return idMatch[1];
  return null;
};

export const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return str;
};

export const getMonthWeight = (monthStr) => {
  if (!monthStr) return 99;
  const m = monthStr.trim().toUpperCase();
  if (MONTH_ORDER[m]) return MONTH_ORDER[m];
  const prefix = m.substring(0, 3);
  if (MONTH_ORDER[prefix]) return MONTH_ORDER[prefix];
  return 99;
};