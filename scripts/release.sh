#!/bin/bash

# 确保脚本在出错时立即退出
set -e

# 获取当前分支
CURRENT_BRANCH=$(git symbolic-ref --short -q HEAD)

echo "当前分支为: $CURRENT_BRANCH"

# 获取输入参数或提示输入
VERSION=$1
if [ -z "$VERSION" ]; then
  read -p "请输入要发布的新版本号 (例如 2026.6.24): " VERSION
fi

# 去除可能包含的 'v' 或 'V' 前缀以得到纯版本号
CLEAN_VERSION=$(echo "$VERSION" | sed 's/^[vV]//')
TAG_NAME="v$CLEAN_VERSION"

echo "准备发布版本: $CLEAN_VERSION"
echo "对应的 Git Tag: $TAG_NAME"

# 1. 更新 package.json 中的版本号
npm version "$CLEAN_VERSION" --no-git-tag-version --allow-same-version

# 2. git 提交 (仅在 package.json 或 package-lock.json 有实际改动时提交，防止 nothing to commit 报错中断)
if ! git diff --quiet package.json || ! git diff --quiet package-lock.json; then
  git add package.json
  if [ -f package-lock.json ] && ! git diff --quiet package-lock.json; then
    git add package-lock.json
  fi
  git commit -m "chore: bump version to $CLEAN_VERSION"
else
  echo "版本号已是最新，跳过 Commit 步骤。"
fi

# 3. 强制创建/覆盖本地 Tag，防止已存在时报错中断
git tag -f "$TAG_NAME"

echo ""
echo "✓ 本地版本修改、Commit 和 Tag 创建已完成！"
echo "请确认是否立即推送至远程仓库以触发打包流水线？"
read -p "是否执行 git push？(y/N): " CONFIRM

if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
  echo "正在推送代码和 Tag..."
  git push origin "$CURRENT_BRANCH"
  git push origin -f "$TAG_NAME"
  echo "✓ 推送成功！打包流水线已触发。"
else
  echo "推送已被取消。您可以稍后手动执行以下命令推送："
  echo "  git push origin $CURRENT_BRANCH"
  echo "  git push origin $TAG_NAME"
fi
