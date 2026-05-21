// ============================================================================
// LiabilityDetail — Finary-style amortization + KPI detail view for loans.
// Extracted from Wealth.jsx lines 1258-1619.
// ============================================================================
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, Edit3, Home, Users, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDate, buildAmortization } from '../../../utils.js';
import { LiabilityPatchStyles } from '../styles.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';

export function LiabilityDetail({ liability, assets, members, memberShare, fmt, onEdit, onClose, onOpenLinkedAsset }) {
  const l = liability;
  const [activeTab, setActiveTab] = useState('synthese');

  const schedule = useMemo(() => buildAmortization({
    principal: l.initialCapital,
    annualRate: l.interestRate,
    durationM: l.durationMonths,
    insuranceRate: l.insuranceRate,
    startDate: l.startDate,
    paymentOverride: l.monthlyPayment,
  }), [l]);

  const today = new Date().toISOString().slice(0, 10);
  const paidRows = schedule.filter(r => r.date <= today);
  const remainingRows = schedule.filter(r => r.date > today);
  const totalCost = schedule.reduce((s, r) => s + r.payment, 0) + (parseFloat(l.applicationFees) || 0);
  const totalCapitalPaid = paidRows.reduce((s, r) => s + r.capital, 0);
  const totalInterestPaid = paidRows.reduce((s, r) => s + r.interest, 0);
  const totalInsurancePaid = paidRows.reduce((s, r) => s + r.insurance, 0);
  const totalPaid = totalCapitalPaid + totalInterestPaid + totalInsurancePaid;
  const totalRemaining = remainingRows.reduce((s, r) => s + r.payment, 0);
  const computedRemaining = remainingRows.length > 0 ? remainingRows[0].remaining + remainingRows[0].capital : 0;
  const remainingCapital = parseFloat(l.remainingCapital) > 0 ? parseFloat(l.remainingCapital) : computedRemaining;
  const principal = parseFloat(l.initialCapital) || 0;
  const pctRepaid = principal > 0 ? Math.min(100, ((principal - remainingCapital) / principal) * 100) : 0;
  const linkedAsset = l.linkedAssetId ? assets.find(a => a.id === l.linkedAssetId) : null;
  const owners = (l.memberIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(' & ');
  const monthlyPayment = parseFloat(l.monthlyPayment) || (schedule[0]?.payment ?? 0);

  const chartData = schedule.map(r => ({
    date: r.date,
    remaining: Math.round(r.remaining),
    payment: Math.round(r.payment),
  }));

  // Current/next monthly breakdown — find first unpaid row (or fallback to first row)
  const currentRow = remainingRows[0] || schedule[0] || null;
  const breakdownCapital = currentRow ? currentRow.capital : 0;
  const breakdownInterest = currentRow ? currentRow.interest : 0;
  const breakdownInsurance = currentRow ? currentRow.insurance : 0;
  const breakdownTotal = breakdownCapital + breakdownInterest + breakdownInsurance;
  const endDate = schedule.length > 0 ? schedule[schedule.length - 1].date : null;

  return (
    <ResponsiveModal open={true} onClose={onClose}> e.stopPropagation()}>
        {/* Top bar — back arrow + name + actions */}
        <header className="loan-finary-topbar">
          <button className="loan-finary-back" onClick={onClose} aria-label="Fermer">
            <ChevronLeft size={18}/>
          </button>
          <span className="loan-finary-pagetitle">Loan</span>
          <div className="loan-finary-topbar-actions">
            <button className="ds-btn" onClick={onEdit}><Edit3 size={13}/> Modifier</button>
          </div>
        </header>

        {/* KPI strip — title + 4 inline metrics */}
        <div className="loan-finary-kpi-strip">
          <div className="loan-finary-title-block">
            <span className="loan-finary-eyebrow">Loan</span>
            <h2 className="loan-finary-title">{l.name}</h2>
          </div>

          <div className="loan-finary-kpis">
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Remboursé</div>
              <div className="loan-finary-progress">
                <div className="loan-finary-progress-fill" style={{ width: `${pctRepaid}%` }}/>
              </div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Taux d'intérêt</div>
              <div className="loan-finary-kpi-value w-num">{l.interestRate ? `${parseFloat(l.interestRate).toFixed(2)}%` : '—'}</div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Mensualité</div>
              <div className="loan-finary-kpi-value w-num">{fmt(monthlyPayment)}</div>
            </div>
            <div className="loan-finary-kpi">
              <div className="loan-finary-kpi-label">Capital restant dû</div>
              <div className="loan-finary-kpi-value w-num">{fmt(remainingCapital)}</div>
            </div>
          </div>
        </div>

        {/* Tabs — Synthèse / Mensualités */}
        <div className="loan-finary-tabs">
          <button className={activeTab === 'synthese' ? 'active' : ''} onClick={() => setActiveTab('synthese')}>Synthèse</button>
          <button className={activeTab === 'mensualites' ? 'active' : ''} onClick={() => setActiveTab('mensualites')}>Mensualités</button>
        </div>

        <div className="loan-finary-body">
          {activeTab === 'synthese' && (
            <>
              <div className="loan-finary-grid">
                {/* Area chart — capital remaining over time, smooth cobalt line + subtle fill */}
                <div className="loan-finary-chart">
                  {schedule.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="loanRemainingFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22}/>
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                        <XAxis dataKey="date" tickFormatter={(d) => d.slice(0, 4)} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(schedule.length / 8))}/>
                        <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={56}/>
                        <Tooltip
                          formatter={(v) => [fmt(v), 'Capital restant']}
                          labelFormatter={(d) => formatDate(d, { format: 'monthYear' })}
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                        />
                        <Area type="monotone" dataKey="remaining" stroke="var(--accent)" strokeWidth={2} fill="url(#loanRemainingFill)" dot={false} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg-elev, var(--bg-card))', strokeWidth: 2 }}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-mini" style={{ padding: '60px 0' }}>
                      <BarChart3 size={24}/>
                      <p>Renseigne le capital, le taux et la durée pour voir la courbe d'amortissement.</p>
                    </div>
                  )}
                </div>

                {/* Right monthly panel — big amount + breakdown + stats + progress */}
                <div className="loan-monthly-panel">
                  <div className="loan-monthly-eyebrow">Mensualité</div>
                  <div className="loan-monthly-amount">
                    <em>{fmt(breakdownTotal || monthlyPayment)}</em>
                  </div>
                  <div className="loan-monthly-sub">par mois</div>

                  <ul className="loan-monthly-breakdown">
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--accent)' }}/>
                      <span className="loan-monthly-label">Capital</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownCapital)}</span>
                    </li>
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--positive)' }}/>
                      <span className="loan-monthly-label">Intérêts</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownInterest)}</span>
                    </li>
                    <li>
                      <span className="loan-monthly-dot" style={{ background: 'var(--negative)' }}/>
                      <span className="loan-monthly-label">Assurance</span>
                      <span className="loan-monthly-value w-num">{fmt(breakdownInsurance)}</span>
                    </li>
                  </ul>

                  <div className="loan-monthly-stats">
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Échéances payées</span>
                      <span className="loan-monthly-stat-value w-num">{paidRows.length}</span>
                    </div>
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Échéances restantes</span>
                      <span className="loan-monthly-stat-value w-num">{remainingRows.length}</span>
                    </div>
                    <div className="loan-monthly-stat">
                      <span className="loan-monthly-stat-label">Date de fin</span>
                      <span className="loan-monthly-stat-value">{endDate ? formatDate(endDate, { format: 'monthLong' }) : '—'}</span>
                    </div>
                  </div>

                  <p className="loan-progress-text">
                    Vous avez remboursé <strong className="w-num">{pctRepaid.toFixed(0)} %</strong> <em>du capital du prêt</em>
                  </p>
                </div>
              </div>

              {/* Synthèse coût — une seule ligne compacte (le détail vit dans l'onglet Mensualités) */}
              <div className="loan-cost-band">
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Coût total du crédit</div>
                  <div className="loan-cost-val w-num">{fmt(Math.max(0, totalCost - principal))}</div>
                  <div className="loan-cost-meta">intérêts + assurances + frais sur la durée du prêt</div>
                </div>
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Total remboursé à ce jour</div>
                  <div className="loan-cost-val w-num">{fmt(totalPaid)}</div>
                  <div className="loan-cost-meta">
                    dont capital <strong className="w-num">{fmt(totalCapitalPaid)}</strong>
                    {' · '}intérêts <strong className="w-num">{fmt(totalInterestPaid)}</strong>
                  </div>
                </div>
                <div className="loan-cost-item">
                  <div className="loan-monthly-label">Restant à rembourser</div>
                  <div className="loan-cost-val w-num">{fmt(totalRemaining)}</div>
                  <div className="loan-cost-meta">
                    <strong className="w-num">{(100 - pctRepaid).toFixed(0)} %</strong> du capital encore dû
                  </div>
                </div>
              </div>

              {/* Linked asset card — cliquable pour naviguer vers le détail de l'actif */}
              {linkedAsset && (
                <button
                  className="loan-finary-linked"
                  onClick={() => onOpenLinkedAsset && onOpenLinkedAsset(linkedAsset)}
                  title={onOpenLinkedAsset ? 'Voir le détail de l\'actif' : ''}
                  disabled={!onOpenLinkedAsset}
                >
                  <div className="loan-finary-linked-icon">
                    <Home size={18}/>
                  </div>
                  <div className="loan-finary-linked-text">
                    <div className="loan-finary-linked-label">Actif lié à l'emprunt</div>
                    <div className="loan-finary-linked-name">
                      {linkedAsset.name}{linkedAsset.address ? ` · ${linkedAsset.address}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={16} className="loan-finary-linked-chevron"/>
                </button>
              )}

              {/* Plus-value latente : 2 calculs côte à côte avec détail
                  - Brute  = Valeur actuelle − Prix d'achat (vision marché courante)
                  - Nette  = Valeur actuelle − (Prix d'achat + notaire + agence + travaux + mobilier)
                            (déductions fiscales à la cession) */}
              {linkedAsset && (() => {
                const cv = parseFloat(linkedAsset.currentValue) || 0;
                const pp = parseFloat(linkedAsset.purchasePrice) || 0;
                const notaryFees = parseFloat(linkedAsset.notaryFees) || 0;
                const agencyFees = parseFloat(linkedAsset.agencyFees) || 0;
                const worksFees = parseFloat(linkedAsset.worksFees) || 0;
                const furnitureFees = parseFloat(linkedAsset.furnitureFees) || 0;
                const acqExtra = notaryFees + agencyFees + worksFees + furnitureFees;
                const acqTotal = pp + acqExtra;
                if (cv <= 0 || pp <= 0) return null;
                const plBrute = cv - pp;
                const plBrutePct = (plBrute / pp) * 100;
                const plNette = cv - acqTotal;
                const plNettePct = acqTotal > 0 ? (plNette / acqTotal) * 100 : 0;
                return (
                  <div className="loan-pl-panel">
                    <div className="loan-pl-head">
                      <div>
                        <div className="loan-monthly-label">PLUS-VALUE LATENTE</div>
                        <p className="loan-pl-intro">
                          Estimation de la valorisation du bien lié.
                        </p>
                      </div>
                    </div>
                    <div className="loan-pl-grid">
                      <div className="loan-pl-card">
                        <div className="loan-pl-card-label">Plus-value brute <span className="loan-pl-card-hint">(marché)</span></div>
                        <div className={`loan-pl-card-value w-num ${plBrute >= 0 ? 'pl-up' : 'pl-down'}`}>
                          {plBrute >= 0 ? '+' : ''}{fmt(plBrute)}
                          <span className="loan-pl-card-pct">{plBrute >= 0 ? '+' : ''}{plBrutePct.toFixed(1).replace('.', ',')} %</span>
                        </div>
                        <div className="loan-pl-card-detail">
                          <span>Valeur actuelle</span><span className="w-num">{fmt(cv)}</span>
                        </div>
                        <div className="loan-pl-card-detail">
                          <span>− Prix d'achat</span><span className="w-num">{fmt(pp)}</span>
                        </div>
                      </div>
                      <div className="loan-pl-card">
                        <div className="loan-pl-card-label">Plus-value nette <span className="loan-pl-card-hint">(fiscale, à la cession)</span></div>
                        <div className={`loan-pl-card-value w-num ${plNette >= 0 ? 'pl-up' : 'pl-down'}`}>
                          {plNette >= 0 ? '+' : ''}{fmt(plNette)}
                          <span className="loan-pl-card-pct">{plNette >= 0 ? '+' : ''}{plNettePct.toFixed(1).replace('.', ',')} %</span>
                        </div>
                        <div className="loan-pl-card-detail">
                          <span>Valeur actuelle</span><span className="w-num">{fmt(cv)}</span>
                        </div>
                        <div className="loan-pl-card-detail">
                          <span>− Prix d'achat</span><span className="w-num">{fmt(pp)}</span>
                        </div>
                        {notaryFees > 0 && (
                          <div className="loan-pl-card-detail muted">
                            <span>− Frais notaire</span><span className="w-num">{fmt(notaryFees)}</span>
                          </div>
                        )}
                        {agencyFees > 0 && (
                          <div className="loan-pl-card-detail muted">
                            <span>− Frais d'agence</span><span className="w-num">{fmt(agencyFees)}</span>
                          </div>
                        )}
                        {worksFees > 0 && (
                          <div className="loan-pl-card-detail muted">
                            <span>− Travaux</span><span className="w-num">{fmt(worksFees)}</span>
                          </div>
                        )}
                        {furnitureFees > 0 && (
                          <div className="loan-pl-card-detail muted">
                            <span>− Mobilier</span><span className="w-num">{fmt(furnitureFees)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="loan-pl-footnote">
                      <strong>Brute</strong> reflète la performance courante de l'actif sur le marché. <strong>Nette</strong> sera la base imposable si tu vends — les frais de notaire, d'agence et les travaux justifiés se déduisent à la cession.
                    </p>
                  </div>
                );
              })()}

              {owners && (
                <div className="loan-finary-meta">
                  <Users size={13}/> {owners}
                </div>
              )}
            </>
          )}

          {activeTab === 'mensualites' && (
            <div className="loan-finary-table-wrap">
              {schedule.length === 0 ? (
                <div className="empty-mini" style={{ padding: '60px 0' }}>
                  <BarChart3 size={24}/>
                  <p>Échéancier indisponible — renseigne capital, taux et durée.</p>
                </div>
              ) : (
                <table className="loan-finary-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="right">Mensualité</th>
                      <th className="right">Capital</th>
                      <th className="right">Intérêts</th>
                      <th className="right">Assurance</th>
                      <th className="right">Capital restant</th>
                      <th className="center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((r, i) => {
                      const isPaid = r.date <= today;
                      return (
                        <tr key={i} className={isPaid ? 'paid' : 'pending'}>
                          <td className="w-num">{formatDate(r.date, { format: 'monthYear' })}</td>
                          <td className="right w-num">{fmt(r.payment)}</td>
                          <td className="right w-num">{fmt(r.capital)}</td>
                          <td className="right w-num">{fmt(r.interest)}</td>
                          <td className="right w-num">{fmt(r.insurance)}</td>
                          <td className="right w-num">{fmt(r.remaining)}</td>
                          <td className="center">
                            <span className={`loan-finary-status ${isPaid ? 'paid' : 'pending'}`}>
                              {isPaid ? 'Payée' : 'À venir'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <LiabilityPatchStyles/>
      </ResponsiveModal>
  );
}
