<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import {
  Send,
  Sparkles,
  LoaderCircle,
  FileText,
  Plus,
  X,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-vue-next'
import type { Project, Settings, ChatMessage } from '../types'
import { uid } from '../types'
import { askQuestion, questionBusy as busy } from '../api'
import { renderMarkdown } from '../markdown'
const props = defineProps<{
  project: Project
  settings: Settings
  initialQuestion: string
  noteId: string
}>()
const emit = defineEmits<{
  source: [id: string]
  note: [id: string]
  node: [id: string]
  append: [content: string]
  clearScope: []
}>()
const question = ref(props.initialQuestion)
const error = ref('')
const feed = ref<HTMLElement>()
watch(
  () => props.initialQuestion,
  (value) => {
    question.value = value
  },
)
watch(
  () => props.project.id,
  () => {
    question.value = ''
    error.value = ''
  },
)
function suggest(text: string) {
  if (busy.value) return
  question.value = text
  send()
}
async function send() {
  if (
    !question.value.trim() ||
    busy.value ||
    !(props.project.sources.length || props.project.result?.knowledgePoints?.length)
  )
    return
  const target = props.project
  const text = question.value.trim()
  const input = JSON.parse(JSON.stringify(target)) as Project
  error.value = ''
  question.value = ''
  const message: ChatMessage = {
    id: uid(),
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  }
  ;(target.messages ??= []).push(message)
  try {
    const answer = await askQuestion(input, { ...props.settings }, text, props.noteId)
    target.messages.push({
      id: uid(),
      role: 'assistant',
      content: answer.answer,
      references: answer,
      createdAt: new Date().toISOString(),
    })
    target.updatedAt = new Date().toISOString()
  } catch (e) {
    error.value = String(e)
    question.value = text
  } finally {
    await nextTick()
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
  }
}
</script>
<template>
  <section class="chat-workspace">
    <div class="chat-scope">
      <Sparkles :size="16" /><span>{{
        noteId
          ? `围绕文档：${project.result?.notes.find((n) => n.id === noteId)?.title ?? '当前文档'}`
          : `基于本项目的 ${project.sources.length} 份素材、知识点与整理文档回答`
      }}</span
      ><button
        v-if="noteId"
        class="icon-button"
        aria-label="清除问答范围"
        @click="emit('clearScope')"
      >
        <X :size="14" />
      </button>
    </div>
    <div ref="feed" class="chat-feed">
      <div v-if="!project.messages?.length" class="empty">
        <MessageSquare :size="32" />
        <h3>向你的知识库提问</h3>
        <p>追问推导、比较概念、寻找知识缺口。回答会附上可追溯的引用。</p>
        <div class="chat-suggestions">
          <button :disabled="busy" @click="suggest('这些知识点之间有哪些先修关系？')">
            梳理先修关系</button
          ><button :disabled="busy" @click="suggest('现有笔记有哪些矛盾或尚未解释清楚的地方？')">
            发现知识缺口
          </button>
        </div>
      </div>
      <div
        v-for="message in project.messages"
        :key="message.id"
        class="chat-message"
        :class="message.role"
      >
        <span class="chat-role">{{ message.role === 'user' ? '你' : '知识助手' }}</span>
        <article class="markdown-body" v-html="renderMarkdown(message.content)" />
        <div v-if="message.references" class="chat-citations">
          <button v-for="id in message.references.sourceIds" :key="id" @click="emit('source', id)">
            <FileText :size="12" />{{
              project.sources.find((s) => s.id === id)?.title ?? '已移除素材'
            }}</button
          ><button v-for="id in message.references.noteIds" :key="id" @click="emit('note', id)">
            <ArrowUpRight :size="12" />{{
              project.result?.notes.find((n) => n.id === id)?.title ?? '历史文档'
            }}</button
          ><button v-for="id in message.references.nodeIds" :key="id" @click="emit('node', id)">
            {{ project.result?.nodes.find((n) => n.id === id)?.label ?? '历史知识点' }}
          </button>
        </div>
        <button
          v-if="message.role === 'assistant'"
          class="text-button"
          @click="emit('append', `问答补充（AI 回答，待核实）\n\n${message.content}`)"
        >
          <Plus :size="13" />作为新素材加入知识库
        </button>
      </div>
      <div v-if="busy" class="chat-wait">
        <LoaderCircle :size="16" class="spin" />正在检索知识并生成回答…
      </div>
    </div>
    <p v-if="error" class="chat-error" role="alert">{{ error }}</p>
    <form class="chat-composer" @submit.prevent="send">
      <textarea
        v-model="question"
        :disabled="busy"
        aria-label="向知识库提问"
        maxlength="4000"
        placeholder="输入你的问题，Ctrl + Enter 发送"
        @keydown.ctrl.enter.prevent="send"
        @keydown.meta.enter.prevent="send"
      /><button
        class="button primary"
        :disabled="
          busy ||
          !question.trim() ||
          !(project.sources.length || project.result?.knowledgePoints?.length)
        "
      >
        <Send :size="16" />提问
      </button>
    </form>
  </section>
</template>
