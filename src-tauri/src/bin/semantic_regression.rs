// Real provider quality regression, synthetic notes only.
use guiye_lib::ai::{self, KnowledgeResult, OrganizeRequest, Settings, Source};
fn sources() -> Vec<Source> {
    vec![
        Source { id:"algebra".into(), title:"Lecture_01.tex".into(), content:r#"\documentclass{article}
\usepackage{amsmath}
\begin{document}
\tableofcontents

\section{向量与基}
\label{sec:basis}

一组向量线性无关，当且仅当它们的线性组合等于零向量时，所有系数都只能为零：
\[
\begin{aligned}
a_1v_1+\cdots+a_nv_n &= 0 \\

&\Longrightarrow a_1=\cdots=a_n=0.
\end{aligned}
\]
这里的向量都属于同一个向量空间，标量来自同一个域。

\subsection{基与维数}

既线性无关、又张成整个向量空间的向量组，称为空间的一组基。
基中向量的个数称为空间的维数。

\section{矩阵表示}

矩阵的秩等于其列空间的维数。例如下列矩阵的两列线性无关，所以秩为2：
$$
A =
\begin{pmatrix}
1 & 0 \\
0 & 1 \\

0 & 0
\end{pmatrix}
$$

\end{document}
"#.into() },
        Source { id:"eigen".into(), title:"CHAPTER_TWO.md".into(), content:r#"# Chapter Two

## Contents

- Eigenvectors
- Diagonalization

---

若非零向量v满足Av=λv，则v是矩阵A对应特征值λ的特征向量。特征向量不能是零向量。

当n阶矩阵A有n个线性无关的特征向量时，它可以对角化。把这些特征向量作为矩阵P的列，以相应特征值作为对角矩阵D的对角元，有：
$$
\begin{aligned}
AP &= PD,\\
A &= PDP^{-1}.
\end{aligned}
$$

## Repeated definition

A basis is a linearly independent spanning set of a vector space.
The dimension is the number of vectors in a basis.

## 原文断言

1+1=3

"#.into() },
        Source {id:"metadata".into(),title:"README.md".into(),content:"# README.md\n\n---\n\n\\tableofcontents\n\n\\section{Index}\n".into()},
    ]
}
async fn stage(
    settings: &Settings,
    inputs: Vec<Source>,
    previous: Option<KnowledgeResult>,
    label: &str,
) -> Result<KnowledgeResult, String> {
    println!("开始：{label}");
    let result = ai::organize_with_progress(
        OrganizeRequest {
            title: "线性代数知识整理".into(),
            sources: inputs.clone(),
            previous,
            settings: settings.clone(),
        },
        |p| println!("  {p}"),
    )
    .await?;
    ai::validate(&result, &inputs, false, false)?;
    if result
        .knowledge_points
        .iter()
        .any(|p| p.source_ids == ["metadata"])
    {
        return Err("结构素材被当成知识点".into());
    }
    for p in &result.knowledge_points {
        if p.label.contains("英文定义") || p.label.contains("中文定义") {
            return Err("同一概念因语言不同被重复拆分".into());
        }
        if !p
            .label
            .chars()
            .any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
        {
            return Err("知识点标题不是中文".into());
        }
        if p.detail.trim().is_empty() || p.detail.trim() == "$$" {
            return Err("无意义知识点".into());
        }
        for e in &p.evidence {
            if !inputs
                .iter()
                .any(|s| s.id == e.source_id && s.content.contains(&e.quote))
            {
                return Err("原文证据无效".into());
            }
        }
    }
    let details = result
        .knowledge_points
        .iter()
        .map(|p| format!("{}：{}", p.label, p.detail))
        .collect::<Vec<_>>()
        .join("\n");
    if !details.contains("1+1=3") && !details.contains("1 + 1 = 3") {
        return Err("关闭纠错后原断言被更改".into());
    }
    for term in ["线性无关", "维数", "特征向量", "对角化"] {
        if !details.contains(term) {
            return Err(format!("缺少实质概念：{term}"));
        }
    }
    if !(5..=14).contains(&result.knowledge_points.len()) {
        return Err(format!("提取粒度异常：{}", result.knowledge_points.len()));
    }
    for note in &result.notes {
        if [
            "极大线性无关组",
            "判定方法",
            "几何意义",
            "无限维",
            "错误的数学断言",
            "错误断言",
        ]
        .iter()
        .any(|term| note.content.contains(term) || note.title.contains(term))
        {
            return Err("关闭补充或纠错后出现了额外知识或正误评价".into());
        }

        if !note
            .title
            .chars()
            .any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
            || note.content.trim().is_empty()
        {
            return Err("空白或英文文件名文档".into());
        }
        if note.content.contains("\\documentclass") || note.content.contains("\\tableofcontents") {
            return Err("排版元数据混入文档".into());
        }
    }
    println!(
        "通过：{label}，{}个知识点，{}篇中文知识文档",
        result.knowledge_points.len(),
        result.notes.len()
    );
    for point in &result.knowledge_points {
        println!("  概念：{}", point.label);
    }
    Ok(result)
}
#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("语义整理回归失败：{e}");
        std::process::exit(1);
    }
}
async fn run() -> Result<(), String> {
    let settings = Settings {
        base_url: "https://api.deepseek.com".into(),
        model: "deepseek-v4-pro".into(),
        api_key: String::new(),
        prompt: "按适合自学的顺序整理，只使用已有知识。".into(),
        correct: false,
        supplement: false,
    };
    let mut inputs = sources();
    let first = stage(
        &settings,
        inputs.clone(),
        None,
        "结构化原文、完整公式、跨文件重复概念",
    )
    .await?;
    std::fs::write(
        "/tmp/guiye-semantic-result.json",
        serde_json::to_string_pretty(&first).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    inputs.retain(|s| s.id != "metadata");
    let second = stage(&settings, inputs, Some(first), "删除纯结构素材后再整理").await?;
    std::fs::write(
        "/tmp/guiye-semantic-result.json",
        serde_json::to_string_pretty(&second).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    println!("全部语义质量回归通过。结果：/tmp/guiye-semantic-result.json");
    Ok(())
}
