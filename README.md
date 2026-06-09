# ☸️ AKS 3-Tier Microservices Architecture

A production-grade, containerised 3-tier application deployed on **Azure Kubernetes Service** with a complete **CI/CD pipeline** (GitHub Actions + Azure DevOps), auto-scaling, network isolation, and a PostgreSQL + Redis data tier.

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TIER 1 — FRONTEND                                 │
│  React 18 SPA  ←→  Nginx (reverse proxy + static serving)               │
│  HPA: 2–8 pods | Non-root container | Security headers                  │
└───────────────────────────┬─────────────────────────────────────────────┘
                             │ HTTP (nginx proxy_pass)
┌────────────────────────────▼────────────────────────────────────────────┐
│                        TIER 2 — BACKEND MICROSERVICES                    │
│                                                                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  user-service   │  │ product-service  │  │  order-service   │       │
│  │  Node.js :3001  │  │  Node.js :3002   │  │  Node.js :3003   │       │
│  │  JWT auth       │  │  Redis cache     │  │  DB transactions │       │
│  │  HPA: 2–10      │  │  HPA: 2–10       │  │  HPA: 2–10       │       │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           └────────────────────┼────────────────────── ┘                 │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │ SQL / Redis
┌────────────────────────────────▼────────────────────────────────────────┐
│                        TIER 3 — DATA                                     │
│  ┌───────────────────────────┐  ┌─────────────────────────────┐        │
│  │  PostgreSQL 16            │  │  Redis 7.2                  │        │
│  │  StatefulSet + PVC 20Gi   │  │  StatefulSet + PVC 5Gi      │        │
│  │  4 tables + triggers      │  │  maxmemory: 256MB LRU       │        │
│  └───────────────────────────┘  └─────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
aks_3_tier_architecture/
├── frontend/                          # Tier 1: React + Nginx
│   ├── src/                           # React pages (Dashboard, Products, Orders, Users)
│   ├── nginx.conf                     # Reverse proxy config + security headers
│   └── Dockerfile                     # Multi-stage: node:20-alpine → nginx:1.25-alpine
│
├── services/
│   ├── user-service/                  # Tier 2: User CRUD + JWT auth
│   │   ├── src/routes/                # users.js + auth.js
│   │   ├── src/middleware/            # Error handler + Prometheus metrics
│   │   ├── tests/users.test.js
│   │   └── Dockerfile                 # Multi-stage, non-root, health check
│   ├── product-service/               # Tier 2: Product catalog + Redis cache
│   └── order-service/                 # Tier 2: Order management with DB transactions
│
├── database/
│   └── init/
│       ├── 01_schema.sql              # Tables: users, products, orders, order_items
│       └── 02_seed.sql                # Sample data
│
├── k8s/
│   ├── namespace/namespace.yaml       # Namespace + ResourceQuota + LimitRange
│   ├── configmaps/app-config.yaml     # All non-secret env vars
│   ├── secrets/app-secrets.yaml       # Placeholder — use Key Vault in production
│   ├── database/
│   │   └── postgres-statefulset.yaml  # StatefulSet + headless Service + init ConfigMap
│   ├── redis/
│   │   └── redis-statefulset.yaml     # StatefulSet + headless Service
│   ├── services/
│   │   ├── {frontend,user,product,order}-service/
│   │   │   ├── deployment.yaml        # Deployment + Service
│   │   │   ├── hpa.yaml               # HPA (CPU + memory, scale 2→10)
│   │   │   └── pdb.yaml               # PodDisruptionBudget (minAvailable: 1)
│   │   ├── networkpolicies.yaml       # Zero-trust: frontend→backend, backend→db only
│   │   └── serviceaccount.yaml        # Workload Identity ServiceAccount
│   └── ingress/ingress.yaml           # nginx-ingress + cert-manager TLS + rate limiting
│
├── bicep/aks-cluster.bicep            # AKS cluster + ACR + Log Analytics
├── docker-compose.yml                 # Full local dev stack (all 5 services + pg + redis)
├── azure-pipelines/azure-pipelines.yml # Azure DevOps: Test→Build→Staging→Prod
└── .github/workflows/cicd.yml         # GitHub Actions: Test→Scan→Build→Integrate→Deploy
```

---

## 🚀 Quick Start (Local)

```bash
# Clone and start everything locally
git clone https://github.com/ramamishra7262/aks_3_tier_architecture-.git
cd aks_3_tier_architecture-
docker-compose up --build

# Access
open http://localhost         # React frontend
curl http://localhost:3001/health  # User service
curl http://localhost:3002/health  # Product service
curl http://localhost:3003/health  # Order service
```

---

## ☸️ AKS Deployment

```bash
# 1. Provision AKS + ACR with Bicep
az group create --name rg-aks-3tier --location eastus
az deployment group create \
  --resource-group rg-aks-3tier \
  --template-file bicep/aks-cluster.bicep

# 2. Build and push images
ACR=devops3tieracr.azurecr.io
TAG=$(git rev-parse --short HEAD)
az acr login --name devops3tieracr

for SVC in frontend user-service product-service order-service; do
  CONTEXT="./services/$SVC"
  [ "$SVC" = "frontend" ] && CONTEXT="./frontend"
  docker build -t $ACR/$SVC:$TAG $CONTEXT
  docker push $ACR/$SVC:$TAG
done

# 3. Deploy to AKS
./scripts/deploy.sh rg-aks-3tier prod $TAG
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions (`.github/workflows/cicd.yml`)

| Stage | Trigger | Jobs |
|-------|---------|------|
| **Test** | Every push/PR | Unit tests (3 services parallel) |
| **Security Scan** | After test | Trivy FS scan + npm audit |
| **Build & Push** | main/develop | 4 Docker builds parallel → ACR |
| **Integration Tests** | main only | docker-compose smoke tests |
| **Deploy** | main only | Rolling deploy to AKS + health verify |
| **Rollback** | On failure | Auto-undo all deployments |

### Azure DevOps (`azure-pipelines/azure-pipelines.yml`)

| Stage | Branch | Environment Gate |
|-------|--------|-----------------|
| Test | all | — |
| Build & Push | main, develop | — |
| Deploy Staging | develop | Auto |
| Deploy Production | main | **Manual approval** |
| Auto-rollback | On failure | — |

---

## 🔒 Security Features

- **Non-root containers** — all services run as UID 1000/101
- **Read-only filesystems** — `readOnlyRootFilesystem: true` on backends
- **NetworkPolicy** — zero-trust: frontend→backend, backend→DB only
- **ResourceQuota + LimitRange** — CPU/memory bounds per namespace
- **PodDisruptionBudget** — guaranteed availability during node drain
- **TopologySpreadConstraints** — pods distributed across nodes
- **Trivy scanning** — containers scanned before push and after
- **Workload Identity** — no service principal secrets in pods

---

## 📊 API Reference

### User Service (:3001)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | List all users (Redis cached) |
| GET | /api/users/:id | Get user by ID |
| POST | /api/users | Create user (bcrypt password) |
| DELETE | /api/users/:id | Soft delete user |
| POST | /api/auth/login | Login → JWT token |

### Product Service (:3002)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/products | List products (Redis cached 2min) |
| POST | /api/products | Create product |
| PATCH | /api/products/:id/stock | Update stock quantity |
| DELETE | /api/products/:id | Soft delete |

### Order Service (:3003)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/orders | List orders (with items) |
| POST | /api/orders | Create order (DB transaction, stock check) |
| PATCH | /api/orders/:id/status | Update order status |

---

## 📦 Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON for Azure login |
| `SLACK_BOT_TOKEN` | For rollback notifications |
