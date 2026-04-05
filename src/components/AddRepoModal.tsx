'use client'

import { useState } from 'react'
import { Loader } from 'lucide-react'
import { Alert, Button, FormField, Input, Modal } from '@gusvega/ui'

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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Add Repository"
      description="Enter the full GitHub repository URL to start monitoring it."
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-repo-form" size="sm" disabled={isLoading || !repoUrl.trim()}>
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Repository'
            )}
          </Button>
        </>
      }
    >
      <form id="add-repo-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Repository URL"
          htmlFor="repo-url"
          hint="Enter the full GitHub URL, for example https://github.com/gusvega/monitor-webapp"
        >
          <Input
            id="repo-url"
            type="text"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
          />
        </FormField>

        {error && <Alert title="Unable to add repository">{error}</Alert>}
      </form>
    </Modal>
  )
}
