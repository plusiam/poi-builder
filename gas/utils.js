// 공통 유틸리티

const SS_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

function getSpreadsheet_() {
  if (!SS_ID) throw new Error('SPREADSHEET_ID가 설정되지 않았습니다. PropertiesService를 확인하세요.');
  return SpreadsheetApp.openById(SS_ID);
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(`시트를 찾을 수 없습니다: ${name}`);
  return sheet;
}

// UUID v4 생성
function uuid_() {
  return Utilities.getUuid();
}

// 현재 시각 (ISO 8601)
function now_() {
  return new Date().toISOString();
}

// 오류 생성 헬퍼
function appError_(code, message) {
  const err = new Error(message);
  err.code_ = code;
  return err;
}

// 시트에서 헤더 → 인덱스 맵 생성
function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return map;
}

// 행 배열 → 객체 변환
function rowToObj_(row, map) {
  const obj = {};
  Object.entries(map).forEach(([k, i]) => { obj[k] = row[i]; });
  return obj;
}
