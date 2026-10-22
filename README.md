# 片仓 ClipStock

按员工和视频类型管理视频剪辑素材库存，设置固定日消耗，预测耗尽日期。支持团队账号、多设备同步、权限管理与自动备份。

**在线使用：[clipstock.naassh.com](https://clipstock.naassh.com)**

## 开始使用

1. 打开网站，点击「注册 / 创建团队」，创建自己的账号和团队。密码至少 12 位，请妥善保管；当前没有邮箱找回功能。
2. 在「员工管理」添加员工，然后「录入素材」，选择 IP、口播、图文或自定义类型，填写库存与日消耗。
3. 在「设置 → 团队与云端存储」生成邀请链接，选择编辑或只读权限。链接 7 天有效、一次性使用；成员通过链接注册或登录后加入同一个团队。
4. 成员设备会在页面可见时每 15 秒检查更新，也可以手动刷新。

迁移旧版库存：先在旧版导出 JSON，再登录团队，通过「设置 → 导入备份」导入。导入覆盖团队当前库存；本机库存不会自动上传。

## 数据与协作

- PostgreSQL 保存团队库存、成员关系与变动记录。每个团队的数据独立，只有成员可以访问。
- 管理员可邀请、移除成员，恢复自动备份；编辑成员可修改库存；只读成员可查看、导出。
- 每次保存携带版本号。如果其他人抢先修改，服务器拒绝覆盖。修改保留为当前账号的本机草稿，可先导出，再加载云端最新库存。
- 保留最近 **30 次成功保存**的自动快照。恢复旧快照会生成新版本。
- 密码使用随机盐和 scrypt 哈希；登录会话使用 HttpOnly、SameSite Cookie，生产环境启用 Secure。
- 数据库连接字符串只放在服务端环境变量中，仓库不含密钥和真实库存。
- 不登录可使用本机模式。本机数据与云端团队分开存放，不会自动混合。

## 预测口径

库存基准日是盘点日期，从其下一消耗日开始计算。库存 100 条、日消耗 10 条，预计第 10 个消耗日耗尽。天数向上取整；零库存已耗尽，日消耗为零不计算耗尽。

可选择每天或周一至周五消耗；工作日模式不处理法定节假日。预警使用自然日。预测**不自动扣减实际库存**，真实消耗需登记或盘点校准。工具管理数量，不上传视频文件。

## 开发与部署

需要 Node.js 22 或以上。

```sh
npm ci
npm test
npm run build
npm run dev
```

默认开发地址 `http://127.0.0.1:8767`。没有数据库时使用本机模式。

只在本机测试团队功能（内存数据库，重启即清空）：

```sh
CLIPSTOCK_DEV_DATABASE=1 npm run dev
```

部署到 Vercel：导入本 GitHub 仓库，使用仓库自带 `vercel.json`；连接 Neon 或其他 PostgreSQL，在 **Production** 环境设置 `DATABASE_URL`，再部署。首次 API 访问自动创建 `server/schema.sql` 中的表。数据库账号需要建表权限。不要在生产启用 `CLIPSTOCK_DEV_DATABASE`。

```sh
npx vercel link
npx vercel integration add neon --plan free_v3 --name clipstock-db
npx vercel --prod
```

托管配置参考 [Vercel](https://vercel.com/docs) 和 [Neon](https://neon.com/docs)。预览环境建议使用独立数据库，避免影响正式数据。

`npm run build` 同时生成 `release/片仓.html`，可离线打开；离线版只提供本机存储。不要提交 `.env*`、`.vercel/`、备份文件或真实库存。

## 项目结构

```text
dist/       网页、预测模型、团队同步界面
api/        Vercel API 入口
server/     PostgreSQL、登录、团队权限和版本控制
tests/      日期预测、账号、团队隔离、权限及备份检查
scripts/    本地开发与离线构建
```

MIT License。欢迎提交 Issue 与 Pull Request。
