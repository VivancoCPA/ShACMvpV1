// Skeletons compartidos por los dashboards de rol mientras carga el summary o los KPIs.
export function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

// Placeholders del tamaño de una AlertaCard o una KpiRingCard, dentro de la grilla de su zona.
export function CardSkeleton({ count, height }: { count: number; height: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft`} />
      ))}
    </>
  )
}
