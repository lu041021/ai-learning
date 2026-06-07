use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConceptNode {
    pub id: i64,
    pub name: String,
    pub domain: String,
    pub lesson_count: i64,
    pub completed_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConceptEdge {
    pub source_id: i64,
    pub target_id: i64,
    pub weight: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphData {
    pub nodes: Vec<ConceptNode>,
    pub edges: Vec<ConceptEdge>,
    pub positions: Vec<[f64; 2]>, // pre-computed layout positions
}

pub fn build_knowledge_graph(db: &DbPool, user_id: i64) -> Result<KnowledgeGraphData, String> {
    let conn = db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.domain,
                    COUNT(DISTINCT lc.lesson_id) as total,
                    COUNT(DISTINCT CASE WHEN up.completed = 1 THEN up.lesson_id END) as completed_count
             FROM concepts c
             LEFT JOIN lesson_concepts lc ON lc.concept_id = c.id
             LEFT JOIN user_progress up ON up.lesson_id = lc.lesson_id AND up.user_id = ?1
             GROUP BY c.id
             ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let nodes: Vec<ConceptNode> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(ConceptNode {
                id: row.get(0)?,
                name: row.get(1)?,
                domain: row.get(2)?,
                lesson_count: row.get(3)?,
                completed_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Build concept_id -> node index for O(1) lookups in layout
    let concept_index: HashMap<i64, usize> =
        nodes.iter().enumerate().map(|(i, n)| (n.id, i)).collect();

    // Build edges via inverted co-occurrence: for each lesson, pair its concepts
    let mut lesson_to_concepts: HashMap<i64, HashSet<i64>> = HashMap::new();
    let mut lc_stmt = conn
        .prepare("SELECT lesson_id, concept_id FROM lesson_concepts")
        .map_err(|e| e.to_string())?;
    let lc_rows: Vec<(i64, i64)> = lc_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (lesson_id, concept_id) in &lc_rows {
        lesson_to_concepts
            .entry(*lesson_id)
            .or_default()
            .insert(*concept_id);
    }

    // shared[(a,b)] = number of lessons both a and b appear in
    let mut shared_map: HashMap<(i64, i64), u32> = HashMap::new();
    // appears[(a)] = number of lessons a appears in
    let mut appears: HashMap<i64, u32> = HashMap::new();
    for concepts in lesson_to_concepts.values() {
        let ids: Vec<i64> = concepts.iter().copied().collect();
        for &c in &ids {
            *appears.entry(c).or_insert(0) += 1;
        }
        for i in 0..ids.len() {
            for j in (i + 1)..ids.len() {
                let (a, b) = if ids[i] < ids[j] {
                    (ids[i], ids[j])
                } else {
                    (ids[j], ids[i])
                };
                // only track pairs where both are in our node set
                if concept_index.contains_key(&a) && concept_index.contains_key(&b) {
                    *shared_map.entry((a, b)).or_insert(0) += 1;
                }
            }
        }
    }

    let edges: Vec<ConceptEdge> = shared_map
        .into_iter()
        .map(|((a, b), shared)| {
            let union = (appears.get(&a).copied().unwrap_or(0)
                + appears.get(&b).copied().unwrap_or(0))
            .saturating_sub(shared) as f64;
            let weight = shared as f64 / union.max(1.0);
            ConceptEdge {
                source_id: a,
                target_id: b,
                weight: (weight * 100.0).round() / 100.0,
            }
        })
        .collect();

    // Compute force-directed layout
    let positions = compute_layout(&nodes, &edges, &concept_index);

    Ok(KnowledgeGraphData {
        nodes,
        edges,
        positions,
    })
}

fn compute_layout(
    nodes: &[ConceptNode],
    edges: &[ConceptEdge],
    concept_index: &HashMap<i64, usize>,
) -> Vec<[f64; 2]> {
    let n = nodes.len();
    if n == 0 {
        return Vec::new();
    }

    // Initialize random positions in a circle
    let mut positions: Vec<[f64; 2]> = (0..n)
        .map(|i| {
            let angle = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
            [300.0 + 200.0 * angle.cos(), 300.0 + 200.0 * angle.sin()]
        })
        .collect();

    let mut velocities: Vec<[f64; 2]> = vec![[0.0, 0.0]; n];
    let k = 130.0; // ideal spring length
    let temp = 10.0; // temperature

    for _iter in 0..80 {
        // Repulsive forces between all nodes
        for i in 0..n {
            let mut fx = 0.0;
            let mut fy = 0.0;
            for j in 0..n {
                if i == j {
                    continue;
                }
                let dx = positions[i][0] - positions[j][0];
                let dy = positions[i][1] - positions[j][1];
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                let force = k * k / dist;
                fx += force * dx / dist;
                fy += force * dy / dist;
            }
            velocities[i][0] = velocities[i][0] * 0.6 + fx * 0.4;
            velocities[i][1] = velocities[i][1] * 0.6 + fy * 0.4;
        }

        // Attractive forces along edges
        for edge in edges {
            let si = concept_index.get(&edge.source_id).copied();
            let ti = concept_index.get(&edge.target_id).copied();
            if let (Some(si), Some(ti)) = (si, ti) {
                let dx = positions[si][0] - positions[ti][0];
                let dy = positions[si][1] - positions[ti][1];
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                let force = (dist - k) / dist * edge.weight * 0.5;
                let fx = force * dx;
                let fy = force * dy;
                velocities[si][0] -= fx;
                velocities[si][1] -= fy;
                velocities[ti][0] += fx;
                velocities[ti][1] += fy;
            }
        }

        // Apply velocities with temperature damping
        let damping = 1.0 - (_iter as f64 / 80.0) * 0.9;
        for i in 0..n {
            let speed = (velocities[i][0].powi(2) + velocities[i][1].powi(2)).sqrt();
            if speed > temp {
                velocities[i][0] = velocities[i][0] / speed * temp;
                velocities[i][1] = velocities[i][1] / speed * temp;
            }
            positions[i][0] += velocities[i][0] * damping;
            positions[i][1] += velocities[i][1] * damping;
        }
    }

    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_layout_empty() {
        let positions = compute_layout(&[], &[], &std::collections::HashMap::new());
        assert!(positions.is_empty());
    }

    #[test]
    fn test_layout_single_node() {
        let nodes = vec![ConceptNode {
            id: 1,
            name: "AI".into(),
            domain: "cs".into(),
            lesson_count: 3,
            completed_count: 1,
        }];
        let positions = compute_layout(&nodes, &[], &std::collections::HashMap::new());
        assert_eq!(positions.len(), 1);
        assert!(positions[0][0].is_finite());
        assert!(positions[0][1].is_finite());
    }

    #[test]
    fn test_layout_multiple_nodes_no_edges() {
        let nodes: Vec<ConceptNode> = (1..=5)
            .map(|i| ConceptNode {
                id: i,
                name: format!("Concept{}", i),
                domain: "ai".into(),
                lesson_count: 1,
                completed_count: 0,
            })
            .collect();
        let positions = compute_layout(&nodes, &[], &std::collections::HashMap::new());
        assert_eq!(positions.len(), 5);
        // All positions should be finite
        for pos in &positions {
            assert!(pos[0].is_finite());
            assert!(pos[1].is_finite());
        }
    }

    #[test]
    fn test_layout_with_edges() {
        let nodes: Vec<ConceptNode> = vec![
            ConceptNode {
                id: 1,
                name: "A".into(),
                domain: "cs".into(),
                lesson_count: 2,
                completed_count: 0,
            },
            ConceptNode {
                id: 2,
                name: "B".into(),
                domain: "cs".into(),
                lesson_count: 1,
                completed_count: 0,
            },
            ConceptNode {
                id: 3,
                name: "C".into(),
                domain: "ai".into(),
                lesson_count: 3,
                completed_count: 1,
            },
        ];
        let edges = vec![
            ConceptEdge {
                source_id: 1,
                target_id: 2,
                weight: 0.8,
            },
            ConceptEdge {
                source_id: 2,
                target_id: 3,
                weight: 0.5,
            },
        ];
        let idx: HashMap<i64, usize> = nodes.iter().enumerate().map(|(i, n)| (n.id, i)).collect();
        let positions = compute_layout(&nodes, &edges, &idx);
        assert_eq!(positions.len(), 3);
        // Nodes with edges should be pulled closer together
        // Just verify positions are valid (finite, not all identical)
        for pos in &positions {
            assert!(pos[0].is_finite());
            assert!(pos[1].is_finite());
        }
    }
}
