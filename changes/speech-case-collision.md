语音频谱的计算模块从 speech/spectrum.ts 改名为 speech/spectrumBands.ts：它和组件 speech/Spectrum.tsx 只差大小写，在不区分大小写的文件系统（macOS CI 的 iOS 任务）上，'./speech/Spectrum.js' 会解析到 spectrum.ts，导致构建失败。只改文件名和导入，不改行为。
