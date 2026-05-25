import * as React from 'react'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { cn } from './util'

/* ============================================================
 * Button — same surface as the old shadcn-flavored API
 * ============================================================ */
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'outline'; size?: 'sm' | 'md' | 'icon' }
>(({ className, variant = 'default', size = 'md', ...props }, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-quart active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  const variants: Record<string, string> = {
    default: 'bg-surface-2 text-ink-dim border border-line hover:border-orange hover:text-ink',
    primary: 'bg-gradient-to-b from-orange to-orange-deep text-ink-deep border border-orange-deep shadow-glow hover:brightness-110 font-semibold',
    ghost: 'text-ink-dim hover:text-ink hover:bg-surface',
    outline: 'border border-line text-ink hover:border-orange hover:bg-surface',
  }
  const sizes: Record<string, string> = {
    sm: 'h-11 md:h-9 px-3 text-xs',
    md: 'h-11 px-4 text-sm',
    icon: 'h-11 w-11 md:h-10 md:w-10',
  }
  return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
})
Button.displayName = 'Button'

/* ============================================================
 * Slider — Base UI Slider, single-thumb, controlled
 * Old API: value, onValueChange, min, max, step, disabled
 * ============================================================ */
type SliderProps = {
  className?: string
  value: number[]
  onValueChange: (v: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}
export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, onValueChange, min, max, step, disabled }, ref) => (
    <BaseSlider.Root
      value={value[0]}
      onValueChange={(v) => onValueChange([typeof v === 'number' ? v : v[0]])}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn('relative flex w-full touch-none select-none items-center h-9', className)}
    >
      <BaseSlider.Control ref={ref} className="relative flex w-full items-center h-9 cursor-pointer">
        <BaseSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-surface-2 border border-line">
          <BaseSlider.Indicator className="absolute h-full bg-orange" />
        </BaseSlider.Track>
        <BaseSlider.Thumb
          aria-label="value"
          className="absolute block h-5 w-5 rounded-full bg-orange ring-2 ring-ink/90 ring-offset-2 ring-offset-bg-deep transition-transform focus-visible:outline-none focus-visible:ring-orange data-[dragging]:scale-110"
        />
      </BaseSlider.Control>
    </BaseSlider.Root>
  ),
)
Slider.displayName = 'Slider'

/* ============================================================
 * NumberField — Base UI NumberField with horizontal scrub area
 * - Drag the label/glyph left/right to scrub the value (snaps to step)
 * - Tap the input to type an exact value
 * - +/- buttons (decoration; hold-to-repeat baked in)
 * ============================================================ */
type NumberFieldProps = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  smallStep?: number
  largeStep?: number
  className?: string
  scrubLabel?: React.ReactNode
}
export function NumberField({
  value, onChange, min, max, step = 1, smallStep, largeStep, className, scrubLabel,
}: NumberFieldProps) {
  const id = React.useId()
  return (
    <BaseNumberField.Root
      id={id}
      value={value}
      onValueChange={(v) => onChange(v ?? 0)}
      min={min}
      max={max}
      step={step}
      smallStep={smallStep}
      largeStep={largeStep}
      snapOnStep
      className={cn('relative flex items-stretch w-full', className)}
    >
      {/* Scrub area: drag the label horizontally to change the value. */}
      <BaseNumberField.ScrubArea
        direction="horizontal"
        pixelSensitivity={2}
        className="select-none cursor-ew-resize flex items-center justify-center h-11 md:h-9 w-7 rounded-l-md border border-r-0 border-line bg-surface/60 text-ink-faint text-[10px] font-mono uppercase tracking-wider hover:border-orange hover:text-orange transition-colors data-[scrubbing]:bg-orange data-[scrubbing]:text-ink-deep data-[scrubbing]:border-orange"
      >
        <BaseNumberField.ScrubAreaCursor
          className="z-[200] text-orange"
        >
          <svg width="26" height="14" viewBox="0 0 24 14" fill="currentColor" stroke="white" strokeWidth="1" style={{ display: 'block' }}>
            <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
          </svg>
        </BaseNumberField.ScrubAreaCursor>
        <span aria-hidden>{scrubLabel ?? '↔'}</span>
      </BaseNumberField.ScrubArea>
      <BaseNumberField.Group className="flex-1 flex items-stretch">
        <BaseNumberField.Input
          className={cn(
            'h-11 md:h-9 min-w-0 w-full rounded-r-md bg-surface/60 border border-line px-2 text-right font-mono text-base md:text-xs text-ink',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus:border-orange',
            'data-[scrubbing]:border-orange data-[scrubbing]:text-orange',
          )}
        />
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  )
}

/* ============================================================
 * Dialog — wraps Base UI Dialog with the same API the App.tsx uses
 * Dialog (Root), DialogContent (Portal+Backdrop+Popup), DialogHeader, DialogTitle, DialogClose
 * ============================================================ */
type DialogProps = React.ComponentProps<typeof BaseDialog.Root>
export const Dialog = ({ open, onOpenChange, children, ...rest }: DialogProps) => (
  <BaseDialog.Root open={open} onOpenChange={onOpenChange} {...rest}>
    {children as React.ReactNode}
  </BaseDialog.Root>
)

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <BaseDialog.Portal>
    <BaseDialog.Backdrop className="fixed inset-0 z-[90] bg-bg-deep/80 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-200" />
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-[100] grid w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 border border-line bg-bg p-6 shadow-lg rounded-xl',
        'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
        'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
        'transition-[opacity,transform] duration-200 ease-out',
        className,
      )}
      {...props}
    >
      {children}
    </BaseDialog.Popup>
  </BaseDialog.Portal>
))
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5', className)} {...props} />
)

export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <BaseDialog.Title
      ref={ref as any}
      className={cn('text-2xl font-display leading-none', className)}
      {...(props as any)}
    />
  ),
)
DialogTitle.displayName = 'DialogTitle'

/* DialogClose — pass `asChild` to render the child as the close button (Base UI uses `render`) */
type DialogCloseProps =
  | (React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: false; children?: React.ReactNode })
  | { asChild: true; children: React.ReactElement }
export const DialogClose = (props: DialogCloseProps) => {
  if ((props as any).asChild) {
    const { children } = props as { asChild: true; children: React.ReactElement }
    return <BaseDialog.Close render={children} />
  }
  const { className, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>
  return <BaseDialog.Close className={className} {...rest} />
}
