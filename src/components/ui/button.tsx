import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva('inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      primary: 'cursor-pointer bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]',
      secondary: 'cursor-pointer bg-[var(--surface-raised)] text-[var(--accent-foreground)] hover:bg-[var(--surface-hover)]',
      ghost: 'cursor-pointer text-[var(--muted-foreground)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]',
      outline: 'cursor-pointer border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-raised)]',
    },
    size: { default: '', icon: 'w-11 px-0' },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
})

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
