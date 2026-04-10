import type {
  AccessKind,
  AccountAdapterMetadata,
  AdapterId,
  AdapterMode,
  HealthStatus,
  ProviderId,
  SourceType,
  SyncState,
  TrackedAccount,
} from '../types/account'

type StoredAccountAdapterMetadata = Partial<AccountAdapterMetadata>

type StoredTrackedAccount = Omit<TrackedAccount, 'adapter' | 'syncState'> & {
  adapter?: StoredAccountAdapterMetadata
  syncState?: SyncState
}

type StoredAccountsPayload = {
  version?: number
  exportedAt?: string
  accounts: StoredTrackedAccount[]
}

type RefreshSummary = {
  errorCount: number
  syncedCount: number
  unsupportedCount: number
}

type RefreshAllResult = {
  accounts: TrackedAccount[]
  summary: RefreshSummary
}

export type RefreshAccountResult = {
  account: TrackedAccount
}

type RefreshContext = {
  now: string
}

type RefreshSuccess = {
  changes?: Partial<TrackedAccount>
  status: 'synced'
}

type RefreshFailure = {
  error: string
  status: 'error' | 'unsupported'
}

type RefreshResult = RefreshFailure | RefreshSuccess

type AccountRefreshAdapter = {
  id: AdapterId
  label: string
  mode: AdapterMode
  refresh: (account: TrackedAccount, context: RefreshContext) => Promise<RefreshResult>
  supports: (account: TrackedAccount) => boolean
}

type OpenAIRefreshPayload = {
  account: TrackedAccount
}

type OpenAIRefreshResponse = {
  accountPatch: Partial<TrackedAccount>
  summary: {
    costRangeDays: number
    requests?: number
    spendUsd?: number
    windowEnd: string
    windowStart: string
  }
}

