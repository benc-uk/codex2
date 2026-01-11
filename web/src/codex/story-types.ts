// ============================================================================
// Codex - Interactive Storytelling Platform
// Copyright (C) 2025 Ben Coleman, Licensed under the MIT License
// story-types.ts - TypeScript interfaces for story YAML structure and parsing
// ============================================================================

// Define TypeScript interfaces for the story YAML structure

// Main story YAML structure
export interface StoryYAML {
  title: string
  author?: string
  version?: string
  vars?: Record<string, number | string | boolean | string[]>
  events?: Record<string, StoryEvent>
  hooks?: Record<string, StoryHook>
  init?: string
  sections: Record<string, SectionYAML>
}

// Event handler structure
export interface StoryEvent {
  params?: string[]
  run: string
}

// Hook structure
export interface StoryHook {
  run: string
}

// Section structure which can contain options
export interface SectionYAML {
  title: string
  text: string
  vars?: Record<string, number | string | boolean | string[]>
  run?: string
  options: Record<string, OptionYAML>
}

/**
 * Option can be either:
 * - A full object with text, goto, if, run, notify, confirm, flags
 * - A shorthand array [text, goto]
 */
export type OptionYAML =
  | {
      text: string
      goto: string
      if?: string
      run?: string
      notify?: string
      confirm?: string
      flags?: string[]
      hidden?: boolean
    }
  | [string, string] // [text, goto]
