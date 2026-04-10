import { useEffect, useRef, useState } from 'react'
import type {
  AccessKind,
  HealthStatus,
  ProviderId,
  SourceType,
  TrackedAccount,
} from '../types/account'

export type AccountDraft = {
  accessKind: AccessKind
  label: string
  notes: string
  openAIProjectId: string
  planName: string
  provider: ProviderId
  sourceType: SourceType
  spendCapUsd: string
  status: HealthStatus
}

type AccountEditorProps = {
  account?: TrackedAccount
  createLabel: string
  isOpen: boolean
  mode: 'create' | 'edit'
  onClose: () => void
  onCreateAccount: (draft: AccountDraft) => void
  onDeleteAccount: (accountId: string) => void
  onUpdateAccount: (account: TrackedAccount) => void
}

const statusOptions: Array<{ label: string; value: HealthStatus }> = [
  { label: 'Healthy', value: 'healthy' },
  { label: 'Watch', value: 'watch' },
  { label: 'Warning', value: 'warning' },
  { label: 'Exhausted', value: 'exhausted' },
  { label: 'Unknown', value: 'unknown' },
  { label: 'Idle', value: 'idle' },
]

const providerOptions: Array<{ label: string; value: ProviderId }> = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google AI', value: 'google' },
  { label: 'Other', value: 'other' },
]

const accessKindOptions: Array<{ help: string; label: string; value: AccessKind }> = [
  { label: 'API', value: 'api', help: 'Usage metered by API spend or quotas.' },
  { label: 'OAuth', value: 'oauth', help: 'Account access managed through OAuth or login limits.' },
  { label: 'Subscription', value: 'subscription', help: 'Flat plan or seat-based subscription.' },
]

const buildDraft = (account: TrackedAccount | undefined, createLabel: string): AccountDraft => ({
  accessKind: account?.accessKind ?? 'api',
  label: account?.label ?? createLabel,
  notes: account?.notes ?? '',
  openAIProjectId: account?.openAIProjectId ?? '',
  planName: account?.planName ?? '',
  provider: account?.provider ?? 'openai',
  sourceType: account?.sourceType ?? 'api',
  spendCapUsd: account?.spendCapUsd != null ? String(account.spendCapUsd) : '',
  status: account?.status ?? 'unknown',
})

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined

  const nextValue = Number(value)
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return undefined
  }

  return nextValue
}

