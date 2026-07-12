import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const analysisSchema = z.object({
  summary: z.string().min(1).max(700), itemCategory: z.string().min(1).max(80), buildFitScore: z.number().min(0).max(100),
  recommendation: z.enum(['equip', 'sell', 'craft', 'ignore', 'price_check']),
  strongStats: z.array(z.object({ stat:z.string().min(1).max(160), reason:z.string().min(1).max(350) })).max(10),
  weakStats: z.array(z.object({ stat:z.string().min(1).max(160), reason:z.string().min(1).max(350) })).max(10),
  craftingSuggestions: z.array(z.object({ action:z.string().min(1).max(160), reason:z.string().min(1).max(350), confidence:z.number().min(0).max(1) })).max(8),
  marketExplanation: z.string().max(700), beginnerExplanation: z.string().min(1).max(900), confidence:z.number().min(0).max(1), warnings:z.array(z.string().max(300)).max(10),
  speculativeMarketEstimate:z.object({available:z.boolean(),low:z.number().nonnegative().optional(),high:z.number().nonnegative().optional(),currency:z.literal('exalted').optional(),reason:z.string().max(700),confidence:z.number().min(0).max(1),limitations:z.array(z.string().max(300)).max(8)}),
  buildOpinion:z.object({summary:z.string().max(700),strengths:z.array(z.string().max(250)).max(8),risks:z.array(z.string().max(250)).max(8),confidence:z.number().min(0).max(1)}),
  metaOpinion:z.object({available:z.boolean(),summary:z.string().max(700),basis:z.array(z.string().max(250)).max(8),confidence:z.number().min(0).max(1)}),
});
export type GeminiItemAnalysis = z.infer<typeof analysisSchema>;
export type GeminiAnalysis = { available:true; model:string; result:GeminiItemAnalysis } | { available:false; reason:'gemini_unavailable'|'gemini_disabled'|'gemini_not_configured'|'gemini_rate_limited'|'gemini_timeout'|'gemini_invalid_response' };

const systemInstruction=`You are Exile Companion's PoE 2 item-analysis explainer. You receive deterministic item, category, build, crafting and market data computed by the application. Explain it simply for beginners. Never override verified market data, invent modifiers, tiers, crafting legality, or game rules. When verified market evidence exists, repeat only that evidence and set speculativeMarketEstimate.available=false. When it is absent or insufficient, you may produce a clearly speculative Exalted range from the provided item specifications and build demand signals only; label its limitations, use low confidence unless concrete comparable data is supplied, and never call it a live market price. Build opinion must be tied to the supplied build profile and deterministic fit. Meta opinion must be unavailable unless explicit source-backed meta context is supplied. Return JSON only.`;
const responseSchema={type:'object',properties:{summary:{type:'string'},itemCategory:{type:'string'},buildFitScore:{type:'number'},recommendation:{type:'string',enum:['equip','sell','craft','ignore','price_check']},strongStats:{type:'array',items:{type:'object',properties:{stat:{type:'string'},reason:{type:'string'}},required:['stat','reason']}},weakStats:{type:'array',items:{type:'object',properties:{stat:{type:'string'},reason:{type:'string'}},required:['stat','reason']}},craftingSuggestions:{type:'array',items:{type:'object',properties:{action:{type:'string'},reason:{type:'string'},confidence:{type:'number'}},required:['action','reason','confidence']}},marketExplanation:{type:'string'},beginnerExplanation:{type:'string'},confidence:{type:'number'},warnings:{type:'array',items:{type:'string'}},speculativeMarketEstimate:{type:'object',properties:{available:{type:'boolean'},low:{type:'number'},high:{type:'number'},currency:{type:'string'},reason:{type:'string'},confidence:{type:'number'},limitations:{type:'array',items:{type:'string'}}},required:['available','reason','confidence','limitations']},buildOpinion:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},risks:{type:'array',items:{type:'string'}},confidence:{type:'number'}},required:['summary','strengths','risks','confidence']},metaOpinion:{type:'object',properties:{available:{type:'boolean'},summary:{type:'string'},basis:{type:'array',items:{type:'string'}},confidence:{type:'number'}},required:['available','summary','basis','confidence']}},required:['summary','itemCategory','buildFitScore','recommendation','strongStats','weakStats','craftingSuggestions','marketExplanation','beginnerExplanation','confidence','warnings','speculativeMarketEstimate','buildOpinion','metaOpinion']};

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
