export type PinnedItem = {
  key: string
  type: 'project' | 'insight'
  id: string
  title: string
  subtitle: string
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
  fontFamily: 'Inter' | 'Roboto Slab' | 'JetBrains Mono'
  fontSize: number
  valueFontSize: number
  barThickness: number
  classChartHeight: number
  genderChartHeight: number
}
