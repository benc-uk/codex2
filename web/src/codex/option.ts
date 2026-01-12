// ================================================================================================
// Codex - Interactive Storytelling Platform
// Copyright (C) 2025 Ben Coleman, Licensed under the MIT License
// option.ts - Options represent choices users can make, and drive the story flow & overall state
// ================================================================================================

import type { Section } from './section'
import { LuaVM, Story } from './story'
import type { OptionYAML } from './story-types'

export interface Result {
  nextSectionId: string | undefined
  notifyMsg: string | null
  confirmMsg: string | null // Not yet implemented
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

  // Getters...

  public get text(): string {
    return Story.replaceVars(this._text)
  }

  // Private constructor used by static parse method
  private constructor(id: string, text: string, target: string) {
    this.id = id
    this._text = text
    this.target = target
  }

  // ==================================================================================
  // Parse an Option from YAML data
  // ==================================================================================
  static parse(id: string, data: OptionYAML, sectionId: string): Option {
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

  // ==================================================================================
  // Determine if this option is available to the user based on its condition and flags
  // ==================================================================================
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

    return result as boolean
  }

  // ==================================================================================
  // Execute the option's run code and return result, typically a section to move to
  // ==================================================================================
  public execute(): Result {
    // Execute option run code if any
    if (this.runCode) {
      const res = LuaVM.DoString(this.runCode)
      if (res instanceof Error) {
        console.error('Error executing option run code:', res)
      }
    }

    // Call post option hook if defined
    LuaVM.DoString(`if type(hook_post_option) == "function" then hook_post_option() end`)

    // Handle 'once' flag to hide option after use
    if (this.flags.has('once')) {
      this.hidden = true
    }

    // Determine target section, allowing Lua to override via goto_section global
    let target = this.target
    const gotoSection = LuaVM.GetGlobal('goto_section')
    if (gotoSection && target !== 'restart') {
      target = gotoSection as string
    }

    return {
      nextSectionId: target,
      notifyMsg: Story.replaceVars(this.notify || ''),
      confirmMsg: null,
    }
  }
}
