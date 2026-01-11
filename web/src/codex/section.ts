import { Option } from './option'
import { LuaVM, Story } from './story'

export class Section {
  public readonly id: string
  private _text: string
  private _title: string
  private _options: Map<string, Option>
  private runCode: string | null = null
  private _visits = 0

  public get options(): Map<string, Option> {
    const availOptions = new Map<string, Option>()

    for (const [id, option] of this._options) {
      if (option.isAvailable(this)) {
        availOptions.set(id, option)
      }
    }

    return availOptions
  }

  public get title(): string {
    return this._title || this.id
  }

  public get visits(): number {
    return this._visits
  }

  private constructor(id: string, title: string, content: string) {
    this.id = id
    this._title = title
    this._text = content
    this._options = new Map<string, Option>()
  }

  public get text(): string {
    return Story.replaceVars(this._text)
  }

  static parse(id: string, data: any): Section {
    const sect = new Section(id, data.title, data.text)

    // Parse options
    for (const optionId in data.options) {
      const optionData = data.options[optionId]
      const option = Option.parse(optionId, optionData, id)
      sect._options.set(optionId, option)
    }

    // Parse run code
    if (data.run) {
      sect.runCode = data.run
    }

    // Parse vars if any into section specific table
    LuaVM.DoString(`__s_${id} = {}`)
    if (data.vars) {
      const varsCode = Object.entries(data.vars)
        .map(([key, value]) => {
          const v = JSON.stringify(value)
          // Handle arrays as Lua tables
          if (v.startsWith('[')) {
            return `__s_${id}.${key} = { ${v.slice(1, -1)} }`
          }
          return `__s_${id}.${key} = ${v}`
        })
        .join('\n')

      LuaVM.DoString(varsCode)
    }

    return sect
  }

  public visit(): void {
    this._visits += 1

    // temp is reset before each section run to avoid leftover state
    // The s table is a ref to the section specific var table, which persists
    const code = `
      temp = {}
      s = __s_${this.id} or {}
      s.visits = ${this._visits}
      ${this.runCode || ''}
    `

    LuaVM.DoString(code)
  }
}
