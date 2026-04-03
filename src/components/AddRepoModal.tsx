'use client'

import { useState } from 'react'
import { X, GitBranch, Loader } from 'lucide-react'

interface AddRepoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddRepoModal({ isOpen, onClose }: AddRepoModalProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validate GitHub URL
      const urlPattern = /^https?:\/\/github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)(\.git)?$/
      const match = repoUrl.trim().match(urlPattern)

      if (!match) {
        setError('Please enter a valid GitHub repository URL')
        setIsLoading(false)
        return
      }

      const [, owner, repo] = match

      // Here you would typically call an API endpoint to add the repo
      console.log('Adding repo:', { owner, repo })

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Reset and close
      setRepoUrl('')
      onClose()
    } catch (err) {
      setError('Failed to add repository. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-neutral-600" />
            <h2 className="text-lg font-bold text-neutral-900">Add Repository</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
            <p className="text-xs text-neutral-600 mt-2">
              Enter the full GitHub URL (e.g., https://github.com/gusvega/monitor-webapp)
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 text-neutral-900 font-semibold hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Repository'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
