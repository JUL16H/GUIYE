<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch, nextTick } from 'vue'
import {
  BookOpen,
  Plus,
  Search,
  Settings2,
  ArrowUpRight,
  ChevronRight,
  FolderOpen,
  FileText,
  Sparkles,
  Upload,
  X,
  Check,
  MoreHorizontal,
  ArrowRight,
  Download,
  Pencil,
  Trash2,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Info,
  LayoutDashboard,
  Layers3,
  Clock3,
  CircleHelp,
  MessageSquare,
  Network,
  HardDrive,
  List,
} from 'lucide-vue-next'
import KnowledgeGraph from './components/KnowledgeGraph.vue'
import KnowledgeChat from './components/KnowledgeChat.vue'
import ModelSettings from './components/ModelSettings.vue'
import { demoProject } from './demo'
import {
  uid,
  type Project,
  type Source,
  type Settings,
  type Workspace,
  type Result,
  type KnowledgePoint,
} from './types'
import {
  desktop,
  download,
  loadWorkspace,
  saveWorkspace,
  organize,
  rebuildGraph,
  testConnection,
} from './api'
import { renderMarkdown } from './markdown'
const defaults: Settings = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: '',
  prompt:
    '使用简体中文，以适合自学的顺序组织知识。数学公式使用 LaTeX，并清楚区分定义、结论和例子。',
  correct: false,
  supplement: false,
}
const projects = ref<Project[]>([])
const activeId = ref('')
const settings = reactive<Settings>({ ...defaults })
const project = computed(() => projects.value.find((p) => p.id === activeId.value)!)
type Page = 'overview' | 'sources' | 'graph' | 'notes' | 'settings' | 'knowledge' | 'chat'
const page = ref<Page>('overview')
const pageLabels: Record<Page, string> = {
  overview: '项目概览',
  sources: '素材',
  graph: '知识图谱',
  notes: '知识文档',
  knowledge: '知识点',
  chat: '知识问答',
  settings: '模型设置',
}
const navItems = [
  { id: 'overview', label: '项目概览', icon: LayoutDashboard },
  { id: 'sources', label: '素材', icon: Layers3 },
  { id: 'graph', label: '知识图谱', icon: Network },
  { id: 'knowledge', label: '知识点', icon: List },
  { id: 'notes', label: '知识文档', icon: BookOpen },
  { id: 'chat', label: '知识问答', icon: MessageSquare },
] as const
function navigate(to: Page) {
  page.value = to
  projectMenu.value = false
  window.location.hash = to
}
const sourceFilter = ref('all')
const selectedNodeId = ref('n2')
const selectedNoteId = ref('note1')
const selectedNode = computed(() =>
  project.value?.result?.nodes.find((n) => n.id === selectedNodeId.value),
)
const selectedNote = computed(
  () =>
    project.value?.result?.notes.find((n) => n.id === selectedNoteId.value) ??
    project.value?.result?.notes[0],
)
const relatedNotes = computed(
  () => project.value?.result?.notes.filter((n) => n.nodeIds.includes(selectedNodeId.value)) ?? [],
)
const query = ref('')
const filteredProjects = computed(() =>
  projects.value.filter((p) => p.title.toLowerCase().includes(query.value.toLowerCase())),
)
const sourceQuery = ref('')
const sources = computed(() =>
  (project.value?.sources ?? []).filter(
    (s) =>
      (sourceFilter.value === 'all' ||
        (sourceFilter.value === 'text' ? s.kind === 'text' : s.kind !== 'text')) &&
      (s.title + s.content).toLowerCase().includes(sourceQuery.value.toLowerCase()),
  ),
)
function isProcessed(source: Source) {
  if (project.value?.result?.extractionVersion !== 2) return false
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(source.title + '\0' + source.content)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return (
    project.value?.result?.sourceFingerprints?.[source.id] === hash.toString(16).padStart(16, '0')
  )
}
const pendingSources = computed(
  () => (project.value?.sources ?? []).filter((s) => !isProcessed(s)).length,
)
const sourcePage = ref(1)
const sourcePages = computed(() => Math.max(1, Math.ceil(sources.value.length / 12)))
const pagedSources = computed(() =>
  sources.value.slice((sourcePage.value - 1) * 12, sourcePage.value * 12),
)
watch([sourceQuery, sourceFilter, activeId], () => {
  sourcePage.value = 1
})
watch(sourcePages, (count) => {
  sourcePage.value = Math.min(sourcePage.value, count)
})
const rightOpen = ref(true)
const modal = ref<
  '' | 'project' | 'settings' | 'source' | 'delete' | 'reorganize' | 'about' | 'capture' | 'point'
