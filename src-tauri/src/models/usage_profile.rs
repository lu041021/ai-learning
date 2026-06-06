use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolUsage {
    pub tool_name: String,
    pub frequency: String,
    pub proficiency_hint: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeGap {
    pub domain: String,
    pub description: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageProfile {
    pub frequent_topics: Vec<String>,
    pub tool_usage: Vec<ToolUsage>,
    pub error_patterns: Vec<String>,
    pub knowledge_gaps: Vec<KnowledgeGap>,
    pub learning_recommendations: Vec<String>,
    pub experience_summary: String,
}
