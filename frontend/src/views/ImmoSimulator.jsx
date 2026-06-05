// ============================================================================
// ImmoSimulator — simulateur d'achat immobilier.
//
// Calcule, à partir d'un prix de bien et des revenus du foyer :
//   - la mensualité (capital + intérêts + assurance) via buildAmortization
//   - le taux d'endettement vs le plafond HCSF de 35 %
//   - la capacité d'emprunt / le prix de bien maximum finançable
//   - les frais de notaire, le coût total du crédit, le reste-à-vivre
//
// Tout le calcul tourne côté frontend (vue pure, comme TaxSimulator).
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { Home, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { buildAmortization } from '../utils.js';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';

const HCSF_MAX = 0.35; // plafond d'endettement réglementaire (HCSF)
const NOTAIRE = { ancien: 0.075, neuf: 0.025 }; // taux frais de notaire approx.

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

export function ImmoSimulator({ fmt, monthlyIncome = 0, monthlyCharges = 0 }) {
  const [form, setForm] = useState({
    prix: '300000',
    apport: '40000',
    type: 'ancien',
    taux: '3.5',
    duree: '20',
    assurance: '0.34',
    revenus: monthlyIncome ? String(Math.round(monthlyIncome)) : '4000',
    charges: monthlyCharges ? String(Math.round(monthlyCharges)) : '0',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const r = useMemo(() => {
    const prix = num(form.prix);
    const apport = num(form.apport);
    const notaireRate = NOTAIRE[form.type] ?? NOTAIRE.ancien;
    const taux = num(form.taux);
    const dureeM = Math.max(1, Math.round(num(form.duree) * 12));
    const assurance = num(form.assurance);
    const revenus = num(form.revenus);
    const charges = num(form.charges);

    const fraisNotaire = prix * notaireRate;
    const coutOperation = prix + fraisNotaire;
    const montantEmprunte = Math.max(0, coutOperation - apport);

    const amort = buildAmortization({
      principal: montantEmprunte, annualRate: taux, durationM: dureeM, insuranceRate: assurance,
    });
    const mensualite = amort.length ? amort[0].payment : 0;
    const coutInterets = amort.reduce((s, x) => s + x.interest, 0);
    const coutAssurance = amort.reduce((s, x) => s + x.insurance, 0);
    const coutCredit = coutInterets + coutAssurance;

    const tauxEndettement = revenus > 0 ? ((mensualite + charges) / revenus) * 100 : 0;
    const resteAVivre = revenus - mensualite - charges;
    const finançable = revenus > 0 && tauxEndettement <= HCSF_MAX * 100 + 0.01;

    // Capacité d'emprunt à 35 % : mensualité max disponible, puis principal
    // inverse de l'annuité (assurance incluse de façon approchée).
    const mr = taux / 100 / 12;
    const insMonthly = assurance / 100 / 12;
    const annuityFactor = mr > 0
      ? (mr * Math.pow(1 + mr, dureeM)) / (Math.pow(1 + mr, dureeM) - 1)
      : 1 / dureeM;
    const mensualiteMax = Math.max(0, HCSF_MAX * revenus - charges);
    const capaciteEmprunt = (annuityFactor + insMonthly) > 0
      ? mensualiteMax / (annuityFactor + insMonthly)
      : 0;
    // Prix de bien max : (capacité + apport) net des frais de notaire.
    const prixMax = (capaciteEmprunt + apport) / (1 + notaireRate);

    // Courbe du capital restant dû (1 point/an).
    const curve = [];
    for (let i = 0; i < amort.length; i += 12) {
      curve.push({ annee: Math.floor(i / 12), capital: Math.round(amort[i].remaining) });
    }
    if (amort.length) curve.push({ annee: Math.ceil(amort.length / 12), capital: 0 });

    return {
      fraisNotaire, coutOperation, montantEmprunte, mensualite, coutInterets,
      coutAssurance, coutCredit, tauxEndettement, resteAVivre, finançable,
      capaciteEmprunt, prixMax, curve,
    };
  }, [form]);

  const donut = [
    { name: 'Capital emprunté', value: Math.round(r.montantEmprunte), color: 'var(--d1)' },
    { name: 'Intérêts', value: Math.round(r.coutInterets), color: 'var(--d3)' },
    { name: 'Assurance', value: Math.round(r.coutAssurance), color: 'var(--d4)' },
    { name: 'Frais de notaire', value: Math.round(r.fraisNotaire), color: 'var(--d6)' },
  ].filter(d => d.value > 0);

  const fmtShort = (v) => { try { return fmt(v); } catch { return `${Math.round(v)} €`; } };
  const endettementCls = r.tauxEndettement > 35 ? 'negative' : r.tauxEndettement > 30 ? 'warning' : 'positive';

  return (
    <div className="immo-view">
      <div className="subview-header">
        <div>
          <h1>Simulateur <em>immobilier.</em></h1>
          <p>Capacité d'emprunt, mensualité et reste-à-vivre — avant de vous lancer.</p>
        </div>
      </div>

      <div className="immo-grid">
        {/* ---- Paramètres ---- */}
        <section className="card immo-form-card">
          <div className="card-header"><h3>Votre projet</h3></div>
          <div className="immo-form">
            <label><span>Prix du bien</span>
              <input type="number" inputMode="numeric" value={form.prix} onChange={e => set('prix', e.target.value)} placeholder="300000"/>
            </label>
            <div className="field-row">
              <label><span>Apport</span>
                <input type="number" inputMode="numeric" value={form.apport} onChange={e => set('apport', e.target.value)} placeholder="40000"/>
              </label>
              <label><span>Type de bien</span>
                <div className="nw-toggle-group" style={{ width: '100%' }}>
                  <button type="button" className={form.type === 'ancien' ? 'active' : ''} onClick={() => set('type', 'ancien')}>Ancien</button>
                  <button type="button" className={form.type === 'neuf' ? 'active' : ''} onClick={() => set('type', 'neuf')}>Neuf</button>
                </div>
              </label>
            </div>
            <div className="field-row">
              <label><span>Taux annuel (%)</span>
                <input type="number" step="0.01" inputMode="decimal" value={form.taux} onChange={e => set('taux', e.target.value)} placeholder="3.5"/>
              </label>
              <label><span>Durée (ans)</span>
                <input type="number" inputMode="numeric" value={form.duree} onChange={e => set('duree', e.target.value)} placeholder="20"/>
              </label>
            </div>
            <div className="field-row">
              <label><span>Assurance (%/an)</span>
                <input type="number" step="0.01" inputMode="decimal" value={form.assurance} onChange={e => set('assurance', e.target.value)} placeholder="0.34"/>
              </label>
              <label><span>Revenus nets/mois</span>
                <input type="number" inputMode="numeric" value={form.revenus} onChange={e => set('revenus', e.target.value)} placeholder="4000"/>
              </label>
            </div>
            <label><span>Crédits/charges déjà en cours (€/mois)</span>
              <input type="number" inputMode="numeric" value={form.charges} onChange={e => set('charges', e.target.value)} placeholder="0"/>
            </label>
          </div>
        </section>

        {/* ---- Résultats ---- */}
        <section className="card immo-result-card">
          <div className="card-header"><h3>Résultat</h3></div>

          <div className={`immo-verdict ${r.finançable ? 'ok' : 'ko'}`} role="status">
            {r.finançable
              ? <><CheckCircle2 size={18} aria-hidden="true"/><span>Projet finançable — endettement à <strong>{r.tauxEndettement.toFixed(1)} %</strong> (≤ 35 %).</span></>
              : <><AlertTriangle size={18} aria-hidden="true"/><span>Endettement à <strong>{r.tauxEndettement.toFixed(1)} %</strong> — au-delà du plafond de 35 %. Augmentez l'apport ou la durée.</span></>}
          </div>

          <div className="cashflow-kpi-row" style={{ marginTop: 4 }}>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Mensualité</div>
              <div className="cashflow-kpi-value"><AnimatedNumber value={r.mensualite} format={fmtShort}/></div>
            </div>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Taux d'endettement</div>
              <div className={`cashflow-kpi-value ${endettementCls}`}>{r.tauxEndettement.toFixed(1)} %</div>
            </div>
            <div className="cashflow-kpi">
              <div className="cashflow-kpi-label">Reste-à-vivre</div>
              <div className={`cashflow-kpi-value ${r.resteAVivre >= 0 ? 'positive' : 'negative'}`}>
                <AnimatedNumber value={r.resteAVivre} format={fmtShort}/>
              </div>
            </div>
          </div>

          <div className="immo-capacity">
            <TrendingUp size={16} aria-hidden="true"/>
            <span>À 35 % d'endettement, vous pouvez emprunter jusqu'à <strong>{fmtShort(r.capaciteEmprunt)}</strong>, soit un bien d'environ <strong>{fmtShort(r.prixMax)}</strong> (apport inclus).</span>
          </div>

          <div className="immo-breakdown">
            <div className="immo-bd-row"><span>Montant emprunté</span><b>{fmtShort(r.montantEmprunte)}</b></div>
            <div className="immo-bd-row"><span>Frais de notaire ({(NOTAIRE[form.type] * 100).toFixed(1)} %)</span><b>{fmtShort(r.fraisNotaire)}</b></div>
            <div className="immo-bd-row"><span>Coût total du crédit</span><b>{fmtShort(r.coutCredit)}</b></div>
            <div className="immo-bd-row total"><span>Coût total de l'opération</span><b>{fmtShort(r.coutOperation + r.coutCredit)}</b></div>
          </div>
        </section>
      </div>

      {/* ---- Dataviz ---- */}
      <div className="immo-grid">
        <section className="card">
          <div className="card-header"><h3>Capital restant dû</h3></div>
          {r.curve.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={r.curve} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="immoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false}/>
                <XAxis dataKey="annee" tickFormatter={(a) => `${a}a`} tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--border)"/>
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={42} tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--border)"/>
                <Tooltip formatter={(v) => fmtShort(v)} labelFormatter={(a) => `Année ${a}`} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
                <Area type="monotone" dataKey="capital" stroke="var(--accent)" strokeWidth={2} fill="url(#immoFill)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-mini"><Home size={24}/><p>Renseignez un prix et un revenu pour simuler.</p></div>}
        </section>

        <section className="card">
          <div className="card-header"><h3>Coût de l'opération</h3></div>
          {donut.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donut} dataKey="value" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
                  {donut.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip formatter={(v) => fmtShort(v)} contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-mini"><Home size={24}/><p>Aucun coût à afficher.</p></div>}
          <div className="immo-legend">
            {donut.map((d, i) => (
              <div key={i} className="immo-legend-item">
                <span className="immo-legend-dot" style={{ background: d.color }}/>
                <span>{d.name}</span>
                <b>{fmtShort(d.value)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
