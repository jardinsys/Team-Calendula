import { useCallback, useMemo, useState } from 'react'
import { api } from '@chameleon/shared'

const DEFAULT_SESSION = () => ({
  systemName: null,
  sysType: null,
  privacyBuckets: {
    Strangers: { name: 'Strangers', friends: [] },
    Friends:   { name: 'Friends',   friends: [] },
  },
  alters:     { conditions: [], IDs: [] },
  states:     { conditions: [], IDs: [] },
  groups:     { conditions: [], IDs: [] },
  front:      null,
  shiftHistory: [],
  members:    [],
  source:     null,
  privateEntityIDs: { alters: [], states: [], groups: [] },
})

export function useSystemSession() {
  const [session, setSession] = useState(DEFAULT_SESSION)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const update = useCallback((patch) => {
    setSession(prev => ({ ...prev, ...patch }))
  }, [])

  const setSystemName = useCallback((name) => {
    setSession(prev => ({ ...prev, systemName: name || null }))
  }, [])

  const setSysType = useCallback((sysType) => {
    setSession(prev => ({ ...prev, sysType }))
  }, [])

  const setMembers = useCallback((members) => {
    setSession(prev => ({ ...prev, members }))
  }, [])

  const setGroups = useCallback((groups) => {
    setSession(prev => ({ ...prev, groups }))
  }, [])

  const setSwitches = useCallback((switches) => {
    setSession(prev => ({ ...prev, switchHistory: switches }))
  }, [])

  const setFront = useCallback((front) => {
    setSession(prev => ({ ...prev, front }))
  }, [])

  const addShift = useCallback((shift) => {
    setSession(prev => ({
      ...prev,
      shiftHistory: [...(prev.shiftHistory || []), shift],
    }))
  }, [])

  const reset = useCallback(() => {
    setSession(DEFAULT_SESSION())
    setError(null)
    setResult(null)
  }, [])

  const markPrivateFromPreview = useCallback((preview, selectedMemberIds, selectedGroupIds) => {
    const privateMemberIds = new Set()
    const privateGroupIds = new Set()

    if (preview?.members) {
      for (const member of preview.members) {
        if (!selectedMemberIds.has(member.sourceId)) continue
        const isPrivate = member.visibility === 'private' || member.visible === false || (member.flags && member.flags.private)
        if (isPrivate) privateMemberIds.add(member.sourceId)
      }
    }
    if (preview?.groups) {
      for (const group of preview.groups) {
        if (!selectedGroupIds.has(group.sourceId)) continue
        const isPrivate = group.visibility === 'private' || group.visible === false || (group.flags && group.flags.private)
        if (isPrivate) privateGroupIds.add(group.sourceId)
      }
    }

    setSession(prev => ({
      ...prev,
      privateEntityIDs: {
        alters: [...privateMemberIds].filter(sourceId => {
          const m = prev.members?.find(x => x.sourceId === sourceId)
          return m && m.entityType !== 'state'
        })
        .map(sourceId => prev.members.find(x => x.sourceId === sourceId)?.id)
        .filter(Boolean),
        states: [...privateMemberIds].filter(sourceId => {
          const m = prev.members?.find(x => x.sourceId === sourceId)
          return m && m.entityType === 'state'
        })
        .map(sourceId => prev.members.find(x => x.sourceId === sourceId)?.id)
        .filter(Boolean),
        groups: [...privateGroupIds].map(sourceId => prev.groups?.find(g => g.sourceId === sourceId)?.id).filter(Boolean),
      },
    }))
  }, [])


  const deriveFlags = useCallback((sysType = session.sysType) => {
    if (!sysType) return { isSystem: false, isFragmented: false, isDissociative: false }
    return {
      isSystem:      !!sysType.isSystem,
      isFragmented:  !!sysType.isFragmented,
      isDissociative:!!sysType.isDissociative,
    }
  }, [session.sysType])

  const buildFront = useCallback((current) => {
    const base = current.front || { status: '', caution: '' }

    if ((current.shiftHistory || []).length) {
      return {
        ...base,
        layers: [
          {
            _id: `layer_${Date.now()}`,
            name: 'Active',
            shifts: current.shiftHistory.map(s => ({
              ...s,
              timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
            })),
          },
        ],
      }
    }

    return {
      ...base,
      layers: base.layers || [],
    }
  }, [])

  const buildPayload = useCallback(() => {
    const { isSystem, isFragmented, isDissociative } = deriveFlags()
    const name = session.systemName || ''
    const sysIdx = name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined
    const front = buildFront(session)

    const payload = {
      name: {
        display: name || 'My System',
        ...(sysIdx && { indexable: sysIdx }),
      },
      sys_type: {
        name: session.sysType?.name || 'None',
        dd: session.sysType?.dd || {},
        isSystem,
        isFragmented,
        isDissociative,
      },
      privacyBuckets: [
        session.privacyBuckets?.Strangers?._id,
        session.privacyBuckets?.Friends?._id,
      ].filter(Boolean),
      alters: {
        conditions: (session.members || [])
          .filter(m => !isSystem || m.entityType !== 'state')
          .map(m => ({ name: m.name, settings: { hide_to_self: false, include_in_Count: true } })),
        IDs: (session.members || [])
          .filter(m => !isSystem || m.entityType !== 'state')
          .map(m => m.id),
      },
      states: {
        conditions: (session.members || [])
          .filter(m => m.entityType === 'state')
          .map(m => ({ name: m.name, settings: { hide_to_self: false, include_in_Count: true } })),
        IDs: (session.members || [])
          .filter(m => m.entityType === 'state')
          .map(m => m.id),
      },
      groups: { conditions: [], IDs: [] },
      setting: {
        friendAutoBucket: 'Friends',
        privacy: [
          {
            bucket: 'Strangers',
            settings: {
              mask: false, description: false, banner: false, avatar: false,
              birthday: false, pronouns: false, metadata: false, caution: false, hidden: true,
            },
          },
          {
            bucket: 'Friends',
            settings: {
              mask: false, description: true, banner: true, avatar: true,
              birthday: false, pronouns: true, metadata: false, caution: false, hidden: false,
            },
          },
        ],
      },
      privateEntityIDs: session.privateEntityIDs || { alters: [], states: [], groups: [] },
      front: front
    }

    return payload
  }, [
    session.systemName,
    session.sysType,
    session.members,
    session.front,
    session.shiftHistory,
    session.privacyBuckets,
    deriveFlags,
    buildFront,
  ])

  const commit = useCallback(async (overridePatch) => {
    setCommitting(true)
    setError(null)
    try {
      if (overridePatch) setSession(prev => ({ ...prev, ...overridePatch }))
      await Promise.resolve()
      const data = buildPayload()
      const res = await api.createSystemSession(data)
      setResult(res)
      return res
    } catch (err) {
      setError(err.message || 'Failed to create system')
      throw err
    } finally {
      setCommitting(false)
    }
  }, [buildPayload])

  const summary = useMemo(() => {
    const { isSystem, isFragmented, isDissociative } = deriveFlags()
    const statusParts = []
    if (isSystem) statusParts.push('System')
    if (isFragmented) statusParts.push('Fragmented')
    if (isDissociative) statusParts.push('Dissociative')
    if (!statusParts.length) statusParts.push('Basic')
    return {
      systemName: session.systemName,
      sysType: session.sysType,
      statusParts,
      memberCount: (session.members || []).length,
      hasShiftHistory: !!(session.shiftHistory && session.shiftHistory.length),
    }
  }, [session, deriveFlags])

  return {
    markPrivateFromPreview,
    session,
    update,
    setSystemName,
    setSysType,
    setMembers,
    setGroups,
    setSwitches,
    setFront,
    addShift,
    reset,
    deriveFlags,
    buildPayload,
    commit,
    committing,
    error,
    result,
    summary,
  }
}