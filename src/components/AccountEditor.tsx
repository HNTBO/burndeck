import { useEffect, useRef, useState } from 'react'
import type { HealthStatus, ProviderId, TrackedAccount } from '../types/account'

export type AccountDraft = {
  label: string
  provider: ProviderId
  notes: string
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

const statusOptions: HealthStatus[] = ['healthy', 'watch', 'warning', 'exhausted', 'unknown', 'idle']
const providerOptions: ProviderId[] = ['openai', 'anthropic', 'google', 'other']

const buildDraft = (account: TrackedAccount | undefined, createLabel: string): AccountDraft => ({
  label: account?.label ?? createLabel,
  provider: account?.provider ?? 'openai',
  notes: account?.notes ?? '',
  status: account?.status ?? 'unknown',
})

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

  useEffect(() => {
    if (!isOpen) return
    setDraft(buildDraft(account, createLabel))
  }, [account, createLabel, isOpen, mode])

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

    if (mode === 'edit' && account) {
      onUpdateAccount({
        ...account,
        label,
        provider: draft.provider,
        notes: notes || undefined,
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
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
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
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field field--full">
          <span>Tracking info</span>
          <textarea
            rows={5}
            value={draft.notes}
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
