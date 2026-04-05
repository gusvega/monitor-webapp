interface LoadingScreenProps {
  title?: string
  description?: string
  fullScreen?: boolean
  inset?: boolean
}

export default function LoadingScreen({
  title = 'Loading...',
  description,
  fullScreen = true,
  inset = false,
}: LoadingScreenProps) {
  return (
    <div
      className={[
        fullScreen ? 'min-h-screen' : 'min-h-[320px]',
        inset ? 'px-8 py-10' : '',
        'flex items-center justify-center bg-neutral-50',
      ].join(' ')}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
        <p className="text-sm font-semibold text-neutral-700">{title}</p>
        {description ? <p className="mt-1 text-xs text-neutral-500">{description}</p> : null}
      </div>
    </div>
  )
}
