import type { SourceEvidence } from "./offenceTypes.js";

export type MechanicKnowledge="confirmed"|"partial"|"scenario-required"|"unknown";
export interface AscendancyMechanic { id:string; label:string; status:MechanicKnowledge; actor:string; limitation:string; sourceEvidence:SourceEvidence[] }
const evidence=(label:string,url:string):SourceEvidence=>({label,url,patch:"0.5.4b",dataVersion:"2026-07-15.1",confidence:"High",inspectedAt:"2026-07-15",limitation:"Node wording is authoritative for scope; uptime and AI behaviour are not inferred."});
const spiritSource=evidence("Spirit Walker","https://www.poe2wiki.net/wiki/Spirit_Walker");
const martialSource=evidence("Martial Artist","https://www.poe2wiki.net/wiki/Martial_Artist");
const mechanic=(id:string,label:string,status:MechanicKnowledge,actor:string,limitation:string,sourceEvidence:SourceEvidence[]):AscendancyMechanic=>({id,label,status,actor,limitation,sourceEvidence});

export const spiritWalkerMechanics:AscendancyMechanic[]=[
  mechanic("vivid-wisps","Vivid Wisps / Vivid Stampede","scenario-required","granted-ascendancy-effect","Movement generation and attack expenditure require an explicit rotation.",[spiritSource]),
  mechanic("primal-bounty","Primal Bounty / Owl Feathers","partial","granted-ascendancy-effect","Exact scenario inputs remain required.",[spiritSource]),
  mechanic("soaring-ground","Soaring Ground","scenario-required","player","Presence and movement uptime are not assumed.",[spiritSource]),
  mechanic("wild-protector","Wild Protector","confirmed","companion","Granted skill is distinct from inherited player stats.",[spiritSource]),
  mechanic("tame-beast","Tame Beast / Unique Tamed Beast","confirmed","tamed-beast","Unique companion limit is validated; beast AI and best-beast choice remain unknown.",[spiritSource]),
  mechanic("azmeri-possession","Azmeri Spirit possession rotation","scenario-required","tamed-beast","Rotation is represented without assuming effective combat uptime.",[spiritSource]),
  mechanic("idolatry","Idolatry / Idols / non-Idol Augments","confirmed","both","Reservation, companion damage and resistance penalty retain their explicit scopes.",[spiritSource]),
  mechanic("command-revive","Command skill and revive downtime","unknown","companion","No default frequency, contact uptime or revive downtime is fabricated.",[spiritSource]),
];
export const martialArtistMechanics:AscendancyMechanic[]=[
  mechanic("hollow","Hollow Form / Focus / Resonance","confirmed","player","Requires an explicit Hollow transition state.",[martialSource]),
  mechanic("combo","Combo / Martial Adept / Martial Master","scenario-required","player","Combo generation, spending and weapon-set state require rotation inputs.",[martialSource]),
  mechanic("runic-meridians","Runic Meridians body rune sockets","confirmed","player","Socket contents are not inferred.",[martialSource]),
  mechanic("stonefist","Way of the Stonefist glove transformation","confirmed","player","Transformed glove state must be supplied.",[martialSource]),
  mechanic("mountain","Way of the Mountain / Surpassing / Immobilise","partial","enemy-target-state","Threshold and uptime remain scenario inputs.",[martialSource]),
  mechanic("bells-illusions","Bells and illusions","unknown","clone-illusion","Hit count, targeting and uptime are withheld.",[martialSource]),
];

