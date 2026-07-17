export interface SaleForReview {
  id: number;
  status: string;
  listedPrice: number;
  listedAt: string;
  updatedAt: string;
  priceChanges: number;
}
export interface SaleAdvice {
  saleId: number;
  action: 'hold' | 'review' | 'reprice';
  suggestedPrice: number | null;
  ageDays: number;
  confidence: 'High' | 'Medium';
  reasons: string[];
}
export function adviseSale(sale: SaleForReview, now = new Date()): SaleAdvice {
  // Age is measured from the last time this listing's price/status actually changed, not from
  // its original listing date — otherwise a listing repriced an hour ago and one untouched for
  // 15 days receive identical advice despite priceChanges/updatedAt being fetched for this purpose.
  const ageDays = Math.max(0, (now.getTime() - new Date(sale.updatedAt || sale.listedAt).getTime()) / 86_400_000),
    reasons: string[] = [];
  if (sale.status !== 'listed')
    return {
      saleId: sale.id,
      action: 'hold',
      suggestedPrice: null,
      ageDays,
      confidence: 'High',
      reasons: ['Only active listings receive repricing advice.'],
    };
  if (ageDays < 2)
    return {
      saleId: sale.id,
      action: 'hold',
      suggestedPrice: null,
      ageDays,
      confidence: 'Medium',
      reasons: [
        'The current price has been unchanged for less than two days; there is not enough local evidence to reduce it.',
      ],
    };
  if (ageDays < 5) {
    reasons.push(
      'The current price has held for at least two days.',
      'Review current comparable listings before changing the price.',
    );
    return { saleId: sale.id, action: 'review', suggestedPrice: null, ageDays, confidence: 'Medium', reasons };
  }
  if ((sale.priceChanges || 0) >= 3) {
    reasons.push(
      `This listing has already been repriced ${sale.priceChanges} times without selling.`,
      'Repeated cuts with no sale suggest the listing or market needs reconsidering, not another mechanical reduction.',
    );
    return { saleId: sale.id, action: 'review', suggestedPrice: null, ageDays, confidence: 'Medium', reasons };
  }
  const reduction = ageDays >= 10 ? 0.1 : 0.05;
  reasons.push(
    `The current price has held for ${Math.floor(ageDays)} days.`,
    `A conservative ${Math.round(reduction * 100)}% reduction may improve visibility, but active listings are not completed-sale evidence.`,
  );
  return {
    saleId: sale.id,
    action: 'reprice',
    suggestedPrice: Number((sale.listedPrice * (1 - reduction)).toFixed(2)),
    ageDays,
    confidence: 'Medium',
    reasons,
  };
}
