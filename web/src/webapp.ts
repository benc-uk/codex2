// ===================================================================================
// Codex - Interactive Storytelling Platform
// Copyright (C) 2025 Ben Coleman, Licensed under the MIT License
// webapp.ts - Main web application entry point & state using Alpine.js
// ===================================================================================

import './style.css'

import Alpine from 'alpinejs'
import { Story } from './codex/story'
import { newlineToBr, niceify } from './utils/strings'
import type { Option } from './codex/option'

let story: Story

Alpine.data('appState', () => ({
  title: '',
  section: {
    id: '',
    title: 'Loading...',
    text: 'Please wait while the story loads...',
    options: new Map<string, Option>(),
  },
  globals: {
    equip: {},
    consumables: {},
  } as Record<string, unknown>,

  loaded: false,
  sheetVisible: true,
  notifyMsg: '',
  confirmMsg: '',
  _confirmResolve: null as ((result: boolean) => void) | null,

  // =====================================================================
  // Application initialization & entry point
  // =====================================================================
  async init() {
    // first segment of URL is story name (without .yaml or path prefix)
    const storyName = window.location.pathname.split('/')[1] || 'main'
    story = await Story.parse(`stories/${storyName}.yaml`)

    // Find anchor in URL and go there if present
    let startSectionId = 'start'
    const anchor = window.location.hash.slice(1)
    if (anchor) {
      startSectionId = anchor
    }

    if (startSectionId === 'start') {
      localStorage.removeItem('codex_globals')
    }

    this.title = story.title
    document.title = this.title
    console.log('Loaded story:', story.title)

    this.gotoSection(startSectionId)
    this.loaded = true

    // Load global state from localStorage if present
    const savedGlobals = localStorage.getItem('codex_globals')
    if (savedGlobals && startSectionId !== 'start') {
      const saved = JSON.parse(savedGlobals) as Record<string, unknown>
      story.setGlobal('skill', saved['skill'] as number)
      story.setGlobal('stamina', saved['stamina'] as number)
      story.setGlobal('luck', saved['luck'] as number)
      story.setGlobal('skill_init', saved['skill_init'] as number)
      story.setGlobal('stamina_init', saved['stamina_init'] as number)
      story.setGlobal('luck_init', saved['luck_init'] as number)
      story.setGlobal('meals', saved['meals'] as number)
      story.setGlobal('equip', saved['equip'] as string[])
      story.setGlobal('consumables', saved['consumables'] as string[])
      story.setGlobal('player_name', saved['player_name'] as string)

      this.globals = saved
      console.log('Loaded saved global state from localStorage')
    }

    // Watch for global state changes
    this.$watch('globals', (newGlobals) => {
      localStorage.setItem('codex_globals', JSON.stringify(newGlobals))
    })
  },

  // =====================================================================
  // Called to navigate to a different section, main state update point
  // =====================================================================
  gotoSection(sectionId: string) {
    const section = story.getSection(sectionId)
    if (!section) {
      console.error('Section not found:', sectionId)
      return
    }

    section.visit()
    const g = story.getGlobals()
    this.globals = g

    this.section = {
      id: section.id,
      title: niceify(section.id),
      text: newlineToBr(section.text),
      options: section.options,
    }

    console.log('Navigated to section:', sectionId)

    // Update URL hash without reloading page
    window.history.replaceState(null, '', `#${sectionId}`)
  },

  // =====================================================================
  // Handle when an option is selected by the user
  // =====================================================================
  async takeOption(option: Option) {
    const result = option.execute()

    if (result.confirmMsg) {
      await this.confirm(result.confirmMsg)
    }

    if (result.nextSectionId) {
      this.gotoSection(result.nextSectionId)
    }

    if (result.notifyMsg) {
      this.notify(result.notifyMsg)
    }
  },

  // =====================================================================
  // Handle using an item from the character sheet
  // =====================================================================
  async useItem(itemId: string): Promise<void> {
    const res = await this.confirm(`Are you sure you want to use the ${niceify(itemId)}?`)
    if (!res) {
      return
    }

    const message = story.trigger('use_item', itemId)

    this.globals = story.getGlobals()
    this.notify(message)
  },

  // ============ UI HELPERS ==================================================

  notify(message: string) {
    this.notifyMsg = newlineToBr(message)
    ;(this.$refs.notifyDialog as HTMLDialogElement).showModal()
  },

  confirm(message: string): Promise<boolean> {
    this.confirmMsg = newlineToBr(message)
    return new Promise((resolve) => {
      this._confirmResolve = resolve
      ;(this.$refs.confirmDialog as HTMLDialogElement).showModal()
    })
  },

  confirmResult(confirmed: boolean) {
    ;(this.$refs.confirmDialog as HTMLDialogElement).close()
    if (this._confirmResolve) {
      this._confirmResolve(confirmed)
      this._confirmResolve = null
    }
  },

  niceify: niceify,
}))

Alpine.start()
