import { describe, expect, it } from 'vitest';
import { getMode } from './mode';

describe('getMode', () => {
  it('uses tickets when any ticket is present', () => {
    expect(getMode({ tickets: [{}], meta: {} })).toBe('tickets');
  });

  it('uses portfolio when tickets are missing or empty', () => {
    expect(getMode({ tickets: [], meta: {} })).toBe('portfolio');
    expect(getMode({ meta: {} })).toBe('portfolio');
  });

  it('lets meta.mode override the ticket count', () => {
    expect(getMode({ tickets: [], meta: { mode: 'tickets' } })).toBe('tickets');
    expect(getMode({ tickets: [{}], meta: { mode: 'portfolio' } })).toBe('portfolio');
  });
});