function AccountEditor({
  account,
  createLabel,
  isOpen,
  mode,
  onClose,
  onCreateAccount,
  onDeleteAccount,
  onUpdateAccount,
}: AccountEditorProps) {
  const [draft, setDraft] = useState<AccountDraft>(() => buildDraft(account, createLabel))
  const nameInputRef = useRef<HTMLInputElement>(null)

  const supportsLiveSync = draft.provider === 'openai' && draft.accessKind === 'api'

  useEffect(() => {
    if (!isOpen) return
    setDraft(buildDraft(account, createLabel))
  }, [account, createLabel, isOpen, mode])

  useEffect(() => {
    if (!supportsLiveSync && draft.sourceType !== 'manual') {
      setDraft((currentDraft) => ({ ...currentDraft, sourceType: 'manual' }))
    }
  }, [draft.sourceType, supportsLiveSync])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }, 10)

    return () => window.clearTimeout(focusTimer)
  }, [isOpen, mode])

  useEffect(() => {
    if (isOpen && mode === 'edit' && !account) {
      onClose()
    }
  }, [account, isOpen, mode, onClose])

  if (!isOpen) {
    return null
  }

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const label = draft.label.trim() || createLabel
    const notes = draft.notes.trim()
    const planName = draft.planName.trim()
    const spendCapUsd = parseOptionalNumber(draft.spendCapUsd)
    const sourceType = supportsLiveSync ? draft.sourceType : 'manual'
    const openAIProjectId =
      draft.provider === 'openai' && draft.accessKind === 'api'
        ? draft.openAIProjectId.trim() || undefined
        : undefined

    if (mode === 'edit' && account) {
      onUpdateAccount({
        ...account,
        accessKind: draft.accessKind,
        label,
        notes: notes || undefined,
        openAIProjectId,
        planName: planName || undefined,
        provider: draft.provider,
        sourceType,
        spendCapUsd,
        status: draft.status,
        updatedAt: new Date().toISOString(),
      })
      onClose()
      return
    }

    onCreateAccount({
      ...draft,
      label,
      notes,
      openAIProjectId: openAIProjectId ?? '',
      planName,
      sourceType,
      spendCapUsd: spendCapUsd != null ? String(spendCapUsd) : '',
    })
    onClose()
  }

  const handleDelete = () => {
    if (!account) return
    onDeleteAccount(account.id)
    onClose()
  }

  return (
    <div
      aria-modal="true"
      className="modal"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form className="modal__panel" onSubmit={handleSave}>
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">{mode === 'create' ? 'New account' : 'Edit account'}</p>
            <h2>{mode === 'create' ? 'Add account' : 'Update account'}</h2>
          </div>
          <button
            aria-label="Close account editor"
            className="button button--ghost button--icon"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="modal__grid">
          <label className="field">
            <span>Name</span>
            <input
              ref={nameInputRef}
              value={draft.label}
              onChange={(event) =>
                setDraft((currentDraft) => ({ ...currentDraft, label: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Provider</span>
            <select
              value={draft.provider}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  provider: event.target.value as ProviderId,
                }))
              }
            >
              {providerOptions.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Account type</span>
            <select
              value={draft.accessKind}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  accessKind: event.target.value as AccessKind,
                }))
              }
            >
              {accessKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="field__hint">
              {accessKindOptions.find((option) => option.value === draft.accessKind)?.help}
            </p>
          </label>

          <label className="field">
            <span>Refresh mode</span>
            <select
              value={supportsLiveSync ? draft.sourceType : 'manual'}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  sourceType: event.target.value as SourceType,
                }))
              }
              disabled={!supportsLiveSync}
            >
              <option value="manual">Manual check-in</option>
              {supportsLiveSync ? <option value="api">Live provider sync</option> : null}
            </select>
            <p className="field__hint">
              {supportsLiveSync
                ? 'OpenAI API accounts can refresh live from the BurnDeck backend.'
                : 'Live sync is only available for OpenAI API accounts right now.'}
            </p>
          </label>

          <label className="field">
            <span>Health indicator</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  status: event.target.value as HealthStatus,
                }))
              }
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Plan / label</span>
            <input
              value={draft.planName}
              placeholder="Pay-as-you-go, Team, Plus..."
              onChange={(event) =>
                setDraft((currentDraft) => ({ ...currentDraft, planName: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Spend cap USD</span>
            <input
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
              value={draft.spendCapUsd}
              placeholder="100"
              onChange={(event) =>
                setDraft((currentDraft) => ({ ...currentDraft, spendCapUsd: event.target.value }))
              }
            />
            <p className="field__hint">
              Optional. Used to derive watch, warning, and exhausted states from live spend.
            </p>
          </label>

          {draft.provider === 'openai' && draft.accessKind === 'api' ? (
            <label className="field field--full">
              <span>OpenAI project ID</span>
              <input
                value={draft.openAIProjectId}
                placeholder="proj_123..."
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    openAIProjectId: event.target.value,
                  }))
                }
              />
              <p className="field__hint">
                Optional. Leave blank for org-wide totals. Set this to track one OpenAI project
                separately.
              </p>
            </label>
          ) : null}
        </div>

        <label className="field field--full">
          <span>Tracking info</span>
          <textarea
            rows={5}
            value={draft.notes}
            placeholder="Freeform notes, reminders, account ownership, quirks..."
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, notes: event.target.value }))
            }
          />
        </label>

        <div className="modal__actions">
          {mode === 'edit' && account ? (
            <button className="button button--ghost button--danger" type="button" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <span className="modal__spacer" />
          )}
          <button className="button button--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button" type="submit">
            {mode === 'create' ? 'Add account' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AccountEditor
