import './style.css'

import Alpine from 'alpinejs'
import { Story } from './codex/story'
import type { Option } from './codex/option'

let story: Story = null!

Alpine.data('appState', () => ({
  title: '',
  section: {
    id: '',
    title: 'Loading...',
    text: 'Please wait while the story loads...',
    options: new Map<string, Option>(),
  },
  globals: {} as Record<string, any>,

  loaded: false,
  sheetVisible: false,
  notifyMsg: '',
  confirmMsg: '',
  _confirmResolve: null as ((result: boolean) => void) | null,

  async init() {
    story = await Story.parse('stories/cave.yaml')
    this.title = story.title
    document.title = this.title
    console.log('Loaded story:', story.title)

    this.gotoSection('start')
  },

  gotoSection(sectionId: string) {
    const section = story.getSection(sectionId)
    if (!section) {
      console.error('Section not found:', sectionId)
      return
    }

    section.visit()
    this.globals = story.getGlobals()

    this.section = {
      id: section.id,
      title: niceify(section.id),
      text: newlineToBr(section.text),
      options: section.options,
    }

    console.log('Navigated to section:', sectionId)
  },

  async takeOption(option: Option) {
    const result = option.execute()

    if (result.confirmMsg) {
      const res = await this.confirm(result.confirmMsg)
      console.log('Confirmation result:', res)
    }

    if (result.newSectionId) {
      this.gotoSection(result.newSectionId)
    }

    if (result.notifyMsg) {
      this.notify(result.notifyMsg)
    }
  },

  async useItem(itemId: string): Promise<void> {
    const res = await this.confirm(`Are you sure you want to use the ${niceify(itemId)}?`)
    if (!res) {
      return
    }

    const message = story.trigger('use_item', itemId)

    this.globals = story.getGlobals()
    this.notify(message)
  },

  async notify(message: string): Promise<void> {
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

  niceify(id: string): string {
    return niceify(id)
  },
}))

function newlineToBr(text: string): string {
  return text.replace(/\n/g, '<br/>')
}

// Utility function to create a readable title from a section ID.
function niceify(id: string): string {
  return id
    .split('_')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

Alpine.start()
