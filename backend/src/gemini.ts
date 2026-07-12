import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const analysisSchema = z.object({
  summary: z.string().min(1).max(700), itemCategory: z.string().min(1).max(80), buildFitScore: z.number().min(0).max(100),
  recommendation: z.enum(['equip', 'sell', 'craft', 'ignore', 'price_check']),
  strongStats: z.array(z.object({ stat:z.string().min(1).max(160), reason:z.string().min(1).max(350) })).max(10),
  weakStats: z.array(z.object({ stat:z.string().min(1).max(160), reason:z.string().min(1).max(350) })).max(10),
  craftingSuggestions: z.array(z.object({ action:z.string().min(1).max(160), reason:z.string().min(1).max(350), confidence:z.number().min(0).max(1) })).max(8),
  marketExplanation: z.string().max(700), beginnerExplanation: z.string().min(1).max(900), confidence:z.number().min(0).max(1), warnings:z.array(z.string().max(300)).max(10),
});
export type GeminiItemAnalysis = z.infer<typeof analysisSchema>;
export type GeminiAnalysis = { available:true; model:string; result:GeminiItemAnalysis } | { available:false; reason:'gemini_unavailable'|'gemini_disabled'|'gemini_not_configured'|'gemini_rate_limited'|'gemini_timeout'|'gemini_invalid_response' };

const systemInstruction=`You are Exile Companion's PoE 2 item-analysis explainer. You receive only deterministic item, category, build, crafting and market data computed by the application. Explain that data simply for a beginner. Never invent or infer a price, market result, modifier, tier, crafting mechanic, item stat, or game rule not explicitly present in the supplied JSON. Never use your own knowledge as a market source. Treat absent or uncertain data as uncertainty and lower confidence. Recommend craft only when the deterministic crafting data explicitly supports it. Analyze category-specific priorities, selected build fit, strong/weak/wasted stats, and choose equip, sell, craft, ignore, or price_check. Return JSON only.`;
const responseSchema={type:'object',properties:{summary:{type:'string'},itemCategory:{type:'string'},buildFitScore:{type:'number'},recommendation:{type:'string',enum:['equip','sell','craft','ignore','price_check']},strongStats:{type:'array',items:{type:'object',properties:{stat:{type:'string'},reason:{type:'string'}},required:['stat','reason']}},weakStats:{type:'array',items:{type:'object',properties:{stat:{type:'string'},reason:{type:'string'}},required:['stat','reason']}},craftingSuggestions:{type:'array',items:{type:'object',properties:{action:{type:'string'},reason:{type:'string'},confidence:{type:'number'}},required:['action','reason','confidence']}},marketExplanation:{type:'string'},beginnerExplanation:{type:'string'},confidence:{type:'number'},warnings:{type:'array',items:{type:'string'}}},required:['summary','itemCategory','buildFitScore','recommendation','strongStats','weakStats','craftingSuggestions','marketExplanation','beginnerExplanation','confidence','warnings']};

export async function explainWithGemini(context: unknown, env: NodeJS.ProcessEnv = process.env): Promise<GeminiAnalysis> {
  if (env.GEMINI_ENABLED?.toLowerCase() === 'false') return {available:false,reason:'gemini_disabled'};
  if (!env.GEMINI_API_KEY) return {available:false,reason:'gemini_not_configured'};
  const model=env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const client=new GoogleGenAI({apiKey:env.GEMINI_API_KEY});
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(), Number(env.GEMINI_TIMEOUT_MS||12000));
    try{
      const interaction=await client.interactions.create({model,input:JSON.stringify(context),system_instruction:systemInstruction,response_format:{type:'text',mime_type:'application/json',schema:responseSchema},generation_config:{temperature:0.2}} as any,{abortSignal:controller.signal} as any);
      const text=(interaction as {output_text?:string}).output_text;
      const parsed=analysisSchema.safeParse(text?JSON.parse(text):null);
      if(!parsed.success)return {available:false,reason:'gemini_invalid_response'};
      return {available:true,model,result:parsed.data};
    }catch(error){
      const message=String(error); const rate=/\b429\b|rate.?limit/i.test(message); const timeout=controller.signal.aborted||/abort|timeout/i.test(message);
      if(attempt===0&&!rate&&!timeout&&/\b(408|500|502|503|504)\b|network|fetch/i.test(message)){await new Promise(resolve=>setTimeout(resolve,250));continue;}
      return {available:false,reason:rate?'gemini_rate_limited':timeout?'gemini_timeout':'gemini_unavailable'};
    }finally{clearTimeout(timer);}
  }
  return {available:false,reason:'gemini_unavailable'};
}
