const HOTKEY_STORAGE_KEY = 'hotkeySettingsV1'
const notificationDefaults = {
  dnd: false,
  connection: true,
  stream: true,
  record: true,
  scene: true,
  error: true
}

const DEFAULT_HOTKEY_SETTINGS = {
  enabled: true,
  bindings: {
    sceneModifier: 'Mod',
    streamToggle: 'Mod+S',
    recordToggle: 'Mod+R',
    studioToggle: 'Mod+Shift+S',
    transition: 'Mod+T',
    volumeUp: 'Mod+ArrowUp',
    volumeDown: 'Mod+ArrowDown',
    muteFocused: 'Mod+M'
  }
}

const LAYOUT_PRESETS_KEY = 'obsLayoutPresets'
const ACTIVE_LAYOUT_PRESET_KEY = 'obsActiveLayoutPreset'
const DEFAULT_LAYOUT_PRESETS = {
  expanded: { id: 'expanded', name: 'Expanded', density: 'expanded', sidebarLeft: 280, sidebarRight: 300 },
  compact: { id: 'compact', name: 'Compact', density: 'compact', sidebarLeft: 240, sidebarRight: 240 }
}
const LAYOUT_LIMITS = { min: 200, max: 420 }

const elements = {
  layoutPresetSelect: document.getElementById('settings-layout-preset'),
  layoutDensitySelect: document.getElementById('settings-layout-density'),
  sidebarLeftWidth: document.getElementById('settings-sidebar-left'),
  sidebarRightWidth: document.getElementById('settings-sidebar-right'),
  layoutApplyBtn: document.getElementById('settings-layout-apply'),
  layoutSaveBtn: document.getElementById('settings-layout-save'),
  layoutDeleteBtn: document.getElementById('settings-layout-delete'),
  layoutResetBtn: document.getElementById('settings-layout-reset'),
  hotkeysEnabled: document.getElementById('settings-hotkeys-enabled'),
  hotkeyInputs: document.querySelectorAll('[data-hotkey-action]'),
  hotkeyResetBtn: document.getElementById('settings-hotkeys-reset'),
  hotkeyConflict: document.getElementById('settings-hotkey-conflict'),
  notifyDnd: document.getElementById('settings-notify-dnd'),
  notifyConnection: document.getElementById('settings-notify-connection'),
  notifyStream: document.getElementById('settings-notify-stream'),
  notifyRecord: document.getElementById('settings-notify-record'),
  notifyScene: document.getElementById('settings-notify-scene'),
  notifyError: document.getElementById('settings-notify-error'),
  closeBtn: document.getElementById('settings-close-btn')
}

let layoutPresets = { ...DEFAULT_LAYOUT_PRESETS }
let hotkeySettings = cloneDefaultHotkeys()
let notificationSettings = { ...notificationDefaults }

function cloneDefaultHotkeys() {
  return JSON.parse(JSON.stringify(DEFAULT_HOTKEY_SETTINGS))
}

function clampSidebar(value) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) return LAYOUT_LIMITS.min
  return Math.min(LAYOUT_LIMITS.max, Math.max(LAYOUT_LIMITS.min, parsed))
}

function sanitizePreset(preset) {
  if (!preset || typeof preset !== 'object') return null
  const density = preset.density === 'compact' ? 'compact' : 'expanded'
  const sidebarLeft = clampSidebar(preset.sidebarLeft || LAYOUT_LIMITS.min)
  const sidebarRight = clampSidebar(preset.sidebarRight || LAYOUT_LIMITS.min)
  const id = preset.id && typeof preset.id === 'string' ? preset.id : null
  const name = preset.name && typeof preset.name === 'string' ? preset.name : null
  if (!id || !name) return null
  return { id, name, density, sidebarLeft, sidebarRight }
}

function loadStoredLayoutPresets() {
  let presets = { ...DEFAULT_LAYOUT_PRESETS }
  const stored = localStorage.getItem(LAYOUT_PRESETS_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      Object.values(parsed || {}).forEach((preset) => {
        const sanitized = sanitizePreset(preset)
        if (sanitized) {
          presets[sanitized.id] = sanitized
        }
      })
    } catch (err) {
      console.warn('Failed to parse stored layout presets', err)
    }
  }
  return presets
}

function saveLayoutPresets(presets) {
  localStorage.setItem(LAYOUT_PRESETS_KEY, JSON.stringify(presets))
}

function applyLayoutToDocument(density, leftWidth, rightWidth) {
  document.documentElement.style.setProperty('--sidebar-left', `${leftWidth}px`)
  document.documentElement.style.setProperty('--sidebar-right', `${rightWidth}px`)
  const body = document.body
  if (body) {
    body.classList.remove('density-compact', 'density-expanded')
    body.classList.add(density === 'compact' ? 'density-compact' : 'density-expanded')
  }
}

