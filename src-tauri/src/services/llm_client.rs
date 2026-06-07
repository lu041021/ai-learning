use futures_util::Stream;
use reqwest::Client as ReqwestClient;
use serde_json::json;
use std::collections::VecDeque;
use std::pin::Pin;
use std::sync::LazyLock;
use std::task::{Context, Poll};

static HTTP_CLIENT: LazyLock<ReqwestClient> = LazyLock::new(|| {
    ReqwestClient::builder()
        .timeout(std::time::Duration::from_secs(300))
        .pool_max_idle_per_host(2)
        .build()
        .expect("Failed to create global HTTP client")
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmProvider {
    Anthropic,
    DeepSeek,
}

impl LlmProvider {
    pub fn from_name(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "deepseek" => Self::DeepSeek,
            _ => Self::Anthropic,
        }
    }

    pub fn endpoint(&self) -> &'static str {
        match self {
            Self::Anthropic => "https://api.anthropic.com/v1/messages",
            Self::DeepSeek => "https://api.deepseek.com/v1/chat/completions",
        }
    }

    pub fn parse_stream_delta(&self, data: &serde_json::Value) -> Option<String> {
        match self {
            Self::Anthropic => {
                if data["type"] == "content_block_delta" {
                    data["delta"]["text"].as_str().map(|s| s.to_string())
                } else {
                    None
                }
            }
            Self::DeepSeek => data["choices"][0]["delta"]["content"]
                .as_str()
                .map(|s| s.to_string()),
        }
    }
}

pub struct LlmClient {
    pub provider: LlmProvider,
    pub api_key: String,
    pub model: String,
}

impl LlmClient {
    pub fn new(provider: LlmProvider, api_key: String, model: String) -> Self {
        Self {
            provider,
            api_key,
            model,
        }
    }

    fn build_headers(&self) -> (String, String) {
        match self.provider {
            LlmProvider::Anthropic => ("x-api-key".to_string(), self.api_key.clone()),
            LlmProvider::DeepSeek => (
                "Authorization".to_string(),
                format!("Bearer {}", self.api_key),
            ),
        }
    }

    fn build_body(
        &self,
        system_prompt: &str,
        user_message: Vec<serde_json::Value>,
        max_tokens: u32,
    ) -> serde_json::Value {
        match self.provider {
            LlmProvider::Anthropic => json!({
                "model": self.model,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": user_message,
            }),
            LlmProvider::DeepSeek => {
                let mut messages: Vec<serde_json::Value> = vec![json!({
                    "role": "system",
                    "content": system_prompt,
                })];
                messages.extend(user_message);
                json!({
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "messages": messages,
                })
            }
        }
    }

    fn parse_response_text(&self, body: &serde_json::Value) -> Option<String> {
        match self.provider {
            LlmProvider::Anthropic => body["content"][0]["text"].as_str().map(|s| s.to_string()),
            LlmProvider::DeepSeek => body["choices"][0]["message"]["content"]
                .as_str()
                .map(|s| s.to_string()),
        }
    }

    pub async fn chat(
        &self,
        system_prompt: &str,
        user_message: &str,
        max_tokens: u32,
    ) -> Result<String, String> {
        let (header_name, header_value) = self.build_headers();
        let body = self.build_body(
            system_prompt,
            vec![json!({"role": "user", "content": user_message})],
            max_tokens,
        );

        let mut req = HTTP_CLIENT
            .post(self.provider.endpoint())
            .header(&header_name, &header_value)
            .json(&body);

        if self.provider == LlmProvider::Anthropic {
            req = req.header("anthropic-version", "2023-06-01");
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("API 请求失败: {}", e))?;

        let status = response.status();
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        if !status.is_success() {
            let err_detail = body["error"]["message"]
                .as_str()
                .unwrap_or(body["error"].as_str().unwrap_or("unknown"));
            eprintln!("[llm] HTTP {} error: {}", status.as_u16(), err_detail);
            return Err(format!(
                "API 返回错误 ({}): {}",
                status.as_u16(),
                err_detail
            ));
        }

        self.parse_response_text(&body)
            .ok_or_else(|| format!("API 返回格式异常: {}", body))
    }

