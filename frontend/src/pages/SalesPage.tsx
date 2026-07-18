import { CircleDollarSign, LoaderCircle, Plus, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

type Advice = {
  saleId: number;
  action: 'hold' | 'review' | 'reprice';
  confidence: string;
  reasons: string[];
  suggestedPrice: number | null;
};

export function SalesPage() {
  const { t, format } = useI18n();
  const [sales, setSales] = useState<Array<Record<string, unknown>>>([]),
    [advice, setAdvice] = useState<Advice[]>([]),
    [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    itemName: '',
    league: 'Runes of Aldur',
    listedPrice: 1,
    currency: 'exalted' as 'exalted' | 'divine',
    notes: '',
  });
  const load = () =>
    Promise.all([api.sales(), api.saleAdvice()])
      .then(([result, tips]) => {
        setSales(result.sales);
        setAdvice(tips.advice);
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  async function add() {
    await api.createSale(form);
    setForm({ ...form, itemName: '', notes: '' });
    await load();
  }
  async function update(id: number, body: { status?: 'sold'; finalPrice?: number; price?: number }) {
    await api.updateSale(id, body);
    await load();
  }
  return (
    <div className="page standard-page">
      <header className="page-header">
        <span className="eyebrow">{t('sales.eyebrow').toUpperCase()}</span>
        <h1>{t('sales.title')}</h1>
        <p>{t('sales.help')}</p>
      </header>
      <section className="card build-card">
        <div className="build-section-title">
          <CircleDollarSign />
          <div>
            <h2>{t('sales.new')}</h2>
            <p>{t('sales.newHelp')}</p>
          </div>
        </div>
        <div className="build-fields">
          <label>
            {t('sales.item')}
            <input
              aria-label={t('sales.item')}
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            />
          </label>
          <label>
            {t('sales.league')}
            <input
              aria-label={t('sales.league')}
              value={form.league}
              onChange={(e) => setForm({ ...form, league: e.target.value })}
            />
          </label>
          <label>
            {t('sales.price')}
            <input
              aria-label={t('sales.price')}
              type="number"
              min="0.01"
              value={form.listedPrice}
              onChange={(e) => setForm({ ...form, listedPrice: Number(e.target.value) })}
            />
          </label>
          <label>
            {t('sales.currency')}
            <select
              aria-label={t('sales.currency')}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as 'exalted' | 'divine' })}
            >
              <option value="exalted">Exalted</option>
              <option value="divine">Divine</option>
            </select>
          </label>
          <label className="wide">
            {t('sales.notes')}
            <textarea
              aria-label={t('sales.notes')}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
        <button className="primary-button" type="button" disabled={!form.itemName.trim()} onClick={add}>
          <Plus />
          {t('sales.add')}
        </button>
      </section>
      {loading ? (
        <div className="loading" role="status">
          <LoaderCircle className="spin" />
          {t('sales.loading')}
        </div>
      ) : (
        <div className="saved-grid">
          {sales.map((sale) => {
            const tip = advice.find((item) => item.saleId === Number(sale.id));
            return (
              <article className="card saved-card" key={String(sale.id)}>
                <div className={`source-dot ${sale.status === 'sold' ? 'live' : 'manual'}`} />
                <div>
                  <span>
                    {String(sale.status)} · {String(sale.league)}
                  </span>
                  <h2>{String(sale.itemName)}</h2>
                  <small>
                    {t('sales.listed')} {format.dateTime(String(sale.listedAt))}
                  </small>
                  {tip && (
                    <div className={`sale-advice ${tip.action}`}>
                      <Sparkles />
                      <div>
                        <strong>
                          {tip.action === 'reprice'
                            ? t('sales.review')
                            : tip.action === 'review'
                              ? t('sales.comparables')
                              : t('sales.hold')}
                        </strong>
                        <small>
                          {tip.reasons[0]} · {tip.confidence} {t('gemini.confidence')}
                        </small>
                      </div>
                    </div>
                  )}
                </div>
                <div className="saved-price">
                  <strong>
                    {String(sale.listedPrice)} {String(sale.currency)}
                  </strong>
                  {sale.finalPrice != null && (
                    <span>
                      {t('sales.soldFor')} {String(sale.finalPrice)}
                    </span>
                  )}
                </div>
                <div className="saved-actions">
                  {sale.status === 'listed' && (
                    <>
                      <button
                        type="button"
                        title={t('sales.markSold')}
                        aria-label={t('sales.markSold')}
                        onClick={() =>
                          update(Number(sale.id), { status: 'sold', finalPrice: Number(sale.listedPrice) })
                        }
                      >
                        <CircleDollarSign />
                      </button>
                      {tip?.suggestedPrice && (
                        <button type="button" onClick={() => update(Number(sale.id), { price: tip.suggestedPrice! })}>
                          {t('sales.apply')} {tip.suggestedPrice}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
