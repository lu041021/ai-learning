use std::path::Path;

const CHUNK_SIZE: usize = 800;
const CHUNK_OVERLAP: usize = 100;

pub fn extract_text_from_bytes(data: &[u8], ext: &str) -> Result<String, String> {
    match ext {
        "txt" | "md" | "markdown" => std::str::from_utf8(data)
            .map(|s| s.to_string())
            .map_err(|e| format!("文件编码错误: {}", e)),
        "pdf" => extract_pdf_bytes(data),
        "docx" => extract_docx_bytes(data),
        other => Err(format!("不支持的文件格式: .{}", other)),
    }
}

pub fn extract_text(path: &Path) -> Result<String, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let data = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    extract_text_from_bytes(&data, &ext)
}

pub fn chunk_text(text: &str) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut start = 0;

    while start < words.len() {
        let end = (start + CHUNK_SIZE).min(words.len());
        let chunk = words[start..end].join(" ");
        if !chunk.trim().is_empty() {
            chunks.push(chunk);
        }
        if end == words.len() {
            break;
        }
        start = end.saturating_sub(CHUNK_OVERLAP);
    }

    chunks
}

fn extract_pdf_bytes(data: &[u8]) -> Result<String, String> {
    let doc = lopdf::Document::load_mem(data).map_err(|e| format!("PDF 解析失败: {}", e))?;
    let mut text = String::new();

    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    for page_num in pages {
        if let Ok(page_text) = doc.extract_text(&[page_num]) {
            text.push_str(&page_text);
            text.push('\n');
        }
    }

    if text.trim().is_empty() {
        return Err("PDF 中未提取到文本（可能是扫描件）".to_string());
    }
    Ok(text)
}

fn extract_docx_bytes(data: &[u8]) -> Result<String, String> {
    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("DOCX 解压失败: {}", e))?;

    let xml = {
        let mut entry = archive
            .by_name("word/document.xml")
            .map_err(|_| "word/document.xml 不存在，不是有效的 DOCX 文件".to_string())?;
        let mut buf = String::new();
        use std::io::Read;
        entry
            .read_to_string(&mut buf)
            .map_err(|e| format!("读取 document.xml 失败: {}", e))?;
        buf
    };

    Ok(strip_xml_tags(&xml))
}

fn strip_xml_tags(xml: &str) -> String {
    let mut out = String::with_capacity(xml.len() / 2);
    let mut in_tag = false;
    let mut last_was_space = false;

    for ch in xml.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                if !last_was_space {
                    out.push(' ');
                    last_was_space = true;
                }
            }
            _ if !in_tag => {
                out.push(ch);
                last_was_space = ch == ' ';
            }
            _ => {}
        }
    }

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_empty_text() {
        assert!(chunk_text("").is_empty());
    }

    #[test]
    fn chunk_short_text_is_single_chunk() {
        let text = "hello world foo bar";
        let chunks = chunk_text(text);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn chunk_produces_overlap() {
        let words: Vec<String> = (0..1000).map(|i| i.to_string()).collect();
        let text = words.join(" ");
        let chunks = chunk_text(&text);
        assert!(chunks.len() >= 2);
        let second_first_word = chunks[1].split_whitespace().next().unwrap_or("");
        assert!(
            chunks[0].contains(second_first_word),
            "first chunk should contain the first word of the second chunk"
        );
    }

    #[test]
    fn strip_xml_removes_tags() {
        let xml = "<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> World</w:t></w:r></w:p>";
        let text = strip_xml_tags(xml);
        assert!(text.contains("Hello"));
        assert!(text.contains("World"));
        assert!(!text.contains('<'));
    }
}
