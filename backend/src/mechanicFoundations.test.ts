import { describe, expect, it } from "vitest";
import { evaluateAilment } from "./ailmentEvaluator.js";
import { evaluateDefence } from "./defensiveEvaluator.js";
import { evaluateTransitionBundle } from "./transitionBundles.js";
import { evaluateActorScope, modifiersForActor, validateRoster } from "./actorStatScope.js";
import { evaluateHollowUnarmedTransition } from "./transitionBundles.js";
import { evaluateIdolatry, evaluateSpiritFeasibility, martialArtistMechanics, spiritWalkerMechanics } from "./ascendancyMechanics.js";

describe("mechanic foundations", () => {
  it("does not present armour as a universal percentage without hit-size formula coverage", () => {
    const result = evaluateDefence({ life: 2000, armour: 5000 }, { incomingHit: 1000, damageType: "physical", armourAppliesPercent: 100 });
    expect(result.mitigatedHit).toBeNull();
    expect(result.maximumHit).toBeNull();
    expect(result.missingInputs.join(" ")).toMatch(/armour formula/i);
  });
  it("calculates a resistance scenario while stating its pool assumption", () => {
    const result = evaluateDefence({ life: 2000, energyShield: 500, resistances: { fire: 75 } }, { incomingHit: 1000, damageType: "fire", armourAppliesPercent: 0 });
    expect(result.mitigatedHit).toBe(250);
    expect(result.maximumHit).toBe(10000);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });
  it("discloses that block chance is not folded into a single isolated hit's mitigation instead of silently ignoring it", () => {
    const withBlock = evaluateDefence({ life: 2000, blockChance: 30 }, { incomingHit: 1000, damageType: "fire", armourAppliesPercent: 0 });
    expect(withBlock.assumptions.some((line) => /block chance/i.test(line))).toBe(true);
    const withoutBlock = evaluateDefence({ life: 2000 }, { incomingHit: 1000, damageType: "fire", armourAppliesPercent: 0 });
    expect(withoutBlock.assumptions.some((line) => /block chance/i.test(line))).toBe(false);
  });
  it("requires explicit Poison chance and stack coverage and ignores penetration", () => {
    const result = evaluateAilment({ kind: "Poison", damagePerInstance: 100, penetrationPercent: 20 });
    expect(result.dps).toBeNull();
    expect(result.missingInputs).toEqual(expect.arrayContaining(["explicit Poison chance", "verified Poison stack limit"]));
    expect(result.ignoredInputs[0]).toMatch(/penetration/i);
  });
  it("counts only the strongest Ignite", () => {
    const result = evaluateAilment({ kind: "Ignite", damagePerInstance: 120, instances: 4 });
    expect(result.dps).toBe(120);
  });
  it("withholds Bleed DPS instead of silently discarding stacks when the stack limit is unverified", () => {
    const result = evaluateAilment({ kind: "Bleed", damagePerInstance: 80, instances: 3 });
    expect(result.dps).toBeNull();
    expect(result.missingInputs).toContain("verified Bleed stack limit");
  });
  it("computes Bleed DPS across verified stacks once a stack limit is supplied", () => {
    const result = evaluateAilment({ kind: "Bleed", damagePerInstance: 80, instances: 3, stackLimit: 3 });
    expect(result.dps).toBe(240);
  });
  it("does not require a Bleed stack limit for a single, unambiguous instance", () => {
    const result = evaluateAilment({ kind: "Bleed", damagePerInstance: 80 });
    expect(result.dps).toBe(80);
    expect(result.missingInputs).not.toContain("verified Bleed stack limit");
  });
  it("withholds a final-build item before its transition package is complete", () => {
    const result = evaluateTransitionBundle({ kind: "crit", stage: "transition", requiredSignals: ["critical chance", "critical damage", "accuracy"], presentSignals: ["critical chance"] });
    expect(result.recommendationAllowed).toBe(false);
    expect(result.missingSignals).toEqual(["critical damage", "accuracy"]);
  });
  it("does not apply player stats to minions without explicit text", () => {
    const modifiers = [{ stat: "accuracy", value: 100, explicitText: "+100 to Accuracy Rating" }, { stat: "damage", value: 20, explicitText: "Minions deal 20% increased Damage", appliesTo: ["minion" as const] }];
    expect(modifiersForActor(modifiers, "minion").map((entry) => entry.stat)).toEqual(["damage"]);
    expect(validateRoster({ availableSpirit: 100, reservedSpirit: 120, activeCount: 1, companionLimit: 1 }).valid).toBe(false);
  });
  it("keeps companions, tamed beasts and totems in distinct actor scopes",()=>{
    const modifiers=[
      {stat:"damage",value:10,explicitText:"player",appliesTo:["player" as const]},
      {stat:"damage",value:20,explicitText:"companion",appliesTo:["companion" as const]},
      {stat:"damage",value:30,explicitText:"beast",appliesTo:["tamed-beast" as const]},
      {stat:"damage",value:40,explicitText:"totem",appliesTo:["totem" as const]},
    ];
    expect(modifiersForActor(modifiers,"companion").map((entry)=>entry.value)).toEqual([20]);
    expect(modifiersForActor(modifiers,"tamed-beast").map((entry)=>entry.value)).toEqual([30]);
    expect(modifiersForActor(modifiers,"totem").map((entry)=>entry.value)).toEqual([40]);
  });
  it("withholds ambiguous or conditional Presence scope",()=>{
    const result=evaluateActorScope([{stat:"damage",value:20,explicitText:"while in Presence",appliesTo:[],condition:"Presence",confidence:"Low"}],"player");
    expect(result.applied).toHaveLength(0); expect(result.unknown).toHaveLength(1); expect(result.coverage).toBe("partial");
  });
  it("does not let a low-confidence modifier scoped to an unrelated actor mark every other actor's coverage as partial",()=>{
    const modifiers=[{stat:"damage",value:10,explicitText:"totem-only, low confidence",appliesTo:["totem" as const],confidence:"Low" as const}];
    expect(evaluateActorScope(modifiers,"totem")).toMatchObject({unknown:[modifiers[0]],coverage:"partial"});
    for(const actor of ["player","minion","companion","tamed-beast"] as const){
      expect(evaluateActorScope(modifiers,actor)).toMatchObject({unknown:[],coverage:"complete"});
    }
  });
  it("evaluates Spirit per weapon set and exposes a required-roster regression, disabling only the entries needed to close the shortfall",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:2,baseSpirit:100,equipmentSpirit:0,weaponSetSpirit:{1:40,2:0},reservationEfficiencyPercent:0,companionLimit:1,roster:[{id:"beast",kind:"tamed-beast",reservation:60,required:true,unique:true},{id:"aura",kind:"persistent-skill",reservation:60,required:true}]});
    expect(result.availableSpirit).toBe(100); expect(result.valid).toBe(false); expect(result.disabledSkills).toEqual(["beast"]);
  });
  it("disables only the single largest required entry when it alone covers a smaller shortfall",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:1,baseSpirit:100,equipmentSpirit:0,weaponSetSpirit:{1:0,2:0},reservationEfficiencyPercent:0,companionLimit:2,roster:[{id:"small",kind:"persistent-skill",reservation:20,required:true},{id:"large",kind:"persistent-skill",reservation:90,required:true}]});
    // Reserved = 20+90 = 110 against 100 available -> shortfall 10, fully covered by cutting "large" (90) alone.
    expect(result.disabledSkills).toEqual(["large"]);
  });
  it("disables the minimum set of required entries (largest-first) when no single entry covers the shortfall",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:1,baseSpirit:30,equipmentSpirit:0,weaponSetSpirit:{1:0,2:0},reservationEfficiencyPercent:0,companionLimit:3,roster:[{id:"a",kind:"persistent-skill",reservation:20,required:true},{id:"b",kind:"persistent-skill",reservation:20,required:true},{id:"c",kind:"persistent-skill",reservation:20,required:true}]});
    // Reserved = 60 against 30 available -> shortfall 30, no single 20-reservation entry covers it, but two do.
    expect(result.disabledSkills).toEqual(["a","b"]);
  });
  it("disables the least-important companions first (neither required nor unique) instead of whichever ones sit last in the roster array",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:1,baseSpirit:200,equipmentSpirit:0,weaponSetSpirit:{1:0,2:0},reservationEfficiencyPercent:0,companionLimit:1,roster:[
      {id:"optional-first",kind:"companion",reservation:10,required:false,unique:false},
      {id:"unique-required",kind:"tamed-beast",reservation:10,required:true,unique:true},
      {id:"optional-second",kind:"companion",reservation:10,required:false,unique:false},
    ]});
    expect(result.disabledCompanions.sort()).toEqual(["optional-first","optional-second"]);
  });
  it("does not disable any required entry when Spirit is not over-committed",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:1,baseSpirit:100,equipmentSpirit:0,weaponSetSpirit:{1:0,2:0},reservationEfficiencyPercent:0,companionLimit:1,roster:[{id:"only",kind:"persistent-skill",reservation:50,required:true}]});
    expect(result.valid).toBe(true); expect(result.disabledSkills).toEqual([]);
  });
  it("keeps unknown Spirit inputs unknown instead of treating them as zero",()=>{
    const result=evaluateSpiritFeasibility({weaponSet:1,baseSpirit:null,reservationEfficiencyPercent:null,companionLimit:null,roster:[{id:"beast",kind:"tamed-beast",reservation:null,required:true}]});
    expect(result.availableSpirit).toBeNull(); expect(result.reservedSpirit).toBeNull(); expect(result.valid).toBeNull(); expect(result.exactFeasibilityAvailable).toBe(false);
  });
  it("calculates only an explicitly supplied Idolatry resistance penalty and cites its source",()=>{
    const result=evaluateIdolatry({nonIdolAugments:3,resistancePenaltyPerAugment:4});
    expect(result.resistancePenalty).toBe(12);
    expect(result.sourceEvidence.length).toBeGreaterThan(0);
    expect(evaluateIdolatry({nonIdolAugments:null,resistancePenaltyPerAugment:4}).resistancePenalty).toBeNull();
  });
  it("requires the complete Hollow unarmed transition bundle",()=>{
    const result=evaluateHollowUnarmedTransition({hollow:true,unarmed:true,compatibleGloves:true,transformedGloves:false,attributesMet:true,resistancesMet:true,defencesMet:true,skillCompatible:true,comboConfigured:false,weaponSetCompatible:true,runesKnown:false});
    expect(result.recommendationAllowed).toBe(false); expect(result.missingSignals).toEqual(expect.arrayContaining(["transformed gloves","Combo configuration","known body runes"]));
  });
  it("documents unknown Spirit Walker and Martial Artist components without manufacturing uptime",()=>{
    expect(spiritWalkerMechanics.find((entry)=>entry.id==="command-revive")?.status).toBe("unknown");
    expect(martialArtistMechanics.find((entry)=>entry.id==="bells-illusions")?.status).toBe("unknown");
  });
});
