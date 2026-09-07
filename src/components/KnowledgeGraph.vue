<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Plus, Minus, Maximize, GitBranch } from 'lucide-vue-next'
import type { KnowledgeNode, Relation } from '../types'
const props = defineProps<{ nodes: KnowledgeNode[]; relations: Relation[]; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const svg = ref<SVGSVGElement>()
const viewport = ref({ width: 820, height: 420 })
let observer: ResizeObserver | undefined
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
let drag: { x: number; y: number; px: number; py: number } | null = null
const layout = computed(() => {
  const positions = new Map<string, { x: number; y: number; depth: number }>()
  const seen = new Set<string>()
  let leaf = 0
  const visit = (node: KnowledgeNode, depth: number): number => {
    if (seen.has(node.id)) return 0
    seen.add(node.id)
    const children = props.nodes.filter((n) => n.parentId === node.id && !seen.has(n.id))
    const ys = children.map((child) => visit(child, depth + 1))
    const y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 75 + leaf++ * 98
    positions.set(node.id, { x: 48 + depth * 252, y, depth })
    return y
  }
  props.nodes
    .filter((n) => !n.parentId || !props.nodes.some((p) => p.id === n.parentId))
    .forEach((n) => visit(n, 0))
  props.nodes.filter((n) => !seen.has(n.id)).forEach((n) => visit(n, 0))
  return {
    positions,
    width: Math.max(820, ...Array.from(positions.values()).map((p) => p.x + 242)),
    height: Math.max(420, leaf * 98 + 55),
  }
})
function path(from: string, to: string) {
  const a = layout.value.positions.get(from),
    b = layout.value.positions.get(to)
  if (!a || !b) return ''
  return `M ${a.x + 184} ${a.y} C ${a.x + 224} ${a.y}, ${b.x - 44} ${b.y}, ${b.x} ${b.y}`
}
function start(event: PointerEvent) {
  if (event.button !== 0 || (event.target as Element).closest('.graph-node')) return
  event.preventDefault()
  window.getSelection()?.removeAllRanges()
  const point = graphPoint(event.clientX, event.clientY)
  drag = { x: point.x, y: point.y, px: pan.value.x, py: pan.value.y }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (drag) {
    const point = graphPoint(event.clientX, event.clientY)
    pan.value = { x: drag.px + point.x - drag.x, y: drag.py + point.y - drag.y }
  }
}
function graphPoint(x: number, y: number) {
  const matrix = svg.value?.getScreenCTM()
  return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : { x, y }
}
function wheel(event: WheelEvent) {
  const point = graphPoint(event.clientX, event.clientY)
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1)
  const next = Math.max(0.25, Math.min(4, zoom.value * Math.exp(-delta * 0.0015)))
  const ratio = next / zoom.value
  pan.value = {
    x: point.x - (point.x - pan.value.x) * ratio,
    y: point.y - (point.y - pan.value.y) * ratio,
  }
  zoom.value = next
}
function reveal(id?: string) {
  const position = layout.value.positions.get(id ?? '')
  if (!position) return
  pan.value = {
    x: 40 - position.x * zoom.value,
    y: viewport.value.height / 2 - position.y * zoom.value,
  }
}
function reset() {
  zoom.value = 1
  reveal(props.nodes.find((n) => !n.parentId)?.id)
}
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    viewport.value = {
      width: entry.contentRect.width || 820,
      height: entry.contentRect.height || 420,
    }
  })
  if (svg.value) observer.observe(svg.value)
  nextTick(() => {
    reset()
    ensureVisible(props.selected)
  })
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.nodes,
  () => nextTick(reset),
)
function ensureVisible(id: string) {
  const p = layout.value.positions.get(id)
  if (!p) return
  const x = p.x * zoom.value + pan.value.x,
    y = p.y * zoom.value + pan.value.y
  if (
    x < 0 ||
    x + 184 * zoom.value > viewport.value.width ||
    y < 28 * zoom.value ||
    y + 28 * zoom.value > viewport.value.height
  )
    reveal(id)
}
watch(() => props.selected, ensureVisible)
</script>
<template>
  <div
    class="graph-surface"
    @wheel.prevent="wheel"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="drag = null"
    @pointercancel="drag = null"
    @lostpointercapture="drag = null"
    @selectstart.prevent
    @dragstart.prevent
  >
    <svg
      ref="svg"
      class="graph-svg"
      :viewBox="`0 0 ${viewport.width} ${viewport.height}`"
      role="img"
      aria-label="知识图谱，点击节点查看详情"
    >
      <g :transform="`translate(${pan.x} ${pan.y}) scale(${zoom})`">
        <path
          v-for="node in nodes.filter((n) => n.parentId)"
          :key="`edge-${node.id}`"
          :d="path(node.parentId!, node.id)"
          class="tree-edge"
        />
        <path
          v-for="(edge, i) in relations"
          :key="`rel-${i}`"
          :d="path(edge.from, edge.to)"
          class="relation-edge"
        >
          <title>{{ edge.label }}</title>
        </path>
        <g
          v-for="node in nodes"
          :key="node.id"
          :data-node-id="node.id"
          :transform="`translate(${layout.positions.get(node.id)?.x ?? 0} ${(layout.positions.get(node.id)?.y ?? 0) - 28})`"
          class="graph-node"
          :class="{
            root: !node.parentId,
            selected: selected === node.id,
            extra: node.status === 'supplemented',
          }"
          tabindex="0"
          role="button"
          :aria-label="node.label"
          @focus="ensureVisible(node.id)"
          @click="emit('select', node.id)"
          @keydown.enter="emit('select', node.id)"
          @keydown.space.prevent="emit('select', node.id)"
        >
          <rect width="184" height="56" rx="12" />
          <circle cx="19" cy="28" r="4" />
          <text x="33" y="33">
            {{ node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label }}
          </text>
          <title>{{ node.label }}：{{ node.summary }}</title>
        </g>
      </g>
    </svg>
    <div class="graph-legend">
      <span><i />知识层级</span><span><i class="dashed" />关联关系</span>
    </div>
    <div class="graph-tools" @pointerdown.stop>
      <button title="缩小" aria-label="缩小图谱" @click="zoom = Math.max(0.35, zoom - 0.15)">
        <Minus :size="15" />
      </button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button title="放大" aria-label="放大图谱" @click="zoom = Math.min(2.5, zoom + 0.15)">
        <Plus :size="15" />
      </button>
      <div class="divider" />
      <button title="重置视图" aria-label="重置视图" @click="reset"><Maximize :size="15" /></button>
    </div>
    <div v-if="!nodes.length" class="empty graph-empty">
      <GitBranch :size="36" />
      <h3>知识，从一个片段开始</h3>
      <p>添加素材并点击「开始整理」，让零散知识连接起来。</p>
    </div>
  </div>
</template>
