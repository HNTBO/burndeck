import { useMemo, useState } from 'react'
import type { HealthStatus, TrackedAccount } from '../types/account'

type AccountEditorProps = {
  accounts: TrackedAccount[]
  onUpdateAccount: (account: TrackedAccount) => void
}

const statusOptions: HealthStatus[] = ['healthy', 'watch', 'warning', 'exhausted', 'unknown', 'idle']

function AccountEditor({ accounts, onUpdateAccount }: AccountEditorProps) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? '')

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? accounts[0],
    [accounts, selectedId],
  )

  if (!selectedAccount) {
    return null
  }

  const updateField = <K extends keyof TrackedAccount>(field: K, value: TrackedAccount[K]) => {
    onUpdateAccount({
      ...selectedAccount,
      [field]: value,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <section className="editor">
      <div className="section-header section-header--editor">
        <div>
          <p className="eyebrow">Manual editor</p>
          <h2>Update one tracked account</h2>
        </div>
      </div>

      <div className="editor__panel">
        <label className="field">
          <span>Account</span>
          <select value={selectedAccount.id} onChange={(event) => setSelectedId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>

        <div className="editor__grid">
          <label className="field">
            <span>Label</span>
            <input
              value={selectedAccount.label}
              onChange={(event) => updateField('label', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Plan</span>
            <input
              value={selectedAccount.planName ?? ''}
              onChange={(event) => updateField('planName', event.target.value || undefined)}
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={selectedAccount.status}
              onChange={(event) => updateField('status', event.target.value as HealthStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Spend USD</span>
            <input
              type="number"
              step="0.01"
              value={selectedAccount.spendUsd ?? ''}
              onChange={(event) =>
                updateField(
                  'spendUsd',
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
            />
          </label>

          <label className="field">
            <span>Spend cap USD</span>
            <input
              type="number"
              step="0.01"
              value={selectedAccount.spendCapUsd ?? ''}
              onChange={(event) =>
                updateField(
                  'spendCapUsd',
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
            />
          </label>

          <label className="field">
            <span>Reset date</span>
            <input
              type="date"
              value={selectedAccount.resetAt?.slice(0, 10) ?? ''}
              onChange={(event) =>
                updateField(
                  'resetAt',
                  event.target.value ? `${event.target.value}T00:00:00Z` : undefined,
                )
              }
            />
          </label>
        </div>

        <label className="field field--full">
          <span>Notes</span>
          <textarea
            rows={4}
            value={selectedAccount.notes ?? ''}
            onChange={(event) => updateField('notes', event.target.value || undefined)}
          />
        </label>
      </div>
    </section>
  )
}

export default AccountEditor
