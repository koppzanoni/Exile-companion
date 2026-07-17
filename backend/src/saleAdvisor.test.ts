import {describe,expect,it} from 'vitest';
import {adviseSale} from './saleAdvisor.js';
const now=new Date('2026-07-14T00:00:00Z');
describe('sale advisor',()=>{it('does not immediately reduce a new listing',()=>expect(adviseSale({id:1,status:'listed',listedPrice:100,listedAt:'2026-07-13T00:00:00Z',updatedAt:'2026-07-13T00:00:00Z',priceChanges:0},now).action).toBe('hold'));it('suggests a conservative reduction for a stale listing',()=>expect(adviseSale({id:2,status:'listed',listedPrice:100,listedAt:'2026-07-07T00:00:00Z',updatedAt:'2026-07-07T00:00:00Z',priceChanges:0},now)).toMatchObject({action:'reprice',suggestedPrice:95}));it('never reprices a completed sale',()=>expect(adviseSale({id:3,status:'sold',listedPrice:100,listedAt:'2026-06-01T00:00:00Z',updatedAt:'2026-06-02T00:00:00Z',priceChanges:0},now).suggestedPrice).toBeNull());
  it('bases age on the last price/status update, not the original listing date, so a just-repriced listing is not immediately flagged again',()=>{
    const justRepriced=adviseSale({id:4,status:'listed',listedPrice:100,listedAt:'2026-07-01T00:00:00Z',updatedAt:'2026-07-13T23:00:00Z',priceChanges:5},now);
    const neverTouched=adviseSale({id:5,status:'listed',listedPrice:100,listedAt:'2026-07-01T00:00:00Z',updatedAt:'2026-07-01T00:00:00Z',priceChanges:0},now);
    expect(justRepriced.action).toBe('hold');
    expect(neverTouched.action).toBe('reprice');
    expect(justRepriced.action).not.toBe(neverTouched.action);
  });
  it('stops suggesting another mechanical cut once a listing has already been repriced several times without selling',()=>{
    const result=adviseSale({id:6,status:'listed',listedPrice:100,listedAt:'2026-06-20T00:00:00Z',updatedAt:'2026-06-20T00:00:00Z',priceChanges:4},now);
    expect(result.action).toBe('review');
    expect(result.suggestedPrice).toBeNull();
    expect(result.reasons.join(' ')).toMatch(/repriced 4 times/);
  });
});
