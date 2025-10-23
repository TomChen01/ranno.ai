# Workflow
对于两个人、时间紧迫的黑客松，你们不需要复杂的 GitFlow (如 `develop` 分支)。我推荐一个简化的 **"GitHub Flow"** 或称 **"功能分支工作流" (Feature Branch Workflow)**。

**核心原则：**

1.  `main` 分支是你们的“黄金标准”。它应该**始终**是可运行的、基本没有 Bug 的。
2.  **绝不 (Never)** 直接推送到 `main` 分支。
3.  所有的开发工作都在**单独的分支 (Branch)** 上进行。

#### 详细工作流程 (循环)

假设你们要开发一个“用户登录”功能：

**1. 同步最新代码**

在开始任何新工作*之前*，务必先从 `main` 分支拉取最新的代码，确保你的本地和远程是一致的。

```bash
# 切换到 main 分支
git checkout main

# 从 GitHub (origin) 拉取最新版本
git pull origin main
```

**2. 创建功能分支 (Feature Branch)**

基于最新的 `main` 分支，创建一个描述性强的新分支。

```bash
# -b 表示 "创建并切换到"
# 好的命名：feat/login-page, fix/navbar-bug, refactor/api-service
git checkout -b feat/user-login
```

**3. 开发和提交 (Code & Commit)**

现在你在这个 `feat/user-login` 分支上安心写代码。

  * 频繁地、小颗粒度地提交 (commit)。
  * 写清楚你的 commit message。

<!-- end list -->

```bash
# 写你的代码...
git add .
git commit -m "feat: add login form UI"

# 继续写代码...
git add .
git commit -m "feat: implement login API call"
```

**4. 推送分支到 GitHub**

当你觉得这个功能基本完成，需要 partner review 或者备份时，把它推送到远程仓库 (GitHub)。

```bash
# 第一次推送时，GitHub 会提示你用这个命令
git push -u origin feat/user-login
```

**5. 创建 Pull Request (PR)**

推送后，打开你们的 GitHub 仓库页面，你会看到一个黄色的提示条，询问你是否要为 `feat/user-login` 分支创建一个 **Pull Request (PR)**。

  * 点击 `Compare & pull request`。
  * 写一个简短的描述，说明这个 PR 做了什么。
  * 在右侧的 `Reviewers` 栏，**指定你的 partner**。

**6. 代码审查 (Code Review)**

  * 你的 partner 会收到通知，他会来审查你的代码（即 PR 里的 "Files changed"）。
  * 他可以在特定代码行上留言、提问或要求修改。
  * 这是你们**合作的核心**：确保代码质量，并且让双方都知道项目的进展。
  * 如果需要修改，你就在本地的 `feat/user-login` 分支上继续修改、commit、push，PR 会自动更新。

**7. 合并 (Merge) 和清理**

  * 一旦你的 partner 觉得代码没问题，他会点击 `Approve` (批准)。
  * 然后，你们中的任何一人都可以点击 `Merge pull request` 按钮，把你的代码合并到 `main` 分支。
  * **建议：** 合并后，点击 `Delete branch` 按钮删除这个远程分支，保持仓库整洁。

**8. 循环开始**

现在，`main` 分支已经包含了“用户登录”功能。你们俩都回到**第 1 步** (`git pull origin main`)，开始下一个功能的开发。

-----

### 黑客松合作小贴士

1.  **高频沟通：** 这个 workflow 依赖沟通。在开始任务前，先分好工（比如你做前端，他做后端 API）。在发起 PR 时，一定要 `@` 对方。

2.  **任务拆分：** 在 `README.md` 里或者用 GitHub 的 `Issues` 功能，列出一个 TODO list。把大功能拆成小块（比如“登录页面UI”、“登录API对接”），一个分支只做一个小块。

3.  **处理 `.env` 文件：**

      * 你们的 `.gitignore` 应该已经包含了 `.env`。
      * 但是你的 partner 需要知道需要哪些环境变量 (API 密钥、数据库地址等)。
      * 所以，你们应该在项目里创建一个 `env.example` 文件（**这个文件要提交到 Git**），内容如下：

    <!-- end list -->

    ```
    # env.example (这是安全的，可以提交)
    DATABASE_URL=
    API_KEY=
    ```

    你的 partner 拿到代码后，自己复制一份 `env.example` 并重命名为 `.env`，然后填上他自己的值。

**问题：** 为了给你更精确的 `.gitignore` 建议，**你们打算用什么技术栈？** (例如：React + Node.js? 还是 Python/Django + Svelte?)