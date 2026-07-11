import type { MarketProvider, MarketSearchQuery, MarketSearchResult } from './engineContracts.js';

export interface TradeTransport{search(query:MarketSearchQuery,signal:AbortSignal):Promise<unknown[]>;currencyRates?(signal:AbortSignal):Promise<unknown>}
export class OfficialTradeMarketProvider implements MarketProvider{
  private cache=new Map<string,{expires:number,value:MarketSearchResult}>();private nextAllowed=0;
  constructor(private transport:TradeTransport,private options={timeoutMs:8000,cacheMs:60000,minIntervalMs:250,retries:2}){}
  async search(query:MarketSearchQuery):Promise<MarketSearchResult>{const key=JSON.stringify(query);const cached=this.cache.get(key);if(cached&&cached.expires>Date.now())return{...cached.value,warning:'Cached official market response.'};let last:unknown;for(let attempt=0;attempt<=this.options.retries;attempt++){try{await this.throttle();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs);try{const listings=await this.transport.search(query,controller.signal);const value={provider:'official-trade2',fetchedAt:new Date().toISOString(),listings};this.cache.set(key,{expires:Date.now()+this.options.cacheMs,value});return value;}finally{clearTimeout(timer);}}catch(error){last=error;}}return{provider:'official-trade2',fetchedAt:new Date().toISOString(),listings:[],warning:`Official market unavailable: ${last instanceof Error?last.message:'unknown error'}. No price was inferred.`};}
  async getCurrencyRates(){const controller=new AbortController();return this.transport.currencyRates?this.transport.currencyRates(controller.signal):{warning:'Currency rate transport is not configured.'};}
  async getProviderStatus(){try{await this.search({league:'Standard',patch:'',itemClass:'',filters:{},limit:1});return{ok:true};}catch(error){return{ok:false,message:error instanceof Error?error.message:'Unavailable'};}}
  private async throttle(){const delay=Math.max(0,this.nextAllowed-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));this.nextAllowed=Date.now()+this.options.minIntervalMs;}
}
