import {describe,expect,it} from "vitest";
import {createDatabase} from "./db.js";
import {builtInRosterCatalog,loadActiveRosterCatalog,patchCompatibility,rosterCompatibility,validateRosterCatalog} from "./rosterCatalog.js";

describe("versioned roster catalog",()=>{
  it("contains eight playable classes, 22 regular ascendancies and a separate Abyssal Lich",()=>{
    const result=validateRosterCatalog(builtInRosterCatalog); expect(result.ok).toBe(true); if(!result.ok)return;
    const playable=result.catalog.entries.filter((entry)=>entry.playable);
    expect(playable).toHaveLength(8);
    expect(playable.flatMap((entry)=>entry.ascendancies).filter((entry)=>!entry.alternate)).toHaveLength(22);
    expect(playable.find((entry)=>entry.baseClass==="Witch")?.ascendancies).toContainEqual({name:"Abyssal Lich",alternate:true});
  });
  it("rejects wrong Spirit Walker and Martial Artist ownership",()=>{
    const wrong=structuredClone(builtInRosterCatalog);
    const huntress=wrong.entries.find((entry)=>entry.baseClass==="Huntress")!; const druid=wrong.entries.find((entry)=>entry.baseClass==="Druid")!;
    huntress.ascendancies=huntress.ascendancies.filter((entry)=>entry.name!=="Spirit Walker"); druid.ascendancies.push({name:"Spirit Walker",alternate:false});
    expect(validateRosterCatalog(wrong)).toMatchObject({ok:false});
  });
  it("keeps planned classes unavailable and reports patch mismatch",()=>{
    expect(rosterCompatibility(builtInRosterCatalog,"Templar",undefined,"0.5.4b").recognized).toBe(false);
    expect(patchCompatibility(builtInRosterCatalog,"0.6.0")).toBe("unsupported");
  });
  it("loads the explicitly active seeded catalog",()=>{
    const db=createDatabase(":memory:"); const loaded=loadActiveRosterCatalog(db);
    expect(loaded.status).toBe("active"); expect(loaded.catalog.patch).toBe("0.5.4b"); db.close();
  });
});
