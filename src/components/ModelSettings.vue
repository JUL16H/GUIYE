<script setup lang="ts">
import {
  KeyRound,
  SlidersHorizontal,
  Globe2,
  Bot,
  LoaderCircle,
  ArrowUpRight,
  Check,
  ShieldCheck,
} from 'lucide-vue-next'
import type { Settings } from '../types'
defineProps<{ settings: Settings; checking: boolean; testStatus: string }>()
defineEmits<{ test: [] }>()
</script>
<template>
  <div class="settings-layout">
    <div class="settings-main">
      <section class="settings-card">
        <div class="settings-card-title">
          <span class="setting-icon"><Bot :size="20" /></span>
          <div>
            <h2>模型连接</h2>
            <p>支持兼容 Chat Completions 与 JSON Output 的模型服务。</p>
          </div>
          <span class="badge">自定义服务商</span>
        </div>
        <label class="field"
          >API 地址
          <div class="input-with-icon">
            <Globe2 :size="16" /><input
              v-model="settings.baseUrl"
              type="url"
              placeholder="https://api.deepseek.com"
            /></div
        ></label>
        <label class="field"
          >模型名称<input v-model="settings.model" placeholder="deepseek-chat"
        /></label>
        <label class="field"
          >API Key
          <div class="input-with-icon">
            <KeyRound :size="16" /><input
              v-model="settings.apiKey"
              type="password"
              autocomplete="off"
              placeholder="输入 Key，或留空使用环境变量"
            /></div
        ></label>
        <p class="field-hint">留空时，DeepSeek 官方地址会读取桌面进程的 DEEPSEEK_API 环境变量。</p>
        <div class="settings-card-footer">
          <span class="connection-status" role="status">{{
            testStatus || '保存设置后，可测试模型是否可用。'
          }}</span
          ><button class="button secondary" :disabled="checking" @click="$emit('test')">
            <LoaderCircle v-if="checking" :size="15" class="spin" />{{
              checking ? '连接中…' : '测试连接'
            }}<ArrowUpRight v-if="!checking" :size="14" />
          </button>
        </div>
      </section>
      <section class="settings-card">
        <div class="settings-card-title">
          <span class="setting-icon"><SlidersHorizontal :size="19" /></span>
          <div>
            <h2>整理偏好</h2>
            <p>决定 AI 如何处理你的原始知识。</p>
          </div>
        </div>
        <label class="option-row"
          ><span
            >纠正知识错误<small>识别事实或推导中的错误，说明修正原因，并保留素材来源。</small></span
          ><input
            v-model="settings.correct"
            type="checkbox"
            class="switch"
            aria-label="纠正知识错误"
        /></label>
        <label class="option-row"
          ><span
            >补充关联知识<small>适度补充必要背景，在图谱和笔记中明确标记 AI 补充内容。</small></span
          ><input
            v-model="settings.supplement"
            type="checkbox"
            class="switch"
            aria-label="补充关联知识"
        /></label>
        <label class="field prompt-field"
          >自定义提示词<textarea
            v-model="settings.prompt"
            rows="5"
            maxlength="5000"
            placeholder="描述你的学习背景、期望的笔记结构或表达方式…"
          />
        </label>
        <div class="prompt-footnote">
          <span>纠错与补充开关优先于提示词。</span><span>{{ settings.prompt.length }} / 5000</span>
        </div>
      </section>
    </div>
    <aside class="settings-aside">
      <ShieldCheck :size="24" />
      <h3>你的模型，你的数据</h3>
      <p>API Key 只在本次会话中使用，不写入项目文件，也不会包含在导出内容中。</p>
      <div class="aside-divider" />
      <h4>什么时候会发送素材？</h4>
      <p>仅当你点击「开始整理」。项目素材与提示词将发送到你配置的模型服务。</p>
      <h4>本地模型</h4>
      <p>可填写本机服务地址，例如 http://localhost:11434/v1。无需 Key 的本机服务可将 Key 留空。</p>
      <span class="autosave-note"><Check :size="14" />偏好设置自动保存</span>
    </aside>
  </div>
</template>
