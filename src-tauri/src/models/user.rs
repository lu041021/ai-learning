use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserOut {
    pub id: i64,
    pub username: String,
    pub local_id: String,
}
