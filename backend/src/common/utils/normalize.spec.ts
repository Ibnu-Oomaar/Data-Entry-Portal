import { cleanDisplayName, escapeLike, normalizePersonName } from './normalize';

describe('normalizePersonName', () => {
  it('ignores case, outer and repeated whitespace', () => {
    expect(normalizePersonName('  AMINA   Yusuf ')).toBe('amina yusuf');
    expect(normalizePersonName('amina\tyusuf')).toBe('amina yusuf');
  });
  it('folds compatibility characters (NFKC), e.g. non-breaking spaces and full-width letters', () => {
    expect(normalizePersonName('Amina Yusuf')).toBe('amina yusuf');
    expect(normalizePersonName('Ａｍｉｎａ')).toBe('amina');
  });
  it('keeps different names different', () => {
    expect(normalizePersonName('Amina Yusuf')).not.toBe(normalizePersonName('Amina Yusuf Ali'));
  });
});

describe('cleanDisplayName', () => {
  it('keeps capitalisation but cleans whitespace', () => {
    expect(cleanDisplayName('  Amina   Yusuf ')).toBe('Amina Yusuf');
  });
});

describe('escapeLike', () => {
  it('neutralises LIKE wildcards in user search text', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
