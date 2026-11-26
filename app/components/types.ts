/**
 * Purpose
 * Provide the types logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
import type { V1Presentation } from './database-redesign/aiResultPresentation'

export type PinnedItem = {
  key: string
  type: 'project' | 'insight' | 'ai'
  id: string
  title: string
  subtitle: string
  snapshot?: V1Presentation
}

export type ColorPalette = {
  background: string
  card: string
  foreground: string
  primary: string
  secondary: string
  mutedForeground: string
  accent: string
  border: string
  navigationBackground: string
  navigationText: string
  navigationActive: string
  chartText: string
  chartGrid: string
  classChart: string
  majorChart: string
  genderChart: string
  genderChartSecondary: string
  raceChart: string
}

export type ThemePalettes = {
  light: ColorPalette
  dark: ColorPalette
}

export type GraphDisplaySettings = {
  fontFamily:
    | 'Inter'
    | 'Roboto Slab'
    | 'JetBrains Mono'
    | 'Arial'
    | 'Verdana'
    | 'Tahoma'
    | 'Trebuchet MS'
    | 'Segoe UI'
    | 'Calibri'
    | 'Candara'
    | 'Corbel'
    | 'Georgia'
    | 'Cambria'
    | 'Constantia'
    | 'Times New Roman'
    | 'Palatino Linotype'
    | 'Consolas'
    | 'Courier New'
  fontSize: number
  valueFontSize: number
  barThickness: number
  classChartHeight: number
  genderChartHeight: number
}
