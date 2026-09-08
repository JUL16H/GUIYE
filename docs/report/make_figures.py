from pathlib import Path
from html import escape
OUT=Path(__file__).resolve().parent/'assets'

def svg(name,w,h,body):
    head=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#334155" stroke-width="1.4"/></marker></defs><rect width="100%" height="100%" fill="white"/><g font-family="Noto Sans CJK SC, sans-serif" fill="#111827">'''
    (OUT/(name+'.svg')).write_text(head+body+'</g></svg>')
def text(x,y,lines,size=19):
    return ''.join(f'<text x="{x}" y="{y+i*28}" text-anchor="middle" font-size="{size}">{escape(line)}</text>' for i,line in enumerate(lines.split('\n')))
def box(x,y,w,h,label,fill='#f5f7fa',round=4):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{round}" fill="{fill}" stroke="#334155" stroke-width="2"/>'+text(x+w/2,y+h/2-14*(label.count('\n'))+7,label)
def arrow(points,label='',lx=0,ly=0):
    return f'<polyline points="{points}" fill="none" stroke="#334155" stroke-width="2" marker-end="url(#arrow)"/>'+ (text(lx,ly,label,16) if label else '')
def diamond(x,y,w,h,label):
    return f'<polygon points="{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}" fill="#fff" stroke="#334155" stroke-width="2"/>'+text(x+w/2,y+h/2+6,label,18)

b=box(35,30,830,100,'交互层：Vue 3 + TypeScript\n素材管理 · 知识点编辑 · 知识图谱 · 知识文档 · 知识问答')
b+=arrow('450,130 450,190','Tauri IPC / 进度事件',625,163)
b+=box(35,190,830,78,'桌面命令层：参数校验 · 加载检查点 · 回传进度')
b+=arrow('450,268 450,315')
for x,label in [(35,'知识整理\n提取 → 去重 → 层级 → 写作'),(320,'知识问答\n检索 → 生成 → 引用校验'),(605,'本地数据\n保存 · 备份 · 导出')]:
    b+=box(x,315,260,110,label)
b+=arrow('165,425 165,478 250,478 250,520')+arrow('450,425 450,478 250,478')+arrow('735,425 735,520')
b+=box(35,520,415,98,'远端模型服务\n兼容 Chat Completions 的接口')+box(515,520,350,98,'本地文件\n工作区 · 检查点 · Downloads')
svg('architecture',900,650,b)

b=box(265,15,330,55,'开始：选择素材并读取已有结果',round=24)+arrow('430,70 430,100')
b+=box(265,100,330,60,'比较指纹，复用已验证知识点')+arrow('430,160 430,190')
b+=box(265,190,330,60,'构建有限批次及补处理队列')+arrow('430,250 430,280')
b+=diamond(295,280,270,95,'队列是否为空？')
b+=arrow('565,327 745,327 745,905 595,905','是',625,312)
b+=arrow('430,375 430,415','否',451,403)
b+=box(265,415,330,60,'取出一批，优先恢复检查点')+arrow('430,475 430,505')
b+=box(265,505,330,72,'调用模型，恢复完整条目\n绑定原文证据及上下文分类')+arrow('430,577 430,610')
b+=diamond(295,610,270,95,'本批是否覆盖完整？')
b+=arrow('295,657 155,657 155,785 265,785','是',220,641)
b+=arrow('430,705 430,735','否',452,726)
b+=box(265,735,330,100,'保存有效条目及分类理由\n缺失部分补上下文、重试或拆分\n达到终止条件时明确保留原文')
b+=arrow('265,785 80,785 80,327 295,327','继续下一批',158,308)
b+=box(265,875,330,60,'去重、纠错、层级规划')+arrow('430,935 430,965')
b+=box(265,965,330,60,'分段写作、引用校验、本地保存')+arrow('430,1025 430,1055')
b+=box(265,1055,330,55,'结束：展示知识图谱与文档',round=24)
svg('organize-flow',860,1140,b)

b=box(35,25,760,65,'用户问题 + 最近追问 + 可选指定文档')+arrow('415,90 415,125')
b+=box(35,125,760,85,'本地文本相关性检索\n素材、知识节点及文档 → 受限数量与长度的候选片段')+arrow('415,210 415,245')
b+=box(35,245,760,85,'构造模型上下文并生成回答\n候选内容 + 允许使用的来源 ID')+arrow('415,330 415,365')
b+=box(35,365,760,85,'校验 sourceIds / nodeIds / noteIds\n仅接受检索上下文中的引用')+arrow('415,450 415,485')
b+=box(35,485,760,65,'显示回答与可追溯的引用链接')
svg('rag-flow',830,575,b)
print('Three SVG diagrams generated')
