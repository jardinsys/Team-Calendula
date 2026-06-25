export const REGISTER_STEPS = [
  { id: 'category', label: 'Category' },
  { id: 'disorder', label: 'Condition' },
  { id: 'import', label: 'Import', show: (ctx) => ctx.isSystem || ctx.isFragmented },
  { id: 'other', label: 'Custom', show: (ctx) => ctx.category === 'OTHER' && !ctx.isSystem && !ctx.isFragmented },
  { id: 'name', label: 'Details' },
  { id: 'alters', label: 'Front' },
  { id: 'finish', label: 'Complete' },
]

export const IMPORT_PHASES = [
  { id: 'select', label: 'Select' },
  { id: 'mode', label: 'Mode' },
  { id: 'assign', label: 'Assign', show: (ctx) => ctx.importMode === 'intermediate' },
  { id: 'configure', label: 'Configure' },
  { id: 'preview', label: 'Preview' },
  { id: 'complete', label: 'Complete' },
]

export const FLOW = [
  ...REGISTER_STEPS,
  { id: 'import-select', label: 'Select Sources' },
  { id: 'import-mode', label: 'Import Mode' },
  { id: 'import-assign', label: 'Assign Targets', show: (ctx) => ctx.importMode === 'intermediate' },
  { id: 'import-configure', label: 'Configure Sources' },
  { id: 'import-preview', label: 'Preview' },
  { id: 'import-complete', label: 'Imported' },
]

export function visible(list, ctx) {
  return list.filter((item) => !item.show || item.show(ctx))
}

export function indexOf(list, id) {
  return list.findIndex((item) => item.id === id)
}

export function previous(list, currentId, ctx) {
  const visibleList = visible(list, ctx)
  const idx = indexOf(visibleList, currentId)
  if (idx <= 0) return null
  return visibleList[idx - 1]
}
