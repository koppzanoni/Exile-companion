import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildPage } from './BuildPage';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => ({ ok: true, status: 200, json: async () => {
    if (url.endsWith('/api/build-profile/import')) return { profile: { name:'Imported Ice Shot', className:'Ranger', ascendancy:'Deadeye', mainSkill:'Ice Shot', guideUrl:'https://mobalytics.gg/poe-2/builds/ice-shot-deadeye', stage:'early-maps', defenceStyle:'life-evasion', priorities:[{stat:'life',level:'high'}], requiredMods:[], desiredMods:[] }, source:'reader', provider:'Mobalytics', equipmentSummary:'Boots: movement speed and life', detected:['Ranger','Deadeye','Ice Shot'], fields:[{field:'className',value:'Ranger',excerpt:'Class: Ranger',confidence:'High',needsConfirmation:false},{field:'mainSkill',value:'(not detected)',excerpt:'',confidence:'Low',needsConfirmation:true}], method:'jina-reader', importedAt:'2026-07-10T00:00:00.000Z', partial:true, warnings:['Review imported priorities.','This import is partial: some core fields could not be reliably detected and require manual confirmation before saving.'], snapshotId:1 };
    if(url.endsWith('/api/build-profiles')&&options?.method==='POST'){const body=JSON.parse(String(options.body));return{profile:{id:'custom:1',source:'custom',...body,preferredWeaponTypes:body.weaponType?[body.weaponType]:[],damageTypes:[body.mainDamageType],defensiveLayers:[body.defensiveLayer],offensiveStats:body.importantStats,defensiveStats:[],attributes:[],utilityStats:[],wastedStats:body.badStats,valuableSlots:[],categoryPriorities:{},explanationRules:[]}};}
    if(url.endsWith('/api/build-profiles'))return{profiles:[]};
    return options?.method === 'PUT' ? { profile: JSON.parse(String(options.body)) } : { profile: null };
  } })));
});

describe('build profile', () => {
  it('loads a preset and saves a personalized build', async () => {
    const user = userEvent.setup(); render(<BuildPage/>);
    expect(await screen.findByText(/Teach the Lens your build/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ice Shot Deadeye'), { target: { value: 'Glacial Lance' } });
    fireEvent.change(screen.getByPlaceholderText('Ranger'), { target: { value: 'Huntress' } });
    await user.click(screen.getByRole('button', { name: /Life \/ Evasion projectile/i }));
    expect(screen.getByLabelText('Maximum Life priority')).toHaveValue('required');
    await user.click(screen.getByRole('button', { name: /Save as active build/i }));
    expect(await screen.findByText(/Build saved/i)).toBeInTheDocument();
  });

  it('analyzes a Mobalytics link into a reviewable draft', async () => {
    const user = userEvent.setup(); render(<BuildPage/>);
    const url = await screen.findByPlaceholderText(/Mobalytics, poe\.ninja/i);
    fireEvent.change(url, { target: { value: 'https://mobalytics.gg/poe-2/builds/ice-shot-deadeye' } });
    await user.click(screen.getByRole('button', { name: /Analyze link/i }));
    expect(await screen.findByText('Build analysis incomplete — review before saving')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Imported Ice Shot')).toBeInTheDocument();
    expect(screen.getByText(/Jina AI Reader/i)).toBeInTheDocument();
    expect(screen.getByText(/Review the detected fields/i)).toBeInTheDocument();
    expect(screen.getByText(/is not treated as a fully successful import/i)).toBeInTheDocument();
    expect(screen.getByText('(not detected)')).toBeInTheDocument();
  });

  it('creates a custom Build Fit profile',async()=>{
    const user=userEvent.setup();render(<BuildPage/>);await screen.findByText(/Teach the Lens your build/i);
    fireEvent.change(screen.getByLabelText('Custom profile name'),{target:{value:'My Frost Monk'}});fireEvent.change(screen.getByLabelText('Custom class'),{target:{value:'Monk'}});fireEvent.change(screen.getByLabelText('Custom main skill'),{target:{value:'Ice Strike'}});fireEvent.change(screen.getByLabelText('Custom important stats'),{target:{value:'cold damage\nattack speed\nlife'}});
    await user.click(screen.getByRole('button',{name:'Save custom profile'}));expect(await screen.findByText('My Frost Monk')).toBeInTheDocument();expect(screen.getByText(/available in the Analyzer selector/i)).toBeInTheDocument();
  });
});
