export function EmptyNotice({ children }: { children: string }) {
  return (
    <div className="panel">
      <p className="empty-notice">{children}</p>
    </div>
  )
}
