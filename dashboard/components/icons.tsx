import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export const Ic = {
  activity: (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 8h2.5l1.5-5 3 10 1.5-5h4.5"/></svg>,
  inbox:    (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M1.5 8.5l1.5-5h10l1.5 5v5h-13v-5z"/><path d="M1.5 8.5h3l1 2h5l1-2h3"/></svg>,
  queue:    (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="2" y="3" width="12" height="2.2" rx="1"/><rect x="2" y="6.9" width="9" height="2.2" rx="1"/><rect x="2" y="10.8" width="6" height="2.2" rx="1"/></svg>,
  diagram:  (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="5.5" y="9.5" width="5" height="5" rx="1"/><path d="M4 6.5v1.5h4v1.5M12 6.5v1.5H8v1.5"/></svg>,
  cog:      (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05L4.5 4.5M11.5 11.5l1.45 1.45M3.05 12.95L4.5 11.5M11.5 4.5l1.45-1.45"/></svg>,
  health:   (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="M1 8h3l1.5-4 3 8 1.5-4H15"/></svg>,
  search:   (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" strokeLinecap="round"/></svg>,
  filter:   (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 3h12l-4.5 6v4l-3-1.5V9z"/></svg>,
  retry:    (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4"/><path d="M12.5 2v2.5h-2.5M3.5 14v-2.5h2.5"/></svg>,
  close:    (p: IconProps) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="M3 3l10 10M13 3L3 13"/></svg>,
  ext:      (p: IconProps) => <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3H3v10h10v-3"/><path d="M9 2h5v5"/><path d="M14 2L8.5 7.5"/></svg>,
  pause:    (p: IconProps) => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" {...p}><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>,
  play:     (p: IconProps) => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" {...p}><path d="M3.5 2v12L13 8z"/></svg>,
  sun:      (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1"/></svg>,
  moon:     (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z"/></svg>,
  kbd:      (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1.5" y="4" width="13" height="9" rx="1.5"/><path d="M4 7h.01M7 7h.01M10 7h.01M13 7h.01M4 10h.01M7 10h.01M10 10h6"/></svg>,
  chevL:    (p: IconProps) => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 3L5 8l5 5"/></svg>,
  chevR:    (p: IconProps) => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3l5 5-5 5"/></svg>,
  check:    (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8.5L6.5 12 13 4.5"/></svg>,
  alert:    (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="M8 1.5L15 13.5H1z"/><path d="M8 6v3.5M8 11v.5"/></svg>,
  dot3:     (p: IconProps) => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" {...p}><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>,
  arrow:    (p: IconProps) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 8h12M9 3l5 5-5 5"/></svg>,
}

export function PlatIcon({ source, size = 'sm' }: { source: string; size?: 'sm' | 'lg' }) {
  const initial = source === 'shopify' ? 'S' : source === 'woocommerce' ? 'W' : 'O'
  const style = size === 'lg' ? { width: 36, height: 36, fontSize: 14, borderRadius: 8 } : undefined
  return <span className={`plat ${source}`} style={style}>{initial}</span>
}

export function HighlightedJSON({ obj }: { obj: unknown }) {
  const txt = JSON.stringify(obj, null, 2)
  const html = txt
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/("(\\.|[^"\\])*")(\s*:)/g, '<span class="k">$1</span>$3')
    .replace(/:\s*("(\\.|[^"\\])*")/g, ': <span class="s">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="n">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="b">$1</span>')
  return <pre className="code" dangerouslySetInnerHTML={{ __html: html }} />
}
