import type { Project } from './types'
export function demoProject(): Project {
  const now = new Date().toISOString()
  return {
    id: 'demo',
    title: '线性代数学习笔记',
    description: '从向量出发，理解线性世界的结构与变换。',
    color: 'green',
    updatedAt: now,
    organizedAt: now,
    sources: [
      {
        id: 's1',
        title: '向量与线性空间.md',
        kind: 'md',
        createdAt: now,
        content:
          '向量可以相加和数乘。线性无关的向量组可以构成向量空间的一组基，基中向量个数是空间的维数。矩阵的列空间由它的列向量张成，列空间的维数是秩。',
      },
      {
        id: 's2',
        title: '课堂随记 · 线性变换',
        kind: 'text',
        createdAt: now,
        content:
          '矩阵表示线性变换。线性变换满足 T(au+bv)=aT(u)+bT(v)。矩阵乘法对应变换的复合。特征向量在变换后方向保持在同一直线上，Av=λv，v不能为零。',
      },
      {
        id: 's3',
        title: '特征值与对角化.tex',
        kind: 'tex',
        createdAt: now,
        content: String.raw`特征值由 $\det(A-\lambda I)=0$ 求解。n 阶矩阵有 n 个线性无关的特征向量时可对角化：$A=PDP^{-1}$，其中 P 的列是特征向量。`,
      },
    ],
    result: {
      nodes: [
        {
          id: 'n1',
          label: '线性代数',
          summary: '研究向量空间及其线性变换的数学分支。沿着「空间 → 变换 → 结构」建立知识脉络。',
          parentId: null,
          sourceIds: ['s1', 's2', 's3'],
          status: 'original',
        },
        {
          id: 'n2',
          label: '向量空间',
          summary: '对向量加法与数乘封闭的集合，是理解线性代数的起点。',
          parentId: 'n1',
          sourceIds: ['s1'],
          status: 'original',
        },
        {
          id: 'n3',
          label: '矩阵与线性变换',
          summary: '矩阵是在选定基下线性变换的表示。矩阵乘法对应线性变换的复合。',
          parentId: 'n1',
          sourceIds: ['s2'],
          status: 'original',
        },
        {
          id: 'n4',
          label: '特征值与特征向量',
          summary: '寻找在线性变换下保持方向在同一直线上的非零向量，用 Av = λv 描述。',
          parentId: 'n1',
          sourceIds: ['s2', 's3'],
          status: 'original',
        },
        {
          id: 'n5',
          label: '基与维数',
          summary: '基是张成空间的线性无关向量组；基包含的向量数就是维数。',
          parentId: 'n2',
          sourceIds: ['s1'],
          status: 'original',
        },
        {
          id: 'n6',
          label: '线性无关',
          summary: '只有系数全为零时线性组合才为零的向量组称为线性无关。',
          parentId: 'n2',
          sourceIds: ['s1'],
          status: 'original',
        },
        {
          id: 'n7',
          label: '矩阵的秩',
          summary: '列空间的维数，衡量矩阵能够保留的独立信息的数量。',
          parentId: 'n3',
          sourceIds: ['s1'],
          status: 'original',
        },
        {
          id: 'n8',
          label: '矩阵对角化',
          summary: '当存在足够多的线性无关特征向量时，可以在特征向量基下将矩阵表示为对角矩阵。',
          parentId: 'n4',
          sourceIds: ['s3'],
          status: 'original',
        },
      ],
      relations: [{ from: 'n6', to: 'n8', label: '可对角化的条件' }],
      notes: [
        {
          id: 'note1',
          title: '向量空间：从直觉到结构',
          nodeIds: ['n2', 'n5', 'n6'],
          sourceIds: ['s1'],
          content: String.raw`# 向量空间：从直觉到结构

向量不仅是一支带方向的箭头，也可以是一组数据、一个多项式，甚至一个函数。**线性代数的起点，是研究这些对象共有的结构。**

## 01 / 向量与线性组合

对一组向量 $v_1, v_2, \ldots, v_k$，它们的线性组合写为：

$$
v = a_1v_1 + a_2v_2 + \cdots + a_kv_k
$$

其中 $a_i$ 是标量。所有线性组合形成的集合称为这些向量的**张成空间**。

## 02 / 线性无关

如果等式

$$
a_1v_1 + \cdots + a_kv_k = 0
$$

只有在所有 $a_i = 0$ 时成立，那么这组向量就是线性无关的。这意味着每个向量都提供了一个无法被其他向量替代的方向。

## 03 / 基与维数

一组向量如果既线性无关，又能张成整个空间，就构成这个空间的一组**基**。基中向量的个数称为**维数**。

> 理解线索：线性组合回答「能走到哪里」，线性无关回答「是否有多余方向」，基则给出一套恰好够用的坐标。

---
素材来源：向量与线性空间.md`,
        },
        {
          id: 'note2',
          title: '矩阵，是线性变换的语言',
          nodeIds: ['n3', 'n7'],
          sourceIds: ['s1', 's2'],
          content: String.raw`# 矩阵，是线性变换的语言

## 线性变换

线性变换保持加法与数乘：

$$T(au+bv)=aT(u)+bT(v)$$

选定一组基后，线性变换可以表示为矩阵。每一列描述一个基向量被变换后的位置。

## 复合与秩

矩阵乘法对应变换的复合。矩阵的**秩**等于列空间的维数，描述变换后剩余的独立方向数量。

素材来源：课堂随记 · 线性变换、向量与线性空间.md`,
        },
        {
          id: 'note3',
          title: '沿着特征向量理解对角化',
          nodeIds: ['n4', 'n8'],
          sourceIds: ['s2', 's3'],
          content: String.raw`# 沿着特征向量理解对角化

## 不改变所在直线的方向

对非零向量 $v$，若有 $Av=\lambda v$，则 $v$ 是特征向量，$\lambda$ 是对应的特征值。

$$\det(A-\lambda I)=0$$

## 换一组基，简化变换

当 $n$ 阶矩阵存在 $n$ 个线性无关的特征向量时，可以对角化：

$$A=PDP^{-1}$$

$P$ 的列是特征向量，$D$ 的对角元素是相应特征值。

素材来源：特征值与对角化.tex、课堂随记 · 线性变换`,
        },
      ],
      changes: [],
    },
  }
}
