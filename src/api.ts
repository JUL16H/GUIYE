import { ref } from 'vue'
export const questionBusy = ref(false)
import { listen } from '@tauri-apps/api/event'
import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Project, Result, Settings, Workspace } from './types'
export const desktop = isTauri()
const storageKey = 'guiye.workspace.v1'
export async function loadWorkspace(): Promise<Workspace | null> {
  if (desktop) return invoke('load_workspace')
  const saved = localStorage.getItem(storageKey)
  return saved ? JSON.parse(saved) : null
}
export async function saveWorkspace(workspace: Workspace) {
  if (desktop) await invoke('save_workspace', { workspace })
  else localStorage.setItem(storageKey, JSON.stringify(workspace))
}
export async function organize(
  project: Project,
  settings: Settings,
  onProgress?: (message: string) => void,
): Promise<Result> {
  if (!desktop)
    throw new Error(
      'AI 整理需要桌面版。请运行 npm run tauri dev；浏览器预览可体验项目、素材与笔记功能。',
    )
  let unlisten: (() => void) | undefined
  try {
    unlisten = await listen<string>('organize-progress', (event) => onProgress?.(event.payload))
  } catch {
    /* IPC test harnesses may not implement events. */
  }
  try {
    return await invoke('organize', {
      projectId: project.id,
      request: {
        title: project.title,
        sources: project.sources,
        previous: project.result,
        settings,
      },
    })
  } finally {
    unlisten?.()
  }
}
export async function testConnection(settings: Settings): Promise<string> {
  if (!desktop) throw new Error('请在桌面版中测试模型连接。')
  return invoke('test_connection', { settings })
}
export async function download(
  name: string,
  content: string,
  mime = 'text/markdown;charset=utf-8',
) {
  if (desktop) return invoke<string>('export_document', { name, content })
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

export async function askQuestion(
  project: Project,
  settings: Settings,
  question: string,
  noteId?: string,
): Promise<import('./types').Answer> {
  if (!desktop) throw new Error('知识问答需要在 Tauri 桌面版中运行。')
  if (questionBusy.value) throw new Error('请等待当前回答完成。')
  questionBusy.value = true
  try {
    return await invoke('ask_question', {
      request: {
        question,
        sources: project.sources,
        knowledge: project.result,
        history: (project.messages ?? []).slice(-12),
        noteId: noteId || null,
        settings,
      },
    })
  } finally {
    questionBusy.value = false
  }
}

export async function rebuildGraph(project: Project, settings: Settings): Promise<Result> {
  if (!desktop) throw new Error('重建图谱层级需要桌面版。')
  return invoke('rebuild_graph', {
    request: { title: project.title, sources: project.sources, previous: project.result, settings },
  })
}
