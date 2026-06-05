use rusqlite::Connection;

const L01: &str = include_str!("../../seed_data/lessons/lesson-01-what-is-ai.md");
const L02: &str = include_str!("../../seed_data/lessons/lesson-02-machine-learning.md");
const L03: &str = include_str!("../../seed_data/lessons/lesson-03-neural-networks.md");
const L04: &str = include_str!("../../seed_data/lessons/lesson-04-applications.md");
const L05: &str = include_str!("../../seed_data/lessons/lesson-05-ethics.md");

const Q01: &str = include_str!("../../seed_data/quizzes/quiz-01.json");
const Q02: &str = include_str!("../../seed_data/quizzes/quiz-02.json");
const Q03: &str = include_str!("../../seed_data/quizzes/quiz-03.json");
const Q04: &str = include_str!("../../seed_data/quizzes/quiz-04.json");
const Q05: &str = include_str!("../../seed_data/quizzes/quiz-05.json");

fn extract_title(md: &str) -> String {
    for line in md.lines() {
        let trimmed = line.trim();
        if let Some(stripped) = trimmed.strip_prefix("# ") {
            return stripped.trim().to_string();
        }
    }
    "Untitled".to_string()
}

pub fn run_seed(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM courses WHERE slug = 'ai-basics'", [], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Seed check failed: {}", e))?;

    if count > 0 {
        return Ok(());
    }

    let lessons_data: Vec<(&str, &str)> = vec![
        (L01, Q01),
        (L02, Q02),
        (L03, Q03),
        (L04, Q04),
        (L05, Q05),
    ];

    conn.execute(
        "INSERT INTO courses (title, slug, description) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "AI 入门基础",
            "ai-basics",
            "面向初学者的 AI 入门课程，涵盖从什么是 AI 到神经网络、现实应用与 AI 伦理等核心概念。"
        ],
    )
    .map_err(|e| format!("Seed course: {}", e))?;

    let course_id = conn.last_insert_rowid();

    let chapters = [("AI 基础概念", vec![0, 1, 2]),
        ("AI 实践与未来", vec![3, 4])];

    let mut lesson_counter = 0i64;

    for (ch_idx, (ch_title, lesson_indices)) in chapters.iter().enumerate() {
        conn.execute(
            "INSERT INTO chapters (course_id, title, order_index) VALUES (?1, ?2, ?3)",
            rusqlite::params![course_id, ch_title, ch_idx as i64],
        )
        .map_err(|e| format!("Seed chapter: {}", e))?;

        let chapter_id = conn.last_insert_rowid();

        for (l_idx, &li) in lesson_indices.iter().enumerate() {
            let (md_content, quiz_json) = lessons_data[li];
            let title = extract_title(md_content);

            conn.execute(
                "INSERT INTO lessons (chapter_id, title, content_md, order_index) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![chapter_id, title, md_content, l_idx as i64],
            )
            .map_err(|e| format!("Seed lesson: {}", e))?;

            let lesson_id = conn.last_insert_rowid();
            lesson_counter += 1;

            let quiz_data: serde_json::Value =
                serde_json::from_str(quiz_json).map_err(|e| format!("Parse quiz JSON: {}", e))?;

            let quiz_title = quiz_data["title"].as_str().unwrap_or("Quiz");
            conn.execute(
                "INSERT INTO quizzes (lesson_id, title) VALUES (?1, ?2)",
                rusqlite::params![lesson_id, quiz_title],
            )
            .map_err(|e| format!("Seed quiz: {}", e))?;

            let quiz_id = conn.last_insert_rowid();

            if let Some(questions) = quiz_data["questions"].as_array() {
                for q in questions {
                    let question_text = q["question_text"].as_str().unwrap_or("");
                    let options = q["options"].to_string();
                    let correct_idx = q["correct_answer_index"].as_i64().unwrap_or(0);
                    let explanation = q["explanation"].as_str().unwrap_or("");

                    conn.execute(
                        "INSERT INTO quiz_questions (quiz_id, question_text, options, correct_answer_index, explanation) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![quiz_id, question_text, options, correct_idx, explanation],
                    )
                    .map_err(|e| format!("Seed question: {}", e))?;
                }
            }
        }
    }

    println!(
        "Seeded: 1 course, 2 chapters, {} lessons with quizzes.",
        lesson_counter
    );
    Ok(())
}
