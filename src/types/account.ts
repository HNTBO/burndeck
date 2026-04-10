export type ProviderId = 'openai' | 'anthropic' | 'google' | 'other'
export type AccessKind = 'api' | 'oauth' | 'subscription'
export type SourceType = 'manual' | 'api' | 'derived'
export type HealthStatus = 'healthy' | 'watch' | 'warning' | 'exhausted' | 'unknown' | 'idle'
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'unsupported'
export type AdapterId = 'manual' | 'openai-org-api'
export type AdapterMode = 'manual' | 'live'

export type AccountAdapterMetadata = {
  id: AdapterId
  label: string
  mode: AdapterMode
}

export type TrackedAccount = {
  id: string
  provider: ProviderId
  label: string
  accessKind: AccessKind
  sourceType: SourceType
  openAIProjectId?: string
  status: HealthStatus
  planName?: string
  notes?: string
  spendUsd?: number
  spendCapUsd?: number
  resetAt?: string
  lastSyncedAt?: string
  syncState: SyncState
  syncError?: string
  adapter: AccountAdapterMetadata
  updatedAt?: string
}
