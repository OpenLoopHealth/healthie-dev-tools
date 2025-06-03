import { DateRange } from '../types';

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateDateRanges(daysPerChunk: number, daysAhead: number): DateRange[] {
  const ranges: DateRange[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStart = new Date(today);
  const finalEnd = new Date(today);
  finalEnd.setDate(finalEnd.getDate() + daysAhead);
  
  while (currentStart < finalEnd) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + daysPerChunk - 1);
    
    if (currentEnd > finalEnd) {
      currentEnd.setTime(finalEnd.getTime());
    }
    
    ranges.push({
      start: formatDate(currentStart),
      end: formatDate(currentEnd)
    });
    
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return ranges;
} 