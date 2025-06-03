import { describe, it, expect } from 'vitest';
import { formatDate, generateDateRanges } from './date-utils';

describe('Date Utils', () => {
  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const testDate = new Date(2024, 0, 15);
      const formatted = formatDate(testDate);
      
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle single digit months and days', () => {
      const testDate = new Date(2024, 0, 5);
      const formatted = formatDate(testDate);
      
      expect(formatted).toBe('2024-01-05');
    });

    it('should handle double digit months and days', () => {
      const testDate = new Date(2024, 11, 25);
      const formatted = formatDate(testDate);
      
      expect(formatted).toBe('2024-12-25');
    });
  });

  describe('generateDateRanges', () => {
    it('should generate correct date ranges for single day chunks', () => {
      const ranges = generateDateRanges(1, 3);
      
      expect(ranges).toHaveLength(3);
      expect(ranges[0]).toHaveProperty('start');
      expect(ranges[0]).toHaveProperty('end');
      expect(ranges[0].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ranges[0].end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should generate correct date ranges for multi-day chunks', () => {
      const ranges = generateDateRanges(5, 10);
      
      expect(ranges).toHaveLength(2);
    });

    it('should handle edge case where days ahead is less than chunk size', () => {
      const ranges = generateDateRanges(7, 3);
      
      expect(ranges).toHaveLength(1);
    });

    it('should generate non-overlapping ranges', () => {
      const ranges = generateDateRanges(2, 6);
      
      expect(ranges).toHaveLength(3);
      
      for (let i = 1; i < ranges.length; i++) {
        const prevEnd = new Date(ranges[i - 1].end);
        const currentStart = new Date(ranges[i].start);
        prevEnd.setDate(prevEnd.getDate() + 1);
        expect(currentStart.getTime()).toBe(prevEnd.getTime());
      }
    });

    it('should handle exact division of days', () => {
      const ranges = generateDateRanges(5, 10);
      
      expect(ranges).toHaveLength(2);
    });
  });
}); 