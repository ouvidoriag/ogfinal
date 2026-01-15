/**
 * Date Utils Module - Sistema centralizado de cálculos e formatação de datas
 * Otimizado para evitar duplicação e garantir consistência
 */

const dateCache = {
  today: null,
  todayTimestamp: null,
  currentMonth: null,
  currentYear: null,
  lastUpdate: null
};

const CACHE_TTL = 60 * 1000; // 1 minuto

function clearCacheIfExpired() {
  const now = Date.now();
  if (!dateCache.lastUpdate || (now - dateCache.lastUpdate) > CACHE_TTL) {
    dateCache.today = null;
    dateCache.todayTimestamp = null;
    dateCache.currentMonth = null;
    dateCache.currentYear = null;
    dateCache.lastUpdate = now;
  }
}

function getToday() {
  clearCacheIfExpired();
  if (!dateCache.today) {
    dateCache.today = new Date();
    dateCache.today.setHours(0, 0, 0, 0);
  }
  return new Date(dateCache.today);
}

function getTodayTimestamp() {
  clearCacheIfExpired();
  if (!dateCache.todayTimestamp) {
    dateCache.todayTimestamp = getToday().getTime();
  }
  return dateCache.todayTimestamp;
}

function getCurrentMonth() {
  clearCacheIfExpired();
  if (!dateCache.currentMonth) {
    const today = getToday();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    dateCache.currentMonth = `${year}-${month}`;
  }
  return dateCache.currentMonth;
}

function getCurrentYear() {
  clearCacheIfExpired();
  if (!dateCache.currentYear) {
    dateCache.currentYear = getToday().getFullYear();
  }
  return dateCache.currentYear;
}

function formatDate(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
  } else {
    return '';
  }
  
  return date.toLocaleDateString('pt-BR');
}

function formatMonthYear(ym) {
  if (!ym || typeof ym !== 'string') return ym || 'Data inválida';
  
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  
  const [year, month] = parts;
  const monthIndex = parseInt(month) - 1;
  
  if (monthIndex < 0 || monthIndex > 11) return ym;
  
  const monthNames = window.config?.FORMAT_CONFIG?.MONTH_NAMES || 
    ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  return `${monthNames[monthIndex]}. de ${year}`;
}

function formatMonthYearShort(ym) {
  if (!ym || typeof ym !== 'string') return ym || 'Data inválida';
  
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  
  const [year, month] = parts;
  return `${month}/${year.slice(-2)}`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatPercentage(num, decimals = 1) {
  if (num === null || num === undefined) return '0%';
  return `${num.toFixed(decimals)}%`;
}

function formatDateShort(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
  } else {
    return '';
  }
  
  // Formato: DD/MM
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

window.dateUtils = {
  getToday,
  getTodayTimestamp,
  getCurrentMonth,
  getCurrentYear,
  formatDate,
  formatMonthYear,
  formatMonthYearShort,
  formatDateShort,
  formatNumber,
  formatPercentage
};

