# SQLite 部署说明

## 当前推荐

当前系统推荐使用 SQLite：

```env
EDU_STORAGE_DRIVER=sqlite
EDU_SQLITE_PATH=/app/data/study.db
```

优势：

- 单文件数据库，部署比 PostgreSQL 简单
- 比 JSON 更适合长期写入
- Docker volume 可持久化
- 备份/迁移方便
- 后续仍可导出到 PostgreSQL

## 本地运行

```powershell
cd C:\Code\AI\Study\backend
$env:EDU_STORAGE_DRIVER='sqlite'
$env:EDU_SQLITE_PATH='C:\Code\AI\Study\backend\data\study.db'
.\bin\edu-server.exe
```

## Docker 运行

```powershell
cd C:\Code\AI\Study
docker compose -f docker-compose.prod.yml up -d --build
```

默认会在容器内使用：

```text
/app/data/study.db
```

并通过 Docker volume 持久化。

## 从 JSON 初始化

首次启动 SQLite 时，如果存在：

```text
backend/data/platform_state.json
```

系统会自动把它作为初始数据写入 SQLite。

如果 SQLite 文件已存在，则不会覆盖。

## 重置 SQLite

本地：

```powershell
Remove-Item C:\Code\AI\Study\backend\data\study.db -Force
```

Docker：

```powershell
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

## 备份

本地备份：

```powershell
Copy-Item C:\Code\AI\Study\backend\data\study.db C:\backup\study-$(Get-Date -Format yyyyMMddHHmmss).db
```

Docker volume 备份：

```powershell
docker run --rm -v study_edu-data:/data -v ${PWD}:/backup alpine tar czf /backup/edu-sqlite-backup.tgz -C /data study.db
```

## 生产建议

- 小规模校内试点：SQLite 足够
- 多学校并发 SaaS：后续迁 PostgreSQL
- 备份频率：每天至少一次
- 不要把 `study.db` 放进 Git
