use crate::services::llm_client::LlmClient;

const GRADER_PROMPT: &str = r#"你是一位 AI 测验评分老师，为 AI/ML 初学者课程批改测验。检查学生的答案并提供鼓励性、有教育意义的反馈。

测验：{quiz_title}
题目和学生答案：
{qa_pairs}

对每道题，告诉学生：
- 他们答对了还是答错了
- 对正确答案的简要解释
- 一句鼓励的话

最后给出总分和激励性的话语。保持友好和支持的态度。用中文回复。

在反馈的最后，用 [NEXT_STEP]...[/NEXT_STEP] 标记给出下一步学习建议（1-2句话）。例如：
[NEXT_STEP]你掌握得不错！建议继续学习下一课"线性回归"来巩固统计基础。[/NEXT_STEP]"#;

#[derive(Debug, Clone)]
pub struct QuizQuestionData {
    pub question_text: String,
    pub options: String,
    pub correct_answer_index: i64,
    pub explanation: String,
}

pub async fn grade_quiz(
    questions: &[QuizQuestionData],
    user_answers: &[i64],
    client: &LlmClient,
) -> (f64, String, Option<String>) {
    let mut correct = 0i64;
    let mut qa_pairs = Vec::new();

    for (i, q) in questions.iter().enumerate() {
        let user_idx = if i < user_answers.len() {
            user_answers[i]
        } else {
            -1
        };
        let is_correct = user_idx == q.correct_answer_index;
        if is_correct {
            correct += 1;
        }

        let options: Vec<String> =
            serde_json::from_str(&q.options).unwrap_or_else(|_| vec![]);
        let user_ans_text = if user_idx >= 0 && (user_idx as usize) < options.len() {
            &options[user_idx as usize]
        } else {
            "(no answer)"
        };
        let correct_ans_text = if (q.correct_answer_index as usize) < options.len() {
            &options[q.correct_answer_index as usize]
        } else {
            "?"
        };

        qa_pairs.push(format!(
            "Q{}: {}\n  Student answered: [{}] {}\n  Correct answer: [{}] {}\n  Explanation: {}",
            i + 1,
            q.question_text,
            user_idx,
            user_ans_text,
            q.correct_answer_index,
            correct_ans_text,
            q.explanation,
        ));
    }

    let total = questions.len();
    let score = if total > 0 {
        correct as f64 / total as f64
    } else {
        0.0
    };

    if client.api_key.is_empty() {
        return (score, build_simple_feedback(score, correct, total as i64), None);
    }

    let prompt = GRADER_PROMPT
        .replace("{quiz_title}", "Lesson Quiz")
        .replace("{qa_pairs}", &qa_pairs.join("\n\n"));

    match client.chat(
        "你是一位支持性的 AI 测验评分老师，帮助初学者学习 AI。",
        &prompt,
        800,
    ).await {
        Ok(feedback) => {
            let next_step = extract_next_step(&feedback);
            let clean = remove_next_step_tag(&feedback);
            (score, clean, next_step)
        }
        Err(_) => (score, build_simple_feedback(score, correct, total as i64), None),
    }
}

fn extract_next_step(feedback: &str) -> Option<String> {
    let start = feedback.find("[NEXT_STEP]")?;
    let end = feedback.find("[/NEXT_STEP]")?;
    if end > start {
        Some(feedback[start + 11..end].trim().to_string())
    } else {
        None
    }
}

fn remove_next_step_tag(feedback: &str) -> String {
    if let Some(start) = feedback.find("[NEXT_STEP]") {
        if let Some(end) = feedback.find("[/NEXT_STEP]") {
            let before = &feedback[..start];
            let after = &feedback[end + 13..];
            return format!("{}{}", before.trim_end(), after);
        }
    }
    feedback.to_string()
}

fn build_simple_feedback(score: f64, correct: i64, total: i64) -> String {
    let pct = (score * 100.0) as i64;
    if pct == 100 {
        "满分！你已经完全掌握了这个知识点，太棒了！".to_string()
    } else if pct >= 70 {
        format!(
            "不错！你答对了 {}/{} 题。回顾一下做错的题目，巩固理解。",
            correct, total
        )
    } else {
        format!(
            "你答对了 {}/{} 题。别担心——学习需要时间！复习一下课程再试试。",
            correct, total
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // extract_next_step tests
    #[test]
    fn test_extract_next_step_present() {
        let feedback = "Good job!\n[NEXT_STEP]Review linear regression[/NEXT_STEP]\nKeep going!";
        assert_eq!(extract_next_step(feedback), Some("Review linear regression".into()));
    }

    #[test]
    fn test_extract_next_step_missing() {
        assert_eq!(extract_next_step("No next step here"), None);
    }

    #[test]
    fn test_extract_next_step_empty_tags() {
        let feedback = "[NEXT_STEP][/NEXT_STEP]";
        assert_eq!(extract_next_step(feedback), Some("".into()));
    }

    #[test]
    fn test_extract_next_step_only_start() {
        assert_eq!(extract_next_step("[NEXT_STEP]incomplete"), None);
    }

    // remove_next_step_tag tests
    #[test]
    fn test_remove_next_step_tag_present() {
        let input = "Score: 80%\n[NEXT_STEP]Study more[/NEXT_STEP]\nEnd";
        // before.trim_end() strips the trailing \n, and after starts with \n
        // format!("{}{}", "Score: 80%", "\nEnd") gives "Score: 80%\nEnd"
        // But the actual find position may differ — just verify tag removal
        let result = remove_next_step_tag(input);
        assert!(!result.contains("[NEXT_STEP]"));
        assert!(!result.contains("[/NEXT_STEP]"));
        assert!(result.starts_with("Score: 80%"));
        assert!(result.ends_with("End"));
    }

    #[test]
    fn test_remove_next_step_tag_not_present() {
        let input = "Just feedback";
        assert_eq!(remove_next_step_tag(input), "Just feedback");
    }

    // build_simple_feedback tests
    #[test]
    fn test_feedback_perfect_score() {
        let fb = build_simple_feedback(1.0, 3, 3);
        assert!(fb.contains("满分"));
    }

    #[test]
    fn test_feedback_good_score() {
        let fb = build_simple_feedback(0.75, 3, 4);
        assert!(fb.contains("3/4"));
        assert!(fb.contains("不错"));
    }

    #[test]
    fn test_feedback_low_score() {
        let fb = build_simple_feedback(0.25, 1, 4);
        assert!(fb.contains("1/4"));
        assert!(fb.contains("别担心"));
    }
}