>('')
const deleteName = ref('')
const deleteTarget = ref<{ projectId: string; sourceId?: string; sourceIds?: string[] } | null>(
  null,
)
const deletionProject = computed(() =>
  projects.value.find((p) => p.id === deleteTarget.value?.projectId),
)
const newTitle = ref('')
const newDescription = ref('')
const editingProject = ref(false)
const draft = ref('')
const sourceTitle = ref('')
const sourceContent = ref('')
const sourceId = ref('')
const editingNote = ref(false)
const noteDraft = ref('')
const progress = ref('')
const pointQuery = ref('')
const knowledgePoints = computed(() =>
  (project.value?.result?.knowledgePoints ?? []).filter((p) =>
    (p.label + p.detail).toLowerCase().includes(pointQuery.value.toLowerCase()),
  ),
)
const pointId = ref('')
const pointTitle = ref('')
const pointDetail = ref('')
const pointProjectId = ref('')
const pointParentId = ref('')
const parentOptions = computed(() => {
  const nodes = projects.value.find((p) => p.id === pointProjectId.value)?.result?.nodes ?? []
  const excluded = new Set(
    nodes.filter((n) => n.pointIds?.includes(pointId.value)).map((n) => n.id),
  )
  let changed = true
  while (changed) {
    changed = false
    for (const n of nodes)
      if (n.parentId && excluded.has(n.parentId) && !excluded.has(n.id)) {
        excluded.add(n.id)
        changed = true
      }
  }
  return nodes
    .filter((n) => !excluded.has(n.id))
    .map((n) => {
      const path = [n.label]
      const seen = new Set([n.id])
      let parent = nodes.find((p) => p.id === n.parentId)
      while (parent && !seen.has(parent.id)) {
        seen.add(parent.id)
        path.unshift(parent.label)
        parent = nodes.find((p) => p.id === parent!.parentId)
      }
      return { id: n.id, label: path.join(' / ') }
    })
})
const hasKnowledge = computed(
  () => !!(project.value?.sources.length || project.value?.result?.knowledgePoints?.length),
)
function editPoint(point?: KnowledgePoint) {
  pointProjectId.value = activeId.value
  pointId.value = point?.id ?? ''
  pointTitle.value = point?.label ?? ''
  pointDetail.value = point?.detail ?? ''
  const nodes = project.value?.result?.nodes ?? []
  const node = nodes.find((n) => n.pointIds?.includes(point?.id ?? ''))
  pointParentId.value = node
    ? (node.parentId ?? '')
    : (nodes.find((n) => n.id === selectedNodeId.value)?.id ??
      nodes.find((n) => !n.parentId)?.id ??
      '')
  modal.value = 'point'
}
function savePoint() {
  const target = projects.value.find((p) => p.id === pointProjectId.value)
  if (!target || !pointTitle.value.trim() || !pointDetail.value.trim()) return
  const result = (target.result ??= {
    knowledgePoints: [],
    nodes: [],
    relations: [],
    notes: [],
    changes: [],
  })
  if (pointParentId.value && !parentOptions.value.some((n) => n.id === pointParentId.value)) {
    error.value = '所选父节点已失效，请重新选择。'
    return
  }
  const points = (result.knowledgePoints ??= [])
  let point = points.find((p) => p.id === pointId.value)
  if (!point) {
    point = { id: uid(), label: '', detail: '', sourceIds: [], evidence: [] }
    points.push(point)
  }
  Object.assign(point, {
    label: pointTitle.value.trim(),
    detail: pointDetail.value.trim(),
    manual: true,
    status: 'original',
    originalDetail: undefined,
    originalLabel: undefined,
  })
  const linked = result.nodes.filter((n) => n.pointIds?.includes(point.id))
  if (!linked.length) {
    result.nodes.push({
      id: uid(),
      label: point.label,
      summary: point.detail,
      parentId: pointParentId.value || null,
      sourceIds: [...point.sourceIds],
      pointIds: [point.id],
      status: 'original',
    })
  } else {
    for (const node of linked) {
      node.parentId = pointParentId.value || null
      const assigned = points.filter((p) => node.pointIds?.includes(p.id))
      if (assigned.length === 1) node.label = point.label
      node.summary = assigned.map((p) => p.detail).join('\n\n')
      node.status = assigned.some((p) => p.status === 'corrected') ? 'corrected' : 'original'
    }
  }
  target.updatedAt = new Date().toISOString()
  modal.value = ''
  if (lastResult.value?.projectId === target.id) lastResult.value = null
  notify('知识点已保存；重新整理可更新知识文档')
}
const questionDraft = ref('')
const questionNoteId = ref('')
function openQuestion(text = '', noteId = '') {
  questionDraft.value = text
  questionNoteId.value = noteId
  navigate('chat')
}
function appendKnowledge(text: string) {
  draft.value = text
  modal.value = 'capture'
}
function openSource(id: string) {
  const source = project.value?.sources.find((s) => s.id === id)
  if (source) editSource(source)
  else notify('该来源已移除')
}
function openNode(id: string) {
  rightOpen.value = true
  selectedNodeId.value = id
  navigate('graph')
}
function openPoint(id: string) {
  const node = project.value?.result?.nodes.find((n) => n.pointIds?.includes(id))
  if (node) openNode(node.id)
}
function loadDemo() {
  if (!projects.value.some((p) => p.id === 'demo')) projects.value.push(demoProject())
  activeId.value = 'demo'
}
function chooseProject() {
  activeId.value = ''
  navigate('overview')
}
const busy = ref(false)
const busyProjectId = ref('')
const checking = ref(false)
const testStatus = ref('')
const saved = ref('已保存到本地')
const ready = ref(false)
const storageBlocked = ref(false)
const toast = ref('')
const error = ref('')
const lastResult = ref<{ projectId: string; result: Result | null; organizedAt?: string } | null>(
  null,
)
const fileInput = ref<HTMLInputElement>()
const projectMenu = ref(false)
let toastTimer: ReturnType<typeof setTimeout>
let saveTimer: ReturnType<typeof setTimeout>
let saveQueue = Promise.resolve()
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 4000)
}
function touch() {
  project.value.updatedAt = new Date().toISOString()
}
function snapshot(): Workspace {
  const { apiKey: _key, ...safeSettings } = settings
  return JSON.parse(
    JSON.stringify({ projects: projects.value, activeId: activeId.value, settings: safeSettings }),
  )
}
function persist() {
  if (!ready.value || storageBlocked.value) return
  const state = snapshot()
  saved.value = '保存中…'
  saveQueue = saveQueue
    .then(() => saveWorkspace(state))
    .then(() => {
      saved.value = '已保存到本地'
    })
    .catch((e) => {
      saved.value = '保存失败'
      error.value = `本地保存失败：${String(e)}`
    })
}
watch(
  [projects, activeId, settings],
  () => {
    if (!ready.value) return
    clearTimeout(saveTimer)
    saved.value = '保存中…'
    saveTimer = setTimeout(persist, 300)
  },
  { deep: true },
)
watch(activeId, () => {
  selectedSourceIds.value = []
  if (!ready.value) return
  selectedNodeId.value = project.value?.result?.nodes[0]?.id ?? ''
  selectedNoteId.value = project.value?.result?.notes[0]?.id ?? ''
  editingNote.value = false
  questionNoteId.value = ''
  questionDraft.value = ''
  sourceQuery.value = ''
  draft.value = ''
  projectMenu.value = false
  navigate('overview')
})
onMounted(async () => {
  const initialPage = window.location.hash.slice(1) as Page
  if (Object.hasOwn(pageLabels, initialPage)) page.value = initialPage
  window.addEventListener('hashchange', syncPage)
  try {
    const state = await loadWorkspace()
    if (state) {
      if (
        !Array.isArray(state.projects) ||
        state.projects.some((p) => !p.id || !p.title || !Array.isArray(p.sources))
      )
        throw new Error('项目文件格式不正确，请备份后检查本地数据文件。')
      projects.value = state.projects
      activeId.value = state.projects.some((p) => p.id === state.activeId) ? state.activeId : ''
      Object.assign(settings, state.settings, { apiKey: '' })
    }
  } catch (e) {
    storageBlocked.value = true
    saved.value = '存储未载入'
    error.value = `无法读取本地数据，已暂停自动保存以保护原文件：${String(e)}`
  } finally {
    await nextTick()
    ready.value = true
  }
  window.addEventListener('keydown', shortcuts)
  window.addEventListener('beforeunload', flush)
})
function syncPage() {
  const target = window.location.hash.slice(1) as Page
  if (Object.hasOwn(pageLabels, target)) page.value = target
}
function formatDate(date?: string) {
  return date
    ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(date))
    : '尚未整理'
}
function preview(content: string) {
  return content
    .replace(/[#*$>]/g, '')
    .split('\n')
    .filter(Boolean)
    .slice(1)
    .join(' ')
    .slice(0, 110)
}
function flush() {
  clearTimeout(saveTimer)
  persist()
}
onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  window.removeEventListener('hashchange', syncPage)
  window.removeEventListener('keydown', shortcuts)
  window.removeEventListener('beforeunload', flush)
  flush()
})
function shortcuts(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    modal.value = ''
    contextMenu.value = null
    projectMenu.value = false
  }
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault()
    navigate('settings')
  }
}
function openProject(edit = false) {
  editingProject.value = edit
  newTitle.value = edit ? project.value.title : ''
  newDescription.value = edit ? project.value.description : ''
  modal.value = 'project'
  projectMenu.value = false
}
function createProject() {
  if (!newTitle.value.trim()) return
  if (editingProject.value) {
    project.value.title = newTitle.value.trim()
    project.value.description = newDescription.value.trim()
    touch()
  } else {
    const p: Project = {
      id: uid(),
      title: newTitle.value.trim(),
      description: newDescription.value.trim(),
      color: ['green', 'purple', 'orange'][projects.value.length % 3]!,
      sources: [],
      result: null,
      updatedAt: new Date().toISOString(),
    }
    projects.value.push(p)
    activeId.value = p.id
  }
  modal.value = ''
  notify(editingProject.value ? '项目已更新' : '项目已创建，添加第一个知识片段吧')
}
function addFragment() {
  if (!draft.value.trim()) return
  project.value.sources.push({
    id: uid(),
    title: draft.value.trim().split('\n')[0]!.slice(0, 28),
    content: draft.value.trim(),
    kind: 'text',
    createdAt: new Date().toISOString(),
  })
  draft.value = ''
  modal.value = ''
  touch()
  notify('片段已添加')
  navigate('sources')
}
async function importFiles(files: FileList | null) {
  if (!files) return
  const target = project.value
  let count = 0
  const failures: string[] = []
  for (const file of Array.from(files)) {
    const kind = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['txt', 'md', 'markdown', 'tex', 'latex', 'csv', 'json'].includes(kind)) {
      failures.push(`${file.name}：不支持此格式`)
      continue
    }
    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      if (!content.trim()) {
        failures.push(`${file.name}：文件为空`)
        continue
      }
      target.sources.push({
        id: uid(),
        title: file.name,
        content,
        kind,
        createdAt: new Date().toISOString(),
      })
      count++
    } catch {
      failures.push(`${file.name}：无法读取，请使用 UTF-8 编码`)
    }
  }
  target.updatedAt = new Date().toISOString()
  if (count) notify(`已导入 ${count} 份文档`)
  if (failures.length) error.value = failures.join('\n')
  if (fileInput.value) fileInput.value.value = ''
}
function editSource(source: Source) {
  sourceId.value = source.id
  sourceTitle.value = source.title
  sourceContent.value = source.content
  modal.value = 'source'
}
function saveSource() {
  if (!sourceTitle.value.trim() || !sourceContent.value.trim()) return
  const source = project.value.sources.find((s) => s.id === sourceId.value)
  if (source) {
    source.title = sourceTitle.value.trim()
    source.content = sourceContent.value
    touch()
  }
  modal.value = ''
  notify('素材已更新，重新整理后可更新知识脉络')
}
function removeSource() {
  deleteTarget.value = { projectId: project.value.id, sourceId: sourceId.value }
  deleteName.value = ''
  modal.value = 'delete'
}
const selectedSourceIds = ref<string[]>([])
const selectedSources = computed(
  () => project.value?.sources.filter((s) => selectedSourceIds.value.includes(s.id)) ?? [],
)
const allSourcesSelected = computed(
  () =>
    sources.value.length > 0 && sources.value.every((s) => selectedSourceIds.value.includes(s.id)),
)
function toggleSources() {
  const visible = new Set(sources.value.map((s) => s.id))
  selectedSourceIds.value = allSourcesSelected.value
    ? selectedSourceIds.value.filter((id) => !visible.has(id))
    : [...new Set([...selectedSourceIds.value, ...visible])]
}
function removeSelectedSources() {
  deleteTarget.value = {
    projectId: project.value.id,
    sourceIds: selectedSources.value.map((s) => s.id),
  }
  modal.value = 'delete'
}
async function organizeSource(source: Source) {
  if (busy.value) return
  await runOrganize([source.id])
}
function requestOrganize() {
  if (!project.value || busy.value) return
  if (!hasKnowledge.value) {
    notify('请先新建知识点或导入素材')
    return
  }
  if (!desktop) {
    error.value = '当前为浏览器预览。AI 整理在 Tauri 桌面版中运行：npm run tauri dev。'
    return
  }
  if (project.value.result && !project.value.result.extractionPending) modal.value = 'reorganize'
  else runOrganize()
}
async function runOrganize(onlySourceIds?: string[], graphOnly = false) {
  if (busy.value || storageBlocked.value) return
  modal.value = ''
  busy.value = true
  progress.value = graphOnly ? '正在分析概念关系并重建图谱层级…' : '正在读取素材并提取知识点…'
  busyProjectId.value = project.value.id
  error.value = ''
  const target = project.value
  const input = JSON.parse(JSON.stringify(target)) as Project
  const originalSources = JSON.stringify(target.sources)
  if (onlySourceIds) {
    // Include only the selected source and sources already in the knowledge base.
    input.sources = input.sources.filter(
      (s) => onlySourceIds.includes(s.id) || input.result?.sourceFingerprints?.[s.id],
    )
  }
  try {
    const result = graphOnly
      ? await rebuildGraph(input, { ...settings })
      : await organize(input, { ...settings }, (message) => {
          progress.value = message
        })
    if (
      JSON.stringify(target.sources) !== originalSources ||
      JSON.stringify(target.result) !== JSON.stringify(input.result)
    ) {
      throw new Error(
        '整理期间素材或文档发生了变化，本次结果未覆盖已有内容。请根据最新内容重新整理。',
      )
    }
    lastResult.value = {
      projectId: target.id,
      result: target.result ? JSON.parse(JSON.stringify(target.result)) : null,
      organizedAt: target.organizedAt,
    }
    const oldNoteIds = new Set(target.result?.notes.map((n) => n.id) ?? [])
    const updatedNotes = result.notes.filter((n) => oldNoteIds.has(n.id)).length
    const newNotes = result.notes.length - updatedNotes
    target.result = result
    if (!graphOnly) target.organizedAt = new Date().toISOString()
    target.updatedAt = new Date().toISOString()
    if (activeId.value === target.id) {
      selectedNodeId.value = result.nodes[0]?.id ?? ''
      if (!result.notes.some((n) => n.id === selectedNoteId.value))
        selectedNoteId.value = result.notes[0]?.id ?? ''
      editingNote.value = false
    }
    notify(
      result.hierarchyPending
        ? '知识内容已保留，图谱层级待继续优化'
        : graphOnly
          ? '图谱层级已重建，知识点与笔记正文已保留'
          : `整理完成：更新 ${updatedNotes} 篇，新建 ${newNotes} 篇，共 ${result.notes.length} 篇知识文档`,
    )
  } catch (e) {
    console.error('我Astra就是个废物, 写出来的代码就是一坨史')
    console.error('[归页][整理异常]', e)
    error.value = String(e)
  } finally {
    busy.value = false
    busyProjectId.value = ''
  }
}
function undoOrganize() {
  if (lastResult.value?.projectId !== project.value.id) return
  project.value.result = lastResult.value.result
  project.value.organizedAt = lastResult.value.organizedAt
  lastResult.value = null
  touch()
  notify('已恢复上一次整理前的内容')
}
async function checkModel() {
  checking.value = true
  testStatus.value = ''
  try {
    testStatus.value = await testConnection({ ...settings })
  } catch (e) {
    testStatus.value = String(e)
  } finally {
    checking.value = false
  }
}
function showNote(id: string) {
  selectedNoteId.value = id
  navigate('notes')
  editingNote.value = false
}
function editNote() {
  noteDraft.value = selectedNote.value?.content ?? ''
  editingNote.value = true
}
function saveNote() {
  if (selectedNote.value) {
    selectedNote.value.content = noteDraft.value
    touch()
    editingNote.value = false
    notify('笔记已保存')
  }
}
async function exportProject() {
  try {
    const destination = await download(
      `${project.value.title}.json`,
      JSON.stringify(project.value, null, 2),
      'application/json',
    )
    projectMenu.value = false
    notify(desktop ? `已导出：${destination}` : '项目已导出，包含素材、图谱与笔记')
  } catch (e) {
    error.value = `导出失败：${String(e)}`
  }
}
async function exportNotes() {
  const notes = project.value.result?.notes ?? []
  if (!notes.length) return
  try {
    const destination = await download(
      `${project.value.title}.md`,
      notes.map((n) => n.content).join('\n\n---\n\n'),
    )
    notify(desktop ? `已导出：${destination}` : '已导出 Markdown 笔记（保留 LaTeX 公式）')
  } catch (e) {
    error.value = `导出失败：${String(e)}`
  }
}
async function exportCurrentNote() {
  if (!selectedNote.value) return
  try {
    const destination = await download(`${selectedNote.value.title}.md`, selectedNote.value.content)
    notify(desktop ? `已导出：${destination}` : '笔记已导出')
  } catch (e) {
    error.value = `导出失败：${String(e)}`
  }
}
function requestDeleteProject(id = activeId.value) {
  deleteTarget.value = { projectId: id }
  deleteName.value = ''
  modal.value = 'delete'
  projectMenu.value = false
}
function deleteProject() {
  const target = deletionProject.value
  const ids =
    deleteTarget.value?.sourceIds ??
    (deleteTarget.value?.sourceId ? [deleteTarget.value.sourceId] : [])
  if (!target || (!ids.length && deleteName.value !== target.title)) return
  if (ids.length) {
    target.sources = target.sources.filter((s) => !ids.includes(s.id))
    selectedSourceIds.value = selectedSourceIds.value.filter((id) => !ids.includes(id))
    target.updatedAt = new Date().toISOString()
    notify('素材已移除，已有知识文档仍保留')
  } else {
    projects.value = projects.value.filter((p) => p.id !== target.id)
    if (activeId.value === target.id) activeId.value = ''
    notify('项目已删除')
  }
  modal.value = ''
  deleteTarget.value = null
}
function sourceName(id: string) {
  return project.value.sources.find((s) => s.id === id)?.title ?? '已移除的素材'
}
const statusLabels = { original: '来自素材', corrected: 'AI 已纠错', supplemented: 'AI 补充' }
type MenuAction = { label: string; run: () => void; danger?: boolean }
const contextMenu = ref<{ x: number; y: number; items: MenuAction[] } | null>(null)
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    notify('已复制')
  } catch {
    notify('无法访问剪贴板，请使用 Ctrl+C')
  }
}
function menuAt(event: MouseEvent, items: MenuAction[]) {
  contextMenu.value = {
    x: Math.min(event.clientX, window.innerWidth - 240),
    y: Math.min(event.clientY, window.innerHeight - items.length * 37 - 20),
    items,
  }
}
function showPointMenu(event: MouseEvent, id: string) {
  const point = project.value?.result?.knowledgePoints?.find((p) => p.id === id)
  if (!point) return
  menuAt(event, [
    { label: '编辑知识点', run: () => editPoint(point) },
    { label: '在图谱中定位', run: () => openPoint(id) },
    { label: '向 AI 追问', run: () => openQuestion(`请详细解释「${point.label}」`) },
    { label: '复制知识点', run: () => copyText(point.label + '\n' + point.detail) },
  ])
}
function showMenu(event: MouseEvent) {
  const el = event.target as Element
  const input = el.closest('textarea,input') as HTMLInputElement | HTMLTextAreaElement | null
  if (input) {
    const start = input.selectionStart ?? 0,
      end = input.selectionEnd ?? 0
    const replace = (text: string) => {
      input.focus()
      input.setSelectionRange(start, end)
      input.setRangeText(text, start, end, 'end')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const items: MenuAction[] = [
      {
        label: '全选',
        run: () => {
          input.focus()
          input.select()
        },
      },
    ]
    if (input.type !== 'password' && end > start) {
      items.unshift({ label: '复制', run: () => copyText(input.value.slice(start, end)) })
      if (!input.readOnly)
        items.push({
          label: '剪切',
          run: async () => {
            try {
              await navigator.clipboard.writeText(input.value.slice(start, end))
              replace('')
            } catch {
              notify('请使用 Ctrl+X 剪切')
            }
          },
        })
    }
    if (!input.readOnly)
      items.push({
        label: '粘贴',
        run: async () => {
          try {
            replace(await navigator.clipboard.readText())
          } catch {
            notify('请使用 Ctrl+V 粘贴')
          }
        },
      })
    menuAt(event, items)
    return
  }
  const source = project.value?.sources.find(
    (s) => s.id === el.closest('[data-source-id]')?.getAttribute('data-source-id'),
  )
  if (source) {
    menuAt(event, [
      { label: '查看 / 编辑素材', run: () => editSource(source) },
      { label: '单独整理进知识库', run: () => organizeSource(source) },
      {
        label: '根据这份素材提问',
        run: () => openQuestion(`请提取并解释素材「${source.title}」中的核心知识。`),
      },
      { label: '复制原文', run: () => copyText(source.content) },
      {
        label: '移除素材',
        danger: true,
        run: () => {
          sourceId.value = source.id
          removeSource()
        },
      },
    ])
    return
  }
  const node = project.value?.result?.nodes.find(
    (n) => n.id === el.closest('[data-node-id]')?.getAttribute('data-node-id'),
  )
  if (node) {
    menuAt(event, [
      { label: '查看知识点详情', run: () => openNode(node.id) },
      {
        label: '解释这个知识点',
        run: () => openQuestion(`解释「${node.label}」并给出与其他知识的联系。`),
      },
      { label: '复制知识点', run: () => copyText(node.label + '\n' + node.summary) },
    ])
    return
  }
  const note =
    project.value?.result?.notes.find(
      (n) => n.id === el.closest('[data-note-id]')?.getAttribute('data-note-id'),
    ) ?? (el.closest('.note-reader') ? selectedNote.value : undefined)
  if (note) {
    menuAt(event, [
      { label: '阅读知识文档', run: () => showNote(note.id) },
      { label: '围绕文档提问', run: () => openQuestion('', note.id) },
      { label: '复制 Markdown', run: () => copyText(note.content) },
      {
        label: '导出 Markdown',
        run: () => {
          selectedNoteId.value = note.id
          exportCurrentNote()
        },
      },
    ])
    return
  }
  const p = projects.value.find(
    (p) => p.id === el.closest('[data-project-id]')?.getAttribute('data-project-id'),
  )
  if (p) {
    menuAt(event, [
      { label: '新建项目', run: () => openProject() },
      {
        label: '打开项目',
        run: () => {
          activeId.value = p.id
        },
      },
      {
        label: '编辑项目',
        run: () => {
          activeId.value = p.id
          openProject(true)
        },
      },
      { label: '删除项目', danger: true, run: () => requestDeleteProject(p.id) },
    ])
    return
  }
  const selection = window.getSelection()?.toString().trim()
  const items: MenuAction[] = []
  if (selection) {
    items.push({ label: '复制所选文字', run: () => copyText(selection) })
    if (project.value)
      items.push({
        label: '向 AI 询问所选内容',
        run: () => openQuestion(`请解释以下内容：\n${selection}`),
      })
  }
  if (project.value)
    items.push(
      {
        label: '添加知识片段',
        run: () => {
          modal.value = 'capture'
        },
      },
      { label: '返回项目概览', run: () => navigate('overview') },
    )
  items.push({ label: '选择 / 新建项目', run: chooseProject })
  menuAt(event, items)
}
function runMenu(item: MenuAction) {
  contextMenu.value = null
  item.run()
}
</script>

<template>
  <div class="app-shell" @contextmenu.prevent="showMenu" @click="contextMenu = null">
    <aside class="sidebar">
      <button class="brand" @click="project ? navigate('overview') : chooseProject()">
        <span class="brand-icon"><BookOpen :size="23" :stroke-width="1.8" /></span
        ><span>归页<span class="brand-en">GUIYE</span></span>
      </button>
      <button class="all-projects" @click="chooseProject">
        <FolderOpen :size="17" />选择 / 新建项目
      </button>
      <div class="nav-caption">工作区 <span>WORKSPACE</span></div>
      <nav v-if="project" class="page-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="{ active: page === item.id }"
          :aria-label="item.label"
          @click="navigate(item.id)"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.7" /><span>{{ item.label }}</span
          ><span v-if="item.id === 'sources'" class="nav-count">{{ project.sources.length }}</span
          ><span v-if="item.id === 'notes'" class="nav-count">{{
            project.result?.notes.length ?? 0
          }}</span
          ><span v-if="page === item.id" class="nav-active-mark" />
        </button>
      </nav>
      <div class="nav-caption projects-caption">
        项目
        <button class="icon-button" title="新建项目" aria-label="新建项目" @click="openProject()">
          <Plus :size="15" />
        </button>
      </div>
      <label v-if="projects.length > 4" class="sidebar-search"
        ><Search :size="14" /><input v-model="query" aria-label="搜索项目" placeholder="搜索项目"
      /></label>
      <nav
        class="project-list"
        @contextmenu.self.prevent.stop="
          menuAt($event, [{ label: '新建项目', run: () => openProject() }])
        "
      >
        <button
          v-for="p in filteredProjects"
          :key="p.id"
          :data-project-id="p.id"
          class="project-item"
          :class="{ active: p.id === activeId }"
          @click="activeId = p.id"
        >
          <span class="project-dot" /><span>{{ p.title }}</span
          ><span v-if="p.id === 'demo'" class="demo-indicator">示例</span>
        </button>
      </nav>
      <button class="new-project" aria-label="新建项目" @click="openProject()">
        <Plus :size="15" />新建项目
      </button>
      <div class="sidebar-bottom">
        <button
          class="sidebar-link"
          aria-label="模型设置"
          :class="{ active: page === 'settings' }"
          @click="navigate('settings')"
        >
          <Settings2 :size="18" /><span>模型设置</span></button
        ><button class="sidebar-link" aria-label="关于归页" @click="modal = 'about'">
          <CircleHelp :size="18" /><span>关于归页</span>
        </button>
        <div class="sidebar-account">
          <span class="account-avatar">我</span>
          <div>
            本地工作区<small><HardDrive :size="10" />数据保存在此设备</small>
          </div>
          <span class="version">0.1</span>
        </div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <span class="breadcrumb-icon"><FolderOpen :size="16" /></span
          ><button class="breadcrumb-project" @click="navigate('overview')">
            {{ project?.title ?? '选择项目' }}</button
          ><select v-model="activeId" class="compact-project-select" aria-label="切换项目">
            <option value="">选择项目</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option></select
          ><span class="slash">/</span
          ><strong>{{ project || page === 'settings' ? pageLabels[page] : '项目' }}</strong>
        </div>
        <div class="topbar-right">
          <span class="save-state"><Check :size="13" />{{ saved }}</span
          ><span class="topbar-divider" /><span class="device-badge">{{
            desktop ? 'DESKTOP' : 'WEB PREVIEW'
          }}</span>
        </div>
      </header>
      <div v-if="error" class="error-banner" role="alert">
        <Info :size="17" /><span>{{ error }}</span
        ><button class="icon-button" aria-label="关闭错误提示" @click="error = ''">
          <X :size="16" />
        </button>
      </div>
      <main v-if="!project && page !== 'settings'" class="main-content project-picker">
        <div class="eyebrow">YOUR KNOWLEDGE PROJECTS</div>
        <h1>选择一个项目，继续积累知识</h1>
        <p>每个项目保存自己的素材、提取知识点、知识图谱与问答。</p>
        <div class="picker-actions">
          <button class="button primary" @click="openProject()"><Plus :size="16" />新建项目</button
          ><button
            v-if="!projects.some((p) => p.id === 'demo')"
            class="button secondary"
            @click="loadDemo"
          >
            查看示例项目
          </button>
        </div>
        <div class="project-picker-grid">
          <button v-for="p in projects" :key="p.id" @click="activeId = p.id">
            <FolderOpen :size="25" />
            <h2>{{ p.title }}</h2>
            <p>{{ p.description || '继续添加、提取和整理知识' }}</p>
            <span
              >{{ p.sources.length }} 份素材 ·
              {{ p.result?.knowledgePoints?.length ?? p.result?.nodes.length ?? 0 }} 个知识点</span
            ><ArrowRight :size="16" />
          </button>
        </div>
        <div v-if="!projects.length" class="empty">
          <Layers3 :size="35" />
          <h3>还没有项目</h3>
          <p>创建一个主题项目，再添加你的第一份笔记。</p>
        </div>
      </main>
      <main v-if="!project && page === 'settings'" class="main-content">
        <header class="page-heading"><h1>模型设置</h1></header>
        <ModelSettings
          :settings="settings"
          :checking="checking"
          :test-status="testStatus"
          @test="checkModel"
        />
      </main>
      <main v-if="project" class="main-content" :class="`page-${page}`">
        <header v-if="page !== 'graph'" class="page-heading">
          <div>
            <div class="eyebrow">
              {{
                page === 'overview'
                  ? 'PROJECT OVERVIEW'
                  : page === 'sources'
                    ? 'SOURCE LIBRARY'
                    : page === 'notes'
                      ? 'REWRITTEN NOTES'
                      : page === 'knowledge'
                        ? 'KNOWLEDGE POINTS'
                        : page === 'chat'
                          ? 'KNOWLEDGE Q&A'
                          : 'PREFERENCES'
              }}
            </div>
            <div class="page-title">
              <h1>{{ page === 'overview' ? project.title : pageLabels[page] }}</h1>
              <span v-if="page === 'overview' && project.id === 'demo'" class="badge">示例项目</span
              ><span v-if="page === 'sources'" class="title-count">{{
                project.sources.length
              }}</span
              ><span v-if="page === 'notes'" class="title-count">{{
                project.result?.notes.length ?? 0
              }}</span>
            </div>
            <p>
              {{
                page === 'overview'
                  ? project.description || '从一条记录开始，建立自己的知识体系。'
                  : page === 'sources'
                    ? '收集片段和文档，保留知识的原始出处。'
                    : page === 'notes'
                      ? '从知识点重新编排生成的文档，支持 Markdown 与 LaTeX。'
                      : page === 'knowledge'
                        ? '从原始素材中提取原子知识点，逐条理解、追溯并持续积累。'
                        : page === 'chat'
                          ? '根据现有知识提问、比较和推导，将新理解继续加入知识库。'
                          : '连接你选择的模型，定义知识整理的方式。'
              }}
            </p>
          </div>
          <div class="heading-actions">
            <template v-if="page === 'overview'"
              ><button class="button secondary" @click="navigate('sources')">
                <Layers3 :size="16" />管理素材
              </button>
              <div class="menu-wrapper">
                <button
                  class="button square"
                  aria-label="项目操作"
                  @click="projectMenu = !projectMenu"
                >
                  <MoreHorizontal :size="19" />
                </button>
                <div v-if="projectMenu" class="dropdown">
                  <button @click="openProject(true)"><Pencil :size="14" />编辑项目</button
                  ><button @click="exportProject"><Download :size="14" />导出项目 JSON</button
                  ><button
                    :disabled="busy && busyProjectId === project.id"
                    class="danger-text"
                    @click="requestDeleteProject()"
                  >
                    <Trash2 :size="14" />删除项目
                  </button>
                </div>
              </div></template
            >
            <template v-else-if="page === 'sources'"
              ><button
                class="button primary"
                :disabled="busy || !hasKnowledge"
                @click="requestOrganize"
              >
                <LoaderCircle v-if="busy" :size="15" class="spin" /><Sparkles v-else :size="15" />{{
                  busy ? '处理中…' : '开始整理'
                }}
              </button>
              <button class="button secondary" @click="fileInput?.click()">
                <Upload :size="16" />导入文档</button
              ><button class="button primary" @click="modal = 'capture'">
                <Plus :size="16" />新建片段
              </button></template
            >
            <template v-else-if="page === 'notes'"
              ><button
                class="button secondary"
                :disabled="!project.result?.notes.length"
                @click="exportNotes"
              >
                <Download :size="16" />导出全部
              </button></template
            >
            <span v-else class="auto-save-label"><Check :size="14" />自动保存</span>
          </div>
        </header>

        <div
          v-if="project.result?.hierarchyPending && !project.result?.extractionPending && !busy"
          class="pipeline-progress"
          role="status"
        >
          <span>知识内容已保留，图谱层级待优化。</span>
          <button
            class="text-button"
            :disabled="storageBlocked"
            @click="runOrganize(undefined, true)"
          >
            继续优化
          </button>
        </div>
        <div v-if="busy && busyProjectId === project.id" class="pipeline-progress" role="status">
          <LoaderCircle :size="17" class="spin" /><span>{{ progress }}</span
          ><small>提取进度逐批保存，完成后更新图谱与文档</small>
        </div>
        <template v-if="page === 'overview'">
          <section class="metrics-grid">
            <button class="metric-card" @click="navigate('sources')">
              <div class="metric-label">
                <span><Layers3 :size="17" />原始素材</span><ArrowUpRight :size="17" />
              </div>
              <div class="metric-value">
                {{ String(project.sources.length).padStart(2, '0') }}<span>份</span>
              </div>
              <p>你收集的每一块知识拼图</p></button
            ><button class="metric-card" @click="navigate('graph')">
              <div class="metric-label">
                <span><Network :size="17" />知识节点</span><ArrowUpRight :size="17" />
              </div>
              <div class="metric-value">
                {{ String(project.result?.nodes.length ?? 0).padStart(2, '0') }}<span>个</span>
              </div>
              <p>{{ project.result?.relations.length ?? 0 }} 条跨主题关联，连接不同知识</p></button
            ><button class="metric-card" @click="navigate('notes')">
              <div class="metric-label">
                <span><BookOpen :size="17" />系统笔记</span><ArrowUpRight :size="17" />
              </div>
              <div class="metric-value">
                {{ String(project.result?.notes.length ?? 0).padStart(2, '0') }}<span>篇</span>
              </div>
              <p>从零散记录，到完整的理解</p>
            </button>
          </section>
          <div class="overview-grid">
            <section class="recent-notes">
              <div class="section-heading">
                <div>
                  <h2>继续阅读</h2>
                  <span>整理后的知识，随时回顾</span>
                </div>
                <button class="text-button" @click="navigate('notes')">
                  全部笔记<ArrowRight :size="14" />
                </button>
              </div>
              <div class="recent-notes-list">
                <button
                  v-for="(note, i) in project.result?.notes.slice(0, 3)"
                  :key="note.id"
                  :data-note-id="note.id"
                  class="recent-note"
                  @click="showNote(note.id)"
                >
                  <span class="document-icon"><FileText :size="22" :stroke-width="1.4" /></span>
                  <div>
                    <div class="note-kicker">
                      NOTE {{ String(i + 1).padStart(2, '0') }} <span>·</span>
                      {{ note.sourceIds.length }} 份来源
                    </div>
                    <h3>{{ note.title }}</h3>
                    <p>{{ preview(note.content) }}</p>
                  </div>
                  <ChevronRight :size="17" />
                </button>
                <div v-if="!project.result?.notes.length" class="empty">
                  <BookOpen :size="34" />
                  <h3>这里是你的下一篇笔记</h3>
                  <p>添加素材，开始第一次整理。</p>
                  <button class="button secondary" @click="navigate('sources')">
                    添加素材<ArrowRight :size="15" />
                  </button>
                </div>
              </div>
              <div class="recent-footer">
                <Clock3 :size="13" />{{
                  project.organizedAt ? `上次整理 ${formatDate(project.organizedAt)}` : '尚未整理'
                }}<span>Markdown + LaTeX</span>
              </div>
            </section>
            <section class="organize-card">
              <div class="organize-topline">
                <span class="ai-label"><Sparkles :size="14" />AI WORKSPACE</span
                ><button class="icon-button" aria-label="AI 模型设置" @click="navigate('settings')">
                  <Settings2 :size="16" />
                </button>
              </div>
              <div class="organize-illustration" aria-hidden="true">
                <svg viewBox="0 0 280 114">
                  <defs>
                    <linearGradient id="line" x1="0" x2="1">
                      <stop stop-color="#d2d7f5" />
                      <stop offset="1" stop-color="#7285e9" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M57 24H85Q100 24 108 40L120 57H173 M57 57H173 M57 90H85Q100 90 108 74L120 57"
                    stroke="url(#line)"
                    fill="none"
                    stroke-width="1.5"
                  />
                  <rect x="26" y="10" width="31" height="29" rx="6" fill="white" stroke="#e0e3ed" />
                  <rect x="26" y="43" width="31" height="29" rx="6" fill="white" stroke="#e0e3ed" />
                  <rect x="26" y="76" width="31" height="29" rx="6" fill="white" stroke="#e0e3ed" />
                  <path
                    d="M35 20h13m-13 5h9m-9 5h11M35 53h13m-13 5h9m-9 5h11M35 86h13m-13 5h9m-9 5h11"
                    stroke="#a8b0c7"
                    stroke-width="1.5"
                  />
                  <rect x="173" y="22" width="70" height="70" rx="18" fill="#5368e9" />
                  <path
                    d="M191 42q9-3 17 3 8-6 17-3v30q-9-3-17 3-8-6-17-3zM208 45v30"
                    fill="none"
                    stroke="white"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />
                  <circle cx="126" cy="57" r="4" fill="#7585ed" stroke="#f5f6ff" stroke-width="3" />
                </svg>
              </div>
              <h2>提取知识，持续积累。</h2>
              <p class="organize-description">
                理解
                {{ project.sources.length }}
                份素材、拆分与归并知识点，<br />按知识结构重新写作并生成图谱。
              </p>
              <div class="organize-preferences">
                <div>
                  <span>纠正错误</span
                  ><span :class="{ enabled: settings.correct }">{{
                    settings.correct ? '已开启' : '已关闭'
                  }}</span>
                </div>
                <div>
                  <span>补充知识</span
                  ><span :class="{ enabled: settings.supplement }">{{
                    settings.supplement ? '已开启' : '已关闭'
                  }}</span>
                </div>
                <button @click="navigate('settings')">
                  调整整理偏好<ArrowUpRight :size="12" />
                </button>
              </div>
              <button
                class="button primary organize-button"
                :disabled="busy || !hasKnowledge || storageBlocked"
                @click="requestOrganize"
              >
                <LoaderCircle v-if="busy" class="spin" :size="17" /><Sparkles v-else :size="17" />{{
                  busy ? '正在整理…' : '开始整理'
                }}<ArrowRight v-if="!busy" :size="16" />
              </button>
              <div class="model-caption">
                <span>{{ settings.model }}</span
                ><span>{{ desktop ? '桌面 AI 引擎' : '需桌面版运行' }}</span>
              </div>
              <p v-if="busy" class="processing-note">
                正在梳理素材，完成后自动保存。结构异常时会自动修正一次，请耐心等待。
              </p>
            </section>
          </div>
          <div v-if="lastResult?.projectId === project.id" class="result-notice">
            <Check :size="16" /><span>本次整理已保存</span
            ><button class="text-button" :disabled="busy" @click="undoOrganize">
              <RotateCcw :size="14" />撤销本次整理
            </button>
          </div>
          <section v-if="project.result?.changes.length" class="changes-panel">
            <h3><Sparkles :size="16" />整理说明</h3>
            <p v-for="(change, i) in project.result.changes" :key="i">{{ change }}</p>
          </section>
          <footer class="page-footer">
            <span>收集，是理解的开始。</span
            ><span>GUIYE <span class="footer-dot">·</span> LOCAL FIRST</span>
          </footer>
        </template>

        <template v-else-if="page === 'sources'">
          <div class="source-toolbar">
            <div class="filter-tabs">
              <button :class="{ active: sourceFilter === 'all' }" @click="sourceFilter = 'all'">
                全部素材<span>{{ project.sources.length }}</span></button
              ><button :class="{ active: sourceFilter === 'text' }" @click="sourceFilter = 'text'">
                片段</button
              ><button :class="{ active: sourceFilter === 'file' }" @click="sourceFilter = 'file'">
                文档
              </button>
            </div>
            <label class="search-box"
              ><Search :size="16" /><input
                v-model="sourceQuery"
                aria-label="搜索素材"
                placeholder="搜索素材名称或内容"
            /></label>
          </div>
          <div class="source-processing-summary">
            <span>{{ pendingSources }} 份素材待提取 / 更新</span
            ><span>未变化的素材会复用已有知识点；新增内容会融入现有图谱与知识文档。</span>
          </div>
          <div class="source-batch-toolbar">
            <label
              ><input
                type="checkbox"
                :checked="allSourcesSelected"
                :indeterminate="
                  !allSourcesSelected && sources.some((s) => selectedSourceIds.includes(s.id))
                "
                @change="toggleSources"
              />全选筛选结果</label
            >
            <span>已选 {{ selectedSources.length }} 份</span>
            <button
              class="button secondary"
              :disabled="!selectedSources.length || busy || storageBlocked"
              @click="runOrganize(selectedSources.map((s) => s.id))"
            >
              整理所选
            </button>
            <button
              class="button secondary danger-text"
              :disabled="!selectedSources.length || busy || storageBlocked"
              @click="removeSelectedSources"
            >
              删除所选
            </button>
          </div>
          <section class="source-table">
            <div class="source-table-header">
              <span>名称</span><span>类型</span><span>字符数</span><span>添加时间</span><span />
            </div>
            <div
              v-for="source in pagedSources"
              :key="source.id"
              :data-source-id="source.id"
              class="source-item"
              role="button"
              tabindex="0"
              @keydown.enter.self="editSource(source)"
              @click="editSource(source)"
            >
              <span class="source-name"
                ><input
                  v-model="selectedSourceIds"
                  type="checkbox"
                  :value="source.id"
                  :aria-label="`选择素材：${source.title}`"
                  @click.stop
                />
                <span
                  class="file-icon"
                  :class="
                    source.kind === 'text'
                      ? 'fragment'
                      : ['tex', 'latex'].includes(source.kind)
                        ? 'math-file'
                        : ''
                  "
                  ><Pencil v-if="source.kind === 'text'" :size="18" /><span
                    v-else-if="['tex', 'latex'].includes(source.kind)"
                    >∑</span
                  ><FileText v-else :size="19" /></span
                ><span
                  ><strong
                    >{{ source.title }}
                    <small>{{ isProcessed(source) ? '已整理' : '待整理' }}</small></strong
                  >
                  <small>{{ source.content.replace(/\n/g, ' ').slice(0, 76) }}</small></span
                ></span
              ><span class="file-type">{{
                source.kind === 'text' ? '片段' : source.kind.toUpperCase()
              }}</span
              ><span class="source-size">{{ source.content.length.toLocaleString() }}</span
              ><span class="source-date">{{ formatDate(source.createdAt) }}</span
              ><button
                class="text-button"
                :disabled="busy || storageBlocked"
                @click.stop="organizeSource(source)"
              >
                {{
                  busy && busyProjectId === project.id
                    ? '整理中…'
                    : isProcessed(source)
                      ? '重新整理'
                      : '整理入库'
                }}
              </button>
            </div>
            <div v-if="!sources.length" class="empty">
              <Layers3 :size="35" />
              <h3>{{ sourceQuery || sourceFilter !== 'all' ? '没有匹配的素材' : '还没有素材' }}</h3>
              <p>
                {{ sourceQuery ? '试试其他关键词。' : '随手记录一段知识，或导入你已有的文档。' }}
              </p>
              <button
                v-if="!project.sources.length"
                class="button primary"
                @click="modal = 'capture'"
              >
                <Plus :size="16" />添加第一个片段
              </button>
            </div>
            <div class="table-footer">
              <span>{{ sources.length }} 份素材 · 点击行可查看和编辑</span>
              <div v-if="sourcePages > 1" class="pagination">
                <button
                  class="icon-button"
                  aria-label="上一页素材"
                  :disabled="sourcePage === 1"
                  @click="sourcePage--"
                >
                  <ChevronRight :size="15" class="rotate-180" /></button
                ><span>{{ sourcePage }} / {{ sourcePages }}</span
                ><button
                  class="icon-button"
                  aria-label="下一页素材"
                  :disabled="sourcePage === sourcePages"
                  @click="sourcePage++"
                >
                  <ChevronRight :size="15" />
                </button>
              </div>
            </div>
          </section>
          <button
            class="upload-zone"
            @click="fileInput?.click()"
            @dragover.prevent
            @drop.prevent="importFiles($event.dataTransfer?.files ?? null)"
          >
            <span class="upload-icon"><Upload :size="22" /></span
            ><span
              ><strong>把文档拖到这里，或<span>选择文件</span></strong
              ><small
                >支持 TXT、Markdown、LaTeX、CSV、JSON · UTF-8 编码 · 单文件最大 1 MB</small
              ></span
            ><Plus :size="20" />
          </button>
          <div class="sources-bottom">
            <Info :size="14" />
            <p>素材更新后，可回到项目概览重新整理知识。</p>
            <button class="text-button" @click="navigate('overview')">
              前往整理<ArrowRight :size="15" />
            </button>
          </div>
        </template>

        <template v-else-if="page === 'graph'">
          <section class="graph-workspace" :class="{ 'inspector-hidden': !rightOpen }">
            <div class="graph-stage">
              <KnowledgeGraph
                :nodes="project.result?.nodes ?? []"
                :relations="project.result?.relations ?? []"
                :selected="selectedNodeId"
                @select="openNode"
              >
                <button
                  class="button secondary"
                  :disabled="busy || storageBlocked || !project.result?.knowledgePoints?.length"
                  @click="runOrganize(undefined, true)"
                >
                  <Sparkles :size="16" />重建层级
                </button>
                <button
                  class="button secondary graph-detail-toggle"
                  :aria-pressed="rightOpen"
                  @click="rightOpen = !rightOpen"
                >
                  <PanelRightClose v-if="rightOpen" :size="16" /><PanelRightOpen
                    v-else
                    :size="16"
                  />节点详情
                </button>
              </KnowledgeGraph>
            </div>
            <aside v-if="rightOpen" class="node-detail">
              <template v-if="selectedNode"
                ><div class="inspector-caption">
                  节点详情<button
                    class="icon-button"
                    aria-label="关闭节点详情"
                    @click="rightOpen = false"
                  >
                    <X :size="15" />
                  </button>
                </div>
                <div class="node-detail-icon"><Network :size="23" /></div>
                <h3>{{ selectedNode.label }}</h3>
                <span class="tag" :class="selectedNode.status">{{
                  project.result?.knowledgePoints?.some(
                    (p) => p.manual && selectedNode?.pointIds?.includes(p.id),
                  )
                    ? '手动编辑'
                    : statusLabels[selectedNode.status]
                }}</span>
                <div
                  class="markdown-body node-summary"
                  v-html="renderMarkdown(selectedNode.summary)"
                />
                <button
                  v-for="point in project.result?.knowledgePoints?.filter((p) =>
                    selectedNode?.pointIds?.includes(p.id),
                  )"
                  :key="point.id"
                  class="text-button"
                  @click="editPoint(point)"
                >
                  编辑知识点
                </button>
                <div class="inspector-section">
                  <h4>
                    素材来源<span>{{ selectedNode.sourceIds.length }}</span>
                  </h4>
                  <button
                    v-for="id in selectedNode.sourceIds"
                    :key="id"
                    class="inspector-source"
                    @click="
                      project.sources.find((s) => s.id === id) &&
                      editSource(project.sources.find((s) => s.id === id)!)
                    "
                  >
                    <FileText :size="15" /><span>{{ sourceName(id) }}</span
                    ><ArrowUpRight :size="13" />
                  </button>
                  <p v-if="!selectedNode.sourceIds.length" class="muted">
                    此节点无原始素材；内容来自手动知识点或 AI 补充。
                  </p>
                </div>
                <div class="inspector-section">
                  <h4>
                    相关笔记<span>{{ relatedNotes.length }}</span>
                  </h4>
                  <button
                    v-for="note in relatedNotes"
                    :key="note.id"
                    :data-note-id="note.id"
                    class="note-link"
                    @click="showNote(note.id)"
                  >
                    <BookOpen :size="15" /><span>{{ note.title }}</span
                    ><ArrowUpRight :size="13" />
                  </button>
                </div>
                <div
                  v-if="
                    project.result?.relations.some(
                      (r) => r.from === selectedNodeId || r.to === selectedNodeId,
                    )
                  "
                  class="inspector-section"
                >
                  <h4>关联关系</h4>
                  <p
                    v-for="relation in project.result.relations.filter(
                      (r) => r.from === selectedNodeId || r.to === selectedNodeId,
                    )"
                    :key="relation.from + relation.to"
                    class="relation-label"
                  >
                    {{ project.result.nodes.find((n) => n.id === relation.from)?.label }} →
                    {{ project.result.nodes.find((n) => n.id === relation.to)?.label
                    }}<span>{{ relation.label }}</span>
                  </p>
                </div></template
              >
              <div v-else class="empty">
                <Network :size="30" />
                <p>选择一个节点<br />探索知识点和来源</p>
              </div>
            </aside>
          </section>
        </template>

        <template v-else-if="page === 'notes'">
          <section v-if="project.result?.notes.length" class="notes-workspace">
            <aside class="note-index">
              <div class="note-index-heading"><span>笔记目录</span><List :size="15" /></div>
              <div class="note-selector">
                <button
                  v-for="(note, i) in project.result.notes"
                  :key="note.id"
                  :data-note-id="note.id"
                  :class="{ active: selectedNote?.id === note.id }"
                  @click="showNote(note.id)"
                >
                  <span class="note-index-number">{{ String(i + 1).padStart(2, '0') }}</span
                  ><span
                    ><strong>{{ note.title }}</strong
                    ><small>{{ note.sourceIds.length }} 份素材来源</small></span
                  >
                </button>
              </div>
              <div class="note-index-footer">
                <BookOpen :size="13" />{{ project.result.notes.length }} 篇系统笔记
              </div>
            </aside>
            <div v-if="selectedNote" class="note-reader">
              <div class="reader-toolbar">
                <span
                  ><FileText :size="14" />{{
                    selectedNote.content.length.toLocaleString()
                  }}
                  字符<span class="dot-separator">·</span>Markdown + LaTeX</span
                >
                <div v-if="!editingNote">
                  <button class="text-button" @click="openQuestion('', selectedNote.id)">
                    <MessageSquare :size="14" />向 AI 提问</button
                  ><button class="text-button" @click="editNote"><Pencil :size="14" />编辑</button
                  ><span class="toolbar-divider" /><button
                    class="icon-button"
                    title="导出当前笔记"
                    aria-label="导出当前笔记"
                    @click="exportCurrentNote"
                  >
                    <Download :size="16" />
                  </button>
                </div>
                <div v-else>
                  <button class="text-button" @click="editingNote = false">取消</button
                  ><button class="button primary small-button" @click="saveNote">
                    <Check :size="14" />保存
                  </button>
                </div>
              </div>
              <textarea
                v-if="editingNote"
                v-model="noteDraft"
                class="markdown-editor"
                aria-label="编辑 Markdown 笔记"
                spellcheck="false"
              />
              <article v-else class="markdown-body" v-html="renderMarkdown(selectedNote.content)" />
              <div class="reader-sources">
                <span>素材来源</span
                ><button
                  v-for="id in selectedNote.sourceIds"
                  :key="id"
                  class="text-button"
                  @click="
                    project.sources.find((s) => s.id === id) &&
                    editSource(project.sources.find((s) => s.id === id)!)
                  "
                >
                  <FileText :size="13" />{{ sourceName(id) }}
                </button>
              </div>
            </div>
          </section>
          <div v-else class="empty notes-empty">
            <BookOpen :size="36" />
            <h3>还没有系统笔记</h3>
            <p>收集素材并整理后，笔记会出现在这里。</p>
            <button class="button secondary" @click="navigate('overview')">
              返回项目概览<ArrowRight :size="15" />
            </button>
          </div>
        </template>

        <section v-else-if="page === 'knowledge'" class="knowledge-page">
          <div class="source-toolbar">
            <p>{{ project.result?.knowledgePoints?.length ?? 0 }} 个知识点</p>
            <label class="search-box"
              ><Search :size="15" /><input
                v-model="pointQuery"
                aria-label="搜索知识点"
                placeholder="搜索概念、公式、条件" /></label
            ><button class="button primary" @click="editPoint()">
              <Plus :size="15" />新建知识点
            </button>
          </div>
          <div class="knowledge-cards">
            <article
              v-for="point in knowledgePoints"
              :key="point.id"
              class="knowledge-card"
              @contextmenu.prevent.stop="showPointMenu($event, point.id)"
            >
              <div>
                <h2>
                  {{ point.label
                  }}<span v-if="point.status === 'corrected'" class="tag corrected">已纠错</span>
                </h2>
                <button class="text-button" @click="editPoint(point)">
                  <Pencil :size="13" />编辑知识点
                </button>
                <button class="text-button" @click="openPoint(point.id)">
                  图谱位置<ArrowUpRight :size="13" />
                </button>
              </div>
              <div class="markdown-body" v-html="renderMarkdown(point.detail)" />
              <span v-if="point.verbatim" class="tag">原文保留，未作 AI 提取</span>
              <span v-if="point.manual" class="tag">手动编辑</span>
              <p v-if="!point.evidence.length" class="field-hint">手动创建，无原文素材</p>
              <details v-if="point.evidence.length">
                <summary>原文证据 · {{ point.evidence.length }}</summary>
                <p v-if="point.originalDetail" class="original-claim">
                  原提取：{{ point.originalDetail }}
                </p>
                <blockquote v-for="(e, i) in point.evidence" :key="i">
                  <p>{{ e.quote }}</p>
                  <button class="text-button" @click="openSource(e.sourceId)">
                    {{ sourceName(e.sourceId) }}
                  </button>
                </blockquote>
              </details>
              <button
                class="text-button"
                @click="
                  openQuestion(`请解释「${point.label}」的含义、适用条件及与其他知识点的联系。`)
                "
              >
                <MessageSquare :size="13" />追问这个知识点
              </button>
            </article>
          </div>
          <div v-if="!knowledgePoints.length" class="empty">
            <Network :size="35" />
            <h3>在这里直接新建或编辑知识点</h3>
            <p>也可以整理素材，提取完整的定义、结论或方法。</p>
            <button
              class="button primary"
              :disabled="busy || !hasKnowledge"
              @click="requestOrganize"
            >
              开始提取
            </button>
          </div>
        </section>
        <KnowledgeChat
          v-else-if="page === 'chat'"
          :project="project"
          :settings="settings"
          :initial-question="questionDraft"
          :note-id="questionNoteId"
          @source="openSource"
          @note="showNote"
          @node="openNode"
          @append="appendKnowledge"
          @clear-scope="questionNoteId = ''"
        />
        <ModelSettings
          v-else
          :settings="settings"
          :checking="checking"
          :test-status="testStatus"
          @test="checkModel"
        />
      </main>
    </div>
    <input
      ref="fileInput"
      type="file"
      multiple
      accept=".txt,.md,.markdown,.tex,.latex,.csv,.json"
      hidden
      @change="importFiles(($event.target as HTMLInputElement).files)"
    />
    <div
      v-if="contextMenu"
      class="context-menu"
      role="menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
      @mousedown.prevent
    >
      <button
        v-for="item in contextMenu.items"
        :key="item.label"
        role="menuitem"
        :class="{ 'danger-text': item.danger }"
        @click="runMenu(item)"
      >
        {{ item.label }}
      </button>
    </div>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <Check :size="16" />{{ toast }}
      </div></Transition
    >
    <div v-if="modal" class="modal-overlay" @click.self="modal = ''">
      <section
        class="modal"
        :class="{ wide: modal === 'source' || modal === 'capture' || modal === 'point' }"
        role="dialog"
        aria-modal="true"
        :aria-label="
          modal === 'project'
            ? '项目设置'
            : modal === 'source'
              ? '素材编辑'
              : modal === 'point'
                ? '知识点编辑'
                : modal === 'capture'
                  ? '新建片段'
                  : '提示'
        "
        @keydown.esc="modal = ''"
      >
        <button class="modal-close icon-button" aria-label="关闭弹窗" @click="modal = ''">
          <X :size="19" />
        </button>
        <template v-if="modal === 'project'"
          ><div class="modal-symbol"><FolderOpen :size="24" /></div>
          <h2>{{ editingProject ? '编辑项目' : '新建项目' }}</h2>
          <p class="modal-intro">为一个主题创建独立的素材、图谱和笔记。</p>
          <form @submit.prevent="createProject">
            <label class="field"
              >项目名称<input
                v-model="newTitle"
                autofocus
                required
                maxlength="60"
                placeholder="例如：概率论、读书笔记、产品研究" /></label
            ><label class="field"
              >一句话介绍 <span>可选</span
              ><textarea
                v-model="newDescription"
                maxlength="200"
                rows="3"
                placeholder="这个项目关注什么？"
              />
            </label>
            <div class="modal-actions">
              <button type="button" class="button secondary" @click="modal = ''">取消</button
              ><button class="button primary" :disabled="!newTitle.trim()">
                {{ editingProject ? '保存修改' : '创建项目' }}<ArrowRight :size="15" />
              </button>
            </div></form
        ></template>
        <template v-else-if="modal === 'point'">
          <h2>{{ pointId ? '编辑知识点' : '新建知识点' }}</h2>
          <p class="modal-intro">
            直接保存到知识点，支持 Markdown 和
            LaTeX。后续整理保留手动正文；知识文档在重新整理后更新。
          </p>
          <form @submit.prevent="savePoint">
            <label class="field"
              >知识点标题<input v-model="pointTitle" required maxlength="160" autofocus
            /></label>
            <label class="field"
              >父节点
              <select v-model="pointParentId" aria-label="父节点">
                <option value="">根节点（无父节点）</option>
                <option v-for="node in parentOptions" :key="node.id" :value="node.id">
                  {{ node.label }}
                </option>
              </select>
            </label>
            <label class="field"
              >知识点正文<textarea
                v-model="pointDetail"
                required
                rows="12"
                @keydown.ctrl.enter.prevent="savePoint"
              />
            </label>
            <div class="modal-actions">
              <button type="button" class="button secondary" @click="modal = ''">取消</button>
              <button class="button primary" :disabled="!pointTitle.trim() || !pointDetail.trim()">
                保存知识点
              </button>
            </div>
          </form>
        </template>
        <template v-else-if="modal === 'capture'"
          ><div class="modal-symbol"><Pencil :size="23" /></div>
          <h2>记录一段知识</h2>
          <p class="modal-intro">一个概念、一段摘录，或还没想明白的问题。</p>
          <textarea
            v-model="draft"
            class="capture-editor"
            aria-label="知识片段"
            placeholder="在这里写下你的知识片段…"
            @keydown.ctrl.enter="addFragment"
            @keydown.meta.enter="addFragment"
          />
          <div class="modal-actions">
            <span class="field-hint">Ctrl + Enter 保存</span
            ><button
              class="button primary"
              :disabled="!draft.trim()"
              aria-label="添加知识片段"
              @click="addFragment"
            >
              <Plus :size="15" />保存片段
            </button>
          </div></template
        >
        <template v-else-if="modal === 'source'"
          ><h2>素材原文</h2>
          <p class="modal-intro">修改素材不会自动覆盖已有的图谱和笔记。</p>
          <label class="field">标题<input v-model="sourceTitle" maxlength="160" /></label
          ><label class="field"
            >内容<textarea v-model="sourceContent" class="source-editor" spellcheck="false" />
          </label>
          <div class="modal-actions">
            <button class="text-button danger-text" @click="removeSource">
              <Trash2 :size="14" />移除素材</button
            ><button
              class="button primary"
              :disabled="!sourceTitle.trim() || !sourceContent.trim()"
              @click="saveSource"
            >
              保存素材<Check :size="15" />
            </button></div
        ></template>
        <template v-else-if="modal === 'delete'"
          ><h2>
            {{
              deleteTarget?.sourceId || deleteTarget?.sourceIds?.length ? '移除素材' : '删除项目'
            }}「{{ deletionProject?.title }}」？
          </h2>
          <p v-if="deleteTarget?.sourceIds?.length">
            已选择 {{ deleteTarget.sourceIds.length }} 份素材。
          </p>
          <p class="modal-intro">
            {{
              deleteTarget?.sourceId || deleteTarget?.sourceIds?.length
                ? '该素材将从项目移除，已有知识文档保留。'
                : '该项目的素材、知识图谱与知识文档将从本地移除。'
            }}
          </p>
          <label v-if="!(deleteTarget?.sourceId || deleteTarget?.sourceIds?.length)" class="field"
            >输入项目名称以确认<input
              v-model="deleteName"
              aria-label="输入项目名称以确认"
              autocomplete="off"
          /></label>
          <div class="modal-actions">
            <button class="button secondary" @click="modal = ''">取消</button
            ><button
              class="button danger"
              :disabled="
                !deletionProject ||
                (!(deleteTarget?.sourceId || deleteTarget?.sourceIds?.length) &&
                  deleteName !== deletionProject.title)
              "
              @click="deleteProject"
            >
              {{
                deleteTarget?.sourceId || deleteTarget?.sourceIds?.length ? '移除素材' : '删除项目'
              }}
            </button>
          </div></template
        >
        <template v-else-if="modal === 'reorganize'"
          ><div class="modal-symbol"><Sparkles :size="24" /></div>
          <h2>重新整理项目？</h2>
          <p class="modal-intro">
            AI
            将依据当前知识更新图谱和文档，优先编辑已有文档、合并同主题小笔记，独立主题才新建。文档正文（含手动编辑）会重新编排；手动知识点保留。完成后可在本次会话中撤销一次。
          </p>
          <div class="modal-actions">
            <button class="button secondary" @click="modal = ''">取消</button
            ><button class="button primary" @click="runOrganize()">
              开始重新整理<ArrowRight :size="15" />
            </button></div
        ></template>
        <template v-else
          ><div class="modal-symbol"><BookOpen :size="26" /></div>
          <h2>归页 <span class="muted">GUIYE</span></h2>
          <p class="modal-intro">一个本地优先的知识整理工具。</p>
          <p class="about-copy">
            收集片段、导入文档，借助你选择的 AI 模型建立知识图谱与系统笔记。支持 Markdown 和 LaTeX
            数学公式。
          </p>
          <p class="about-copy">
            桌面版使用 Rust + Vue 3 + Tauri
            2，项目保存在应用数据目录。浏览器预览使用浏览器本地存储。AI 结果请结合素材来源核对。
          </p>
          <div class="modal-actions">
            <span class="field-hint">版本 0.1.0</span
            ><button class="button primary" @click="modal = ''">
              知道了<Check :size="15" />
            </button></div
        ></template>
      </section>
    </div>
  </div>
</template>
