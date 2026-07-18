import { useCallback, useMemo, useState } from 'react'
import { api } from '@chameleon/shared'

const STORAGE_KEY = 'system_session'

function loadPersistedSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveSessionToStorage(session) {
  try {
    const { sysType, systemName, members, groups, front, shiftHistory, source } = session
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sysType, systemName, members, groups, front, shiftHistory, source }))
  } catch {}
}

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
  const [session, setSession] = useState(() => {
    const persisted = loadPersistedSession()
    return persisted ? { ...DEFAULT_SESSION(), ...persisted } : DEFAULT_SESSION()
  })
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  // update() ignores undefined values so partial patches don't clobber persisted fields
  const update = useCallback((patch) => {
    setSession(prev => {
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const next = { ...prev, ...filtered }
      saveSessionToStorage(next)
      return next
    })
  }, [])

  const setSystemName = useCallback((name) => {
    setSession(prev => {
      const next = { ...prev, systemName: name || null }
      saveSessionToStorage(next)
      return next
    })
  }, [])

  const setSysType = useCallback((sysType) => {
    setSession(prev => {
      const next = { ...prev, sysType }
      saveSessionToStorage(next)
      return next
    })
  }, [])

  const setMembers = useCallback((members) => {
    setSession(prev => {
      const next = { ...prev, members }
      saveSessionToStorage(next)
      return next
    })
  }, [])

  const setGroups = useCallback((groups) => {
    setSession(prev => {
      const next = { ...prev, groups }
      saveSessionToStorage(next)
      return next
    })
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
    sessionStorage.removeItem(STORAGE_KEY)
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

    if ((Array.isArray(current.shiftHistory) ? current.shiftHistory : []).length) {
      return {
        ...base,
        layers: [
          {
            _id: `layer_${Date.now()}`,
            name: 'Active',
            shifts: (Array.isArray(current.shiftHistory) ? current.shiftHistory : []).map(s => ({
              ...s,
              timestamp: s.startTime ? new Date(s.startTime) : s.timestamp ? new Date(s.timestamp) : new Date(),
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

  // Strip entity to essential fields only (avoids PayloadTooLargeError)
  const stripEntityForPayload = (raw) => {
    if (!raw) return null
    const entity = {
      name: raw.name,
      entityType: raw.entityType,
      description: raw.description,
      color: raw.color,
      pronouns: raw.pronouns,
      avatar: raw.avatar,
      birthday: raw.birthday,
      proxy: raw.proxy,
      condition: raw.condition,
      signoff: raw.signoff,
      age: raw.age,
      banner: raw.banner,
    }
    if (raw.metadata) {
      entity.metadata = {
        importedFrom: raw.metadata.importedFrom,
        addedAt: raw.metadata.addedAt,
        pluralKitId: raw.metadata.pluralKitId,
        pluralKitUuid: raw.metadata.pluralKitUuid,
        simplyPluralId: raw.metadata.simplyPluralId,
        octoconId: raw.metadata.octoconId,
      }
    }
    return entity
  }

  const buildPayloadFromSession = useCallback((sess) => {
    const { isSystem, isFragmented, isDissociative } = deriveFlags(sess.sysType)
    const name = sess.systemName || ''
    const sysIdx = name.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined
    const front = buildFront(sess)

    const payload = {
      name: {
        display: name || 'My System',
        ...(sysIdx && { indexable: sysIdx }),
      },
      sys_type: {
        name: sess.sysType?.name || 'None',
        dd: sess.sysType?.dd || {},
        isSystem,
        isFragmented,
        isDissociative,
        dissociativeStateName: sess.sysType?.dissociativeStateName || 'Dissociated',
        onboardingCompleted: sess.sysType?.onboardingCompleted ?? true,
      },
      privacyBuckets: [
        sess.privacyBuckets?.Strangers?._id,
        sess.privacyBuckets?.Friends?._id,
      ].filter(Boolean),
      alters: {
        conditions: (sess.members || [])
          .filter(m => !isSystem || m.entityType !== 'state')
          .map(m => ({ name: m.name, settings: { hide_to_self: false, include_in_Count: true } })),
        IDs: (sess.members || [])
          .filter(m => !isSystem || m.entityType !== 'state')
          .map(m => m.id || m._id)
          .filter(id => id && !String(id).startsWith('temp_')),
        entities: (sess.members || [])
          .filter(m => !isSystem || m.entityType !== 'state')
          .map(m => stripEntityForPayload(m._raw) || { name: { display: m.name, indexable: m.name?.toLowerCase?.() }, entityType: m.entityType || 'alter' }),
      },
      states: {
        conditions: (sess.members || [])
          .filter(m => m.entityType === 'state')
          .map(m => ({ name: m.name, settings: { hide_to_self: false, include_in_Count: true } })),
        IDs: (sess.members || [])
          .filter(m => m.entityType === 'state')
          .map(m => m.id || m._id)
          .filter(id => id && !String(id).startsWith('temp_')),
        entities: (sess.members || [])
          .filter(m => m.entityType === 'state')
          .map(m => stripEntityForPayload(m._raw) || { name: { display: m.name, indexable: m.name?.toLowerCase?.() }, entityType: m.entityType || 'state' }),
      },
      groups: {
        conditions: (Array.isArray(sess.groups) ? sess.groups : []).map(g => ({ name: g.name, settings: { hide_to_self: false, include_in_Count: true } })),
        IDs: (Array.isArray(sess.groups) ? sess.groups : []).map(g => g.id || g._id).filter(id => id && !String(id).startsWith('temp_')),
        entities: (Array.isArray(sess.groups) ? sess.groups : []).map(g => stripEntityForPayload(g._raw) || { name: { display: g.name, indexable: g.name?.toLowerCase?.() } }),
      },
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
      privateEntityIDs: sess.privateEntityIDs || { alters: [], states: [], groups: [] },
      front: front
    }

    return payload
  }, [session.systemName, session.sysType, session.members, session.front, session.shiftHistory, session.privacyBuckets, deriveFlags, buildFront])

  const buildPayload = useCallback(() => buildPayloadFromSession(session), [session, buildPayloadFromSession])

  const commit = useCallback(async (overridePatch) => {
    setCommitting(true)
    setError(null)
    try {
      if (overridePatch) setSession(prev => ({ ...prev, ...overridePatch }))
      const patchedSession = overridePatch ? { ...session, ...overridePatch } : session
      const data = buildPayloadFromSession(patchedSession)
      const res = await api.createSystemSession(data)
      setResult(res)
      return res
    } catch (err) {
      setError(err.message || 'Failed to create system')
      throw err
    } finally {
      setCommitting(false)
    }
  }, [session, buildPayload])

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
