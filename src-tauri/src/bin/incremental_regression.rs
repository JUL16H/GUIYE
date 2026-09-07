// Live-provider regression using synthetic notes; never reads the user's workspace.
use guiye_lib::ai::{self, KnowledgeResult, OrganizeRequest, Settings, Source};

async fn organize(
    sources: Vec<Source>,
    previous: Option<KnowledgeResult>,
    label: &str,
) -> Result<KnowledgeResult, String> {
    println!("{label}");
    let result = ai::organize_with_progress(
        OrganizeRequest {
            title: "向量空间与矩阵".into(),
            sources,
            previous,
            settings: Settings {
                base_url: "https://api.deepseek.com".into(),
                model: "deepseek-v4-pro".into(),
                api_key: String::new(),
                prompt: "按适合自学的顺序组织，同主题尽可能合为完整文档。".into(),
                correct: false,
                supplement: false,
            },
        },
        |p| println!("  {p}"),
    )
    .await?;
    println!(
        "  {} 个知识点，{} 篇文档",
        result.knowledge_points.len(),
        result.notes.len()
    );
    for note in &result.notes {
        println!(
            "  {}：{}（{} 字符）",
            note.id,
            note.title,
            note.content.chars().count()
        );
    }
    Ok(result)
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("回归失败：{error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let sources = vec![
        Source { id:"algebra-1".into(), title:"笔记一".into(), content:"# 向量空间\n\n若向量组的线性组合为零仅在所有系数均为零时成立，则这组向量线性无关。\n\n一个既线性无关又张成整个向量空间的向量组称为空间的一组基。\n\n有限维向量空间的维数是其任意一组基中向量的个数。".into() },
        Source { id:"algebra-2".into(), title:"笔记二".into(), content:"# 矩阵\n\n矩阵的秩等于其列空间的维数。\n\n非零向量v满足Av=λv时，v是矩阵A对应于特征值λ的特征向量。\n\nn阶矩阵A有n个线性无关的特征向量时可以对角化。以这些特征向量为矩阵P的列，相应特征值为对角矩阵D的对角元，有A=PDP^{-1}。".into() },
    ];
    let batch = organize(sources.clone(), None, "一次整理两篇素材").await?;
    let first = organize(vec![sources[0].clone()], None, "分次整理：第一篇素材").await?;
    let old_ids: Vec<_> = first.notes.iter().map(|n| n.id.clone()).collect();
    let incremental = organize(sources, Some(first), "分次整理：加入第二篇素材").await?;
    if batch.notes.len() != 1 || incremental.notes.len() != 1 {
        return Err(format!(
            "同主题未归并为完整文档：一次 {} 篇，分次 {} 篇",
            batch.notes.len(),
            incremental.notes.len()
        ));
    }
    if !old_ids.contains(&incremental.notes[0].id) {
        return Err("增量整理未沿用已有文档 ID".into());
    }
    for result in [&batch, &incremental] {
        for keyword in ["线性无关", "基", "维数", "秩", "特征向量", "对角化"] {
            if !result.notes[0].content.contains(keyword) {
                return Err(format!("合并文档遗漏：{keyword}"));
            }
        }
    }
    std::fs::write(
        "/tmp/guiye-incremental-regression.json",
        serde_json::to_string_pretty(&serde_json::json!({"batch":batch,"incremental":incremental}))
            .unwrap(),
    )
    .map_err(|e| e.to_string())?;
    println!("回归通过：一次与分次均为一篇，原文档 ID 保留，六项知识全部覆盖。");
    Ok(())
}
