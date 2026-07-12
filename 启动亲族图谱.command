#!/bin/zsh
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖……"
  npm install
fi

echo "亲族图谱将在浏览器中打开。关闭这个窗口即可停止服务。"
(sleep 2; open "http://127.0.0.1:5173") &
npm run dev
