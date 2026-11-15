import { describe, expect, it } from 'vitest';
import { classLabel, firstName, greeting, initials, timeAgo } from './utils';

describe('utils', () => {
  it('builds initials from the first two words', () => {
    expect(initials('Abdalle Ali Abdillahi Abdi')).toBe('AA');
    expect(initials('  madonna ')).toBe('M');
    expect(initials('')).toBe('?');
  });
  it('labels classes and sections', () => {
    expect(classLabel(3, 'C')).toBe('Class 3C');
    expect(classLabel(1)).toBe('Class 1');
  });
  it('takes the first name', () => {
    expect(firstName('Demo Teacher')).toBe('Demo');
  });
  it('describes elapsed time in plain words', () => {
    const now = new Date('2026-11-15T12:00:00Z').getTime();
    const ago = (s: number) => new Date(now - s * 1000).toISOString();
    expect(timeAgo(ago(10), now)).toBe('just now');
    expect(timeAgo(ago(5 * 60), now)).toBe('5 min ago');
    expect(timeAgo(ago(3 * 3600), now)).toBe('3 h ago');
    expect(timeAgo(ago(86400), now)).toBe('1 day ago');
    expect(timeAgo(ago(3 * 86400), now)).toBe('3 days ago');
  });
  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});
