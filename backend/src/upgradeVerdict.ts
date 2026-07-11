import type { ComparisonVerdict } from './types.js';

export interface VerdictInput {composite:number;offensive:number;defensive:number;utility:number;buildFit:number;overall:number;hasMeaningfulTradeoff:boolean;confidence:'Low'|'Medium'|'High';}

export function chooseUpgradeVerdict(input:VerdictInput):ComparisonVerdict{
  if(input.confidence==='Low'&&Math.abs(input.composite)<7)return'Needs Manual Review';
  if(input.offensive>=10&&input.defensive<=-8)return input.composite>=3?'Offensive Upgrade':'Situational Upgrade';
  if(input.defensive>=10&&input.offensive<=-8)return input.composite>=3?'Defensive Upgrade':'Situational Upgrade';
  if(input.buildFit>=12&&input.overall<0)return'Situational Upgrade';
  if(input.composite>=14)return'Clear Upgrade';
  if(input.composite>=5){if(input.offensive>=input.defensive+8)return'Offensive Upgrade';if(input.defensive>=input.offensive+8)return'Defensive Upgrade';return'Small Upgrade';}
  if(input.composite<=-6)return'Downgrade';
  if(input.hasMeaningfulTradeoff||Math.abs(input.composite)<5)return'Sidegrade';
  return'Needs Manual Review';
}
