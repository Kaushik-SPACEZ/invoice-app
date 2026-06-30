import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesApi } from '../api/invoices'
import type { InvoiceProcessingStatus } from '../types'

export const useInvoiceStatus = (invoiceId: number | null) => {
  const [status, setStatus] = useState<InvoiceProcessingStatus | null>(null)
  const navigate = useNavigate()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!invoiceId || stoppedRef.current) return

    const poll = async () => {
      try {
        const { data } = await invoicesApi.getStatus(invoiceId)
        const s = data.data
        setStatus(s)

        if (s.status === 'review') {
          stoppedRef.current = true
          clearInterval(intervalRef.current!)
          // Small delay so user sees 100% before redirect
          setTimeout(() => navigate(`/invoices/${invoiceId}/review`), 1000)
        } else if (s.status === 'error') {
          stoppedRef.current = true
          clearInterval(intervalRef.current!)
        }
      } catch {
        clearInterval(intervalRef.current!)
      }
    }

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, 2000)
    return () => clearInterval(intervalRef.current!)
  }, [invoiceId, navigate])

  return status
}
