export type FeedbackType = 'correct' | 'partial' | 'wrong' | 'higher' | 'lower'

export interface AttributeConfig {
  key:         string
  label:       string
  type:        'string' | 'boolean' | 'number' | 'enum'
  compareMode: 'exact' | 'partial' | 'arrow'
  icon?:       string
}

export interface AttributeFeedback {
  key:      string
  label:    string
  value:    string | number | boolean
  feedback: FeedbackType
}

export interface ModeConfig {
  slug:        string
  label:       string
  maxAttempts: number | null
  lives?:      number
  attributes?: AttributeConfig[]
}

export interface DailyChallenge {
  id:           number
  themeId:      number
  mode:         string
  date:         string
  characterId?: number
  name:         string
  imageUrl?:    string
  attributes:   Record<string, unknown>
  extra:        Record<string, unknown>
}

export interface GameSession {
  id:               number
  userId:           string
  dailyChallengeId: number
  attempts:         number
  hintsUsed:        number
  won:              boolean
  score:            number
  startedAt:        string
  completedAt?:     string
}

export interface Universe {
  slug:  string
  name:  string
  icon:  string
  color: string
  type:  'character' | 'game' | 'code'
  modes: string[]
}