const providerIds = new Set<ProviderId>(['openai', 'anthropic', 'google', 'other'])
const accessKinds = new Set<AccessKind>(['api', 'oauth', 'subscription'])
const sourceTypes = new Set<SourceType>(['manual', 'api', 'derived'])
const healthStatuses = new Set<HealthStatus>([
  'healthy',
  'watch',
  'warning',
  'exhausted',
  'unknown',
  'idle',
])
const syncStates = new Set<SyncState>(['idle', 'syncing', 'synced', 'error', 'unsupported'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const buildApiUrl = (path: string) => {
  const baseUrl = (import.meta.env.VITE_BURNDECK_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  return `${baseUrl ?? ''}${path}`
}

const deriveOpenAIHealth = (
  spendUsd: number | undefined,
  spendCapUsd: number | undefined,
  fallback: HealthStatus,
) => {
  if (spendUsd == null || spendCapUsd == null || spendCapUsd <= 0) {
    return fallback
  }

  const usageRatio = spendUsd / spendCapUsd

  if (usageRatio >= 1) return 'exhausted'
  if (usageRatio >= 0.8) return 'warning'
  if (usageRatio >= 0.5) return 'watch'
  return 'healthy'
}

export const getDefaultAdapter = (
  account: Pick<TrackedAccount, 'accessKind' | 'provider' | 'sourceType' | 'openAIProjectId'>,
): AccountAdapterMetadata => {
  if (
    account.provider === 'openai' &&
    account.accessKind === 'api' &&
    account.sourceType === 'api'
  ) {
    return {
      id: 'openai-org-api',
      label: account.openAIProjectId ? 'OpenAI project API' : 'OpenAI org API',
      mode: 'live',
    }
  }

  return {
    id: 'manual',
    label: 'Manual check-in',
    mode: 'manual',
  }
}

const normalizeAdapter = (account: StoredTrackedAccount): AccountAdapterMetadata => {
  const fallback = getDefaultAdapter(account)

  if (!account.adapter || !isRecord(account.adapter)) {
    return fallback
  }

  return {
    id:
      account.adapter.id === 'manual' || account.adapter.id === 'openai-org-api'
        ? account.adapter.id
        : fallback.id,
    label:
      typeof account.adapter.label === 'string' && account.adapter.label.trim()
        ? account.adapter.label
        : fallback.label,
    mode:
      account.adapter.mode === 'manual' || account.adapter.mode === 'live'
        ? account.adapter.mode
        : fallback.mode,
  }
}

export const normalizeTrackedAccount = (account: StoredTrackedAccount): TrackedAccount => ({
  ...account,
  lastSyncedAt: typeof account.lastSyncedAt === 'string' ? account.lastSyncedAt : undefined,
  notes: typeof account.notes === 'string' && account.notes.trim() ? account.notes : undefined,
  openAIProjectId:
    typeof account.openAIProjectId === 'string' && account.openAIProjectId.trim()
      ? account.openAIProjectId.trim()
      : undefined,
  planName:
    typeof account.planName === 'string' && account.planName.trim()
      ? account.planName
      : undefined,
  resetAt: typeof account.resetAt === 'string' ? account.resetAt : undefined,
  syncError:
    typeof account.syncError === 'string' && account.syncError.trim()
      ? account.syncError
      : undefined,
  syncState: syncStates.has(account.syncState as SyncState) ? (account.syncState as SyncState) : 'idle',
  updatedAt: typeof account.updatedAt === 'string' ? account.updatedAt : undefined,
  adapter: normalizeAdapter(account),
})

export const cloneAccounts = (accounts: StoredTrackedAccount[]) =>
  accounts.map((account) => normalizeTrackedAccount(account))

export const isStoredTrackedAccount = (value: unknown): value is StoredTrackedAccount => {
  if (!isRecord(value)) return false

  const adapter = value.adapter
  const isValidAdapter =
    adapter == null ||
    (isRecord(adapter) &&
      (adapter.id == null || adapter.id === 'manual' || adapter.id === 'openai-org-api') &&
      (adapter.label == null || typeof adapter.label === 'string') &&
      (adapter.mode == null || adapter.mode === 'manual' || adapter.mode === 'live'))

  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    providerIds.has(value.provider as ProviderId) &&
    accessKinds.has(value.accessKind as AccessKind) &&
    sourceTypes.has(value.sourceType as SourceType) &&
    (value.openAIProjectId == null || typeof value.openAIProjectId === 'string') &&
    healthStatuses.has(value.status as HealthStatus) &&
    (value.planName == null || typeof value.planName === 'string') &&
    (value.notes == null || typeof value.notes === 'string') &&
    (value.spendUsd == null || typeof value.spendUsd === 'number') &&
    (value.spendCapUsd == null || typeof value.spendCapUsd === 'number') &&
    (value.resetAt == null || typeof value.resetAt === 'string') &&
    (value.updatedAt == null || typeof value.updatedAt === 'string') &&
    (value.lastSyncedAt == null || typeof value.lastSyncedAt === 'string') &&
    (value.syncError == null || typeof value.syncError === 'string') &&
    (value.syncState == null || syncStates.has(value.syncState as SyncState)) &&
    isValidAdapter
  )
}

export const parseAccountsPayload = (raw: string): StoredAccountsPayload => {
  const parsed = JSON.parse(raw) as unknown

  if (Array.isArray(parsed) && parsed.every(isStoredTrackedAccount)) {
    return { accounts: parsed }
  }

  if (
    isRecord(parsed) &&
    Array.isArray(parsed.accounts) &&
    parsed.accounts.every(isStoredTrackedAccount)
  ) {
    return {
      version: typeof parsed.version === 'number' ? parsed.version : undefined,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
      accounts: parsed.accounts,
    }
  }

  throw new Error('Expected a JSON array of tracked accounts or an { accounts: [...] } payload.')
}

export const createTransferPayload = (accounts: TrackedAccount[]) => ({
  version: 2,
  exportedAt: new Date().toISOString(),
  accounts,
})

export const markAccountSyncing = (account: TrackedAccount): TrackedAccount => ({
  ...account,
  syncError: undefined,
  syncState: 'syncing',
})

const openAIOrgApiAdapter: AccountRefreshAdapter = {
  id: 'openai-org-api',
  label: 'OpenAI org API',
  mode: 'live',
  supports: (account) =>
    account.provider === 'openai' &&
    account.accessKind === 'api' &&
    account.sourceType === 'api',
  refresh: async (account) => {
    try {
      const response = await fetch(buildApiUrl('/api/refresh/openai'), {
        body: JSON.stringify({ account } satisfies OpenAIRefreshPayload),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null

        return {
          error: payload?.error ?? 'OpenAI refresh failed on the server.',
          status: 'error',
        }
      }

      const payload = (await response.json()) as OpenAIRefreshResponse

      return {
        changes: payload.accountPatch,
        status: 'synced',
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? `${error.message}. Check that the BurnDeck backend is running and reachable.`
            : 'OpenAI refresh failed. Check that the BurnDeck backend is running and reachable.',
        status: 'error',
      }
    }
  },
}

const manualCheckInAdapter: AccountRefreshAdapter = {
  id: 'manual',
  label: 'Manual check-in',
  mode: 'manual',
  supports: (account) => account.sourceType === 'manual',
  refresh: async (_account, context) => ({
    changes: {
      updatedAt: context.now,
    },
    status: 'synced',
  }),
}

const adapters: AccountRefreshAdapter[] = [openAIOrgApiAdapter, manualCheckInAdapter]

const refreshSingleAccount = async (
  account: TrackedAccount,
  context: RefreshContext,
): Promise<TrackedAccount> => {
  const adapter = adapters.find((candidate) => candidate.supports(account))
  const adapterMetadata = getDefaultAdapter(account)

  if (!adapter) {
    return {
      ...account,
      adapter: adapterMetadata,
      syncError: 'No refresh adapter is available for this account yet.',
      syncState: 'unsupported',
    }
  }

  const result = await adapter.refresh(account, context)

  if (result.status !== 'synced') {
    return {
      ...account,
      adapter: adapterMetadata,
      syncError: result.error,
      syncState: result.status,
    }
  }

  const nextSpendUsd =
    result.changes?.spendUsd != null ? result.changes.spendUsd : account.spendUsd

  const nextStatus =
    account.provider === 'openai' && account.accessKind === 'api'
      ? deriveOpenAIHealth(nextSpendUsd, account.spendCapUsd, result.changes?.status ?? account.status)
      : (result.changes?.status ?? account.status)

  return {
    ...account,
    ...result.changes,
    adapter: getDefaultAdapter({
      ...account,
      ...result.changes,
    }),
    lastSyncedAt: context.now,
    status: nextStatus,
    syncError: undefined,
    syncState: 'synced',
  }
}

export const refreshAllAccounts = async (accounts: TrackedAccount[]): Promise<RefreshAllResult> => {
  const context = { now: new Date().toISOString() }
  const refreshedAccounts = await Promise.all(
    accounts.map((account) => refreshSingleAccount(account, context)),
  )

  return {
    accounts: refreshedAccounts,
    summary: refreshedAccounts.reduce<RefreshSummary>(
      (summary, account) => {
        if (account.syncState === 'synced') summary.syncedCount += 1
        if (account.syncState === 'unsupported') summary.unsupportedCount += 1
        if (account.syncState === 'error') summary.errorCount += 1
        return summary
      },
      {
        errorCount: 0,
        syncedCount: 0,
        unsupportedCount: 0,
      },
    ),
  }
}

export const refreshAccount = async (account: TrackedAccount): Promise<RefreshAccountResult> => {
  const context = { now: new Date().toISOString() }

  return {
    account: await refreshSingleAccount(account, context),
  }
}