function populateLayoutPresetSelect() {
  if (!elements.layoutPresetSelect) return
  elements.layoutPresetSelect.innerHTML = ''
  const defaultsOrder = ['expanded', 'compact']
  const sorted = Object.values(layoutPresets).sort((a, b) => {
    const aIndex = defaultsOrder.indexOf(a.id)
    const bIndex = defaultsOrder.indexOf(b.id)
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
    }
    return a.name.localeCompare(b.name)
  })
  sorted.forEach((preset) => {
    const option = document.createElement('option')
    option.value = preset.id
    option.textContent = preset.name
    elements.layoutPresetSelect.appendChild(option)
  })
}

function applyLayoutPreset(presetId) {
  const preset = sanitizePreset(layoutPresets[presetId]) || DEFAULT_LAYOUT_PRESETS.expanded
  const density = preset.density || 'expanded'
  const leftWidth = preset.sidebarLeft || 280
  const rightWidth = preset.sidebarRight || 300

  applyLayoutToDocument(density, leftWidth, rightWidth)

  if (elements.layoutDensitySelect) elements.layoutDensitySelect.value = density
  if (elements.sidebarLeftWidth) elements.sidebarLeftWidth.value = leftWidth
  if (elements.sidebarRightWidth) elements.sidebarRightWidth.value = rightWidth
  if (elements.layoutPresetSelect) {
    const optionExists = Array.from(elements.layoutPresetSelect.options || []).some(opt => opt.value === presetId)
    if (optionExists) {
      elements.layoutPresetSelect.value = presetId
    }
  }

  localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, presetId)
}

function handleLayoutApply() {
  const presetId = elements.layoutPresetSelect?.value || 'expanded'
  const density = elements.layoutDensitySelect ? elements.layoutDensitySelect.value : 'expanded'
  const leftWidth = elements.sidebarLeftWidth ? clampSidebar(elements.sidebarLeftWidth.value) : 280
  const rightWidth = elements.sidebarRightWidth ? clampSidebar(elements.sidebarRightWidth.value) : 300

  layoutPresets[presetId] = sanitizePreset({ id: presetId, name: layoutPresets[presetId]?.name || presetId, density, sidebarLeft: leftWidth, sidebarRight: rightWidth }) || DEFAULT_LAYOUT_PRESETS.expanded
  saveLayoutPresets(layoutPresets)
  applyLayoutPreset(presetId)
}

function handleLayoutSave() {
  const name = (window.prompt('Preset name', 'Custom Layout') || '').trim()
  if (!name) return
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!id) return
  if (['expanded', 'compact', '__custom'].includes(id)) {
    alert('Preset name is reserved. Choose another name.')
    return
  }

  const density = elements.layoutDensitySelect ? elements.layoutDensitySelect.value : 'expanded'
  const leftWidth = elements.sidebarLeftWidth ? clampSidebar(elements.sidebarLeftWidth.value) : 280
  const rightWidth = elements.sidebarRightWidth ? clampSidebar(elements.sidebarRightWidth.value) : 300

  layoutPresets[id] = { id, name, density, sidebarLeft: leftWidth, sidebarRight: rightWidth }
  saveLayoutPresets(layoutPresets)
  populateLayoutPresetSelect()
  applyLayoutPreset(id)
}

function handleLayoutDelete() {
  const presetId = elements.layoutPresetSelect?.value
  if (!presetId || DEFAULT_LAYOUT_PRESETS[presetId]) {
    alert('Select a saved preset to delete.')
    return
  }
  delete layoutPresets[presetId]
  saveLayoutPresets(layoutPresets)
  populateLayoutPresetSelect()
  applyLayoutPreset('expanded')
}

function handleLayoutReset() {
  layoutPresets = { ...DEFAULT_LAYOUT_PRESETS }
  saveLayoutPresets(layoutPresets)
  populateLayoutPresetSelect()
  applyLayoutPreset('expanded')
}

function normalizeKey(key) {
  if (!key) return ''
  if (key === ' ') return 'Space'
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1)
}

function formatHotkeyFromEvent(event) {
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('Mod')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  const key = normalizeKey(event.key)
  if (key && !['Control', 'Meta', 'Shift', 'Alt'].includes(key)) {
    parts.push(key)
  }
  return parts.join('+')
}

function loadHotkeySettings() {
  try {
    const raw = localStorage.getItem(HOTKEY_STORAGE_KEY)
    if (!raw) return cloneDefaultHotkeys()
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed.enabled ?? DEFAULT_HOTKEY_SETTINGS.enabled,
      bindings: { ...DEFAULT_HOTKEY_SETTINGS.bindings, ...(parsed.bindings || {}) }
    }
  } catch (err) {
    console.warn('Failed to load hotkey settings, using defaults', err)
    return cloneDefaultHotkeys()
  }
}

function saveHotkeySettings() {
  localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeySettings))
}

