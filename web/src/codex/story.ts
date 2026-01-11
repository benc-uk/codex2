import { Section } from './section'
import { parse } from 'yaml'

import { initLua } from '../lua/lua'

export const LuaVM = await initLua()

export class Story {
  private sections: Map<string, Section>
  public readonly title: string

  constructor(title: string) {
    this.title = title
    this.sections = new Map<string, Section>()
  }

  getSection(id: string): Section | undefined {
    return this.sections.get(id)
  }

  getGlobals(): Record<string, any> {
    const globals: Record<string, any> = {}
    const luaGlobals = LuaVM.GetAllGlobals()

    for (const [key, value] of Object.entries(luaGlobals)) {
      if (
        key.startsWith('__s_') ||
        typeof value === 'undefined' ||
        key === 'math' ||
        key === 'os' ||
        key === 'string' ||
        key === 'table' ||
        key === 'debug' ||
        key === 'io' ||
        key === 'package' ||
        key === 'channel' ||
        key === 'coroutine'
      ) {
        continue
      }

      globals[key] = luaGlobals[key]
    }

    return globals
  }

  trigger(eventId: string, ...args: any[]): string {
    // Check if event function exists
    const eventFunc = LuaVM.GetGlobal(`event_${eventId}`)
    if (typeof eventFunc !== 'function') {
      console.warn('No event handler for:', eventId)
      return 'Event trigger failed: handler not found.'
    }

    return LuaVM.CallFunction(`event_${eventId}`, ...args)
  }

  static async parse(url: string): Promise<Story> {
    if (Object.keys(LuaVM).length === 0) {
      console.error('Lua VM not initialized')
      return Promise.reject('Lua VM not initialized')
    }

    const res = await fetch(url)
    const text = await res.text()
    console.log('Fetched story file from', url, 'with content length:', text.length)

    const data = parse(text, { merge: true }) as any

    if (data.vars) {
      const varsCode = Object.entries(data.vars)
        .map(([key, value]) => {
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

    const luaInit = `
      function dice(count, sides, modifier)
        local total = 0
        for i = 1, count do
          total = total + math.floor(math.random(1, sides+1))
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

    // Parse init
    const initCode = data.init as string
    LuaVM.DoString(initCode)

    // Parse event handlers
    if (data.events) {
      for (const eventId in data.events) {
        const eventData = data.events[eventId]
        const params = eventData.params || []
        const runCode = eventData.run || ''

        const funcCode = `function event_${eventId}(${params.join(', ')})
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

    const story = new Story(data.title || 'Untitled Story')
    story.sections = sections
    return story
  }

  // Replace {varname} placeholders in text with section/story data
  static replaceVars(text: string): string {
    return text.replace(/{(.*?)}/g, (_, expr) => {
      try {
        const result = LuaVM.DoString('return ' + expr)
        return result !== undefined ? result.toString() : ''
      } catch (e) {
        console.error('Error evaluating expression:', expr, e)
        return ''
      }
    })
  }
}
