export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SYNCED:     { cls: 'ok',   label: 'synced' },
    PROCESSING: { cls: 'proc', label: 'processing' },
    FAILED:     { cls: 'err',  label: 'failed' },
    RECEIVED:   { cls: 'neu',  label: 'received' },
    RETRYING:   { cls: 'warn', label: 'retrying' },
  }
  const m = map[status] ?? map.RECEIVED
  return (
    <span className={`chip ${m.cls}`}>
      <span className="d" />{m.label}
    </span>
  )
}
