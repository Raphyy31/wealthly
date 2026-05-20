// frontend/src/components/DuplicateMergeModal.jsx
//
// Modal de fusion des doublons Account/Asset détectés au boot.
// Affiche une paire à la fois, propose de garder l'un ou l'autre,
// ou de marquer comme "pas un doublon".

import { useState } from 'react';
import { X } from 'lucide-react';
import { SUBTYPE_LABELS } from '../types/wealth.js';
import { ResponsiveModal } from './ui/ResponsiveModal.jsx';

export function DuplicateMergeModal({ pairs, fmt, onMerge, onSkip, onClose }) {
  const [idx, setIdx] = useState(0);
  const current = pairs[idx];
  if (!current) return null;

  const next = () => {
    if (idx + 1 < pairs.length) setIdx(idx + 1);
    else onClose && onClose();
  };

  return (
    <ResponsiveModal open={true} onClose={onClose}>
        <div className="modal-header">
          <h2 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600 }}>
            Doublon <em>{idx + 1} / {pairs.length}</em>
          </h2>
          <button className="icon-btn" onClick={onClose} title="Fermer"><X size={18}/></button>
        </div>
        <div className="modal-body">
          <p className="modal-eyebrow">
            Deux éléments semblent être le même {SUBTYPE_LABELS[current.accountItem.subtype]}.
          </p>

          <div className="merge-pair">
            <div className="merge-card">
              <span className="badge badge-synced">Synchronisé</span>
              <h4>{current.accountItem.name}</h4>
              <p className="w-num">{fmt(current.accountItem.value)}</p>
              <button
                className="primary-btn"
                onClick={async () => {
                  await onMerge(current, 'keep-account');
                  next();
                }}
              >
                Garder celui-ci
              </button>
            </div>
            <div className="merge-card">
              <span className="badge badge-manual">Manuel</span>
              <h4>{current.assetItem.name}</h4>
              <p className="w-num">{fmt(current.assetItem.value)}</p>
              <button
                className="primary-btn"
                onClick={async () => {
                  await onMerge(current, 'keep-asset');
                  next();
                }}
              >
                Garder celui-ci
              </button>
            </div>
          </div>

          <div className="modal-foot">
            <button className="secondary-btn" onClick={() => { onSkip && onSkip(current); next(); }}>
              Ce ne sont pas des doublons
            </button>
            <button className="secondary-btn" onClick={next}>Passer</button>
          </div>
        </div>
      </ResponsiveModal>
  );
}
