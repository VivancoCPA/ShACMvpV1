interface PageWrapperProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageWrapper({ title, actions, children }: PageWrapperProps) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between border-b border-hairline pb-4 dark:border-hairline/20">
        <h1 className="font-display text-2xl font-normal tracking-tight text-ink dark:text-on-dark">
          {title}
        </h1>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
