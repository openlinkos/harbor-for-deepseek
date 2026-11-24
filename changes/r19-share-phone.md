手机上多选时，问题旁边的勾选框回到原来的高度。宽屏往下滚时，勾选框仍然钉在列表顶部。
窄屏只把问题勾选框上移 25px，灰色选中块向上加高，勾选框仍贴在块顶内侧。回答勾选框不再一起上移。
多选吸顶不再靠位移补偿：去掉桌面 margin-top 13px + translateY(-13px)、手机问题勾选框 translateY(-25px) 和灰块 top:-40px 三处偏移。手机多选时 28.5px 顶部间距从 .transcript 的 padding 移到 .chat-column：Chromium 会把 sticky 区域按滚动容器的 padding 内缩，原来这段 padding 把问题勾选框压低 25px（SP-SHARE-035/109/111，sticky top 0、padding-top 13px）。390 宽问题勾选框回到 76.5（转向顶部上方 12px，与第三轮 sharegeo 一致），测试断言未改。
