use rusqlite::Connection;
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

pub fn update_learning_memory(conn: &Connection, user_id: i64) {
    let memory_dirs = find_memory_dirs();
    if memory_dirs.is_empty() {
        return;
    }

    let content = build_memory_content(conn, user_id);

    for dir in &memory_dirs {
        let _ = std::fs::write(dir.join("learning-progress.md"), &content);

        let index_path = dir.join("MEMORY.md");
        let entry = "- [Learning Progress](learning-progress.md) — AI学堂学习进度：课时完成率、测验成绩、课程详情";
        if let Ok(existing) = std::fs::read_to_string(index_path) {
            if !existing.contains("learning-progress.md") {
                let updated = format!("{}\n{}", existing.trim_end(), entry);
                let _ = std::fs::write(dir.join("MEMORY.md"), updated);
            }
        }
    }
}

fn build_memory_content(conn: &Connection, user_id: i64) -> String {
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
        .unwrap_or(0);
    let completed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1",
            rusqlite::params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let avg_score: Option<f64> = conn
        .query_row(
            "SELECT AVG(score) FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |r| r.get(0),
        )
        .ok()
        .flatten();

    let (streak, longest) = {
        let dates: Vec<String> = {
            let mut stmt = conn
                .prepare(
                    "SELECT DISTINCT date(completed_at) FROM user_progress
                     WHERE user_id = ?1 AND completed = 1 AND completed_at IS NOT NULL
                     ORDER BY date(completed_at) DESC",
                )
                .unwrap();
            stmt.query_map(rusqlite::params![user_id], |r| r.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        if dates.is_empty() {
            (0i64, 0i64)
        } else {
            let mut cur = 1i64;
            let mut best = 1i64;
            for i in 1..dates.len() {
                let prev = &dates[i - 1];
                let cur_date = &dates[i];
                if prev == cur_date {
                    continue;
                }
                let prev_day: i64 = prev[8..].parse().unwrap_or(0);
                let cur_day: i64 = cur_date[8..].parse().unwrap_or(0);
                let prev_month: i64 = prev[5..7].parse().unwrap_or(0);
                let cur_month: i64 = cur_date[5..7].parse().unwrap_or(0);
                let prev_year: i64 = prev[..4].parse().unwrap_or(0);
                let cur_year: i64 = cur_date[..4].parse().unwrap_or(0);

                let consecutive = (cur_year == prev_year && cur_month == prev_month && cur_day == prev_day - 1)
                    || (cur_year == prev_year && cur_month == prev_month - 1
                        && prev_day == 1 && cur_day == 28);
                if consecutive {
                    cur += 1;
                } else {
                    best = best.max(cur);
                    cur = 1;
                }
            }
            best = best.max(cur);
            (cur, best)
        }
    };

    let pct = if total > 0 {
        format!("{:.1}%", completed as f64 / total as f64 * 100.0)
    } else {
        "0%".to_string()
    };

    let quiz_avg_str = avg_score
        .map(|s| format!("{:.1}%", s * 100.0))
        .unwrap_or_else(|| "N/A".to_string());

    let course_lines = build_course_table(conn, user_id);

    let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC");

    format!(
        r#"---
name: learning-progress
description: AI学堂学习进度：{pct} 完成率，测验均分 {quiz_avg_str}
metadata:
  type: project
---

# AI学堂 学习进度

**总进度**: {completed}/{total} 课时（{pct}）
**测验均分**: {quiz_avg_str}
**连续学习**: {streak} 天 | **最长连续**: {longest} 天

## 课程详情

{course_table}

---
*AI学堂自动更新于 {timestamp}*
"#,
        completed = completed,
        total = total,
        pct = pct,
        quiz_avg_str = quiz_avg_str,
        streak = streak,
        longest = longest,
        course_table = course_lines,
        timestamp = timestamp,
    )
}

fn build_course_table(conn: &Connection, user_id: i64) -> String {
    let mut stmt = match conn.prepare(
        "SELECT c.title, c.slug, COUNT(l.id) as total,
                (SELECT COUNT(*) FROM user_progress up
                 JOIN lessons l2 ON l2.id = up.lesson_id
                 JOIN chapters ch2 ON ch2.id = l2.chapter_id
                 WHERE ch2.course_id = c.id AND up.user_id = ?1 AND up.completed = 1) as done
         FROM courses c
         JOIN chapters ch ON ch.course_id = c.id
         JOIN lessons l ON l.chapter_id = ch.id
         GROUP BY c.id
         ORDER BY c.id",
    ) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    let courses: Vec<(String, String, i64, i64)> = stmt
        .query_map(rusqlite::params![user_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    courses
        .iter()
        .map(|(title, _slug, total, done)| {
            let pct = if *total > 0 {
                (*done as f64 / *total as f64 * 100.0) as i64
            } else {
                0
            };
            let bar_len = 16usize;
            let filled = if *total > 0 {
                (*done as f64 / *total as f64 * bar_len as f64) as usize
            } else {
                0
            };
            let bar: String = (0..bar_len)
                .map(|i| if i < filled { '█' } else { '░' })
                .collect();
            format!(
                "| {title:<24} | {bar} | {done:>3}/{total:<3} ({pct:>3}%) |",
                title = title,
                bar = bar,
                done = done,
                total = total,
                pct = pct
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}
