import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { NotificationIcon } from '../components/ui/Badge'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatDateTime } from '../lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { cn } from '../lib/utils'
import type { Notification } from '../types'

const groupNotifications = (notifications: Notification[]) => {
  const today: Notification[] = []
  const yesterday: Notification[] = []
  const older: Notification[] = []
  notifications.forEach((n) => {
    const d = new Date(n.created_at)
    if (isToday(d)) today.push(n)
    else if (isYesterday(d)) yesterday.push(n)
    else older.push(n)
  })
  return { today, yesterday, older }
}

export default function Notifications() {
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications: Notification[] = data?.data ?? []
  const groups = groupNotifications(notifications)
  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Notifications</h1>
          {unread > 0 && <p className="text-sm text-gray-400 mt-0.5">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="p-6"><TableSkeleton rows={5} cols={1} /></Card>
      ) : notifications.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-6">
          {[['Today', groups.today], ['Yesterday', groups.yesterday], ['Earlier', groups.older]].map(([label, items]) => {
            if (!(items as Notification[]).length) return null
            return (
              <div key={label as string}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label as string}</h3>
                <Card>
                  {(items as Notification[]).map((n, i) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markRead.mutate(n.id)}
                      className={cn(
                        'flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors',
                        i > 0 && 'border-t border-border-default/30',
                        !n.is_read ? 'hover:bg-primary/5' : 'opacity-60 hover:opacity-80'
                      )}
                    >
                      <NotificationIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-200">{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDateTime(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}
