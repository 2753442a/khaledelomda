import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react'

type ToastMessage = { id: number; title: string; tone: 'success' | 'error' | 'info' }
let toastId = 0

export function toast(title: string, tone: ToastMessage['tone'] = 'info') {
  window.dispatchEvent(new CustomEvent('resort-toast', { detail: { id: ++toastId, title, tone } }))
}

export function ToastHost() {
  const [items, setItems] = useState<ToastMessage[]>([])
  useEffect(() => {
    const handler = (event: Event) => {
      const item = (event as CustomEvent<ToastMessage>).detail
      setItems((current) => [...current, item])
      window.setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), 4200)
    }
    window.addEventListener('resort-toast', handler)
    return () => window.removeEventListener('resort-toast', handler)
  }, [])
  return <div className="toast-stack" aria-live="polite">{items.map((item) => <div className={`toast toast-${item.tone}`} key={item.id} role="status">
    {item.tone === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}<span>{item.title}</span>
    <button aria-label="إغلاق" onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15} /></button>
  </div>)}</div>
}

export function Button({ children, variant = 'primary', className = '', disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' }) {
  return <button className={`button button-${variant} ${className}`} disabled={disabled} {...props}>{children}</button>
}

export function Busy({ label = 'لحظة من فضلك' }: { label?: string }) {
  return <div className="busy" role="status"><LoaderCircle className="spin" size={25} /><span>{label}</span></div>
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✳</span><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>
}

export function PageIntro({ eyebrow, title, body, align = 'right' }: { eyebrow?: string; title: string; body?: string; align?: 'right' | 'center' }) {
  return <div className={`page-intro align-${align}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{body && <p>{body}</p>}</div>
}

export function IconCircle({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`icon-circle ${tone}`}>{children}</span>
}

export function Price({ value, compact = false }: { value: number | string; compact?: boolean }) {
  return <span className={compact ? 'price compact' : 'price'}>{new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(Number(value))}<small> ر.س</small></span>
}
