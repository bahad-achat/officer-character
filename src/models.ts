import { Settings } from "./pages/SettingsPage"

export interface OCDocument {
  type: string
  modificationDate: string

  title?: string
  secretness?: string
  date?: string
  afterSunset?: boolean
  to?: string[]
  da?: string[]
  forCivillians?: boolean
  parameters?: Record<string, any>
  settings?: Settings
  overrideSettings?: boolean
}

export interface OCDocuments {
  [documentName: string]: OCDocument
}

export interface OCPracticeInfo {
  remainingQuestionIndices: number[]
  // Whether to automatically restart practicing
  autoRestart?: boolean
}

export interface OCQuestionStatistics {
  success?: number
  fail?: number
}

export interface OCPracticeStatistics {
  streak?: number
  questionStatistics?: Record<number, OCQuestionStatistics>
}

export interface OCSessionStatistics {
  startDate?: string
  endDate?: string
  mistakes?: Record<number, number[]>
  correct?: number[]
}
