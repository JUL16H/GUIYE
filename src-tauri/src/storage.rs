use serde_json::Value;
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::Path,
};

fn validate(value: &Value) -> Result<(), String> {
    let projects = value
        .get("projects")
        .and_then(Value::as_array)
        .ok_or("项目列表格式错误")?;
    let active = value
        .get("activeId")
        .and_then(Value::as_str)
        .ok_or("缺少活动项目")?;
    if !active.is_empty() && !projects.iter().any(|p| p["id"].as_str() == Some(active)) {
        return Err("活动项目不存在".into());
    }
    for project in projects {
        if project["id"].as_str().is_none()
            || project["title"].as_str().is_none()
            || project["sources"].as_array().is_none()
        {
            return Err("项目数据格式错误".into());
        }
    }
    let settings = value
        .get("settings")
        .and_then(Value::as_object)
        .ok_or("设置格式错误")?;
    if settings.contains_key("apiKey") {
        return Err("禁止将 API Key 写入项目数据".into());
    }
    Ok(())
}

pub fn load(dir: &Path) -> Result<Option<Value>, String> {
    let path = dir.join("workspace.json");
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|e| format!("无法读取本地项目：{e}"))?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "本地数据损坏。请保留 workspace.json，并检查 workspace.backup.json 备份。")?;
    validate(&value)?;
    Ok(Some(value))
}

pub fn save(dir: &Path, workspace: &Value) -> Result<(), String> {
    validate(workspace)?;
    fs::create_dir_all(dir).map_err(|e| format!("无法创建数据目录：{e}"))?;
    let path = dir.join("workspace.json");
    let temp = dir.join("workspace.tmp");
    let bytes = serde_json::to_vec_pretty(workspace).map_err(|e| e.to_string())?;
    let mut options = OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temp)
        .map_err(|e| format!("无法写入临时文件：{e}"))?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("保存失败：{e}"))?;
    if path.exists() {
        // A corrupt original is never silently replaced, even if a caller skipped load().
        load(dir)?;
        fs::copy(&path, dir.join("workspace.backup.json"))
            .map_err(|e| format!("无法备份项目：{e}"))?;
    }
    fs::rename(&temp, &path).map_err(|e| format!("无法提交保存：{e}"))?;
    #[cfg(unix)]
    File::open(dir)
        .and_then(|f| f.sync_all())
        .map_err(|e| format!("目录同步失败：{e}"))?;
    Ok(())
}

pub fn export_document(dir: &Path, name: &str, content: &str) -> Result<String, String> {
    fs::create_dir_all(dir).map_err(|e| format!("无法创建下载目录：{e}"))?;
    let clean: String = name
        .chars()
        .filter(|c| {
            !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
        .collect();
    let clean = clean.trim_matches(|c: char| c == '.' || c.is_whitespace());
    let clean = if clean.is_empty() {
        "guiye-export.md"
    } else {
        clean
    };
    let (stem, extension) = clean.rsplit_once('.').unwrap_or((clean, "md"));
    // Linux limits each filename by UTF-8 bytes, not characters. Leave room for
    // extensions and collision suffixes, preserving the original extension.
    fn prefix(text: &str, limit: usize) -> &str {
        let mut end = text.len().min(limit);
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        &text[..end]
    }
    let stem = prefix(stem, 200);
    let extension = prefix(extension, 20);
    for index in 0..1000 {
        let filename = if index == 0 {
            format!("{stem}.{extension}")
        } else {
            format!("{stem} ({index}).{extension}")
        };
        let path = dir.join(filename);
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(mut file) => {
                file.write_all(content.as_bytes())
                    .and_then(|_| file.sync_all())
                    .map_err(|e| format!("导出写入失败：{e}"))?;
                return Ok(path.to_string_lossy().into_owned());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("导出失败：{e}")),
        }
    }
    Err("同名导出文件过多，请修改项目或笔记名称后重试".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn workspace(title: &str) -> Value {
        json!({"projects":[{"id":"p1","title":title,"sources":[]}],"activeId":"p1","settings":{"model":"test"}})
    }
    fn temp(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("guiye-{}-{name}", std::process::id()))
    }
    #[test]
    fn empty_workspace_roundtrips_without_creating_a_project() {
        let dir = temp("empty");
        let _ = fs::remove_dir_all(&dir);
        let w = json!({"projects":[],"activeId":"","settings":{"model":"test"}});
        save(&dir, &w).unwrap();
        assert_eq!(load(&dir).unwrap().unwrap(), w);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn export_stays_in_downloads_and_never_overwrites() {
        let dir = temp("export");
        let _ = fs::remove_dir_all(&dir);
        let first = export_document(&dir, "../../note.md", "first").unwrap();
        let second = export_document(&dir, "../../note.md", "second").unwrap();
        assert_eq!(Path::new(&first).parent().unwrap(), dir);
        assert_ne!(first, second);
        assert_eq!(fs::read_to_string(first).unwrap(), "first");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn export_creates_downloads_and_handles_long_chinese_titles() {
        let home = temp("long-export");
        let _ = fs::remove_dir_all(&home);
        let dir = home.join("Downloads");
        let name = format!("{}.md", "知识图谱笔记".repeat(40));
        let first = export_document(&dir, &name, "数学：$x^2$").unwrap();
        let second = export_document(&dir, &name, "second").unwrap();
        assert_ne!(first, second);
        assert_eq!(Path::new(&first).extension().unwrap(), "md");
        assert!(Path::new(&first).file_name().unwrap().len() < 255);
        assert_eq!(fs::read_to_string(first).unwrap(), "数学：$x^2$");
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn saves_and_preserves_previous_version() {
        let dir = temp("save");
        let _ = fs::remove_dir_all(&dir);
        save(&dir, &workspace("one")).unwrap();
        save(&dir, &workspace("two")).unwrap();
        assert_eq!(load(&dir).unwrap().unwrap()["projects"][0]["title"], "two");
        let backup: Value =
            serde_json::from_slice(&fs::read(dir.join("workspace.backup.json")).unwrap()).unwrap();
        assert_eq!(backup["projects"][0]["title"], "one");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn rejects_credentials() {
        let mut w = workspace("test");
        w["settings"]["apiKey"] = json!("secret");
        assert!(validate(&w).is_err());
    }
    #[test]
    fn preserves_corrupt_original() {
        let dir = temp("corrupt");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("workspace.json"), "broken").unwrap();
        assert!(load(&dir).is_err());
        assert!(save(&dir, &workspace("new")).is_err());
        assert_eq!(
            fs::read_to_string(dir.join("workspace.json")).unwrap(),
            "broken"
        );
        fs::remove_dir_all(dir).unwrap();
    }
}
