'use client'

export function toRepoSlug(repoName: string) {
  return repoName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
