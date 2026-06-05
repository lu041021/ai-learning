from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    local_id: str


class UserOut(BaseModel):
    id: int
    username: str
    local_id: str

    class Config:
        from_attributes = True
