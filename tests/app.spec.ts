import { test, expect, type Page } from '@playwright/test'
import { demoProject } from '../src/demo'
test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith('empty')) return
  const state = {
    projects: [demoProject()],
    activeId: 'demo',
    settings: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      prompt: '使用简体中文',
      correct: false,
      supplement: false,
    },
  }
  await page.addInitScript((state) => {
    if (!localStorage.getItem('guiye.workspace.v1'))
      localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
  }, state)
})
const nav = (page: Page, name: string) =>
  page
    .locator('.page-nav')
    .getByRole('button', { name: new RegExp(name) })
    .click()
async function addFragment(page: Page, content: string) {
  await nav(page, '素材')
  await page.getByRole('button', { name: '新建片段', exact: true }).click()
  await page.getByLabel('知识片段', { exact: true }).fill(content)
  await page.getByRole('button', { name: '添加知识片段' }).click()
}

test('separate pages, knowledge graph, LaTeX, note editing and export', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '线性代数学习笔记' })).toBeVisible()
  await expect(page.locator('.graph-surface')).toHaveCount(0)
  await expect(page.locator('.source-table')).toHaveCount(0)
  await nav(page, '知识图谱')
  await page.getByRole('button', { name: '矩阵对角化', exact: true }).focus()
  await page.getByRole('button', { name: '矩阵对角化', exact: true }).click()
  await expect(page.locator('.node-detail h3')).toHaveText('矩阵对角化')
  await page.locator('.node-detail .note-link').click()
  await expect(page.locator('.markdown-body h1')).toHaveText('沿着特征向量理解对角化')
  await expect(page.locator('.katex').first()).toBeVisible()
  await expect(page.locator('.katex-error')).toHaveCount(0)
  await expect(page.locator('.graph-surface')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page
    .getByLabel('编辑 Markdown 笔记')
    .fill('# 编辑后的笔记\n\n$x^2$\n\n$$\n\\frac{1}{2}\n$$\n\n<script>alert(1)</script>')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('.markdown-body h1')).toHaveText('编辑后的笔记')
  await expect(page.locator('.markdown-body script')).toHaveCount(0)
  await expect(page.locator('.katex')).toHaveCount(2)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出当前笔记', exact: true }).click()
  expect((await downloadEvent).suggestedFilename()).toMatch(/\.md$/)
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(page.getByRole('heading', { name: '知识文档', exact: true })).toBeVisible()
  await page.locator('.note-selector button').last().click()
  await expect(page.locator('.markdown-body h1')).toHaveText('编辑后的笔记')
  expect(errors).toEqual([])
})