function applyHotkeySettingsToUI() {
  if (elements.hotkeysEnabled) {
    elements.hotkeysEnabled.checked = hotkeySettings.enabled
  }
  if (elements.hotkeyInputs && elements.hotkeyInputs.forEach) {
    elements.hotkeyInputs.forEach(input => {
      const action = input.dataset.hotkeyAction
      input.value = hotkeySettings.bindings[action] || ''
    })
  }
  validateHotkeyConflicts()
}

function validateHotkeyConflicts() {
  if (!elements.hotkeyInputs || !elements.hotkeyConflict) return
  const valueMap = {}
  let hasConflict = false

  elements.hotkeyInputs.forEach(input => {
    const val = input.value.trim()
    input.classList.remove('conflict')
    if (!val) return
    if (!valueMap[val]) {
      valueMap[val] = []
    }
    valueMap[val].push(input)
  })

  Object.values(valueMap).forEach(list => {
    if (list.length > 1) {
      hasConflict = true
      list.forEach(el => el.classList.add('conflict'))
    }
  })

  if (hasConflict) {
    elements.hotkeyConflict.textContent = 'Conflicting hotkeys detected. Adjust bindings to ensure each action is unique.'
    elements.hotkeyConflict.classList.remove('hidden')
  } else {
    elements.hotkeyConflict.classList.add('hidden')
  }
}

function handleHotkeyInputKeydown(event, input) {
  event.preventDefault()
  const hotkey = formatHotkeyFromEvent(event)
  const action = input.dataset.hotkeyAction
  input.value = hotkey
  hotkeySettings.bindings[action] = hotkey
  saveHotkeySettings()
  validateHotkeyConflicts()
}

function handleHotkeysReset() {
  hotkeySettings = cloneDefaultHotkeys()
  saveHotkeySettings()
  applyHotkeySettingsToUI()
}

function loadNotificationSettings() {
  const stored = JSON.parse(localStorage.getItem('notificationSettings') || '{}')
  notificationSettings = { ...notificationDefaults, ...stored }
  applyNotificationSettingsToUI()
}

function applyNotificationSettingsToUI() {
  if (elements.notifyDnd) elements.notifyDnd.checked = notificationSettings.dnd
  if (elements.notifyConnection) elements.notifyConnection.checked = notificationSettings.connection
  if (elements.notifyStream) elements.notifyStream.checked = notificationSettings.stream
  if (elements.notifyRecord) elements.notifyRecord.checked = notificationSettings.record
  if (elements.notifyScene) elements.notifyScene.checked = notificationSettings.scene
  if (elements.notifyError) elements.notifyError.checked = notificationSettings.error
}

function saveNotificationSettings() {
  localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings))
}

function attachEventListeners() {
  if (elements.layoutPresetSelect) {
    elements.layoutPresetSelect.addEventListener('change', () => {
      applyLayoutPreset(elements.layoutPresetSelect.value)
    })
  }
  if (elements.layoutApplyBtn) elements.layoutApplyBtn.addEventListener('click', handleLayoutApply)
  if (elements.layoutSaveBtn) elements.layoutSaveBtn.addEventListener('click', handleLayoutSave)
  if (elements.layoutDeleteBtn) elements.layoutDeleteBtn.addEventListener('click', handleLayoutDelete)
  if (elements.layoutResetBtn) elements.layoutResetBtn.addEventListener('click', handleLayoutReset)

  if (elements.hotkeysEnabled) {
    elements.hotkeysEnabled.addEventListener('change', (e) => {
      hotkeySettings.enabled = e.target.checked
      saveHotkeySettings()
    })
  }
  if (elements.hotkeyInputs) {
    elements.hotkeyInputs.forEach(input => {
      input.addEventListener('keydown', (event) => handleHotkeyInputKeydown(event, input))
      input.addEventListener('focus', () => input.select())
    })
  }
  if (elements.hotkeyResetBtn) elements.hotkeyResetBtn.addEventListener('click', handleHotkeysReset)

  const notificationBindings = [
    { el: elements.notifyDnd, key: 'dnd' },
    { el: elements.notifyConnection, key: 'connection' },
    { el: elements.notifyStream, key: 'stream' },
    { el: elements.notifyRecord, key: 'record' },
    { el: elements.notifyScene, key: 'scene' },
    { el: elements.notifyError, key: 'error' }
  ]
  notificationBindings.forEach(({ el, key }) => {
    if (!el) return
    el.addEventListener('change', () => {
      notificationSettings[key] = el.checked
      saveNotificationSettings()
    })
  })

  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', () => {
      window.close()
    })
  }
}

function init() {
  layoutPresets = loadStoredLayoutPresets()
  populateLayoutPresetSelect()
  const activePresetId = localStorage.getItem(ACTIVE_LAYOUT_PRESET_KEY) || 'expanded'
  applyLayoutPreset(layoutPresets[activePresetId] ? activePresetId : 'expanded')

  hotkeySettings = loadHotkeySettings()
  applyHotkeySettingsToUI()

  loadNotificationSettings()
  attachEventListeners()
}

document.addEventListener('DOMContentLoaded', init)
