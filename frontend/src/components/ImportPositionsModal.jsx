import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { parseBoursoramaPositions } from '../utils/boursoramaCSV.js';

export function ImportPositionsModal({ parentAsset, fmt, onConfirm, onClose }) {
  const [step, setStep] = useState('upload');  // upload → preview → done
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseBoursoramaPositions(e.target.result);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPositions(result.positions);
      setError(null);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(positions);
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600 }}>
            Importer un <em>portefeuille.</em>
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {step === 'upload' && (
          <div className="modal-body">
            <p className="modal-eyebrow">Format pris en charge</p>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 16px' }}>
              CSV d'export Boursorama (positions instantanées). Glisse ton fichier ou clique pour parcourir.
            </p>

            <label style={{ display: 'block' }}>
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />
              <div className="csv-drop">
                <Upload size={28}/>
                <p>Sélectionne un fichier CSV</p>
              </div>
            </label>

            {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div className="modal-body">
            <p className="modal-eyebrow">
              {positions.length} positions détectées · à ajouter à <strong>{parentAsset?.name}</strong>
            </p>
            <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 10 }}>
              <table className="positions-table">
                <thead>
                  <tr>
                    <th>Valeur</th>
                    <th className="r">Quantité</th>
                    <th className="r">Prix de revient</th>
                    <th className="r">Cours</th>
                    <th className="r">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="pos-name-line">{p.name}</div>
                        <div className="pos-isin">{p.isin}</div>
                      </td>
                      <td className="r w-num">{p.quantity}</td>
                      <td className="r w-num">{fmt(p.buyingPrice)}</td>
                      <td className="r w-num">{fmt(p.lastPrice)}</td>
                      <td className="r w-num">{fmt(p.quantity * p.lastPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-foot">
              <button className="secondary-btn" onClick={() => setStep('upload')}>Retour</button>
              <button className="primary-btn" disabled={submitting} onClick={confirm}>
                {submitting ? 'Import en cours…' : `Importer ${positions.length} positions`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <p style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: 'var(--positive)', margin: '0 0 12px' }}>
              {positions.length} positions importées ✓
            </p>
            <button className="primary-btn" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
