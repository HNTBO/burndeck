import type { IncomingMessage } from 'node:http'
import type { HealthStatus, TrackedAccount } from '../src/types/account.js'

type OpenAICostBucket = {
  result?: Array<{
    amount?: {
      value?: number
    }
  }>
}

type OpenAIUsageBucket = {
  result?: Array<{
    input_tokens?: number
    num_model_requests?: number
    output_tokens?: number
  }>
}

type OpenAICostsResponse = {
  data?: OpenAICostBucket[]
}

type OpenAIUsageResponse = {
  data?: OpenAIUsageBucket[]
}

type OpenAIRefreshRequestBody = {
  account: TrackedAccount
}

type OpenAIRefreshResponse = {
  accountPatch: Partial<TrackedAccount>
  summary: {
    costRangeDays: number
    requests: number
    spendUsd: number
    tokens: number
    windowEnd: string
    windowStart: string
  }
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const COST_RANGE_DAYS = 30

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(raw) as T
}

const parseOpenAIRefreshRequest = (value: unknown): OpenAIRefreshRequestBody => {
  if (!isRecord(value) || !isRecord(value.account)) {
    throw new Error('Expected a JSON body with an account payload.')
  }

  const account = value.account

  if (
    typeof account.id !== 'string' ||
    typeof account.label !== 'string' ||
    typeof account.provider !== 'string' ||
    account.provider !== 'openai'
  ) {
    throw new Error('Expected a valid OpenAI account payload.')
  }

  return value as OpenAIRefreshRequestBody
}

const createStatusFromSpend = (
  spendUsd: number,
  spendCapUsd: number | undefined,
  fallback: HealthStatus,
): HealthStatus => {
  if (spendCapUsd == null || spendCapUsd <= 0) {
    return fallback
  }

  const usageRatio = spendUsd / spendCapUsd

  if (usageRatio >= 1) return 'exhausted'
  if (usageRatio >= 0.8) return 'warning'
  if (usageRatio >= 0.5) return 'watch'
  return 'healthy'
}

const getOpenAIHeaders = () => {
  const adminKey = process.env.OPENAI_ADMIN_KEY

  if (!adminKey) {
    throw new Error('Missing OPENAI_ADMIN_KEY on the server.')
  }

  return {
    Authorization: `Bearer ${adminKey}`,
    'Content-Type': 'application/json',
    ...(process.env.OPENAI_ORGANIZATION_ID
      ? { 'OpenAI-Organization': process.env.OPENAI_ORGANIZATION_ID }
      : {}),
  }
}

const resolveProjectId = (account: TrackedAccount) =>
  typeof account.openAIProjectId === 'string' && account.openAIProjectId.trim()
    ? account.openAIProjectId.trim()
    : process.env.OPENAI_PROJECT_ID?.trim() || undefined

const buildQuery = (path: string, startTime: number, account: TrackedAccount) => {
  const url = new URL(`${OPENAI_BASE_URL}${path}`)

  url.searchParams.set('start_time', String(startTime))
  url.searchParams.set('bucket_width', '1d')
  url.searchParams.set('limit', String(COST_RANGE_DAYS))

  const projectId = resolveProjectId(account)

  if (projectId) {
    url.searchParams.append('project_ids', projectId)
  }

  return url
}

const fetchOpenAIJson = async <T>(url: URL) => {
  const response = await fetch(url, {
    headers: getOpenAIHeaders(),
    method: 'GET',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI request failed (${response.status}): ${text || response.statusText}`)
  }

  return (await response.json()) as T
}

const sumCosts = (payload: OpenAICostsResponse) =>
  (payload.data ?? []).reduce((total, bucket) => {
    const bucketTotal = (bucket.result ?? []).reduce((bucketSum, result) => {
      return bucketSum + (result.amount?.value ?? 0)
    }, 0)

    return total + bucketTotal
  }, 0)

const sumUsage = (payload: OpenAIUsageResponse) =>
  (payload.data ?? []).reduce(
    (totals, bucket) => {
      for (const result of bucket.result ?? []) {
        totals.requests += result.num_model_requests ?? 0
        totals.tokens += (result.input_tokens ?? 0) + (result.output_tokens ?? 0)
      }

      return totals
    },
    {
      requests: 0,
      tokens: 0,
    },
  )

export const handleOpenAIRefresh = async (
  request: IncomingMessage,
): Promise<OpenAIRefreshResponse> => {
  const body = parseOpenAIRefreshRequest(await readJsonBody<unknown>(request))

  const account = body.account
  const now = new Date()
  const startTime = Math.floor((now.getTime() - COST_RANGE_DAYS * 24 * 60 * 60 * 1000) / 1000)
  const [costs, usage] = await Promise.all([
    fetchOpenAIJson<OpenAICostsResponse>(buildQuery('/organization/costs', startTime, account)),
    fetchOpenAIJson<OpenAIUsageResponse>(
      buildQuery('/organization/usage/completions', startTime, account),
    ),
  ])

  const spendUsd = Number(sumCosts(costs).toFixed(2))
  const usageSummary = sumUsage(usage)
  const windowEnd = now.toISOString()
  const windowStart = new Date(startTime * 1000).toISOString()

  return {
    accountPatch: {
      spendUsd,
      status: createStatusFromSpend(spendUsd, account.spendCapUsd, account.status),
      updatedAt: windowEnd,
    },
    summary: {
      costRangeDays: COST_RANGE_DAYS,
      requests: usageSummary.requests,
      spendUsd,
      tokens: usageSummary.tokens,
      windowEnd,
      windowStart,
    },
  }
}
