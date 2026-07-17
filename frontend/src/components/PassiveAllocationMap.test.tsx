import {render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {PassiveAllocationMap} from './PassiveAllocationMap';

afterEach(()=>vi.restoreAllMocks());
describe('PassiveAllocationMap',()=>{
  it('uses exact versioned nodes when the matching catalog loads',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({manifest:{version:'PassiveTree-0.5',source:'https://example.test/tree',confidence:'High'},nodes:[{id:10,name:'Trusted Kinship',x:0,y:0,links:[20],stats:['Companion bonus'],type:'keystone'},{id:20,name:'Natural Order',x:100,y:0,links:[10],stats:[],type:'ascendancy'}]})}));const{container}=render(<PassiveAllocationMap nodeIds={[10,20]} treeVersion="PassiveTree-0.5"/>);await waitFor(()=>expect(screen.getByText(/Exact PassiveTree-0.5 topology/)).toBeInTheDocument());expect(container.querySelector('title')?.parentElement?.textContent).toContain('Trusted Kinship')});
  it('keeps a clearly labelled fallback for unsupported versions',()=>{render(<PassiveAllocationMap nodeIds={[10]} treeVersion="PassiveTree-0.6"/>);expect(screen.getByText(/positions show preserved ids, not official topology/)).toBeInTheDocument()});
});
