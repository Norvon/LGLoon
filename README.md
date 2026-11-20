# LGLoon

适用于 iOS Loon 3.5.1（build 983）及以上版本。

源码和构建说明放在 `master`。安装插件请看 [main 分支的使用说明](https://github.com/Norvon/LGLoon/tree/main#readme)。

- [YouTube 与 Spotify 合并插件](plugins/LGLoon.lpx)提供两个总开关。YouTube 开关控制复写和响应脚本（去广告，开启后台播放和画中画，在设置页补充画中画和后台播放项），另有隐藏上传按钮、隐藏 Shorts 按钮、恢复底栏订阅和调试日志四个选项。Spotify 开关控制 `pendragon` 请求过滤、歌手列表调整和配置响应中的播放广告标志。YouTube 的 QUIC 规则和两个应用的 MitM 域名随整个插件启停。

## 接入现有配置

1. 把 [LGLoon.lcf](LGLoon.lcf) 中所需的 URL 条目加入主配置的 `[Plugin]` 段。已有同名本地插件时，用 URL 替换文件名。已经通过 URL 安装的用户在插件列表中更新即可。
2. Loon 会从本仓库的 `main/scripts/` 下载媒体插件引用的两份 JS。在 iPhone 上启用复写、脚本和 MitM，并信任自己的 MitM 证书。若单独安装过同功能的 YouTube 或 Spotify 插件，停用重复的插件。[Loon 脚本路径说明](https://nsloon.app/docs/Script/script_v2/#脚本路径)
3. 在媒体插件中分别开关 YouTube 和 Spotify。插件列表中显示的日期就是当前安装的版本，更新插件后核对它是否变成最新发布的日期。

### 在设备上验证

1. 开启 YouTube 和「隐藏 Shorts 按钮」，重新打开 YouTube 查看底栏。再关闭 YouTube 总开关，发起新请求，确认 Loon 记录中没有此次请求的 `LGLoon YouTube` 脚本执行记录。
2. 保持 YouTube 关闭，开启 Spotify，在 iPhone 上打开歌手页。对比 Spotify 总开关打开和关闭时的新请求，只有打开时匹配的 `artistview` 请求会被改为 `platform=ipad`。
3. 开启 Spotify 后重启 Spotify App 并播放歌曲。在 Loon 记录里确认 `bootstrap` 或 `user-customization-service` 的 200 响应命中 `LGLoon Spotify Ads`，再确认歌曲之间是否还有插播广告。

## 从源码构建

从仓库根目录执行以下命令。首次构建需要 Node.js、npm、Python 3 和网络来安装锁定版本的 npm 依赖。依赖就绪后，日常重建只需运行后两行。

```sh
npm ci --prefix src/youtube
python3 build.py
shasum -a 256 -c checksums.sha256
```

[构建入口](build.py) 会重新生成 Protobuf 绑定、检查 TypeScript、打包两份 JS，再生成安装插件。插件头部的 `#!date` 是版本日期（北京时间），插件或脚本内容变化时才会更新，重复构建不会改动它。产物写入 `scripts/` 和 `plugins/`，各文件的摘要写入 [checksums.sha256](checksums.sha256)。发布时将核对过的产物和校验清单一并更新到 `main`。媒体插件中的两个脚本 URL 随该分支更新。

`master` 保留开发历史。`main` 始终只保留一个根提交，后续发布在 `main` 上用 `git commit --amend` 更新该提交，再用 `git rev-list --count main` 确认结果为 `1`。

| 要修改的内容 | 源码 |
| --- | --- |
| 合并插件的开关、规则、脚本绑定和 MitM 域名 | [插件模板](src/media/LGLoon.lpx.in) |
| YouTube 广告过滤、后台播放与画中画、设置项、底栏和调试 | [入口](src/youtube/index.ts)、[响应处理](src/youtube/src/response.ts)、[消息定义](src/youtube/protobuf) |
| Spotify 广告请求过滤和歌手列表处理 | [Spotify 脚本源码](src/spotify/index.js) |
| Spotify 配置响应的播放广告标志 | [响应脚本源码](src/spotify/playback-ads.js) |

### 来源

- YouTube 以 [Norvon/Maasea_sgmodule · 9647aa5](https://github.com/Norvon/Maasea_sgmodule/tree/9647aa5fe889a7b7ab0a1b28d79d55c1ced7a899/Script/Youtube) 为基础，功能与 [feature/lg · 35771ae](https://github.com/Norvon/Maasea_sgmodule/tree/35771ae98f75b5a888914c6703782a2e10b50d43/Script/Youtube) 的构建版脚本对齐：开启后台播放和画中画，在设置页补充画中画开关和后台播放项（含下载相关标志）。该分支源码里尚未打包的歌词与字幕翻译没有引入。缺失的 [frameworkUpdate.proto](src/youtube/protobuf/response/frameworkUpdate.proto) 按上游生成文件的字段描述补齐。[许可及依赖声明](licenses/YouTube.txt)
- Spotify 的广告请求、歌手列表规则和广告字段结构参考 [001ProMax/Surge 的 Spotify 插件](https://github.com/001ProMax/Surge/blob/429b5aa25a43a09443be73d38569b24fe05fd6db/Loon/Spotify.plugin)。Spotify 脚本与 YouTube 脚本共用 [Protobuf 库及编码补丁](licenses/YouTube.txt)。
