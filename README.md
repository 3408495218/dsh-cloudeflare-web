# DSH Remote — Cloudflare 版

在手机浏览器里远程操作 DeepSeek Harness，全程跑在 Cloudflare 上。

## 架构

```
手机 ──HTTPS──> https://example.com  (Cloudflare Pages)
                  ├─ /              → public/index.html（网页）
                  ├─ /a/*           → Pages Functions → Tunnel A → 本机 3080
                  └─ /b/*           → Pages Functions → Tunnel B → 本机 3081
```

**不需要 VPS、不需要公网 IP、不需要端口映射。**

## 部署

1. Cloudflare Pages → Create → Connect to Git → 选本仓库
2. 构建命令：**留空**
3. 输出目录：**public**
4. 绑定自定义域名：`example.com`

## Cloudflare Tunnel（本机）

```cmd
cloudflared.exe service install <token>
```

Tunnel Public Hostname：

| Subdomain | Domain | Service |
|---|---|---|
| dsh-a | example.com | http://127.0.0.1:3080 |
| dsh-b | example.com | http://127.0.0.1:3081 |

## 插件配置

`cordis.patch.yml` 的 `mobile-remote` 段：

```yaml
trustedHosts:
  - 'dsh-a.example.com'
  - 'dsh-b.example.com'
  - 'example.com'
```

## 使用

1. 打开 `https://example.com/`
2. 点 ⚙ → 快捷添加「实例 A」
3. 输入该实例的 authToken
4. 完成
