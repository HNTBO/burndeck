import { useEffect, useMemo, useRef, useState } from 'react'
import AccountEditor, { type AccountDraft } from './components/AccountEditor'
import { accounts as seedAccounts } from './data/accounts'
import {
  cloneAccounts,
  createTransferPayload,
  getDefaultAdapter,
  markAccountSyncing,
  parseAccountsPayload,
  refreshAccount,
  refreshAllAccounts,
} from './lib/accountSync'
import type { HealthStatus, TrackedAccount } from './types/account'

const accountsStorageKey = 'burndeck.accounts.v1'

type TransferNotice = {
  tone: 'neutral' | 'success' | 'error'
  message: string
}

type InitialAccountsState = {
  accounts: TrackedAccount[]
  notice: TransferNotice
}

type EditorState =
  | { mode: 'create' }
  | { accountId: string; mode: 'edit' }
  | null

const providerLabels: Record<TrackedAccount['provider'], string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  other: 'Other',
}

const statusToneClass: Record<HealthStatus, string> = {
  healthy: 'badge--healthy',
  watch: 'badge--watch',
  warning: 'badge--warning',
  exhausted: 'badge--exhausted',
  unknown: 'badge--unknown',
  idle: 'badge--idle',
}

const formatCurrency = (value?: number) => {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const createAccountId = (label: string, accounts: TrackedAccount[]) => {
  const baseId = slugify(label) || 'account'
  let nextId = baseId
  let suffix = 2

  while (accounts.some((account) => account.id === nextId)) {
    nextId = `${baseId}-${suffix}`
    suffix += 1
  }

  return nextId
}

const createNewAccount = (draft: AccountDraft, accounts: TrackedAccount[]): TrackedAccount => {
  const fallbackLabel = `New account ${accounts.length + 1}`
  const label = draft.label.trim() || fallbackLabel
  const notes = draft.notes.trim()
  const planName = draft.planName.trim()
  const openAIProjectId = draft.openAIProjectId.trim()
  const spendCapUsd =
    draft.spendCapUsd.trim() === '' ? undefined : Number(draft.spendCapUsd.trim())

  return {
    id: createAccountId(label, accounts),
    provider: draft.provider,
    label,
    accessKind: draft.accessKind,
    sourceType: draft.sourceType,
    openAIProjectId:
      draft.provider === 'openai' && draft.accessKind === 'api' ? openAIProjectId || undefined : undefined,
    status: draft.status,
    syncState: 'idle',
    adapter: getDefaultAdapter({
      accessKind: draft.accessKind,
      provider: draft.provider,
      sourceType: draft.sourceType,
      openAIProjectId:
        draft.provider === 'openai' && draft.accessKind === 'api' ? openAIProjectId || undefined : undefined,
    }),
    planName: planName || undefined,
    notes: notes || undefined,
    spendCapUsd: Number.isFinite(spendCapUsd) ? spendCapUsd : undefined,
    updatedAt: new Date().toISOString(),
  }
}

const getTrackingInfo = (account: TrackedAccount) => {
  if (account.notes?.trim()) {
    return account.notes.trim()
  }

  const fallback = [`${account.sourceType} tracking`, account.accessKind]

  if (account.provider === 'openai' && account.accessKind === 'api') {
    fallback.push(account.openAIProjectId ? `project ${account.openAIProjectId}` : 'org scope')
  }

  if (account.planName?.trim()) {
    fallback.push(account.planName.trim())
  }

  if (account.spendUsd != null || account.spendCapUsd != null) {
    fallback.push(`${formatCurrency(account.spendUsd)} / ${formatCurrency(account.spendCapUsd)}`)
  }

  if (account.resetAt) {
    fallback.push(`reset ${formatDate(account.resetAt)}`)
  }

  return fallback.join(' · ')
}

const getSyncSummary = (account: TrackedAccount) => {
  if (account.syncState === 'syncing') {
    return 'Syncing now…'
  }

  if (account.syncState === 'synced') {
    return `${account.adapter.label} · Synced ${formatDate(account.lastSyncedAt)}`
  }

  if (account.syncState === 'unsupported') {
    return `${account.adapter.label} · ${account.syncError ?? 'Refresh unsupported'}`
  }

  if (account.syncState === 'error') {
    return `Sync failed · ${account.syncError ?? 'Unknown error'}`
  }

  return `${account.adapter.label} · Not synced yet`
}

const loadInitialAccounts = (): InitialAccountsState => {
  if (typeof window === 'undefined') {
    return {
      accounts: cloneAccounts(seedAccounts),
      notice: {
        tone: 'neutral',
        message: 'Using bundled seed data.',
      },
    }
  }

  const raw = window.localStorage.getItem(accountsStorageKey)

  if (!raw) {
    return {
      accounts: cloneAccounts(seedAccounts),
      notice: {
        tone: 'neutral',
        message: 'Using bundled seed data. Changes will persist in this browser.',
      },
    }
  }

  try {
    const parsed = parseAccountsPayload(raw)

    return {
      accounts: cloneAccounts(parsed.accounts),
      notice: {
        tone: 'neutral',
        message: `Loaded ${parsed.accounts.length} account${parsed.accounts.length === 1 ? '' : 's'} from local storage.`,
      },
    }
  } catch {
    window.localStorage.removeItem(accountsStorageKey)

    return {
      accounts: cloneAccounts(seedAccounts),
      notice: {
        tone: 'error',
        message: 'Saved local data was invalid and has been replaced with seed data.',
      },
    }
  }
}

function App() {
  const [initialState] = useState(loadInitialAccounts)
  const [accounts, setAccounts] = useState<TrackedAccount[]>(initialState.accounts)
  const [transferNotice, setTransferNotice] = useState<TransferNotice>(initialState.notice)
  const [editorState, setEditorState] = useState<EditorState>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingAccountIds, setRefreshingAccountIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const payload = createTransferPayload(accounts)

    window.localStorage.setItem(accountsStorageKey, JSON.stringify(payload, null, 2))
  }, [accounts])

  const handleUpdateAccount = (updatedAccount: TrackedAccount) => {
    const nextAccount = {
      ...updatedAccount,
      adapter: getDefaultAdapter(updatedAccount),
    }

    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === nextAccount.id ? nextAccount : account,
      ),
    )
  }

  const handleCreateAccount = (draft: AccountDraft) => {
    const newAccount = createNewAccount(draft, accounts)

    setAccounts((currentAccounts) => [...currentAccounts, newAccount])
    setTransferNotice({
      tone: 'success',
      message: `Created ${newAccount.label}.`,
    })
  }

  const handleDeleteAccount = (accountId: string) => {
    const accountToDelete = accounts.find((account) => account.id === accountId)
    if (!accountToDelete) return

    setAccounts((currentAccounts) =>
      currentAccounts.filter((account) => account.id !== accountId),
    )
    setTransferNotice({
      tone: 'success',
      message: `Deleted ${accountToDelete.label}.`,
    })
  }

  const handleExportAccounts = () => {
    const payload = createTransferPayload(accounts)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `burndeck-accounts-${payload.exportedAt?.slice(0, 10) ?? 'snapshot'}.json`
    link.click()
    window.URL.revokeObjectURL(url)

    setTransferNotice({
      tone: 'success',
      message: `Exported ${accounts.length} account${accounts.length === 1 ? '' : 's'} to JSON.`,
    })
  }

  const handleImportAccounts = async (file: File) => {
    try {
      const text = await file.text()
      const payload = parseAccountsPayload(text)

      setAccounts(cloneAccounts(payload.accounts))
      setTransferNotice({
        tone: 'success',
        message: `Imported ${payload.accounts.length} account${payload.accounts.length === 1 ? '' : 's'} from ${file.name}.`,
      })
    } catch (error) {
      setTransferNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? `Import failed: ${error.message}`
            : 'Import failed: the selected file could not be parsed.',
      })
    }
  }

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await handleImportAccounts(file)
    } finally {
      event.target.value = ''
    }
  }

  const handleResetAccounts = () => {
    setAccounts(cloneAccounts(seedAccounts))
    setTransferNotice({
      tone: 'success',
      message: 'Reset dashboard data back to the bundled seed snapshot.',
    })
  }

  const handleRefreshAll = async () => {
    if (isRefreshing) return

    const pendingAccounts = accounts.map((account) => markAccountSyncing(account))

    setIsRefreshing(true)
    setRefreshingAccountIds([])
    setAccounts(pendingAccounts)
    setTransferNotice({
      tone: 'neutral',
      message: 'Refreshing accounts…',
    })

    try {
      const result = await refreshAllAccounts(pendingAccounts)

      setAccounts(result.accounts)
      setTransferNotice({
        tone: result.summary.errorCount > 0 ? 'error' : 'success',
        message: `Refresh finished: ${result.summary.syncedCount} synced, ${result.summary.unsupportedCount} unsupported, ${result.summary.errorCount} failed.`,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRefreshAccount = async (accountId: string) => {
    if (isRefreshing || refreshingAccountIds.includes(accountId)) {
      return
    }

    const currentAccount = accounts.find((account) => account.id === accountId)
    if (!currentAccount) return

    setRefreshingAccountIds((currentIds) => [...currentIds, accountId])
    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === accountId ? markAccountSyncing(account) : account,
      ),
    )
    setTransferNotice({
      tone: 'neutral',
      message: `Refreshing ${currentAccount.label}…`,
    })

    try {
      const result = await refreshAccount(markAccountSyncing(currentAccount))

      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === accountId ? result.account : account,
        ),
      )
      setTransferNotice({
        tone: result.account.syncState === 'error' ? 'error' : 'success',
        message:
          result.account.syncState === 'error'
            ? `Refresh failed for ${result.account.label}: ${result.account.syncError ?? 'Unknown error.'}`
            : `Refreshed ${result.account.label} via ${result.account.adapter.label}.`,
      })
    } finally {
      setRefreshingAccountIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== accountId),
      )
    }
  }

  const editingAccount = useMemo(() => {
    if (!editorState || editorState.mode !== 'edit') {
      return undefined
    }

    return accounts.find((account) => account.id === editorState.accountId)
  }, [accounts, editorState])

  const editorCreateLabel = `New account ${accounts.length + 1}`

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private AI quota cockpit</p>
          <h1>BurnDeck</h1>
          <p className="lead">
            A small dashboard for tracking AI subscriptions, OAuth limits, API spend,
            and account-level burn, with local persistence and portable JSON snapshots.
          </p>
        </div>
        <div className="hero__stat">
          <span>Tracked accounts</span>
          <strong>{accounts.length}</strong>
          <button className="button hero__refresh" type="button" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh all'}
          </button>
          <div className="hero__stat-actions">
            <button className="button button--ghost" type="button" onClick={handleExportAccounts} disabled={isRefreshing}>
              Export
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRefreshing}
            >
              Import
            </button>
            <button className="button button--ghost" type="button" onClick={handleResetAccounts} disabled={isRefreshing}>
              Reset
            </button>
          </div>
          {transferNotice.message && (
            <p className={`hero__stat-note hero__stat-note--${transferNotice.tone}`}>{transferNotice.message}</p>
          )}
        </div>
      </section>

      <input
        ref={fileInputRef}
        className="transfer__input"
        type="file"
        accept=".json,application/json"
        onChange={handleImportChange}
      />

      <h2 className="section-title">Accounts</h2>

      <section className="card-grid">
        {accounts.map((account) => {
          const isAccountRefreshing = refreshingAccountIds.includes(account.id)

          return (
            <article className="card account-card" key={account.id}>
              <div className="card__top">
                <div className="account-card__identity">
                  <h3>{account.label}</h3>
                  <p className="account-card__provider">{providerLabels[account.provider]}</p>
                </div>
                <div className="card__controls">
                  <span className={`badge ${statusToneClass[account.status]}`}>
                    {account.status}
                  </span>
                  <button
                    className="button button--ghost button--icon"
                    type="button"
                    aria-label={`Edit ${account.label}`}
                    onClick={() => setEditorState({ accountId: account.id, mode: 'edit' })}
                  >
                    <svg
                      aria-hidden="true"
                      className="button__icon"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.792 2.146a1.5 1.5 0 0 1 2.122 0l.94.94a1.5 1.5 0 0 1 0 2.121l-7.5 7.5L3 13l.293-3.354 7.5-7.5Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.5 3.438 12.563 6.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="account-card__tracking">
                <p className="account-card__label">Tracking info</p>
                <p>{getTrackingInfo(account)}</p>
                <div className="account-card__sync-row">
                  <p className="account-card__sync">{getSyncSummary(account)}</p>
                  <button
                    className="button button--ghost account-card__refresh"
                    type="button"
                    aria-label={
                      isAccountRefreshing
                        ? `Refreshing ${account.label}`
                        : `Refresh ${account.label}`
                    }
                    onClick={() => void handleRefreshAccount(account.id)}
                    disabled={isRefreshing || isAccountRefreshing}
                  >
                    <svg
                      aria-hidden="true"
                      className={`button__icon ${isAccountRefreshing ? 'button__icon--spin' : ''}`}
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.6 8.2A6.6 6.6 0 0 0 5.5 4.8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16.1 3.4v4h-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3.4 11.8A6.6 6.6 0 0 0 14.5 15.2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3.9 16.6v-4h4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        <button
          className="card card--add"
          type="button"
          onClick={() => setEditorState({ mode: 'create' })}
        >
          <span className="card--add__plus">+</span>
          <span className="card--add__title">Add account</span>
          <span className="card--add__copy">Open a focused form only when you need it.</span>
        </button>
      </section>

      <AccountEditor
        account={editingAccount}
        createLabel={editorCreateLabel}
        isOpen={editorState !== null}
        mode={editorState?.mode ?? 'create'}
        onClose={() => setEditorState(null)}
        onCreateAccount={handleCreateAccount}
        onDeleteAccount={handleDeleteAccount}
        onUpdateAccount={handleUpdateAccount}
      />
    </main>
  )
}

export default App
