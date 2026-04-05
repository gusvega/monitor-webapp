import LoadingScreen from '@/components/LoadingScreen'

export default function DashboardLoading() {
  return (
    <LoadingScreen
      title="Loading overview..."
      description="Collecting cross-repository status and deployment data."
      fullScreen={false}
      inset
    />
  )
}
