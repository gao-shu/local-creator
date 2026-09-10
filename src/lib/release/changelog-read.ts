// Copyright (c) local-creator contributors. All rights reserved.

const LAST_READ_CHANGELOG_VERSION_KEY = 'lc_last_read_changelog_version'

/** 用户上次已读的更新日志版本（小铃铛未读角标） */
export function getLastReadChangelogVersion(): string {
  try {
    return localStorage.getItem(LAST_READ_CHANGELOG_VERSION_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function setLastReadChangelogVersion(version: string): void {
  const trimmed = version.trim()
  if (!trimmed) return
  try {
    localStorage.setItem(LAST_READ_CHANGELOG_VERSION_KEY, trimmed)
  } catch {
    /* ignore */
  }
}
