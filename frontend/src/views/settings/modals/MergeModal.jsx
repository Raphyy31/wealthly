// Source: Settings.jsx lines 335-423 — MergeModal
import { useState } from 'react';
import { X } from 'lucide-react';
import { Combobox } from '../../../components/Combobox.jsx';

export function MergeModal({ accounts, sourceId, onConfirm, onClose }) {
  const source = accounts.find(a => a.id === sourceId);
  const others = accounts.filter(a => a.id !== sourceId);
  const [targetId, setTargetId] = useState(others[0]?.id || '');
  const [direction, setDirection] = useState('sourceIntoTarget');
  const [loading, setLoading] = useState(false);
  const target = accounts.find(a => a.id === targetId);
  const kept    = direction === 'sourceIntoTarget' ? target  : source;
  const deleted = direction === 'sourceIntoTarget' ? source  : target;

  const handleConfirm = async () => {
    if (!confirm(`Fusionner "${deleted?.name || deleted?.bank}" dans "${kept?.name || kept?.bank}" ? Cette action est irréversible.`)) return;
    setLoading(true);
    try {
      const [tgt, src] = direction === 'sourceIntoTarget' ? [targetId, sourceId] : [sourceId, targetId];
      await onConfirm(tgt, src);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Fusionner deux comptes</h3>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={16}/></button>
        </div>

        {loading ? (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 24px' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', textAlign: 'center' }}>
              Fusion en cours…<br/>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Les transactions migrent, ça peut prendre quelques secondes.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="ds-input-label">Fusionner avec</label>
                <Combobox
                  value={targetId}
                  onChange={setTargetId}
                  options={others.map(a => ({ value: a.id, label: a.name || a.bank }))}
                  placeholder="Choisir un compte…"
                />
              </div>
              {target && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>Lequel garder ?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { val: 'targetIntoSource', keep: source, del: target },
                      { val: 'sourceIntoTarget', keep: target, del: source },
                    ].map(opt => (
                      <label key={opt.val} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${direction === opt.val ? 'var(--accent)' : 'var(--border)'}`, background: direction === opt.val ? 'var(--accent-soft)' : 'var(--bg-elev)', cursor: 'pointer' }}>
                        <input type="radio" name="direction" value={opt.val} checked={direction === opt.val} onChange={() => setDirection(opt.val)} style={{ marginTop: 2 }}/>
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Garder <span style={{ color: 'var(--positive)' }}>{opt.keep?.name || opt.keep?.bank}</span></div>
                          <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>Supprimer <span style={{ color: 'var(--negative)' }}>{opt.del?.name || opt.del?.bank}</span> — ses transactions migrent dans le compte gardé</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-sunk)', fontSize: 12, color: 'var(--ink-2)' }}>
                Les transactions en double (même identifiant bancaire) seront supprimées. L'identifiant GoCardless sera transféré sur le compte gardé pour que les prochains syncs fonctionnent correctement.
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={onClose}>Annuler</button>
              <button
                className="primary-btn"
                style={{ background: 'var(--negative)', borderColor: 'var(--negative)' }}
                disabled={!targetId}
                onClick={handleConfirm}
              >
                Fusionner
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
