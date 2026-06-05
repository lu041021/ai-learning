const USER_KEY = 'ai_learning_user'

export function getLocalId(): string {
  let localId = localStorage.getItem(USER_KEY)
  if (!localId) {
    localId = crypto.randomUUID()
    localStorage.setItem(USER_KEY, localId)
  }
  return localId
}

export function getSavedUserId(): number | null {
  const id = localStorage.getItem('ai_learning_user_id')
  return id ? parseInt(id) : null
}

export function saveUserId(id: number) {
  localStorage.setItem('ai_learning_user_id', String(id))
}
