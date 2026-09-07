pub mod ai;
pub mod qa;
pub mod storage;
mod text;

#[cfg(feature = "desktop")]
mod desktop {
    use super::{ai, qa, storage};
    use std::sync::Mutex;
    use tauri::{Emitter, Manager};

    #[tauri::command]
    async fn organize(
        request: ai::OrganizeRequest,
        window: tauri::WebviewWindow,
    ) -> Result<ai::KnowledgeResult, String> {
        ai::organize_with_progress(request, |message| {
            let _ = window.emit("organize-progress", message);
        })
        .await
    }
    #[tauri::command]
    async fn ask_question(request: qa::QuestionRequest) -> Result<qa::Answer, String> {
        qa::ask(request).await
    }
    #[tauri::command]
    async fn test_connection(settings: ai::Settings) -> Result<String, String> {
        ai::test_connection(settings).await
    }
    #[tauri::command]
    fn load_workspace(
        app: tauri::AppHandle,
        lock: tauri::State<'_, Mutex<()>>,
    ) -> Result<Option<serde_json::Value>, String> {
        let _guard = lock.lock().map_err(|_| "存储锁不可用")?;
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        storage::load(&dir)
    }
    #[tauri::command]
    fn save_workspace(
        app: tauri::AppHandle,
        lock: tauri::State<'_, Mutex<()>>,
        workspace: serde_json::Value,
    ) -> Result<(), String> {
        let _guard = lock.lock().map_err(|_| "存储锁不可用")?;
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        storage::save(&dir, &workspace)
    }
    #[tauri::command]
    fn export_document(
        app: tauri::AppHandle,
        name: String,
        content: String,
    ) -> Result<String, String> {
        let dir = app
            .path()
            .download_dir()
            .map_err(|e| format!("无法找到下载目录：{e}"))?;
        storage::export_document(&dir, &name, &content)
    }
    pub fn run() {
        tauri::Builder::default()
            .manage(Mutex::new(()))
            .invoke_handler(tauri::generate_handler![
                organize,
                ask_question,
                test_connection,
                load_workspace,
                save_workspace,
                export_document
            ])
            .run(tauri::generate_context!())
            .expect("无法启动归页");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;
