import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

export const formatDate = (dateStr: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))

export const formatDateTime = (dateStr: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))

export const getConfidenceColor = (score: number | string | null | undefined) => {
  const n = Number(score) || 0
  if (n >= 95) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }
  if (n >= 80) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' }
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' }
}

export const MARKETPLACE_COLORS: Record<string, string> = {
  amazon: '#FF9900',
  flipkart: '#2874F0',
  meesho: '#F43397',
  other: '#6B7280',
}

export const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  meesho: 'Meesho',
  other: 'Other',
}

export const formatPercent = (value: number, decimals = 1) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
