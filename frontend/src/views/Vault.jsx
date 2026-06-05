// ============================================================================
// Vault — coffre-fort de documents (factures, baux, justificatifs…).
// Upload (multipart), liste, preview (object URL authentifié), suppression.
// Liens optionnels vers un compte / actif.
// ============================================================================
import React, { useState, useRef } from 'react';
import { FileText, Image as ImageIcon, File, Upload, Trash2, Eye, FolderLock, Loader2 } from 'lucide-react';
import * as api from '../api.js';

const CATEGORIES = [
  { key: 'facture', label: 'Facture' },
  { key: 'bail', label: 'Bail' },
  { key: 'assurance', label: 'Assurance' },
  { key: 'justificatif', label: 'Justificatif' },
  { key: 'autre', label: 'Autre' },
];

const fmtSize = (b) => {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
};

const iconFor = (ct) => {
  if (!ct) return File;
  if (ct.startsWith('image/')) return ImageIcon;
  if (ct === 'application/pdf' || ct.startsWith('text/')) return FileText;
  return File;
};

export function Vault({ documents = [], accounts = [], onUploaded, onDeleted, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('facture');
  const [accountId, setAccountId] = useState('');
  const [previewingId, setPreviewingId] = useState(null);
  const fileRef = useRef(null);

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const saved = await api.documents.upload({
        file, category, account_id: accountId || null,
      });
      onUploaded?.(saved);
      showToast?.('Document ajouté au coffre-fort', 'success');
    } catch (err) {
      showToast?.(err.message || 'Échec de l’envoi', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const preview = async (doc) => {
    setPreviewingId(doc.id);
    try {
      const url = await api.documents.fetchBlobUrl(doc.id);
      window.open(url, '_blank', 'noopener');
      // L'object URL est libéré par le navigateur à la fermeture de l'onglet.
    } catch (err) {
      showToast?.(err.message || 'Aperçu impossible', 'error');
    } finally {
      setPreviewingId(null);
    }
  };

  const remove = async (doc) => {
    if (!confirm(`Supprimer « ${doc.filename} » ?`)) return;
    try {
      await api.documents.delete(doc.id);
      onDeleted?.(doc.id);
    } catch (err) {
      showToast?.(err.message || 'Suppression impossible', 'error');
    }
  };

  const accountName = (id) => accounts.find(a => a.id === id)?.name;

  return (
    <div className="vault-view">
      <div className="subview-header">
        <div>
          <h1>Votre <em>coffre-fort.</em></h1>
          <p>Factures, baux, justificatifs — rangés, privés, liés à votre patrimoine.</p>
        </div>
      </div>

      {/* Zone d'upload */}
      <section className="card vault-upload">
        <div className="vault-upload-controls">
          <label className="vault-field">
            <span>Catégorie</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className="vault-field">
            <span>Lier à un compte (optionnel)</span>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Aucun</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button className="primary-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 size={16} className="spin"/> : <Upload size={16}/>}
            {uploading ? 'Envoi…' : 'Ajouter un document'}
          </button>
          <input
            ref={fileRef} type="file" hidden onChange={onFilePicked}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*,application/pdf"
          />
        </div>
        <p className="vault-hint">PDF, images, Word/Excel, texte — 8 Mo max par fichier.</p>
      </section>

      {/* Liste */}
      {documents.length === 0 ? (
        <div className="empty-mini" style={{ padding: '50px 0' }}>
          <FolderLock size={28}/>
          <p>Aucun document. Ajoutez votre première facture ou bail.</p>
        </div>
      ) : (
        <div className="vault-list">
          {documents.map(doc => {
            const Icon = iconFor(doc.content_type);
            const cat = CATEGORIES.find(c => c.key === doc.category);
            const acc = accountName(doc.account_id);
            return (
              <div key={doc.id} className="vault-row">
                <span className="vault-row-icon"><Icon size={20}/></span>
                <div className="vault-row-info">
                  <div className="vault-row-name">{doc.filename}</div>
                  <div className="vault-row-meta">
                    {cat && <span className="vault-badge">{cat.label}</span>}
                    {fmtSize(doc.size_bytes)}
                    {acc ? ` · ${acc}` : ''}
                    {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString('fr-FR')}` : ''}
                  </div>
                </div>
                <div className="vault-row-actions">
                  <button className="icon-btn-sm" onClick={() => preview(doc)} disabled={previewingId === doc.id} title="Aperçu">
                    {previewingId === doc.id ? <Loader2 size={15} className="spin"/> : <Eye size={15}/>}
                  </button>
                  <button className="icon-btn-sm" onClick={() => remove(doc)} title="Supprimer"><Trash2 size={15}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
