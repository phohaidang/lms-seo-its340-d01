/**
 * Google Sheets Service — Database wrapper
 * 
 * In dev mode (no GOOGLE_SHEETS_ID): uses in-memory JSON store
 * In production: uses Google Sheets API v4
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');
const MOCK_DB_PATH = join(DATA_DIR, '_mock_db.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const IS_MOCK = !process.env.GOOGLE_SHEETS_ID;

// ============ MOCK MODE (in-memory + file persist) ============
let mockData = {
  students: [],
  quiz_attempts: [],
  exam_attempts: [],
  manual_grades: [],
  ebook_progress: [],
  course_config: [],
  session_feedback: [],
  attendance_log: []
};

if (IS_MOCK && existsSync(MOCK_DB_PATH)) {
  try {
    mockData = JSON.parse(readFileSync(MOCK_DB_PATH, 'utf-8'));
  } catch (e) {
    console.warn('Could not load mock DB, starting fresh');
  }
}

function saveMockDB() {
  writeFileSync(MOCK_DB_PATH, JSON.stringify(mockData, null, 2));
}

// ============ GOOGLE SHEETS MODE ============
let sheets = null;
let drive = null;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

if (!IS_MOCK) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
  });
  sheets = google.sheets({ version: 'v4', auth });
  drive = google.drive({ version: 'v3', auth });
}

// ============ UNIFIED API ============

/**
 * Get all rows from a sheet/table
 */
export async function getAll(sheetName) {
  if (IS_MOCK) {
    return mockData[sheetName] || [];
  }
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`
  });
  
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

/**
 * Find rows matching a condition
 */
export async function find(sheetName, predicate) {
  const all = await getAll(sheetName);
  return all.filter(predicate);
}

/**
 * Find one row matching a condition
 */
export async function findOne(sheetName, predicate) {
  const all = await getAll(sheetName);
  return all.find(predicate);
}

/**
 * Append a row to a sheet
 */
export async function append(sheetName, data) {
  if (IS_MOCK) {
    if (!mockData[sheetName]) mockData[sheetName] = [];
    mockData[sheetName].push(data);
    saveMockDB();
    return data;
  }
  
  const all = await getAll(sheetName);
  const headers = all.length > 0
    ? Object.keys(all[0])
    : Object.keys(data);
  
  const row = headers.map(h => {
    const val = data[h];
    return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  });
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] }
  });
  
  return data;
}

/**
 * Update a row matching a condition
 */
export async function update(sheetName, predicate, newData) {
  if (IS_MOCK) {
    const arr = mockData[sheetName] || [];
    const idx = arr.findIndex(predicate);
    if (idx >= 0) {
      mockData[sheetName][idx] = { ...arr[idx], ...newData };
      saveMockDB();
      return mockData[sheetName][idx];
    }
    return null;
  }
  
  // For Google Sheets: read all, find row index, update
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`
  });
  
  const rows = res.data.values;
  if (!rows || rows.length < 2) return null;
  
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = rows[i][j] || ''; });
    if (predicate(obj)) {
      const merged = { ...obj, ...newData };
      const updatedRow = headers.map(h => {
        const val = merged[h];
        return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${i + 1}:Z${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updatedRow] }
      });
      return merged;
    }
  }
  return null;
}

/**
 * Count rows matching a condition
 */
export async function count(sheetName, predicate) {
  const all = await getAll(sheetName);
  return predicate ? all.filter(predicate).length : all.length;
}

/**
 * Upload a file buffer to Google Drive
 */
export async function uploadToDrive(fileName, mimeType, buffer) {
  if (IS_MOCK || !drive) {
     console.warn('DRIVE MOCK: Skipped uploading', fileName, 'to Drive.');
     return `http://mock-drive-link/${fileName}`;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  };

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const media = {
    mimeType: mimeType,
    body: stream
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });
    return file.data.webViewLink;
  } catch (err) {
    console.error('Google Drive Upload error:', err);
    throw err;
  }
}

export default { getAll, find, findOne, append, update, count, uploadToDrive };

if (IS_MOCK) {
  console.log('📋 Database: Mock mode (in-memory + file persist)');
} else {
  console.log('📋 Database: Google Sheets connected');
}