    pub async fn stream_chat(
        &self,
        system_prompt: &str,
        messages: Vec<serde_json::Value>,
        max_tokens: u32,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String, String>> + Send>>, String> {
        let (header_name, header_value) = self.build_headers();
        let mut body = self.build_body(system_prompt, messages, max_tokens);
        body["stream"] = json!(true);

        let mut req = HTTP_CLIENT
            .post(self.provider.endpoint())
            .header(&header_name, &header_value)
            .json(&body);

        if self.provider == LlmProvider::Anthropic {
            req = req.header("anthropic-version", "2023-06-01");
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("API 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API 返回错误 {}: {}", status, body));
        }

        let stream: Pin<Box<dyn Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send>> =
            Box::pin(response.bytes_stream());
        let provider = self.provider;

        Ok(Box::pin(SseStream {
            inner: stream,
            provider,
            buffer: Vec::new(),
            pending_tokens: VecDeque::new(),
        }))
    }
}

struct SseStream {
    inner: Pin<Box<dyn Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send>>,
    provider: LlmProvider,
    buffer: Vec<u8>,
    pending_tokens: VecDeque<String>,
}

impl SseStream {
    fn process_line(&self, line: &str, out: &mut Vec<String>) {
        if line.is_empty() || !line.starts_with("data: ") {
            return;
        }
        let data_str = &line[6..];
        if data_str == "[DONE]" {
            return;
        }
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_str) {
            if let Some(token) = self.provider.parse_stream_delta(&data) {
                if !token.is_empty() {
                    out.push(token);
                }
            }
        }
    }

    fn drain_complete_lines(&mut self, done: bool) -> (Vec<String>, bool) {
        let mut tokens = Vec::new();
        let mut saw_done = false;

        loop {
            match self.buffer.iter().position(|&b| b == b'\n') {
                Some(pos) => {
                    let line_bytes = self.buffer[..pos].to_vec();
                    self.buffer.drain(..=pos);
                    if let Ok(line) = std::str::from_utf8(&line_bytes) {
                        let line = line.trim();
                        if line.starts_with("data: ") && &line[6..] == "[DONE]" {
                            saw_done = true;
                        } else {
                            self.process_line(line, &mut tokens);
                        }
                    }
                }
                None => {
                    if done && !self.buffer.is_empty() {
                        // flush remaining bytes at EOF
                        let line_bytes = std::mem::take(&mut self.buffer);
                        if let Ok(line) = std::str::from_utf8(&line_bytes) {
                            self.process_line(line.trim(), &mut tokens);
                        }
                    }
                    break;
                }
            }
        }
        (tokens, saw_done)
    }
}

impl Stream for SseStream {
    type Item = Result<String, String>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if !self.pending_tokens.is_empty() {
            return Poll::Ready(Some(Ok(self.pending_tokens.pop_front().unwrap())));
        }

        loop {
            match self.inner.as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(chunk))) => {
                    self.buffer.extend_from_slice(&chunk);
                    let (mut tokens, saw_done) = self.drain_complete_lines(false);
                    if saw_done {
                        return Poll::Ready(None);
                    }
                    self.pending_tokens.extend(tokens.drain(..));
                    if !self.pending_tokens.is_empty() {
                        return Poll::Ready(Some(Ok(self.pending_tokens.pop_front().unwrap())));
                    }
                }
                Poll::Ready(Some(Err(e))) => {
                    return Poll::Ready(Some(Err(format!("Stream error: {}", e))));
                }
                Poll::Ready(None) => {
                    // Flush any remaining buffer content
                    let (mut tokens, _) = self.drain_complete_lines(true);
                    if !tokens.is_empty() {
                        self.pending_tokens.extend(tokens.drain(..));
                        return Poll::Ready(Some(Ok(self.pending_tokens.pop_front().unwrap())));
                    }
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}
