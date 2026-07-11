import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BadgeCheck, BrainCircuit, CheckCircle2, Clock3, Download, Gauge, Hammer, History, Layers3, Scale, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../api';
import type { Analysis, BuildFitAnalysis, CraftingPotential, EvaluationFactor, FourEvaluations, ItemComparison, ItemRecommendation, MainDecision, MarketAnalysis, MarketHistoryResult, OpportunityAnalysis, StatValuation } from '../types';
import { Currency } from './Currency';

const sourceLabel = { live: 'Live official results', 'relaxed-live': 'Relaxed-search live results', 'insufficient-live': 'Insufficient live data', cache: 'Cached official results', manual: 'Manual pasted data', none: 'No market data' };

export function ResultPanel({ result, mode = 'Beginner' }: { result: Analysis; mode?: 'Beginner' | 'Advanced' }) {
  const e = result.estimate;
  const q = result.evaluation;
  function exportListings() {
    const blob = new Blob([JSON.stringify(result.comparableListings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `poe2-comparables-${result.id || 'analysis'}.json`; anchor.click();
    URL.revokeObjectURL(url);
  }
  return <section className="results" aria-label="Analysis result">
    {result.beginnerSummary && <div className="beginner-summary card" data-testid="beginner-summary"><Sparkles/><p>{result.beginnerSummary}</p></div>}
    {result.decision&&result.evaluations&&<MainDecisionCard decision={result.decision} evaluations={result.evaluations}/>}
    {result.recommendation&&<FinalRecommendationCard recommendation={result.recommendation}/>}
    <div className={`source-banner ${result.dataSource}`}>
      {result.dataSource === 'live' ? <CheckCircle2/> : <AlertTriangle/>}
      <div><small>OFFICIAL TRADE VERIFICATION</small><strong>{sourceLabel[result.dataSource]}</strong><span>{result.warning || 'Comparable listings were retrieved from the official Path of Exile 2 Trade service.'}</span></div>
      <a href={result.officialUrl} target="_blank" rel="noreferrer">Open trade <ArrowUpRight size={15}/></a>
    </div>
    {result.marketAnalysis && <MarketSearchDetails analysis={result.marketAnalysis} advanced={mode==='Advanced'}/>}
    {(result.item.baseType || result.item.itemType) && <MarketHistoryCard baseType={result.item.baseType || result.item.itemType} league={result.league}/>}
    {result.craftingPotential&&<CraftingPotentialCard potential={result.craftingPotential}/>} 
    <div className={`quality-panel card grade-${q.grade}`}>
      <div className="quality-summary">
        <div className="quality-score"><strong>{q.score}</strong><span>/ 100</span></div>
        <div><span className="eyebrow">GENERAL ITEM QUALITY</span><h2>{q.label}</h2><p>{q.verdict}</p></div>
        <span className={`marketability ${q.marketability}`}>{q.marketability} market appeal</span>
      </div>
      {q.categoryAnalysis ? <div className="category-analysis-card"><div className="category-analysis-head"><Layers3/><div><span className="eyebrow">CATEGORY ANALYSIS</span><h2>{q.categoryAnalysis.detectedCategory.label}</h2><p>{q.categoryAnalysis.detectionReason}</p></div><div className="category-score"><strong>{q.categoryAnalysis.categoryScore}</strong><span>/ 100</span><small>{q.categoryAnalysis.confidence}% confidence</small></div></div><div className="category-analysis-grid"><CategorySignals title="Main positives" values={q.categoryAnalysis.positiveStats} tone="positive"/><CategorySignals title="Weak / wasted" values={q.categoryAnalysis.weakOrWastedStats} tone="negative" empty="No clearly wasted stat detected."/><CategorySignals title="Missing important" values={q.categoryAnalysis.missingImportantStats} tone="warning" empty="Core category requirements are present."/><CategorySignals title="Build fit signals" values={q.categoryAnalysis.buildRelevantStats} tone="neutral"/><CategorySignals title="Market appeal signals" values={q.categoryAnalysis.marketRelevantStats} tone="neutral"/><CategorySignals title="Trade-search priorities" values={q.categoryAnalysis.tradeSearchPriorities} tone="trade"/></div>{q.categoryAnalysis.warnings.length>0&&<div className="category-warnings">{q.categoryAnalysis.warnings.map((warning)=><span key={warning}><AlertTriangle/>{warning}</span>)}</div>}<details className="parser-debug"><summary>Parser debug · {q.categoryAnalysis.parsedLines.length} mapped lines</summary>{q.categoryAnalysis.parsedLines.length?<table><thead><tr><th>Item line</th><th>Parsed as</th><th>Normalized value</th></tr></thead><tbody>{q.categoryAnalysis.parsedLines.map((row,index)=><tr key={`${row.line}-${index}`}><td>{row.line}</td><td>{row.fields.join(', ')}</td><td>{row.values.join(', ')}</td></tr>)}</tbody></table>:<p>No line-level mappings are available for manually entered data.</p>}</details></div> : q.category && <div className="category-analysis"><Layers3/><div><span className="eyebrow">{q.category.label.toUpperCase()} ANALYSIS</span><h2>Judged as a {q.category.label}, not generic gear.</h2></div><div className="category-priorities">{q.category.priorities.map((priority, index) => <span key={priority}><b>{index + 1}</b>{priority}</span>)}</div></div>}
      {q.buildFitAnalysis && <BuildFitCard fit={q.buildFitAnalysis}/>} 
      {result.comparison && <EquippedComparisonCard comparison={result.comparison}/>} 
      {q.personalized && <div className={`personal-fit fit-${q.personalized.fit}`}><div className="personal-fit-score"><strong>{q.personalized.score}</strong><span>% FIT</span></div><div><span className="eyebrow">FOR {q.personalized.className || 'YOUR BUILD'}</span><h2>{q.personalized.fit === 'excellent' ? 'Excellent for your build' : q.personalized.fit === 'strong' ? 'Strong for your build' : q.personalized.fit === 'partial' ? 'Only partly useful' : 'Not a good fit'}</h2><p>{q.personalized.verdict}</p></div><div className="personal-fit-signals"><span className="matches">{q.personalized.matched.length ? `Matches: ${q.personalized.matched.join(' · ')}` : 'No selected priority reached its target.'}</span>{q.personalized.missing.length > 0 && <span className="misses">Missing: {q.personalized.missing.join(' · ')}</span>}{q.personalized.conflicts.map((line) => <span className="misses" key={line}>Conflict: {line}</span>)}</div></div>}
      {q.knowledge && <div className="knowledge-panel"><div className={`knowledge-confidence ${q.knowledge.confidence.level}`}><Gauge/><strong>{q.knowledge.confidence.score}%</strong><span>{q.knowledge.confidence.level} analysis confidence</span></div><div className="knowledge-context"><span className="eyebrow">KNOWLEDGE CHECK · {q.knowledge.ruleset}</span><p>{q.knowledge.itemLevelNote}</p>{q.knowledge.craftingNotes.map((note)=><small key={note}>{note}</small>)}{q.knowledge.confidence.warnings.slice(0,2).map((warning)=><small className="knowledge-warning" key={warning}>! {warning}</small>)}</div><div className="roll-quality"><strong>ADVANCED ROLLS</strong>{q.knowledge.rolls.length?q.knowledge.rolls.slice(0,4).map((roll)=><span key={roll.modifier}><i style={{width:`${roll.percentile}%`}}/><b>{roll.tier?`T${roll.tier} · `:''}{roll.percentile}%</b><small>{shortModifier(roll.modifier)}</small></span>):<p>Copy the item with Advanced Item Descriptions enabled to compare each roll with its displayed range.</p>}</div></div>}
      <div className="quality-details">
        <article><h3><Sparkles/>What makes it good</h3>{q.strengths.length ? q.strengths.map((line) => <span key={line}>+ {line}</span>) : <span>No standout modifier package detected.</span>}</article>
        <article><h3><AlertTriangle/>What holds it back</h3>{q.weaknesses.length ? q.weaknesses.map((line) => <span key={line}>− {line}</span>) : <span>No major structural weakness detected.</span>}</article>
        <article><h3><Hammer/>Best upgrades</h3>{q.upgradePriorities.map((line) => <span key={line}>→ {line}</span>)}</article>
      </div>
      <div className="build-fit-section"><div className="build-fit-title"><BrainCircuit/><div><h3>Build fit</h3><p>Which common archetypes actually want this combination of stats.</p></div></div><div className="build-fit-grid">{q.buildFits.map((fit) => <article key={fit.name} className={`build-fit ${fit.fit}`}><div><strong>{fit.name}</strong><span>{fit.fit} fit</span></div><div className="fit-meter"><i style={{width: `${fit.score}%`}}/></div><b>{fit.score}%</b><p>{fit.reasons.length ? fit.reasons.join(' · ') : 'Few matching build priorities'}</p>{fit.conflicts.map((line) => <small key={line}>! {line}</small>)}</article>)}</div></div>
      {result.statValuation && <StatValuationCard valuation={result.statValuation} advanced={mode==='Advanced'}/>}
    </div>
    {!e ? <div className="empty-result market-gap"><Target/><h2>Quality understood; price still unconfirmed</h2><p>The build analysis above does not require listings. A market price does, so Exile Companion will not invent one when official evidence is missing.</p><a href={result.officialUrl} target="_blank" rel="noreferrer">Inspect the automatic Trade2 search <ArrowUpRight size={15}/></a></div> : <>
      <div className="result-heading"><div><span className="eyebrow">MARKET ESTIMATE</span><h2>{result.item.name || result.item.baseType || result.item.itemType}</h2><p>{result.league} · {result.item.rarity} · {result.item.itemLevel ? `item level ${result.item.itemLevel}` : 'item level unknown'}</p></div><div className={`confidence ${e.confidence}`}><Sparkles size={15}/>{e.confidence} confidence</div></div>
      <div className="price-grid">
        <article><TrendingDown/><span>QUICK SELL</span><Currency kind="exalted" value={e.quickSell}/><Currency kind="divine" value={e.divine.quickSell} compact/></article>
        <article className="featured"><span className="recommended">RECOMMENDED</span><Sparkles/><span>FAIR LISTING</span><Currency kind="exalted" value={e.fair}/><Currency kind="divine" value={e.divine.fair} compact/></article>
        <article><TrendingUp/><span>HIGH LISTING</span><Currency kind="exalted" value={e.high}/><Currency kind="divine" value={e.divine.high} compact/></article>
      </div>
      <div className="insight-grid">
        <article className="card"><h3>Why this price</h3>{e.explanation.map((line) => <p key={line}>{line}</p>)}</article>
        <article className="card mod-card"><h3>Item signals</h3><div className="positive"><strong>POSITIVE</strong>{e.positiveMods.map((m) => <span key={m}>+ {m}</span>)}</div><div className="negative"><strong>NEGATIVE / MISSING</strong>{e.negativeMods.length ? e.negativeMods.map((m) => <span key={m}>− {m}</span>) : <span>None detected</span>}</div></article>
      </div>
      <div className="table-card card"><div className="table-title"><div><h3>Why this price? · Comparable listings</h3><p>{e.usedCount} used · {e.excludedCount} excluded as outliers</p></div><div className="table-tools"><span><Clock3 size={14}/>{new Date(result.timestamp).toLocaleString()}</span><button type="button" onClick={exportListings}><Download size={13}/>Export JSON</button></div></div>
        <div className="table-scroll"><table><thead><tr><th>Comparable</th><th>Similarity</th><th>Price</th><th>Main difference</th><th>Age</th><th>Seller</th><th>Strategy</th><th>Status</th></tr></thead><tbody>{result.comparableListings.map((row) => <tr key={row.id} className={row.excludedReason ? 'excluded' : ''}><td><strong>{row.name}</strong><small>{row.baseType}</small></td><td><span className="similarity"><i style={{width: `${row.similarity || 0}%`}}/>{row.similarity || 0}%</span></td><td><Currency kind={row.currency === 'divine' ? 'divine' : 'exalted'} value={row.price} compact/></td><td>{row.mainDifference||'—'}</td><td>{listingAge(row.indexedAt)}</td><td>{row.account||'—'}</td><td><span className="tag">{row.foundByStrategy||row.source}</span></td><td>{row.excludedReason || 'Used'}</td></tr>)}</tbody></table></div>
      </div>
    </>}
    {result.opportunity && <OpportunityCard opportunity={result.opportunity}/>}
  </section>;
}

function MainDecisionCard({ decision, evaluations }: { decision: MainDecision; evaluations: FourEvaluations }) {
  const actionClass = decision.action.toLowerCase();
  const rows: Array<[string, EvaluationFactor]> = [['Build Fit', evaluations.buildFit], ['Upgrade Value', evaluations.upgradeValue], ['Market Value', evaluations.marketValue], ['Craft Potential', evaluations.craftPotential]];
  return <div className={`final-recommendation action-${actionClass}`} data-testid="main-decision">
    <div className="final-recommendation-head"><Target/><div><span className="eyebrow">MAIN DECISION</span><h2>{decision.action}</h2><p>{decision.reason}</p></div></div>
    <div className="build-fit-grid">{rows.map(([label, factor]) => <article key={label} className={`build-fit ${factor.score>=68?'strong':factor.score>=35?'possible':'weak'}`}>
      <div><strong>{label}</strong><span>{factor.confidence} confidence</span></div>
      <div className="fit-meter"><i style={{width:`${factor.score}%`}}/></div><b>{factor.score}%</b>
      <p>{factor.summary}</p>
      {factor.positiveFactors.slice(0,2).map((line)=><small key={line}>+ {line}</small>)}
      {factor.negativeFactors.slice(0,2).map((line)=><small key={line}>− {line}</small>)}
      {factor.limitations.length>0&&<small className="misses">Limitation: {factor.limitations[0]}</small>}
    </article>)}</div>
    {decision.conditionsToChange.length>0&&<div className="decision-warnings"><strong style={{padding:'0 22px'}}>What would change this decision</strong>{decision.conditionsToChange.map((line)=><span key={line}><AlertTriangle/>{line}</span>)}</div>}
  </div>;
}
function MarketSearchDetails({ analysis, advanced = true }: { analysis: MarketAnalysis; advanced?: boolean }) {
  const v = analysis.valuation;
  return <div className="card market-search-details" data-testid="market-search-details">
    <h3><Gauge/>Why this price</h3>
    <div className="market-search-meta">
      <span><small>STRATEGY</small><b>{analysis.strategyUsed}</b></span>
      <span><small>RELAXED SEARCH</small><b>{analysis.relaxed ? `Yes (${analysis.relaxationSteps.join(' → ')})` : 'No'}</b></span>
      <span><small>FOUND / DISCARDED / USED</small><b>{analysis.foundCount} / {analysis.discardedCount} / {analysis.usedCount}</b></span>
      <span><small>AVG SIMILARITY</small><b>{analysis.averageSimilarity}%</b></span>
      <span><small>DISTINCT SELLERS</small><b>{analysis.distinctSellers}</b></span>
      <span><small>MEDIAN LISTING AGE</small><b>{analysis.medianListingAgeDays === null ? 'Unknown' : `${analysis.medianListingAgeDays}d`}</b></span>
      <span><small>LIQUIDITY (approx.)</small><b>{v.liquidity}</b></span>
      <span><small>CONFIDENCE</small><b>{v.confidence} ({v.confidenceScore}%)</b></span>
    </div>
    {v.lowConfidenceReason && <p className="low-confidence-reason"><AlertTriangle size={14}/>{v.lowConfidenceReason}</p>}
    <p className="liquidity-basis">{v.liquidityBasis}</p>
    {(v.outliers.length > 0 || v.priceFixSuspects.length > 0) && <div className="market-flags">
      {v.outliers.length > 0 && <span>{v.outliers.length} statistical outlier(s) excluded</span>}
      {v.priceFixSuspects.length > 0 && <span>{v.priceFixSuspects.length} possible price-fix cluster(s) excluded</span>}
    </div>}
    {advanced && <div className="market-stat-grid" data-testid="market-formula-detail">
      <span><small>MEDIAN</small><b>{v.median}</b></span>
      <span><small>TRIMMED MEAN</small><b>{v.trimmedMean}</b></span>
      <span><small>IQR (Q1–Q3)</small><b>{v.q1}–{v.q3}</b></span>
      <span><small>MIN RELIABLE</small><b>{v.minimumReliablePrice}</b></span>
      <span><small>CENTRAL</small><b>{v.centralPrice}</b></span>
      <span><small>MAX LIKELY</small><b>{v.maximumLikelyPrice}</b></span>
    </div>}
  </div>;
}
function MarketHistoryCard({ baseType, league }: { baseType: string; league: string }) {
  const [history, setHistory] = useState<MarketHistoryResult | null>(null);
  useEffect(() => { let cancelled = false; api.marketHistory(baseType, league).then((r) => { if (!cancelled) setHistory(r); }).catch(() => {}); return () => { cancelled = true; }; }, [baseType, league]);
  if (!history || !Array.isArray(history.snapshots)) return null;
  return <div className="card market-search-details" data-testid="market-history">
    <h3><History/>Market history for {baseType}</h3>
    {history.snapshots.length === 0 ? <p className="liquidity-basis">No verified live search has been recorded for this item at this league yet. History accumulates automatically as live analyses run.</p> : <>
      <div className="market-search-meta">
        <span><small>TREND</small><b>{history.trend}{history.changePercent !== null ? ` (${history.changePercent > 0 ? '+' : ''}${history.changePercent}%)` : ''}</b></span>
        <span><small>SNAPSHOTS</small><b>{history.snapshots.length}</b></span>
        <span><small>PRICE-FIX FLAGGED</small><b>{history.priceFixFlaggedSnapshots}</b></span>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Date</th><th>Median</th><th>Fair</th><th>Sellers</th><th>Liquidity</th><th>Source</th></tr></thead><tbody>{history.snapshots.map((s) => <tr key={s.id}><td>{new Date(s.createdAt).toLocaleDateString()}</td><td><Currency kind="exalted" value={s.median} compact/></td><td><Currency kind="exalted" value={s.fairPrice} compact/></td><td>{s.distinctSellers}</td><td>{s.liquidity}{s.priceFixSuspectCount > 0 ? ' ⚠' : ''}</td><td><span className="tag">{s.dataSource}</span></td></tr>)}</tbody></table></div>
    </>}
    {(history.limitations || []).map((line) => <p className="liquidity-basis" key={line}>{line}</p>)}
  </div>;
}
function StatValuationCard({ valuation, advanced = true }: { valuation: StatValuation; advanced?: boolean } ) {
  return <div className="build-fit-section stat-valuation-section" data-testid="stat-valuation">
    <div className="build-fit-title"><Gauge/><div><h3>Stat-by-stat valuation</h3><p>Each numeric stat scored against your current character, build weights, and slot priorities — this feeds directly into the final recommendation.</p></div></div>
    <div className="market-search-meta">
      <span><small>OFFENCE</small><b>{valuation.offenceScore}/100</b></span>
      <span><small>DEFENCE</small><b>{valuation.defenceScore}/100</b></span>
      <span><small>UTILITY</small><b>{valuation.utilityScore}/100</b></span>
      <span><small>OVERALL</small><b>{valuation.overallScore}/100</b></span>
    </div>
    {advanced && <div className="table-scroll" data-testid="stat-contribution-detail"><table><thead><tr><th>Stat</th><th>Value</th><th>Local/Global</th><th>Build weight</th><th>Slot weight</th><th>Effective (before → after cap)</th><th>Contribution</th><th>Why</th></tr></thead><tbody>{valuation.contributions.map((row,index)=><tr key={`${row.stat}-${index}`} className={row.wasted?'excluded':''}><td><strong>{row.stat}</strong>{row.tier&&<small> T{row.tier}</small>}</td><td>{row.value}</td><td><span className="tag">{row.local?'Local':'Global'}</span></td><td>{row.buildWeight}×</td><td>{row.slotWeight}×</td><td>{row.effectiveBeforeCap}{row.effectiveBeforeCap!==row.effectiveAfterCap?` → ${row.effectiveAfterCap}`:''}</td><td><span className={`tag ${row.category}`}>{row.category} {row.score}%</span></td><td>{row.reason}</td></tr>)}</tbody></table></div>}
  </div>;
}
function OpportunityCard({ opportunity }: { opportunity: OpportunityAnalysis }) {
  return <div className="card market-search-details" data-testid="opportunity-analysis">
    <h3><Target/>Opportunity analysis</h3>
    <div className="quality-details">
      <article><h3>Better alternative, same price</h3>{opportunity.betterAlternativeSamePrice ? <span>{opportunity.betterAlternativeSamePrice.reason}</span> : <span>None found among the current comparables.</span>}</article>
      <article><h3>Better alternative, paying more</h3>{opportunity.betterAlternativeForMore ? <span>{opportunity.betterAlternativeForMore.reason}</span> : <span>None found among the current comparables.</span>}</article>
      <article><h3>Cost of a relevant jump</h3>{opportunity.amountNeededForRelevantJump ? <span>+{opportunity.amountNeededForRelevantJump.extraCost} Exalted for a {opportunity.amountNeededForRelevantJump.qualityGain}-point higher stat score.</span> : <span>No priced comparable represents a relevant jump.</span>}</article>
    </div>
    <div className="market-search-meta">
      <span><small>BUY VS CRAFT</small><b>{opportunity.buyVsCraft.verdict}</b></span>
      <span><small>SELLING ENABLES A BETTER BUY</small><b>{opportunity.sellingWouldEnableBetterPurchase.possible ? 'Yes' : 'No'}</b></span>
      <span><small>GAIN VS EQUIPPED</small><b>{opportunity.gainVsEquipped ? `${signed(opportunity.gainVsEquipped.scoreDelta)} (${opportunity.gainVsEquipped.verdict})` : 'No equipped item pasted'}</b></span>
    </div>
    <p className="liquidity-basis">{opportunity.buyVsCraft.reason} {opportunity.sellingWouldEnableBetterPurchase.reason}</p>
    {opportunity.wastedExpensiveStats.length > 0 && <div className="market-flags"><span>Wasted for this build: {opportunity.wastedExpensiveStats.join(', ')}</span></div>}
    {opportunity.bestAlternativeSearchUrl && <a href={opportunity.bestAlternativeSearchUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'10px 22px',fontSize:9,textTransform:'uppercase',color:'#9ab0a0'}}>Best alternative search <ArrowUpRight size={13}/></a>}
    {opportunity.limitations.length > 0 && <div className="category-warnings">{opportunity.limitations.map((line) => <span key={line}><AlertTriangle/>{line}</span>)}</div>}
  </div>;
}
function listingAge(indexedAt?: string) { if (!indexedAt) return 'Unknown'; const days = Math.floor((Date.now() - new Date(indexedAt).getTime()) / 86400000); return days <= 0 ? '<1d' : `${days}d`; }
function signed(value?: number) { return `${(value || 0) >= 0 ? '+' : ''}${value || 0}`; }
function shortModifier(value:string){return value.replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();}
function CategorySignals({title,values,tone,empty='No relevant signal detected.'}:{title:string;values:string[];tone:string;empty?:string}){return <article className={`category-signals ${tone}`}><strong>{title}</strong>{values.length?values.map((value)=><span key={value}>{value}</span>):<small>{empty}</small>}</article>}
function BuildFitCard({fit}:{fit:BuildFitAnalysis}){return <div className={`selected-build-fit fit-${fit.label.toLowerCase().replace(/[^a-z]+/g,'-')}`}><div className="selected-build-head"><BadgeCheck/><div><span className="eyebrow">BUILD FIT ANALYSIS</span><h2>{fit.profileName}</h2><p>{fit.buildSpecific?'This result is specific to the selected build.':'No specific build selected; using general usefulness and market coherence.'}</p></div><div className="selected-build-score"><strong>{fit.score}</strong><span>/100</span><b>{fit.label}</b></div></div><div className="selected-build-meta"><span><small>BEST USE</small>{fit.bestUseCase}</span><span><small>ACTION</small>{fit.recommendedAction}</span><span><small>CONFIDENCE</small>{fit.confidence}%</span></div><div className="selected-build-grid"><CategorySignals title="Why it fits" values={fit.fitsBecause} tone="positive"/><CategorySignals title="Why it does not fit" values={fit.doesNotFitBecause} tone="negative"/><CategorySignals title="Important missing stats" values={fit.missingImportantStats} tone="warning"/><CategorySignals title="Wasted for this build" values={fit.wastedStats} tone="negative" empty="No build-specific waste detected."/></div>{fit.warnings.length>0&&<div className="category-warnings">{fit.warnings.map((warning)=><span key={warning}><AlertTriangle/>{warning}</span>)}</div>}</div>}
function EquippedComparisonCard({comparison}:{comparison:ItemComparison}){const verdictClass=comparison.verdict.toLowerCase().replace(/[^a-z]+/g,'-');return <div className={`equipped-comparison-result verdict-${verdictClass} ${comparison.comparable?'compatible':'incompatible'}`} data-testid="equipped-comparison"><div className="equipped-comparison-head"><Scale/><div><span className="eyebrow">EQUIPPED COMPARISON</span><h2>{comparison.verdict}</h2><p>{comparison.explanation}</p></div><div className="comparison-confidence"><strong>{comparison.confidence}</strong><span>confidence</span></div></div>{comparison.comparable?<><div className="comparison-score-row"><span><small>QUALITY CHANGE</small><b>{signed(comparison.scoreDelta)}</b></span><span><small>BUILD FIT CHANGE</small><b>{comparison.buildFitDelta===undefined?'N/A':signed(comparison.buildFitDelta)}</b></span><span><small>BETTER FOR</small><b>{comparison.betterFor.join(', ')||'No clear area'}</b></span><span><small>WORSE FOR</small><b>{comparison.worseFor.join(', ')||'No clear area'}</b></span></div><div className="comparison-detail-grid"><CategorySignals title="Main gains" values={comparison.gains} tone="positive" empty="No measured gain."/><CategorySignals title="Main losses" values={comparison.losses} tone="negative" empty="No measured loss."/><CategorySignals title="Risk flags" values={comparison.riskFlags} tone="warning" empty="No major swap risk detected."/></div>{comparison.characterImpact&&<div className="character-impact"><strong>Estimated character totals after swap</strong><div>{Object.keys(comparison.characterImpact.after).map((key)=><span key={key}><small>{key.replace(/([A-Z])/g,' $1')}</small><b>{comparison.characterImpact?.before[key]} → {comparison.characterImpact?.after[key]}</b></span>)}</div></div>}</>:<div className="not-comparable"><AlertTriangle/><span>New: {comparison.candidateCategory.label} · Equipped: {comparison.equippedCategory.label}</span></div>}{comparison.warnings.length>0&&<div className="comparison-warnings">{comparison.warnings.map((warning)=><span key={warning}><AlertTriangle/>{warning}</span>)}</div>}<div className="comparison-recommendation"><strong>Recommendation impact</strong><p>{comparison.recommendationImpact}</p></div></div>}
function CraftingPotentialCard({potential}:{potential:CraftingPotential}){const labelClass=potential.label.toLowerCase().replace(/[^a-z]+/g,'-');return <div className={`crafting-potential-card craft-${labelClass}`} data-testid="crafting-potential"><div className="crafting-potential-head"><Hammer/><div><span className="eyebrow">CRAFTING POTENTIAL</span><h2>{potential.label}</h2><p>{potential.recommendation}</p></div><div className="crafting-score"><strong>{potential.score}</strong><span>/100</span><b>{potential.confidence} confidence</b></div></div><div className="crafting-quality-row"><span><small>BASE QUALITY</small><b>{potential.baseQuality.score}/100 · {potential.baseQuality.label}</b></span><span><small>ROLL QUALITY</small><b>{potential.rollQuality.score}/100 · {potential.rollQuality.label}</b></span></div><div className="crafting-grid"><CategorySignals title="Why" values={potential.reasons} tone="positive"/><CategorySignals title="Best improvements" values={potential.bestPossibleImprovements} tone="neutral" empty="No obvious improvement target."/><CategorySignals title="Currency advice" values={potential.suggestedCurrencyUse} tone="trade"/><CategorySignals title="Crafting risks" values={potential.risks} tone="warning" empty="No major crafting risk detected."/></div><div className="roll-quality-details"><article><strong>Strong rolls</strong>{potential.rollQuality.strongRolls.length?potential.rollQuality.strongRolls.map((line)=><span key={line}>+ {line}</span>):<small>No strong roll confirmed.</small>}</article><article><strong>Weak rolls</strong>{potential.rollQuality.weakRolls.length?potential.rollQuality.weakRolls.map((line)=><span key={line}>− {line}</span>):<small>No clearly weak roll.</small>}</article><article><strong>Missing rolls</strong>{potential.rollQuality.missingRolls.length?potential.rollQuality.missingRolls.map((line)=><span key={line}>→ {line}</span>):<small>No core roll missing.</small>}</article></div>{potential.currencyWarnings.length>0&&<div className="currency-danger"><AlertTriangle/><div><b>Currency warnings</b>{potential.currencyWarnings.map((warning)=><span key={warning}>{warning}</span>)}</div></div>}{potential.avoidActions.length>0&&<div className="avoid-actions"><strong>AVOID</strong>{potential.avoidActions.map((action)=><span key={action}>{action}</span>)}</div>}</div>}
function FinalRecommendationCard({recommendation}:{recommendation:ItemRecommendation}){const actionClass=recommendation.action.toLowerCase().replace(/[^a-z]+/g,'-');return <div className={`final-recommendation action-${actionClass}`} data-testid="final-recommendation"><div className="final-recommendation-head"><Target/><div><span className="eyebrow">FINAL RECOMMENDATION</span><h2>Recommended Action: <b>{recommendation.action}</b></h2><p>{recommendation.shortReason}</p></div><div className="decision-badge"><strong>{recommendation.action}</strong><span>{recommendation.confidence} confidence</span></div></div>{recommendation.secondaryAction&&<p className="secondary-action"><b>Secondary option:</b> {recommendation.secondaryAction}</p>}<div className="final-recommendation-grid"><article><h3>Why</h3>{recommendation.detailedReason.map((line)=><span key={line}>{line}</span>)}</article><article><h3>Do this next</h3>{recommendation.doThisNext.map((line)=><span key={line}>→ {line}</span>)}</article><article><h3>Crafting potential</h3><strong className="craft-score">{recommendation.craftingPotential.score}/100 · {recommendation.craftingPotential.label}</strong>{recommendation.craftingPotential.reasons.slice(0,3).map((line)=><span key={line}>{line}</span>)}</article></div>{recommendation.warnings.length>0&&<div className="decision-warnings">{recommendation.warnings.map((warning)=><span key={warning}><AlertTriangle/>{warning}</span>)}</div>}{recommendation.hiddenValueFlags.length>0&&<div className="hidden-value-flags"><Sparkles/><div><b>Possible hidden value</b>{recommendation.hiddenValueFlags.map((flag)=><span key={flag}>{flag}</span>)}</div></div>}</div>}
