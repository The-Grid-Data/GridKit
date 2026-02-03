import { useState, useRef, useCallback, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useGridConfig } from './GridProvider.js'
import { executeQuery } from '../core/client.js'
import { gridKeys } from '../core/query-keys.js'
import { PROFILE_HOVER_QUERY } from '../core/queries.js'

interface MediaItem {
  url: string
  mediaType: { name: string } | null
}

interface ProfileHoverData {
  profileInfos: Array<{
    id: string
    name: string
    descriptionShort: string | null
    tagLine: string | null
    profileType: { name: string } | null
    profileSector: { name: string } | null
    root: {
      slug: string
      media: MediaItem[]
    } | null
  }>
}

function getThumbnailUrl(media: MediaItem[] | undefined): string | null {
  if (!media?.length) return null
  const icon = media.find((m) => m.mediaType?.name === 'Icon')
  if (icon) return icon.url
  const logo = media.find((m) => m.mediaType?.name === 'Logo on white')
  if (logo) return logo.url
  return null
}

export function ProfileHoverCard({
  profileId,
  children,
  delay = 300,
}: {
  profileId: string
  children: ReactNode
  delay?: number
}) {
  const config = useGridConfig()
  const [visible, setVisible] = useState(false)
  const [fetchEnabled, setFetchEnabled] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data } = useQuery<ProfileHoverData>({
    queryKey: gridKeys.profileHover(profileId),
    queryFn: () =>
      executeQuery<ProfileHoverData>(config, PROFILE_HOVER_QUERY, {
        id: { _eq: profileId },
      }),
    enabled: fetchEnabled,
    staleTime: 5 * 60_000,
  })

  const profile = data?.profileInfos?.[0] ?? null
  const thumbnailUrl = getThumbnailUrl(profile?.root?.media)

  const handleMouseEnter = useCallback(() => {
    setFetchEnabled(true)
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }, [delay])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && profile && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            width: 280,
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: 16,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={profile.name}
              style={{
                width: 48,
                height: 48,
                borderRadius: 6,
                objectFit: 'contain',
                marginBottom: 8,
                background: '#f5f5f5',
              }}
            />
          )}
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
            {profile.name}
          </div>
          {profile.tagLine && (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              {profile.tagLine}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profile.profileType?.name && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: '#f0f0f0',
                  color: '#555',
                }}
              >
                {profile.profileType.name}
              </span>
            )}
            {profile.profileSector?.name && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: '#e8f4fd',
                  color: '#1976d2',
                }}
              >
                {profile.profileSector.name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
