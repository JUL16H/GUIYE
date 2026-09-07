use guiye_lib::{
    ai::{self, KnowledgeResult, OrganizeRequest, Settings, Source},
    qa,
};
#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("AI smoke FAILED: {e}");
        std::process::exit(1)
    }
}
async fn run() -> Result<(), String> {
    let settings=Settings{base_url:"https://api.deepseek.com".into(),model:std::env::var("GUIYE_TEST_MODEL").unwrap_or("deepseek-chat".into()),api_key:String::new(),prompt:"根据知识内容设计2至3篇文档，不要为纯分类节点单独写总览。精确解释概念和限定条件，公式使用LaTeX。".into(),correct:true,supplement:false};
    let previous: Option<KnowledgeResult> = std::env::var("GUIYE_TEST_PREVIOUS")
        .ok()
        .map(|path| {
            std::fs::read_to_string(path)
                .map_err(|e| e.to_string())
                .and_then(|raw| serde_json::from_str(&raw).map_err(|e| e.to_string()))
        })
        .transpose()?;
    let old_ids: Vec<_> = previous
        .as_ref()
        .map(|r| r.knowledge_points.iter().map(|p| p.id.clone()).collect())
        .unwrap_or_default();
    let mut sources=vec![Source{id:"s1".into(),title:"向量笔记.md".into(),content:"线性无关的向量组可以构成其张成空间的基。基的向量数是维数。矩阵的秩是列空间的维数。".into()},Source{id:"s2".into(),title:"特征值.tex".into(),content:"特征向量允许是零向量。特征值满足 Av=λv。n阶矩阵有n个线性无关的特征向量时可以对角化，A=PDP^{-1}。".into()}];
    let incremental = std::env::var_os("GUIYE_TEST_INCREMENTAL").is_some();
    if incremental {
        sources.push(Source{id:"s3".into(),title:"新补充的内积.md".into(),content:"实向量的标准内积是 u^T v，即对应分量乘积之和。当内积为零时两个向量正交。向量的欧几里得范数等于自身内积的平方根：||v||=sqrt(v^T v)。".into()});
    }
    let result = if std::env::var_os("GUIYE_TEST_QA_ONLY").is_some() {
        println!("QA-only: using previously validated knowledge result");
        previous.ok_or("QA-only requires GUIYE_TEST_PREVIOUS")?
    } else {
        ai::organize_with_progress(
            OrganizeRequest {
                title: "线性代数测试".into(),
                sources: sources.clone(),
                settings: settings.clone(),
                previous,
            },
            |stage| println!("{stage}"),
        )
        .await?
    };
    if result.knowledge_points.len() < 5 {
        return Err("未提取足够的原子知识点".into());
    }
    if !result
        .knowledge_points
        .iter()
        .any(|p| p.status == "corrected")
    {
        return Err("未识别测试素材的错误定义".into());
    }
    if !old_ids
        .iter()
        .all(|id| result.knowledge_points.iter().any(|p| &p.id == id))
    {
        return Err("增量整理丢失了未改动素材的知识点ID".into());
    }
    if incremental
        && !result
            .knowledge_points
            .iter()
            .any(|p| p.source_ids.contains(&"s3".into()))
    {
        return Err("新素材没有加入知识体系".into());
    }
    println!("AI smoke PASS: {} atomic points, {} nodes, {} rewritten notes, {} changes; {} prior point IDs retained",result.knowledge_points.len(),result.nodes.len(),result.notes.len(),result.changes.len(),old_ids.len());
    if let Ok(path) = std::env::var("GUIYE_SMOKE_OUTPUT") {
        std::fs::write(path, serde_json::to_string_pretty(&result).unwrap())
            .map_err(|e| e.to_string())?;
    }
    if std::env::var_os("GUIYE_TEST_QA").is_some() {
        let answer = qa::ask(qa::QuestionRequest {
            question: "根据笔记解释特征向量为什么不能为零，并说明对角化的条件。".into(),
            sources,
            knowledge: Some(result),
            history: vec![],
            note_id: None,
            settings,
        })
        .await?;
        if answer.source_ids.is_empty() && answer.node_ids.is_empty() && answer.note_ids.is_empty()
        {
            return Err("问答没有引用知识库证据".into());
        }
        println!(
            "QA smoke PASS: {} chars; {} source / {} node / {} note references",
            answer.answer.chars().count(),
            answer.source_ids.len(),
            answer.node_ids.len(),
            answer.note_ids.len()
        );
        if let Ok(path) = std::env::var("GUIYE_SMOKE_OUTPUT") {
            std::fs::write(
                format!("{path}.qa.json"),
                serde_json::to_string_pretty(&answer).unwrap(),
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
