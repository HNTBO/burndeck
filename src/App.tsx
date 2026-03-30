import { useMemo, useState } from 'react'
import AccountEditor from './components/AccountEditor'
import { accounts as seedAccounts } from './data/accounts'
import type { HealthStatus, TrackedAccount } from './types/account'

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

function App() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>(seedAccounts)

  const trackedProviders = useMemo(
    () => new Set(accounts.map((account) => account.provider)).size,
    [accounts],
  )
  const manualAccounts = useMemo(
    () => accounts.filter((account) => account.sourceType === 'manual').length,
    [accounts],
  )
  const accountsWithCap = useMemo(
    () => accounts.filter((account) => account.spendCapUsd != null).length,
    [accounts],
  )

  const handleUpdateAccount = (updatedAccount: TrackedAccount) => {
    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === updatedAccount.id ? updatedAccount : account,
      ),
    )
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private AI quota cockpit</p>
          <h1>BurnDeck</h1>
          <p className="lead">
            A small dashboard for tracking AI subscriptions, OAuth limits, API spend,
            and account-level burn.
          </p>
        </div>
        <div className="hero__stat">
          <span>Tracked accounts</span>
          <strong>{accounts.length}</strong>
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Providers</span>
          <strong>{trackedProviders}</strong>
          <p>Provider is a category. Accounts are the actual tracked objects.</p>
        </article>
        <article className="summary-card">
          <span>Manual sources</span>
          <strong>{manualAccounts}</strong>
          <p>Useful until real API ingestion exists.</p>
        </article>
        <article className="summary-card">
          <span>Accounts with caps</span>
          <strong>{accountsWithCap}</strong>
          <p>Only some accounts expose clean numeric limits.</p>
        </article>
      </section>

      <AccountEditor accounts={accounts} onUpdateAccount={handleUpdateAccount} />

      <section className="section-header">
        <div>
          <p className="eyebrow">Tracked accounts</p>
          <h2>Current monitoring surface</h2>
        </div>
      </section>

      <section className="card-grid">
        {accounts.map((account) => (
          <article className="card" key={account.id}>
            <div className="card__top">
              <div>
                <p className="eyebrow">{providerLabels[account.provider]} · {account.accessKind}</p>
                <h3>{account.label}</h3>
              </div>
              <span className={`badge ${statusToneClass[account.status]}`}>
                {account.status}
              </span>
            </div>
            <dl className="meta">
              <div>
                <dt>Plan</dt>
                <dd>{account.planName ?? '—'}</dd>
              </div>
              <div>
                <dt>Spend</dt>
                <dd>
                  {account.spendUsd != null || account.spendCapUsd != null
                    ? `${formatCurrency(account.spendUsd)} / ${formatCurrency(account.spendCapUsd)}`
                    : 'Manual / not tracked yet'}
                </dd>
              </div>
              <div>
                <dt>Reset</dt>
                <dd>{formatDate(account.resetAt)}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{account.sourceType}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(account.updatedAt)}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{account.notes ?? '—'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