export interface SpiritRosterEntry { id:string; kind:"persistent-skill"|"minion"|"companion"|"tamed-beast"; reservation:number|null; required?:boolean; unique?:boolean }
export interface SpiritFeasibilityInput { weaponSet:1|2; baseSpirit:number|null; equipmentSpirit?:number|null; weaponSetSpirit?:Partial<Record<1|2,number|null>>; reservationEfficiencyPercent?:number|null; roster:SpiritRosterEntry[]; companionLimit:number|null }
export function evaluateSpiritFeasibility(input:SpiritFeasibilityInput){
  const missingInputs:string[]=[]; const assumptions:string[]=[];
  const setSpirit=input.weaponSetSpirit?.[input.weaponSet];
  if(input.baseSpirit===null)missingInputs.push("base Spirit"); if(setSpirit===null)missingInputs.push(`weapon set ${input.weaponSet} Spirit`);
  const availableSpirit=input.baseSpirit===null?null:input.baseSpirit+(input.equipmentSpirit??0)+(setSpirit??0);
  const efficiency=input.reservationEfficiencyPercent;
  if(efficiency===null)missingInputs.push("reservation efficiency");
  const knownReservations=input.roster.filter((entry)=>entry.reservation!==null);
  if(knownReservations.length!==input.roster.length)missingInputs.push("reservation for every roster entry");
  const reservedSpirit=knownReservations.length===input.roster.length?knownReservations.reduce((sum,entry)=>sum+(entry.reservation as number)/(1+Math.max(0,efficiency??0)/100),0):null;
  const companionEntries=input.roster.filter((entry)=>entry.kind==="companion"||entry.kind==="tamed-beast");
  if(input.companionLimit===null&&companionEntries.length)missingInputs.push("companion limit");
  const overLimit=input.companionLimit===null?null:Math.max(0,companionEntries.length-input.companionLimit);
  const spiritShortfall=availableSpirit===null||reservedSpirit===null?null:Math.max(0,reservedSpirit-availableSpirit);
  const invalidRequirements:string[]=[];
  if(spiritShortfall&&spiritShortfall>0)invalidRequirements.push(`Spirit shortfall: ${spiritShortfall.toFixed(2)}.`);
  if(overLimit&&overLimit>0)invalidRequirements.push(`Companion limit exceeded by ${overLimit}.`);
  // Disable the least-important companions first (neither required nor unique), instead of
  // whichever ones happen to sit last in the input array — a required/unique companion should
  // stay active as long as any optional one could be cut instead.
  const companionPriority=(entry:SpiritRosterEntry)=>(entry.required&&entry.unique?0:entry.required?1:entry.unique?2:3);
  const disabledCompanions=overLimit&&overLimit>0?[...companionEntries].sort((a,b)=>companionPriority(b)-companionPriority(a)).slice(0,overLimit).map((entry)=>entry.id):[];
  // Disable the fewest required entries needed to close the shortfall (largest effective
  // reservation first), rather than flagging every required entry regardless of whether cutting
  // just one of them would already cover the gap.
  const effectiveReservation=(entry:SpiritRosterEntry)=>(entry.reservation as number)/(1+Math.max(0,efficiency??0)/100);
  const disabledSkills=(()=>{
    if(!spiritShortfall||spiritShortfall<=0)return [];
    const required=[...input.roster.filter((entry)=>entry.required)].sort((a,b)=>effectiveReservation(b)-effectiveReservation(a));
    const disabled:string[]=[]; let covered=0;
    for(const entry of required){
      if(covered>=spiritShortfall)break;
      disabled.push(entry.id); covered+=effectiveReservation(entry);
    }
    return disabled;
  })();
  return{availableSpirit,reservedSpirit,remainingSpirit:availableSpirit===null||reservedSpirit===null?null:availableSpirit-reservedSpirit,activeRoster:input.roster.map((entry)=>entry.id),disabledSkills,disabledCompanions,invalidRequirements,weaponSet:input.weaponSet,assumptions,missingInputs,sourceEvidence:[spiritSource],confidence:missingInputs.length?"Low" as const:"High" as const,exactFeasibilityAvailable:missingInputs.length===0,valid:invalidRequirements.length?false:missingInputs.length?null:true};
}

// The only Idolatry constant this module assumes by default rather than requiring the caller to
// supply — cited the same way every other mechanic constant here is, instead of a bare literal.
export const IDOLATRY_RESISTANCE_PENALTY_PER_AUGMENT=4;
const idolatryPenaltySource=evidence("Idolatry non-Idol Augment resistance penalty","https://www.poe2wiki.net/wiki/Spirit_Walker");

export function evaluateIdolatry(input:{nonIdolAugments:number|null;resistancePenaltyPerAugment:number|null}){
  if(input.nonIdolAugments===null||input.resistancePenaltyPerAugment===null)return{resistancePenalty:null,missingInputs:["non-Idol Augment count and verified penalty"],sourceEvidence:[]};
  return{resistancePenalty:input.nonIdolAugments*input.resistancePenaltyPerAugment,missingInputs:[],sourceEvidence:[idolatryPenaltySource]};
}
