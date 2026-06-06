use crate::models::usage_profile::UsageProfile;
use crate::services::llm_client::LlmClient;
use std::path::PathBuf;

fn find_memory_dirs() -> Vec<PathBuf> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };
    let projects_dir = home.join(".claude").join("projects");
    let mut dirs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let memory_dir = entry.path().join("memory");
            if memory_dir.exists() && memory_dir.join("MEMORY.md").exists() {
                dirs.push(memory_dir);
            }
        }
    }
    dirs
}

fn read_memory_files(dir: &PathBuf) -> String {
    let mut content = String::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "md") {
                if let Ok(text) = std::fs::read_to_string(&path) {
                    let truncated = if text.len() > 3000 {
                        format!("{}...(truncated)", &text[..3000])
                    } else {
                        text
                    };
                    content.push_str(&format!(
                        "--- FILE: {} ---\n{}\n\n",
                        path.file_name().unwrap_or_default().to_string_lossy(),
                        truncated
                    ));
                }
            }
        }
    }
    content
}

const ANALYZE_PROMPT: &str = r#"你是一位技术学习顾问。分析以下用户与 Claude Code 等智能体的交互记录，推断用户的技术使用模式和知识缺口。

用户的工作记忆文件内容：
{memory_content}

请分析并输出 JSON：
1. frequent_topics: 用户频繁讨论/工作的技术主题（数组，最多8个）
2. tool_usage: 用户使用工具的频率和熟练度提示（数组，每项含 tool_name/frequency/proficiency_hint）
3. error_patterns: 用户常遇到的问题类型（数组，最多5个）
4. knowledge_gaps: 用户的知识缺口（数组，每项含 domain/description/severity，severity为 high/medium/low）
5. learning_recommendations: 基于以上分析，推荐优先学习的领域（数组，最多5个，按优先级排序）
6. experience_summary: 对用户技术使用情况的简要总结（中文，2-3句话）

只输出JSON，不要markdown标记或其他文字：
{{
  "frequent_topics": ["..."],
  "tool_usage": [{{"tool_name": "...", "frequency": "经常/偶尔/少量", "proficiency_hint": "熟练/一般/入门"}}],
  "error_patterns": ["..."],
  "knowledge_gaps": [{{"domain": "...", "description": "...", "severity": "high/medium/low"}}],
  "learning_recommendations": ["..."],
  "experience_summary": "..."
}}"#;

pub async fn analyze_usage(client: &LlmClient) -> Result<UsageProfile, String> {
    let dirs = find_memory_dirs();
    let mut memory_content = String::new();

    for dir in &dirs {
        memory_content.push_str(&read_memory_files(dir));
    }

    if memory_content.trim().is_empty() {
        return Err("未找到 Claude Code 使用记录。请先使用 Claude Code 后再试。".to_string());
    }

    let user_message = ANALYZE_PROMPT.replace("{memory_content}", &memory_content);

    let response_text = client
        .chat(
            "你是一位专业的技术学习顾问。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            4096,
        )
        .await?;

    let cleaned = clean_json_response(&response_text);
    serde_json::from_str::<UsageProfile>(&cleaned).map_err(|e| {
        format!(
            "解析使用分析失败: {}. Raw: {}",
            e,
            &cleaned[..200.min(cleaned.len())]
        )
    })
}

fn clean_json_response(text: &str) -> String {
    let t = text.trim();
    if let Some(inner) = t.strip_prefix("```json") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    if let Some(inner) = t.strip_prefix("```") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    t.to_string()
}
