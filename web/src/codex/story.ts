// ===================================================================================
// Codex - Interactive Storytelling Platform
// Copyright (C) 2025 Ben Coleman, Licensed under the MIT License
// story.ts - The Story class is the core of the engine and interface with outside
// ===================================================================================

import { Section } from './section'
import { parse } from 'yaml'

import { initLua, type BasicType } from '../lua/lua'
import type { StoryYAML } from './story-types'

export const LuaVM = await initLua()

export class Story {
  private sections: Map<string, Section>
  public readonly vars: string[] = []
  public readonly title: string
  public readonly events: Set<string>

  private constructor(title: string) {
    this.title = title
    this.sections = new Map<string, Section>()
    this.events = new Set<string>()
  }

  // =================================================================================
  // Get a section by its ID
  // =================================================================================
  getSection(id: string): Section | undefined {
    return this.sections.get(id)
  }

  // =================================================================================
  // Get the current global state as a key-value map
  // =================================================================================
  getState(): Record<string, unknown> {
    const state: Record<string, unknown> = {}

    for (const varName of this.vars) {
      const value = LuaVM.GetGlobal(varName)
      state[varName] = value
    }

    return state
  }

  // =================================================================================
  // Set the global state from a key-value map
  // =================================================================================
  setState(newState: Record<string, unknown>): void {
    for (const varName of this.vars) {
      if (Object.hasOwn(newState, varName)) {
        const value = newState[varName]
        let luaValue: string

        if (Array.isArray(value)) {
          // Convert array to Lua table
          luaValue = `{ ${value.map((v) => JSON.stringify(v)).join(', ')} }`
        } else {
          luaValue = JSON.stringify(value)
        }

        LuaVM.DoString(`${varName} = ${luaValue}`)
      }
    }
  }

  // =================================================================================
  // Trigger an event by its ID, passing any arguments to the Lua handler
  // =================================================================================
  trigger(eventId: string, ...args: BasicType[]): string {
    if (!this.events.has(eventId)) {
      console.warn(`Event trigger failed: no handler for ${eventId} found in story`)
      return `Unable to trigger event: ${eventId}`
    }

    return LuaVM.CallFunction(`event_${eventId}`, ...args) as string
  }

  // =================================================================================
  // Parse a story from a YAML file at the given URL
  // =================================================================================
  static async parse(url: string): Promise<Story> {
    if (Object.keys(LuaVM).length === 0) {
      console.error('Lua VM not initialized')
      return Promise.reject(new Error('Lua VM not initialized'))
    }

    const res = await fetch(url)
    const text = await res.text()
    console.log('Fetched story file from', url, 'with content length:', text.length)

    const data = parse(text, { merge: true }) as StoryYAML

    const story = new Story(data.title || 'Untitled Story')

    // Parse global variables
    if (data.vars) {
      const varsCode = Object.entries(data.vars)
        .map(([key, value]) => {
          story.vars.push(key)
          const v = JSON.stringify(value)

          // Handle arrays as Lua tables
          if (v.startsWith('[')) {
            return `${key} = { ${v.slice(1, -1)} }`
          }

          return `${key} = ${v}`
        })
        .join('\n')

      LuaVM.DoString(varsCode)
    }

    // Initialize helper functions in Lua VM
    const luaInit = `
      function dice(count, sides, modifier)
        local total = 0
        for i = 1, count do
          total = total + math.floor(math.random(sides))
        end
        return total + modifier
      end 

      function d(sides)
        return dice(1, sides, 0)
      end

      function contains(container, item)
        for _, v in pairs(container) do
          if v == item then
            return true
          end
        end
        return false
      end

      function insert(container, item)
        table.insert(container, item)
      end

      function remove(container, item)
        for i, v in pairs(container) do
          if v == item then
            table.remove(container, i)
            return true
          end
        end
        return false
      end

      function remove_all(container, item)
        local i = 1
        while i <= #container do
          if container[i] == item then
            table.remove(container, i)
          else
            i = i + 1
          end
        end
      end

      function count(container, item)
        local count = 0
        for _, v in pairs(container) do
          if v == item then
            count = count + 1
          end
        end
        return count
      end

      temp = {}
      goto_section = nil
    `
    LuaVM.DoString(luaInit)

    // Parse story init code
    const initCode = data.init as string
    LuaVM.DoString(initCode)

    // Parse event handlers
    if (data.events) {
      for (const eventId in data.events) {
        const event = data.events[eventId]
        const params = event.params || []
        const runCode = event.run || ''

        const funcCode = `function event_${eventId}(${params.join(', ')})
                            ${runCode}
                          end`
        LuaVM.DoString(funcCode)
        story.events.add(eventId)
      }
    }

    // Parse hooks
    if (data.hooks) {
      for (const hookId in data.hooks) {
        const hook = data.hooks[hookId]
        const runCode = hook.run || ''

        const funcCode = `function hook_${hookId}()
                            ${runCode}
                          end`
        LuaVM.DoString(funcCode)
      }
    }

    // Parse sections
    const sections = new Map<string, Section>()
    for (const key in data.sections) {
      const section = Section.parse(key, data.sections[key])
      sections.set(section.id, section)
    }

    story.sections = sections
    return story
  }

  // =================================================================================
  // Replace variables in the given text using Lua evaluation
  // =================================================================================
  static replaceVars(text: string): string {
    return text.replace(/{(.*?)}/g, (_, expr) => {
      try {
        const result = LuaVM.DoString('return ' + expr)
        if (result instanceof Error) {
          console.error('Error evaluating expression:', expr, result)
          return ''
        }

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return result !== undefined ? result!.toString() : ''
      } catch (e) {
        console.error('Error evaluating expression:', expr, e)
        return ''
      }
    })
  }
}
