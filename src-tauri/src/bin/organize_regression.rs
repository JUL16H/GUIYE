// Real-provider regression using synthetic data only. No workspace is read or modified.
use guiye_lib::ai::{self, KnowledgeResult, OrganizeRequest, Settings, Source};

async fn run_stage(
    stage: &str,
    sources: Vec<Source>,
    previous: Option<KnowledgeResult>,
    settings: &Settings,
) -> Result<KnowledgeResult, String> {
    println!(
        "开始：{stage}，{} 字符",
        sources
            .iter()
            .map(|s| s.content.chars().count())
            .sum::<usize>()
    );
    let result = ai::organize_with_progress(
        OrganizeRequest {
            title: "整理可靠性回归".into(),
            sources: sources.clone(),
            previous,
            settings: settings.clone(),
        },
        |message| println!("  {message}"),
    )
    .await?;
    ai::validate(&result, &sources, settings.correct, settings.supplement)?;
    for point in &result.knowledge_points {
        for evidence in &point.evidence {
            if !sources
                .iter()
                .any(|s| s.id == evidence.source_id && s.content.contains(&evidence.quote))
            {
                return Err(format!("{stage}：产生了无效原文证据"));
            }
        }
    }
    if result.source_fingerprints.len() != sources.len() {
        return Err(format!("{stage}：素材状态不完整"));
    }
    println!(
        "通过：{stage}，{} 个知识点，{} 篇文档",
        result.knowledge_points.len(),
        result.notes.len()
    );
    Ok(result)
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("真实整理回归失败：{error}");
        std::process::exit(1);
    }
}
async fn run() -> Result<(), String> {
    let settings = Settings {
        base_url: "https://api.deepseek.com".into(),
        model: std::env::var("GUIYE_TEST_MODEL").unwrap_or_else(|_| "deepseek-v4-pro".into()),
        api_key: String::new(),
        prompt: "仅整理已有内容，保留原说法和公式。".into(),
        correct: false,
        supplement: false,
    };
    let mut retained = Source {
        id: "retained".into(),
        title: "公式与实验记录.md".into(),
        content: "1+1=3\r\n\r\n原文保留测试：A=PDP^{-1}，$\\alpha+\\beta$，中文“引号”和🙂。\n"
            .into(),
    };
    for index in 1..=80 {
        retained.content.push_str(&format!("实验记录{index}：样本编号为{index}，测量结果只适用于本次实验，不推断其他样本。条件为温度20摄氏度、保持容器密闭；结果应与原始记录一起保存。\n"));
    }
    let removed = Source {
        id: "removed".into(),
        title: "待删除记录.md".into(),
        content: "删除标记-ONLY-REMOVED：这段记录属于另一个实验，整理后将被删除。\n".into(),
    };
    let first = run_stage(
        "首次整理（公式、换行、多段内容）",
        vec![retained.clone(), removed],
        None,
        &settings,
    )
    .await?;
    let second = run_stage(
        "删除一份素材后再次整理",
        vec![retained.clone()],
        Some(first),
        &settings,
    )
    .await?;
    let text = serde_json::to_string(&second).unwrap();
    if text.contains("ONLY-REMOVED") || second.source_fingerprints.contains_key("removed") {
        return Err("删除的素材仍混入新结果".into());
    }
    retained
        .content
        .push_str("\n修改标记-EDITED：追加一条新的观察，保留原来的1+1=3，不纠错。\n");
    let third = run_stage(
        "修改剩余素材后再次整理",
        vec![retained.clone()],
        Some(second),
        &settings,
    )
    .await?;
    let documents = third
        .notes
        .iter()
        .map(|n| n.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    if !documents.contains("1+1=3") || !documents.contains("EDITED") {
        return Err("关闭纠错后原文被修改或新内容遗漏".into());
    }
    run_stage(
        "未修改素材再次整理（缓存复用）",
        vec![retained],
        Some(third),
        &settings,
    )
    .await?;
    println!("全部真实整理回归通过。");
    Ok(())
}
