import LoadingScreen from '@/components/LoadingScreen'

export default function AuthLoading() {
  return (
    <LoadingScreen
      title="Loading your workspace..."
      description="Preparing your repositories, environments, and workflow status."
    />
  )
}
