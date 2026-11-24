import { describe, expect, it } from 'vitest';
import { parseCsv, serializeToCsv } from '../src/engine/csvParser';

describe('csvParser', () => {
  it('parses standard CSV with headers and rows', () => {
    const csv = 'id,name,amount\n1,Alice,100.50\n2,Bob,200.00';
    const result = parseCsv(csv);
    expect(result.error).toBeUndefined();
    expect(result.headers).toEqual(['id', 'name', 'amount']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ id: '1', name: 'Alice', amount: '100.50' });
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const csv = 'id,company,note\n1,"Acme, Inc.","Said ""Hello"""';
    const result = parseCsv(csv);
    expect(result.error).toBeUndefined();
    expect(result.rows[0].company).toBe('Acme, Inc.');
    expect(result.rows[0].note).toBe('Said "Hello"');
  });

  it('rejects empty CSV files with a descriptive error', () => {
    const emptyRes = parseCsv('');
    expect(emptyRes.error).toBeDefined();
    expect(emptyRes.rows).toHaveLength(0);

    const whitespaceRes = parseCsv('   \n  \n ');
    expect(whitespaceRes.error).toBeDefined();
  });

  it('rejects malformed CSV with unclosed quotes', () => {
    const badRes = parseCsv('id,name\n1,"unclosed');
    expect(badRes.error).toContain('unclosed quote');
  });

  it('flags row length mismatches as warnings without crashing', () => {
    const unevenRes = parseCsv('a,b,c\n1,2\n3,4,5');
    expect(unevenRes.error).toBeUndefined();
    expect(unevenRes.warnings.length).toBeGreaterThan(0);
    expect(unevenRes.rows).toHaveLength(2);
  });

  it('serializes rows back to valid CSV', () => {
    const out = serializeToCsv(['id', 'note'], [{ id: '1', note: 'hello, world' }]);
    expect(out).toBe('id,note\n1,"hello, world"');
  });
});
