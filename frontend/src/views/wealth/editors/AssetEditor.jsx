// ============================================================================
// AssetEditor — dispatcher: routes to RealEstateEditor or SimpleAssetEditor
// depending on the asset type.
// Extracted from Wealth.jsx lines 602-625.
// ============================================================================
import { RealEstateEditor } from './RealEstateEditor.jsx';
import { SimpleAssetEditor } from './SimpleAssetEditor.jsx';

export function AssetEditor({ asset, members, liabilities = [], onSave, onCancel }) {
  // Garde-fou : si on reçoit un asset null/undefined (race condition entre
  // setEditingAsset et setViewingInv), on ferme proprement plutôt que de
  // crasher. Si le type est manquant ou inconnu, fallback sur SimpleAssetEditor
  // qui sait afficher tous les champs malgré tout.
  if (!asset) {
    if (typeof console !== 'undefined') console.warn('[AssetEditor] asset is null/undefined');
    return null;
  }
  if (asset.type === 'real_estate') {
    return <RealEstateEditor asset={asset} members={members} liabilities={liabilities} onSave={onSave} onCancel={onCancel}/>;
  }
  // Normalise les champs minimum requis par SimpleAssetEditor pour éviter
  // les <input value={undefined}> warnings React et le modal vide.
  const safe = {
    type: asset.type || 'other_asset',
    currency: asset.currency || 'EUR',
    name: asset.name || '',
    currentValue: asset.currentValue ?? '',
    memberIds: asset.memberIds || [],
    ...asset,
  };
  return <SimpleAssetEditor asset={safe} members={members} onSave={onSave} onCancel={onCancel}/>;
}
