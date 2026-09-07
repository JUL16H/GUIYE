export interface Source {
  id: string
  title: string
  content: string
  kind: string
  createdAt: string
}
export interface KnowledgeNode {
  pointIds?: string[]
  id: string
  label: string
  summary: string
  parentId: string | null
  sourceIds: string[]
  status: 'original' | 'corrected' | 'supplemented'
}
export interface Relation {
  from: string
  to: string
  label: string
}
export interface Note {
  id: string
  title: string
  content: string
  nodeIds: string[]
  sourceIds: string[]
}
export interface Result {
  extractionVersion?: number
  knowledgePoints?: KnowledgePoint[]
  sourceFingerprints?: Record<string, string>
  nodes: KnowledgeNode[]
  relations: Relation[]
  notes: Note[]
  changes: string[]
}
export interface Project {
  messages?: ChatMessage[]
  id: string
  title: string
  description: string
  color: string
  sources: Source[]
  result: Result | null
  updatedAt: string
  organizedAt?: string
}
export interface Settings {
  baseUrl: string
  model: string
  apiKey: string
  prompt: string
  correct: boolean
  supplement: boolean
}
export interface Workspace {
  projects: Project[]
  activeId: string
  settings: Omit<Settings, 'apiKey'>
}
export const uid = () => crypto.randomUUID()

export interface KnowledgePoint {
  manual?: boolean
  status?: string
  originalDetail?: string
  originalLabel?: string
  id: string
  label: string
  detail: string
  sourceIds: string[]
  evidence: { sourceId: string; quote: string }[]
}
export interface Answer {
  answer: string
  sourceIds: string[]
  nodeIds: string[]
  noteIds: string[]
}
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  references?: Answer
  createdAt: string
}
