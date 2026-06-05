# 机器学习入门

机器学习（Machine Learning，简称 ML）是大多数现代 AI 的引擎。我们不再手工编写规则，而是让计算机**从数据中学习**。

## 什么是机器学习？

> 机器学习是让计算机拥有无需明确编程即可学习的能力的研究领域。
> —— Arthur Samuel, 1959

传统编程：你编写规则 → 计算机执行规则 → 得到输出
机器学习：你提供数据 + 答案 → 计算机学习规则 → 将规则应用于新数据

## 机器学习的三种类型

### 1. 监督学习 (Supervised Learning)
计算机从**有标注的数据**中学习——每个样本都有正确答案。

- **例子：** 根据面积、位置、卧室数量预测房价
- **例子：** 将邮件分类为"垃圾邮件"或"非垃圾邮件"
- **常用算法：** Linear Regression、Decision Trees、Neural Networks

### 2. 无监督学习 (Unsupervised Learning)
计算机在**无标注的数据**中寻找模式——没有提供正确答案。

- **例子：** 按购买行为对客户进行分组
- **例子：** 检测异常交易（欺诈检测）
- **常用算法：** K-Means Clustering、PCA

### 3. 强化学习 (Reinforcement Learning)
计算机通过**试错**来学习，好的行为获得奖励。

- **例子：** 教机器人走路
- **例子：** 训练 AI 下围棋或国际象棋
- **核心概念：** Agent → Action → Environment → Reward

## 一个简单的 ML 示例

以下是如何使用 scikit-learn 训练一个基本分类器：

```python
from sklearn.tree import DecisionTreeClassifier

# 训练数据: [重量(kg), 是否是水果]
# 1 = 水果, 0 = 非水果
X = [[0.02, 1], [0.15, 1], [0.5, 0], [5.0, 0], [0.1, 1]]
y = [1, 1, 0, 0, 1]

model = DecisionTreeClassifier()
model.fit(X, y)

# 预测: 一个 0.08kg 的东西是水果吗？
prediction = model.predict([[0.08, 1]])
print("Is it a fruit?", "Yes" if prediction[0] == 1 else "No")
```

## 训练、测试与真实世界

一个好的 ML 模型应该：
1. **拟合训练数据**——学会数据中的模式
2. **具备泛化能力**——在未见过的新数据上也能表现良好
3. **避免过拟合**——不要仅仅是死记硬背训练样本

## 核心要点

- ML 让计算机从数据中学习模式，而非遵循显式规则
- **监督学习** = 从标注样本中学习
- **无监督学习** = 在无标注数据中发现模式
- **强化学习** = 通过试错和奖励来学习