test('create project, collect, import, edit, persist and delete', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click()
  await page.getByLabel('项目名称').fill('概率论整理')
  await page.getByLabel('一句话介绍').fill('概率与条件概率')
  await page.getByRole('button', { name: '创建项目', exact: true }).click()
  await expect(page.getByRole('heading', { name: '概率论整理' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始整理', exact: true })).toBeDisabled()
  await addFragment(page, '条件概率 P(A|B)=P(A∩B)/P(B)。')
  await page.locator('input[type=file]').setInputFiles([
    {
      name: '公式.tex',
      mimeType: 'text/plain',
      buffer: Buffer.from('贝叶斯公式：$P(A|B)=P(B|A)P(A)/P(B)$'),
    },
    {
      name: '概念.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 概率\n概率的取值在 0 到 1 之间。'),
    },
    { name: '空文件.txt', mimeType: 'text/plain', buffer: Buffer.from('') },
  ])
  await expect(page.locator('.source-item')).toHaveCount(3)
  await expect(page.getByRole('alert')).toContainText('文件为空')
  await page.getByRole('button', { name: '关闭错误提示' }).click()
  await page.locator('.source-item').first().click()
  await page.getByLabel('标题', { exact: true }).fill('条件概率定义')
  await page.getByRole('button', { name: '保存素材', exact: true }).click()
  await expect(page.locator('.source-item').first()).toContainText('条件概率定义')
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(page.locator('.breadcrumb')).toContainText('概率论整理')
  await expect(page.locator('.source-item')).toHaveCount(3)
  await page.getByLabel('搜索素材').fill('贝叶斯')
  await expect(page.locator('.source-item')).toHaveCount(1)
  await nav(page, '项目概览')
  await page.getByRole('button', { name: '开始整理', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('浏览器预览')
  await page.getByRole('button', { name: '项目操作' }).click()
  await page.getByRole('button', { name: '删除项目', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '删除项目', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('输入项目名称以确认').fill('概率论整理')
  await page.getByRole('dialog').getByRole('button', { name: '删除项目', exact: true }).click()
  await expect(page.locator('.project-picker')).toBeVisible()
})

test('settings page persists preferences without the API key', async ({ page }) => {
  await page.goto('/')
  await page.locator('.sidebar').getByRole('button', { name: '模型设置' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('模型名称').fill('custom-model')
  await page.getByLabel('API Key', { exact: true }).fill('test-secret-do-not-persist')
  await page.getByLabel('自定义提示词', { exact: true }).fill('按研究生的知识水平组织。')
  await page.getByLabel('纠正知识错误', { exact: true }).check()
  await expect(page.locator('.save-state')).toContainText('已保存')
  const stored = await page.evaluate(() => localStorage.getItem('guiye.workspace.v1'))
  expect(stored).not.toContain('test-secret-do-not-persist')
  expect(stored).toContain('custom-model')
  await page.reload()
  await expect(page.getByLabel('模型名称')).toHaveValue('custom-model')
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('纠正知识错误', { exact: true })).toBeChecked()
})

test('desktop IPC success, failure preservation and undo', async ({ page }) => {
  await page.addInitScript(() => {
    let workspace: any = null
    let attempts = 0
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          workspace = args.workspace
          return
        }
        if (command === 'organize') {
          attempts++
          if (attempts === 2) throw '测试：模型暂时不可用'
          const result = JSON.parse(JSON.stringify(workspace.projects[0].result))
          result.nodes[0].label = '已整理的线性代数'
          result.notes[0].title = 'AI 生成的新笔记'
          return result
        }
      },
    }
  })
  await page.goto('/')
  await addFragment(page, '测试新素材')
  await expect(page.locator('.save-state')).toContainText('已保存')
  await nav(page, '项目概览')
  await page.getByRole('button', { name: '开始整理', exact: true }).click()
  await page.getByRole('button', { name: '开始重新整理' }).click()
  await expect(page.locator('.recent-note').first()).toContainText('AI 生成的新笔记')
  await nav(page, '知识图谱')
  await expect(page.getByRole('button', { name: '已整理的线性代数', exact: true })).toBeVisible()
  await nav(page, '项目概览')
  await page.getByRole('button', { name: '开始整理', exact: true }).click()
  await page.getByRole('button', { name: '开始重新整理' }).click()
  await expect(page.getByRole('alert')).toContainText('模型暂时不可用')
  await expect(page.locator('.recent-note').first()).toContainText('AI 生成的新笔记')
  await page.getByRole('button', { name: '撤销本次整理' }).click()
  await expect(page.locator('.recent-note').first()).toContainText('向量空间：从直觉到结构')
})

test('desktop page screenshots and mobile layout', async ({ page }) => {
  await page.goto('/')
  await page.mouse.move(0, 0)
  await page.screenshot({ path: 'test-results/guiye-overview.png', fullPage: true })
  for (const [label, file] of [
    ['素材', 'sources'],
    ['知识图谱', 'graph'],
    ['知识文档', 'notes'],
  ]) {
    await nav(page, label!)
    await page.mouse.move(0, 0)
    await page.screenshot({ path: `test-results/guiye-${file}.png`, fullPage: true })
  }
  await page.locator('.sidebar').getByRole('button', { name: '模型设置' }).click()
  await page.mouse.move(0, 0)
  await page.screenshot({ path: 'test-results/guiye-settings.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const label of ['项目概览', '素材', '知识图谱', '知识文档']) {
    // Sidebar labels are visually hidden on small screens; select by navigation order.
    const index = ['项目概览', '素材', '知识图谱', '知识文档'].indexOf(label)
    await nav(page, label)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  }
  await page.locator('.page-nav button').first().click()
  await page.mouse.move(0, 0)
  await page.screenshot({ path: 'test-results/guiye-mobile.png', fullPage: true })
})

test('source pagination and filter reset', async ({ page }) => {
  await page.goto('/')
  await nav(page, '素材')
  await page.locator('input[type=file]').setInputFiles(
    Array.from({ length: 13 }, (_, i) => ({
      name: `分页-${i}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`第 ${i} 段知识`),
    })),
  )
  await expect(page.locator('.source-item')).toHaveCount(12)
  await page.getByRole('button', { name: '下一页素材' }).click()
  await expect(page.locator('.source-item')).toHaveCount(4)
  await page.getByLabel('搜索素材').fill('分页-12')
  await expect(page.locator('.source-item')).toHaveCount(1)
  await expect(page.locator('.source-item')).toContainText('分页-12.txt')
})

test('empty workspace has explicit project selection and stays empty after deletion', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('.project-picker')).toBeVisible()
  await expect(page.locator('.workspace-switch')).toHaveCount(0)
  await expect(page.locator('.project-item')).toHaveCount(0)
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click()
  await page.getByLabel('项目名称').fill('临时知识库')
  await page.getByRole('button', { name: '创建项目', exact: true }).click()
  await page.getByRole('button', { name: '项目操作' }).click()
  await page.getByRole('button', { name: '删除项目', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '删除项目', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('输入项目名称以确认').fill('临时知识库')
  await page.getByRole('dialog').getByRole('button', { name: '删除项目', exact: true }).click()
  await expect(page.locator('.project-picker')).toBeVisible()
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(page.locator('.project-picker')).toBeVisible()
  await expect(page.locator('.project-item')).toHaveCount(0)
  await page.locator('.sidebar').getByRole('button', { name: '模型设置' }).click()
  await expect(page.getByLabel('模型名称')).toBeVisible()
  expect(errors).toEqual([])
})

test('source organize entry, custom context menus and pointer-centered wheel zoom', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, '素材')
  await expect(page.getByRole('button', { name: '开始整理', exact: true })).toBeEnabled()
  await page.locator('.source-item').first().click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: '查看 / 编辑素材' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await nav(page, '知识图谱')
  const canvas = page.locator('.graph-surface')
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -250)
  await expect(page.locator('.graph-tools')).not.toContainText('100%')
  await page.getByRole('button', { name: '重置视图', exact: true }).click()
  await expect(page.locator('.graph-tools')).toContainText('100%')
  await page.mouse.move(box.x + 20, box.y + box.height - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + box.height - 100, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')

  await page.getByRole('button', { name: '向量空间', exact: true }).focus()
  await page.getByRole('button', { name: '向量空间', exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: '解释这个知识点' }).click()
  await expect(page.getByLabel('向知识库提问')).toHaveValue(/向量空间/)
})

test('grounded knowledge QA preserves history and accepts answer as new source', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          localStorage.setItem('guiye.workspace.v1', JSON.stringify(args.workspace))
          return
        }
        if (command === 'ask_question') {
          if (!args.request.knowledge || !args.request.sources.length) throw 'Missing context'
          return {
            answer: '基是线性无关且张成空间的向量组。来源：向量与线性空间.md。维数记为 $\\dim V$。',
            sourceIds: ['s1'],
            nodeIds: ['n2'],
            noteIds: ['note1'],
          }
        }
      },
    }
  })
  await page.goto('/')
  await nav(page, '知识问答')
  await page.getByLabel('向知识库提问').fill('基和维数是什么关系？')
  await page.getByRole('button', { name: '提问', exact: true }).click()
  await expect(page.locator('.chat-message.assistant')).toContainText('张成空间')
  await expect(page.locator('.chat-citations')).toContainText('向量与线性空间.md')
  await page.getByRole('button', { name: '作为新素材加入知识库' }).click()
  await expect(page.getByLabel('知识片段', { exact: true })).toHaveValue(/AI 回答，待核实/)
  await page.getByRole('button', { name: '添加知识片段' }).click()
  await expect(page.locator('.source-item')).toHaveCount(4)
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await nav(page, '知识问答')
  await expect(page.locator('.chat-message.assistant')).toContainText('张成空间')
})

test('extracted knowledge points expose evidence, graph location and follow-up questions', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    state.projects[0].result.knowledgePoints = [
      {
        id: 'kp-test',
        label: '向量空间中的基',
        detail: '一组线性无关且能张成整个空间的向量构成基。',
        sourceIds: ['s1'],
        evidence: [{ sourceId: 's1', quote: '基中向量个数是空间的维数。' }],
        status: 'original',
      },
    ]
    state.projects[0].result.nodes.find((n: any) => n.id === 'n2').pointIds = ['kp-test']
    localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
  })
  await page.goto('/')
  await nav(page, '知识点')
  await expect(page.locator('.knowledge-card')).toContainText('向量空间中的基')
  await page.locator('.knowledge-card summary').click()
  await expect(page.locator('.knowledge-card blockquote')).toContainText('基中向量个数')
  await page.getByRole('button', { name: '图谱位置' }).click()
  await expect(page.locator('.node-detail h3')).toHaveText('向量空间')
  await nav(page, '知识点')
  await page.locator('.knowledge-card').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '向 AI 追问' }).click()
  await expect(page.getByLabel('向知识库提问')).toHaveValue(/向量空间中的基/)
})

test('project context deletion requires exact name and source removal also confirms', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.project-item').first().click({ button: 'right' })
  await expect(page.getByRole('menuitem').last()).toHaveText('删除项目')
  await expect(page.getByRole('menuitem').last()).toHaveCSS('color', 'rgb(220, 38, 38)')
  await page.getByRole('menuitem', { name: '删除项目', exact: true }).click()
  await page.getByLabel('输入项目名称以确认').fill('错误名称')
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '删除项目', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await nav(page, '素材')
  await page.locator('.source-item').first().click()
  await page.getByRole('button', { name: '移除素材', exact: true }).click()
  await expect(page.getByLabel('输入项目名称以确认')).toHaveCount(0)
  await expect(page.locator('.source-item')).toHaveCount(3)
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '移除素材', exact: true }),
  ).toHaveCSS('background-color', 'rgb(220, 38, 38)')
  await page.getByRole('dialog').getByRole('button', { name: '移除素材', exact: true }).click()
  await expect(page.locator('.source-item')).toHaveCount(2)
})

test('chat stays locked across navigation until request settles', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          localStorage.setItem('guiye.workspace.v1', JSON.stringify(args.workspace))
          return
        }
        if (command === 'ask_question')
          return new Promise((_resolve, reject) => {
            ;(window as any).finishQuestion = () => reject('测试失败')
          })
      },
    }
  })
  await page.goto('/')
  await nav(page, '知识问答')
  await page.getByLabel('向知识库提问').fill('测试问题')
  await page.getByRole('button', { name: '提问', exact: true }).click()
  await expect(page.getByLabel('向知识库提问')).toBeDisabled()
  await nav(page, '素材')
  await nav(page, '知识问答')
  await expect(page.getByLabel('向知识库提问')).toBeDisabled()
  await page.evaluate(() => (window as any).finishQuestion())
  await expect(page.getByLabel('向知识库提问')).toBeEnabled()
})

test('single source organization excludes other pending sources and persists status', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    if (!sessionStorage.getItem('single-source-initialized')) {
      state.projects[0].result = null
      localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
      sessionStorage.setItem('single-source-initialized', 'true')
    }
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          localStorage.setItem('guiye.workspace.v1', JSON.stringify(args.workspace))
          return
        }
        if (command === 'organize') {
          ;(window as any).organizedSources = args.request.sources
          const source = args.request.sources[0]
          let hash = 0xcbf29ce484222325n
          for (const byte of new TextEncoder().encode(source.title + '\0' + source.content))
            hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn
          return {
            nodes: [],
            notes: [],
            relations: [],
            changes: [],
            extractionVersion: 2,
            sourceFingerprints: { [source.id]: hash.toString(16).padStart(16, '0') },
          }
        }
      },
    }
  })
  await page.goto('/')
  await nav(page, '素材')
  await page
    .locator('.source-item')
    .first()
    .getByRole('button', { name: '整理入库', exact: true })
    .click()
  await expect(page.locator('.source-item').first()).toContainText('已整理')
  expect(await page.evaluate(() => (window as any).organizedSources.length)).toBe(1)
  await expect(page.locator('.source-item').nth(1)).toContainText('待整理')
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(page.locator('.source-item').first()).toContainText('已整理')
  await page.locator('.source-item').first().click()
  await page.getByLabel('内容', { exact: true }).fill('已修改')
  await page.getByRole('button', { name: '保存素材' }).click()
  await expect(page.locator('.source-item').first()).toContainText('待整理')
})

test('graph nodes keep their pixel size with many nodes and keyboard navigation reveals distant concepts', async ({
  page,
}) => {
  await page.goto('/#graph')
  const width = await page
    .locator('.graph-node rect')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeCloseTo(184, 0)
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    state.projects[0].result.nodes = [
      {
        id: 'root',
        label: '知识目录',
        summary: '目录',
        parentId: null,
        sourceIds: ['s1'],
        status: 'original',
      },
      ...Array.from({ length: 150 }, (_, i) => ({
        id: 'leaf-' + i,
        label: '概念' + i,
        summary: '完整概念说明',
        parentId: 'root',
        sourceIds: ['s1'],
        status: 'original',
      })),
    ]
    state.projects[0].result.relations = []
    localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
  })
  await page.reload()
  await expect
    .poll(async () =>
      page
        .locator('.graph-node rect')
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(184, 0)
  await page.setViewportSize({ width: 1100, height: 800 })
  await expect
    .poll(async () =>
      page
        .locator('.graph-node rect')
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(184, 0)
  const last = page.getByRole('button', { name: '概念149', exact: true })
  await last.focus()
  await last.press('Enter')
  await expect(page.locator('.node-detail h3')).toHaveText('概念149')
  const box = await last.boundingBox()
  const canvas = await page.locator('.graph-surface').boundingBox()
  expect(box!.y).toBeGreaterThan(canvas!.y)
  expect(box!.y + box!.height).toBeLessThan(canvas!.y + canvas!.height)
})

test('knowledge points are created directly, editable, and persistent without source fragments', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click()
  await page.getByLabel('项目名称').fill('手动知识库')
  await page.getByRole('button', { name: '创建项目', exact: true }).click()
  await nav(page, '知识点')
  await page.getByRole('button', { name: '新建知识点', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存知识点', exact: true })).toBeDisabled()
  await page.getByLabel('知识点标题').fill('我的公式')
  await page.getByLabel('知识点正文').fill('$$\n1+1=3\n$$')
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await expect(page.locator('.knowledge-card')).toHaveCount(1)
  await expect(page.locator('.knowledge-card .katex')).toHaveCount(1)
  await expect(page.locator('.save-state')).toContainText('已保存')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guiye.workspace.v1')!))
  const project = saved.projects.find((p: any) => p.id === saved.activeId)
  expect(project.sources).toEqual([])
  expect(project.result.knowledgePoints[0].manual).toBe(true)
  await page.getByRole('button', { name: '编辑知识点', exact: true }).click()
  await page.getByLabel('知识点正文').fill('不应保存的内容')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('.knowledge-card')).not.toContainText('不应保存')
  await page.locator('.knowledge-card').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '编辑知识点', exact: true }).click()
  await page.getByLabel('知识点标题').fill('修改后的公式')
  await page.getByLabel('知识点正文').fill('手动内容：$1+1=2$。')
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(page.locator('.knowledge-card h2')).toHaveText('修改后的公式')
  await page.getByRole('button', { name: '图谱位置', exact: true }).click()
  await expect(page.locator('.node-detail h3')).toHaveText('修改后的公式')
  await nav(page, '知识问答')
  await page.getByLabel('向知识库提问').fill('解释这个公式')
  await expect(page.getByRole('button', { name: '提问', exact: true })).toBeEnabled()
  await nav(page, '素材')
  await expect(page.locator('.source-item')).toHaveCount(0)
})

test('editing an extracted point retains its identity and original evidence', async ({ page }) => {
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    state.projects[0].result.knowledgePoints = [
      {
        id: 'kp-edit',
        label: '原始概念',
        detail: '原始解释',
        sourceIds: ['s1'],
        evidence: [{ sourceId: 's1', quote: '真实原文' }],
      },
    ]
    state.projects[0].result.nodes[1].pointIds = ['kp-edit']
    localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
  })
  await page.goto('/')
  await nav(page, '知识点')
  await page.getByRole('button', { name: '编辑知识点', exact: true }).click()
  await page.getByLabel('知识点正文').fill('用户修改的完整解释')
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await expect(page.locator('.save-state')).toContainText('已保存')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guiye.workspace.v1')!))
  const point = saved.projects[0].result.knowledgePoints[0]
  expect(point.id).toBe('kp-edit')
  expect(point.detail).toBe('用户修改的完整解释')
  expect(point.evidence).toEqual([{ sourceId: 's1', quote: '真实原文' }])
  expect(saved.projects[0].sources).toHaveLength(3)
})

test('graph detail reopens from node and context menu and canvas uses available height', async ({
  page,
}) => {
  await page.goto('/')
  await nav(page, '知识图谱')
  await expect(page.locator('.page-graph .page-heading')).toHaveCount(0)
  const bounds = await page.locator('.graph-surface').boundingBox()
  expect(bounds!.height).toBeGreaterThan(850)
  await page.getByRole('button', { name: '关闭节点详情' }).click()
  const node = page.getByRole('button', { name: '矩阵对角化', exact: true })
  await node.focus()
  await node.click()
  await expect(page.locator('.node-detail h3')).toHaveText('矩阵对角化')
  await page.getByRole('button', { name: '关闭节点详情' }).click()
  await node.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '查看知识点详情', exact: true }).click()
  await expect(page.locator('.node-detail h3')).toHaveText('矩阵对角化')
})

test('manual point parent can move and excludes descendants', async ({ page }) => {
  await page.goto('/')
  await nav(page, '知识点')
  await page.getByRole('button', { name: '新建知识点', exact: true }).click()
  await page.getByLabel('知识点标题').fill('新建子概念')
  await page.getByLabel('知识点正文').fill('完整解释：$x^2$')
  const options = await page
    .getByLabel('父节点', { exact: true })
    .locator('option')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean))
  await page.getByLabel('父节点', { exact: true }).selectOption(options[1])
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await page.getByRole('button', { name: '编辑知识点', exact: true }).click()
  await expect(page.getByLabel('父节点', { exact: true })).toHaveValue(options[1])
  await page.getByLabel('父节点', { exact: true }).selectOption(options[2])
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await expect(page.locator('.save-state')).toContainText('已保存')
  const parent = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    return state.projects[0].result.nodes.find((n: any) => n.label === '新建子概念').parentId
  })
  expect(parent).toBe(options[2])
  await page.getByRole('button', { name: '图谱位置', exact: true }).click()
  await expect(page.locator('.node-detail .katex')).toHaveCount(1)
  await page
    .locator('.node-detail')
    .getByRole('button', { name: '编辑知识点', exact: true })
    .click()
  await expect(
    page.getByLabel('父节点', { exact: true }).locator('option', { hasText: '新建子概念' }),
  ).toHaveCount(0)
})

test('batch selection organizes chosen sources and deletion preserves knowledge', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          localStorage.setItem('guiye.workspace.v1', JSON.stringify(args.workspace))
          return
        }
        if (command === 'organize') {
          ;(window as any).batchSourceIds = args.request.sources.map((s: any) => s.id)
          return args.request.previous
        }
      },
    }
  })
  await page.goto('/')
  await nav(page, '素材')
  const rows = page.locator('.source-item')
  const chosen = [
    await rows.nth(0).getAttribute('data-source-id'),
    await rows.nth(1).getAttribute('data-source-id'),
  ]
  await rows.nth(0).getByRole('checkbox').check()
  await rows.nth(1).getByRole('checkbox').check()
  await expect(page.locator('.modal')).toHaveCount(0)
  await page.getByRole('button', { name: '整理所选', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).batchSourceIds)).toEqual(chosen)
  await page.getByRole('button', { name: '删除所选', exact: true }).click()
  await expect(page.getByText('已选择 2 份素材。')).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await page.getByRole('button', { name: '删除所选', exact: true }).click()
  await page.getByRole('button', { name: '移除素材', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.locator('.save-state')).toContainText('已保存')
  await page.reload()
  await expect(rows).toHaveCount(1)
  await nav(page, '知识文档')
  await expect(page.locator('.note-index [data-note-id]')).not.toHaveCount(0)
})

test('rebuild hierarchy uses dedicated command and preserves notes on success and graph on failure', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
    state.projects[0].result.knowledgePoints = [
      { id: 'kp1', label: '维数', detail: '维数说明', sourceIds: [], evidence: [], manual: true },
    ]
    state.projects[0].result.nodes[1].pointIds = ['kp1']
    localStorage.setItem('guiye.workspace.v1', JSON.stringify(state))
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'load_workspace')
          return JSON.parse(localStorage.getItem('guiye.workspace.v1')!)
        if (command === 'save_workspace') {
          localStorage.setItem('guiye.workspace.v1', JSON.stringify(args.workspace))
          return
        }
        if (command === 'organize') throw new Error('重建层级不应调用全文整理')
        if (command === 'rebuild_graph') {
          if ((window as any).failRebuild) throw new Error('层级仍是扁平列表')
          const result = JSON.parse(JSON.stringify(args.request.previous))
          result.nodes[0].label = '新的层级根节点'
          return result
        }
      },
    }
  })
  await page.goto('/')
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('guiye.workspace.v1')!).projects[0].result,
  )
  await nav(page, '知识图谱')
  await page.getByRole('button', { name: '重建层级', exact: true }).click()
  await expect(page.locator('.node-detail h3')).toHaveText('新的层级根节点')
  await expect(page.locator('.save-state')).toContainText('已保存')
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('guiye.workspace.v1')!).projects[0].result,
  )
  expect(saved.notes).toEqual(before.notes)
  expect(saved.knowledgePoints).toEqual(before.knowledgePoints)
  await page.evaluate(() => {
    ;(window as any).failRebuild = true
  })
  await page.getByRole('button', { name: '重建层级', exact: true }).click()
  await expect(page.getByText('Error: 层级仍是扁平列表', { exact: true })).toBeVisible()
  await expect(page.locator('.node-detail h3')).toHaveText('新的层级根节点')
})
