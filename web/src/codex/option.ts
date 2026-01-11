import type { Section } from './section'
import { LuaVM, Story } from './story'

export interface Result {
  newSectionId: string | undefined
  notifyMsg: string | null
  confirmMsg: string | null
}

export class Option {
  public readonly id: string
  private _text: string
  public readonly target: string
  private conditionCode: string | null = null
  private runCode: string | null = null
  private hidden: boolean = false
  private flags: Set<string> = new Set()
  private notify: string | null = null

  private constructor(id: string, text: string, target: string) {
    this.id = id
    this._text = text
    this.target = target
  }

  public get text(): string {
    return Story.replaceVars(this._text)
  }

  static parse(id: string, data: any, sectionId: string): Option {
    // Option can be in short form [text, goto]
    if (Array.isArray(data)) {
      return new Option(id, data[0], data[1])
    }

    // Handle long form...

    // Some shorthand for goto
    let goto = data.goto || sectionId
    if (goto === 'self') {
      goto = sectionId // 'self' means the same section
    }

    const opt = new Option(id, data.text, goto)

    // Optional properties
    opt.conditionCode = data.if || null
    opt.runCode = data.run || null
    opt.hidden = data.hidden || false
    opt.notify = data.notify || null

    // Flags (as a set for easy lookup)
    if (Array.isArray(data.flags)) {
      for (const flag of data.flags) {
        opt.flags.add(flag)
      }
    }

    return opt
  }

  public isAvailable(section: Section): boolean {
    if (this.hidden) {
      return false
    }

    if (this.flags.has('first')) {
      if (section.visits != 1) {
        return false
      }
    }

    if (this.flags.has('not_first')) {
      if (section.visits == 1) {
        return false
      }
    }

    if (!this.conditionCode) {
      return true
    }

    // Evaluate condition in Lua VM
    const result = LuaVM.DoString('return ' + this.conditionCode)
    if (result instanceof Error) {
      console.error('Error evaluating option condition:', result)
      return false
    }

    return result
  }

  public execute(): Result {
    if (this.runCode) {
      const res = LuaVM.DoString(this.runCode)
      if (res instanceof Error) {
        console.error('Error executing option run code:', res)
      }
    }

    LuaVM.DoString(`if type(post_option) == "function" then post_option() end`)

    if (this.flags.has('once')) {
      this.hidden = true
    }

    let target = this.target
    const gotoSection = LuaVM.GetGlobal('goto_section')
    if (gotoSection) {
      target = gotoSection
    }

    console.log('Navigating to section:', target)

    return {
      newSectionId: target,
      notifyMsg: Story.replaceVars(this.notify || ''),
      confirmMsg: null,
    }
  }
}
