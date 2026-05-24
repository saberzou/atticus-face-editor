import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from './util'

/* Button */
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

/* Tabs */
export const Tabs = TabsPrimitive.Root
export const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn('grid grid-cols-3 gap-1 p-1.5 bg-surface border border-line rounded-lg', className)}
      {...props}
    />
  ),
)
TabsList.displayName = 'TabsList'
export const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim transition-all',
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange',
        'data-[state=active]:bg-gradient-to-b data-[state=active]:from-orange data-[state=active]:to-orange-deep',
        'data-[state=active]:text-[oklch(0.16_0.05_50)] data-[state=active]:shadow-glow',
        className,
      )}
      {...props}
    />
  ),
)
TabsTrigger.displayName = 'TabsTrigger'
export const TabsContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn('focus-visible:outline-none', className)} {...props} />
  ),
)
TabsContent.displayName = 'TabsContent'

/* Slider */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center h-9', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-2 border border-line">
      <SliderPrimitive.Range className="absolute h-full bg-orange" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-orange ring-2 ring-ink/90 ring-offset-2 ring-offset-bg-deep transition-transform focus-visible:outline-none focus-visible:ring-orange active:scale-110" />
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'

/* Dialog */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-bg-deep/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0', className)}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 border border-line bg-bg p-6 shadow-lg rounded-xl', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'
export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5', className)} {...props} />
)
export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-2xl font-display leading-none', className)} {...props} />
  ),
)
DialogTitle.displayName = 'DialogTitle'
