// Source: Settings.jsx lines 1578-1616 — MemberEditor
// 2026-05-20 : migre vers ResponsiveModal (bottom-sheet vaul sur mobile,
// markup desktop preserve 100%).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import { ChipSelect } from '../../../components/ChipSelect.jsx';
import { BusyButton } from '../../../components/ui/BusyButton.jsx';
import { ResponsiveModal } from '../../../components/ui/ResponsiveModal.jsx';
import { MEMBER_PALETTE } from '../../../constants.js';

export function MemberEditor({ member, onSave, onCancel }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(member);
  const COLORS = MEMBER_PALETTE;
  return (
    <ResponsiveModal open={true} onClose={onCancel}>
      <div className="modal-header">
        <h2>{member.id ? t('settings.household.editMember') : t('settings.household.newMember')}</h2>
        <button className="icon-btn-sm" onClick={onCancel}><X size={16}/></button>
      </div>
      <div className="modal-body">
        <label><span>{t('settings.household.firstName')}</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label>
        <label><span>{t('settings.household.role')}</span>
          <ChipSelect
            value={draft.role}
            onChange={(val) => setDraft({ ...draft, role: val })}
            options={[
              { value: 'adult', label: t('settings.household.adult') },
              { value: 'child', label: t('settings.household.child') },
            ]}
          />
        </label>
        <label><span>{t('settings.household.color')}</span>
          <div className="color-picker">
            {COLORS.map(c => (
              <button key={c} className={`color-dot ${draft.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })}/>
            ))}
          </div>
        </label>
      </div>
      <div className="modal-footer">
        <button className="ds-btn" onClick={onCancel}>{t('actions.cancel')}</button>
        <BusyButton className="ds-btn primary" onClick={async () => { if (draft.name) await onSave(draft); }}><Check size={14}/> {t('actions.save')}</BusyButton>
      </div>
    </ResponsiveModal>
  );
}
