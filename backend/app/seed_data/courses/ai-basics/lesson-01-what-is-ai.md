# 什么是人工智能？

欢迎来到你的第一堂 AI 课！让我们从基础开始。

## 什么是 AI？

人工智能（Artificial Intelligence，简称 AI）指的是能够执行通常需要**人类智能**才能完成的任务的机器或软件。这些任务包括：

- 从经验中**学习**
- **推理**和解决问题
- **理解**自然语言
- **识别**模式（图像、声音）
- **做出决策**

可以把 AI 想象成教计算机像人类一样"思考"——但是针对特定的、定义明确的任务。

## 弱人工智能 vs. 强人工智能

| 类型 | 描述 | 目前是否存在？ |
|------|------|----------------|
| **弱人工智能 (Narrow AI)** | 专注于某一特定任务 | 是——目前所有的 AI |
| **强人工智能 (General AI)** | 能完成人类能做的任何智力任务 | 尚未实现 |

你今天使用的每一个 AI 系统——ChatGPT、Netflix 推荐、手机面部解锁——都是弱人工智能。它们在某一领域表现出色，但无法将这些知识迁移到完全不同的任务上。

## 一个简单示例

下面是一个最基本的"AI"的 Python 实现——一个根据你的心情推荐电影的规则系统：

```python
def recommend_movie(mood):
    if mood == "happy":
        return "Watch a comedy: 'The Intouchables'"
    elif mood == "thoughtful":
        return "Watch a sci-fi: 'Interstellar'"
    elif mood == "adventurous":
        return "Watch an action: 'Mad Max: Fury Road'"
    else:
        return "Watch a classic: 'The Shawshank Redemption'"

print(recommend_movie("thoughtful"))
```

这就是**基于规则的系统（Rule-based System）**——最简单的 AI 形式。它按照预先编写的规则来做决策。

## 核心要点

- AI 是让机器执行需要智能的任务
- 目前所有 AI 都是**弱人工智能**——专精于特定任务
- AI 的范围从简单的规则系统到复杂的神经网络
- 你每天都在不知不觉中使用 AI

**下一课：** 我们将学习机器如何从数据中学习——这就是 Machine Learning！
