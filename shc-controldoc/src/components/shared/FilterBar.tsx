interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 mb-4${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
