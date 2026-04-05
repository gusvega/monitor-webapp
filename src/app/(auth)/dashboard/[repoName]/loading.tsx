import LoadingScreen from '@/components/LoadingScreen'

export default function RepoDashboardLoading() {
  return (
    <LoadingScreen
      title="Loading repository details..."
      description="Fetching environments, runs, and release activity."
      fullScreen={false}
      inset
    />
  )
}
