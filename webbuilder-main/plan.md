# 🎯 WebBuilder Enhancement Plan for code69.xyz Deployment

**Goal 1:** Configure API to accept smart contract ABI + address and output live Web3 frontend  
**Goal 2:** Deploy on infrastructure with frontends accessible at `*.code69.xyz`

---

## 📋 Phase 1: API Enhancement (Days 1-2)

### Task 1.1: Simplify Contract-to-Frontend API
**Status:** 🟡 Partially exists, needs enhancement  
**Time:** 2-3 hours

- [ ] **1.1.1** Review existing `/dapp/frontend-for-contract` endpoint in `main.py` (line ~497)
- [ ] **1.1.2** Create simplified payload model:
  ```python
  class SimplifiedContractPayload(BaseModel):
      contract_address: str  # e.g., "0x..."
      abi: list              # Full ABI as JSON array
      network: str           # e.g., "sepolia", "base", "polygon"
      chain_id: Optional[int] = None  # Auto-detect if not provided
      ui_description: Optional[str] = "Create a modern Web3 dashboard"
  ```
- [ ] **1.1.3** Add input validation:
  - Verify contract address format (0x + 40 hex chars)
  - Validate ABI is valid JSON array
  - Check network is supported
- [ ] **1.1.4** Test endpoint with curl:
  ```bash
  curl -X POST http://localhost:8000/api/v1/contract-frontend \
    -H "Content-Type: application/json" \
    -d '{
      "contract_address": "0x...",
      "abi": [...],
      "network": "sepolia"
    }'
  ```

### Task 1.2: Remove Authentication for Public API (Optional)
**Status:** 🔴 New feature  
**Time:** 1 hour

- [ ] **1.2.1** Create public endpoint variant: `/api/v1/public/contract-frontend`
- [ ] **1.2.2** Add rate limiting by IP instead of user tokens
- [ ] **1.2.3** Implement Redis-based rate limiting (10 requests per hour per IP)
- [ ] **1.2.4** Update CORS to allow your frontend domain

### Task 1.3: Optimize Frontend Generation
**Status:** 🟡 Needs optimization  
**Time:** 3-4 hours

- [ ] **1.3.1** Enhance `agent/prompts.py` with Web3-specific templates
- [ ] **1.3.2** Pre-generate common contract patterns:
  - ERC20 token dashboard
  - ERC721 NFT gallery
  - Staking interface
  - DAO voting UI
- [ ] **1.3.3** Add caching for similar ABIs (hash-based)
- [ ] **1.3.4** Reduce generation time from 5-10 min to 2-3 min

---

## 📋 Phase 2: Domain & Infrastructure Setup (Days 3-4)

### Task 2.1: Domain Configuration for code69.xyz
**Status:** 🔴 New setup  
**Time:** 2-3 hours

- [ ] **2.1.1** Register/verify ownership of `code69.xyz`
- [ ] **2.1.2** Configure DNS settings:
  ```
  Type: A Record
  Name: @
  Value: [Your server IP]
  TTL: 3600
  
  Type: A Record  
  Name: *
  Value: [Your server IP]
  TTL: 3600
  ```
- [ ] **2.1.3** Get SSL certificate:
  ```bash
  # Using Let's Encrypt
  certbot certonly --dns-cloudflare \
    -d code69.xyz -d *.code69.xyz
  ```
- [ ] **2.1.4** Verify wildcard subdomain: `test.code69.xyz` resolves

### Task 2.2: Replace E2B with Self-Hosted Deployment
**Status:** 🔴 Major change required  
**Time:** 1-2 days

**Option A: Docker-based Deployment (Recommended)**

- [ ] **2.2.1** Create frontend deployment service:
  ```python
  # New file: deployments/docker_deployer.py
  class DockerDeployer:
      async def deploy_frontend(
          self, 
          project_id: str, 
          files: dict,
          domain: str = "code69.xyz"
      ):
          # Build Docker image
          # Run container
          # Configure nginx proxy
          # Return URL: https://project-id.code69.xyz
  ```

- [ ] **2.2.2** Create Dockerfile template for frontends:
  ```dockerfile
  # deployments/frontend.Dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm install
  COPY . .
  RUN npm run build
  EXPOSE 3000
  CMD ["npm", "start"]
  ```

- [ ] **2.2.3** Set up nginx reverse proxy:
  ```nginx
  # /etc/nginx/sites-available/code69.xyz
  server {
      listen 443 ssl;
      server_name *.code69.xyz;
      
      ssl_certificate /etc/letsencrypt/live/code69.xyz/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/code69.xyz/privkey.pem;
      
      location / {
          proxy_pass http://127.0.0.1:$dynamic_port;
          proxy_set_header Host $host;
      }
  }
  ```

- [ ] **2.2.4** Implement dynamic port allocation (3000-4000 range)
- [ ] **2.2.5** Create container lifecycle manager:
  - Start container on first request
  - Auto-stop after 1 hour idle
  - Restart on subsequent requests

**Option B: Vercel/Netlify Integration (Alternative)**

- [ ] **2.2.6** Set up Vercel/Netlify API integration
- [ ] **2.2.7** Configure custom domain pointing
- [ ] **2.2.8** Automate deployment via API

### Task 2.3: Update Agent Service
**Status:** 🟡 Modification needed  
**Time:** 3-4 hours

- [ ] **2.3.1** Modify `agent/service.py`:
  - Replace `get_e2b_sandbox()` with `get_deployment_target()`
  - Support both E2B (dev) and Docker (production)
- [ ] **2.3.2** Update file write operations:
  - Write to temporary directory
  - Build project locally
  - Deploy to Docker container
- [ ] **2.3.3** Update URL generation:
  ```python
  # Old: url = f"https://{host}"  # E2B URL
  # New: url = f"https://{project_id}.code69.xyz"
  ```

---

## 📋 Phase 3: Database & Storage (Day 5)

### Task 3.1: Add Deployment Tracking
**Status:** 🟡 Partial (contracts table exists)  
**Time:** 2 hours

- [ ] **3.1.1** Create migration for deployments table:
  ```sql
  CREATE TABLE deployments (
      id VARCHAR(36) PRIMARY KEY,
      chat_id VARCHAR(36) REFERENCES chats(id),
      contract_address VARCHAR(42),
      frontend_url VARCHAR(255) NOT NULL,
      deployment_type VARCHAR(50), -- 'docker', 'vercel', 'netlify'
      status VARCHAR(50), -- 'building', 'live', 'stopped', 'failed'
      port INTEGER, -- For docker deployments
      container_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      last_accessed TIMESTAMP,
      INDEX idx_frontend_url (frontend_url),
      INDEX idx_status (status)
  );
  ```
- [ ] **3.1.2** Run migration: `alembic upgrade head`
- [ ] **3.1.3** Add ORM model in `db/models.py`

### Task 3.2: File Storage for Generated Code
**Status:** 🟢 Already exists (projects/ directory)  
**Time:** 1 hour

- [ ] **3.2.1** Verify `projects/` directory permissions
- [ ] **3.2.2** Add cleanup script for old projects:
  ```bash
  # scripts/cleanup_old_projects.sh
  find projects/ -type d -mtime +30 -exec rm -rf {} \;
  ```
- [ ] **3.2.3** Set up backup to S3/B2/Cloudflare R2 (optional)

---

## 📋 Phase 4: Backend Deployment (Days 6-7)

### Task 4.1: Server Setup
**Status:** 🔴 New deployment  
**Time:** 4-6 hours

- [ ] **4.1.1** Provision server (recommended: 4 CPU, 8GB RAM, 100GB SSD)
  - DigitalOcean Droplet
  - AWS EC2
  - Hetzner Cloud
  - Linode

- [ ] **4.1.2** Install dependencies:
  ```bash
  # Ubuntu 22.04+
  apt update && apt upgrade -y
  apt install -y python3.12 python3-pip postgresql nginx docker.io git
  systemctl enable docker
  systemctl start docker
  ```

- [ ] **4.1.3** Clone repository:
  ```bash
  cd /opt
  git clone [your-repo] webbuilder
  cd webbuilder
  ```

- [ ] **4.1.4** Set up PostgreSQL:
  ```bash
  sudo -u postgres createuser webbuilder
  sudo -u postgres createdb webbuilder
  sudo -u postgres psql -c "ALTER USER webbuilder PASSWORD 'secure-password';"
  ```

### Task 4.2: Environment Configuration
**Status:** 🔴 New setup  
**Time:** 1 hour

- [ ] **4.2.1** Create production `.env`:
  ```env
  # Database
  DATABASE_URL=postgresql+asyncpg://webbuilder:password@localhost/webbuilder
  
  # Auth
  SECRET_KEY=[generate with: openssl rand -hex 32]
  
  # LLM (choose one)
  OPENAI_API_KEY=sk-...
  
  # Deployment
  DEPLOYMENT_MODE=docker  # or 'e2b' for dev
  BASE_DOMAIN=code69.xyz
  DOCKER_PORT_RANGE_START=3000
  DOCKER_PORT_RANGE_END=4000
  
  # Optional: E2B for development
  E2B_API_KEY=...
  ```

- [ ] **4.2.2** Set proper permissions:
  ```bash
  chmod 600 .env
  chown webbuilder:webbuilder .env
  ```

### Task 4.3: Install & Configure
**Status:** 🔴 New deployment  
**Time:** 2 hours

- [ ] **4.3.1** Install Python packages:
  ```bash
  pip3 install -r requirements.txt
  ```

- [ ] **4.3.2** Run database migrations:
  ```bash
  alembic upgrade head
  ```

- [ ] **4.3.3** Create systemd service:
  ```ini
  # /etc/systemd/system/webbuilder.service
  [Unit]
  Description=WebBuilder API
  After=network.target postgresql.service
  
  [Service]
  Type=simple
  User=webbuilder
  WorkingDirectory=/opt/webbuilder
  Environment="PATH=/usr/bin"
  ExecStart=/usr/bin/uvicorn main:app --host 0.0.0.0 --port 8000
  Restart=always
  
  [Install]
  WantedBy=multi-user.target
  ```

- [ ] **4.3.4** Start service:
  ```bash
  systemctl daemon-reload
  systemctl enable webbuilder
  systemctl start webbuilder
  systemctl status webbuilder
  ```

### Task 4.4: Nginx Configuration
**Status:** 🔴 New setup  
**Time:** 2 hours

- [ ] **4.4.1** Create nginx config:
  ```nginx
  # /etc/nginx/sites-available/code69.xyz
  
  # API endpoint
  server {
      listen 443 ssl http2;
      server_name api.code69.xyz;
      
      ssl_certificate /etc/letsencrypt/live/code69.xyz/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/code69.xyz/privkey.pem;
      
      location / {
          proxy_pass http://127.0.0.1:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
      
      # WebSocket support
      location /ws/ {
          proxy_pass http://127.0.0.1:8000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_read_timeout 86400;
      }
  }
  
  # Wildcard for frontends
  server {
      listen 443 ssl http2;
      server_name ~^(?<subdomain>.+)\.code69\.xyz$;
      
      ssl_certificate /etc/letsencrypt/live/code69.xyz/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/code69.xyz/privkey.pem;
      
      location / {
          # Lookup port from database or use port mapping
          proxy_pass http://127.0.0.1:$port;
          proxy_set_header Host $host;
      }
  }
  
  # Redirect HTTP to HTTPS
  server {
      listen 80;
      server_name *.code69.xyz;
      return 301 https://$host$request_uri;
  }
  ```

- [ ] **4.4.2** Enable site:
  ```bash
  ln -s /etc/nginx/sites-available/code69.xyz /etc/nginx/sites-enabled/
  nginx -t
  systemctl reload nginx
  ```

- [ ] **4.4.3** Implement dynamic port routing:
  - Use Lua script or custom nginx module
  - Query deployment table for subdomain → port mapping

---

## 📋 Phase 5: Docker Deployment System (Days 8-9)

### Task 5.1: Create Deployment Manager
**Status:** 🔴 New component  
**Time:** 6-8 hours

- [ ] **5.1.1** Create `deployments/manager.py`:
  ```python
  import docker
  import asyncio
  from typing import Dict, Optional
  
  class DeploymentManager:
      def __init__(self):
          self.client = docker.from_env()
          self.active_deployments: Dict[str, dict] = {}
          self.port_allocator = PortAllocator(3000, 4000)
      
      async def deploy_project(
          self, 
          project_id: str,
          files: Dict[str, str],  # {filepath: content}
          abi: Optional[list] = None,
          contract_address: Optional[str] = None,
          network: Optional[str] = None
      ) -> str:
          """
          Deploy project to Docker container
          Returns: Frontend URL (https://project-id.code69.xyz)
          """
          # 1. Create project directory
          # 2. Write files
          # 3. Build Docker image
          # 4. Run container with allocated port
          # 5. Update nginx mapping
          # 6. Return URL
          pass
      
      async def stop_deployment(self, project_id: str):
          """Stop and remove container"""
          pass
      
      async def restart_deployment(self, project_id: str):
          """Restart existing deployment"""
          pass
  ```

- [ ] **5.1.2** Implement port allocation:
  ```python
  class PortAllocator:
      def __init__(self, start: int, end: int):
          self.available = set(range(start, end + 1))
          self.used = {}
      
      def allocate(self, project_id: str) -> int:
          port = self.available.pop()
          self.used[project_id] = port
          return port
      
      def release(self, project_id: str):
          if project_id in self.used:
              port = self.used.pop(project_id)
              self.available.add(port)
  ```

- [ ] **5.1.3** Create build script:
  ```python
  async def build_project(project_id: str, files: dict):
      # Create temp directory
      build_dir = f"/tmp/builds/{project_id}"
      os.makedirs(build_dir, exist_ok=True)
      
      # Write all files
      for filepath, content in files.items():
          full_path = os.path.join(build_dir, filepath)
          os.makedirs(os.path.dirname(full_path), exist_ok=True)
          with open(full_path, 'w') as f:
              f.write(content)
      
      # Build Docker image
      image, logs = client.images.build(
          path=build_dir,
          tag=f"frontend-{project_id}",
          dockerfile="Dockerfile"
      )
      
      return image
  ```

### Task 5.2: Integrate with Main API
**Status:** 🔴 New integration  
**Time:** 3-4 hours

- [ ] **5.2.1** Update `main.py` to use DeploymentManager:
  ```python
  from deployments.manager import DeploymentManager
  
  deployment_manager = DeploymentManager()
  
  @app.post("/api/v1/contract-frontend")
  async def create_contract_frontend(payload: ContractPayload):
      # Generate files with agent
      files = await generate_frontend_files(
          abi=payload.abi,
          contract_address=payload.contract_address,
          network=payload.network
      )
      
      # Deploy
      url = await deployment_manager.deploy_project(
          project_id=chat_id,
          files=files,
          abi=payload.abi,
          contract_address=payload.contract_address,
          network=payload.network
      )
      
      return {"success": True, "url": url}
  ```

- [ ] **5.2.2** Update database with deployment info
- [ ] **5.2.3** Add cleanup cron job for unused deployments

### Task 5.3: Nginx Dynamic Routing
**Status:** 🔴 Advanced feature  
**Time:** 4-5 hours

- [ ] **5.3.1** Install OpenResty (nginx + Lua):
  ```bash
  apt install -y openresty
  ```

- [ ] **5.3.2** Create Lua script for port lookup:
  ```lua
  -- /etc/nginx/lua/route.lua
  local cjson = require "cjson"
  local pgmoon = require("pgmoon")
  
  local pg = pgmoon.new({
      host = "127.0.0.1",
      port = "5432",
      database = "webbuilder",
      user = "webbuilder",
      password = "password"
  })
  
  pg:connect()
  
  local subdomain = ngx.var.subdomain
  local res = pg:query("SELECT port FROM deployments WHERE frontend_url LIKE '%" .. subdomain .. "%' AND status='live'")
  
  if res and res[1] then
      ngx.var.port = res[1].port
  else
      ngx.status = 404
      ngx.say("Deployment not found")
      ngx.exit(404)
  end
  ```

- [ ] **5.3.3** Update nginx config to use Lua
- [ ] **5.3.4** Test routing

---

## 📋 Phase 6: Testing & Optimization (Day 10)

### Task 6.1: End-to-End Testing
**Status:** 🔴 New tests  
**Time:** 3-4 hours

- [ ] **6.1.1** Test complete flow:
  ```bash
  # 1. Submit contract ABI
  curl -X POST https://api.code69.xyz/api/v1/contract-frontend \
    -H "Content-Type: application/json" \
    -d '{
      "contract_address": "0x...",
      "abi": [...],
      "network": "sepolia"
    }'
  
  # 2. Wait for build (2-3 min)
  
  # 3. Access frontend
  curl https://abc-123.code69.xyz
  
  # 4. Verify wallet connection works
  # 5. Verify contract interactions work
  ```

- [ ] **6.1.2** Test different contract types:
  - ERC20 token
  - ERC721 NFT
  - Custom contracts with complex ABIs

- [ ] **6.1.3** Load testing:
  ```bash
  # Test 10 concurrent deployments
  ab -n 10 -c 10 -p payload.json https://api.code69.xyz/api/v1/contract-frontend
  ```

### Task 6.2: Monitoring Setup
**Status:** 🔴 New setup  
**Time:** 2-3 hours

- [ ] **6.2.1** Set up logging:
  ```python
  # Add to main.py
  import logging
  logging.basicConfig(
      filename='/var/log/webbuilder/app.log',
      level=logging.INFO,
      format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
  )
  ```

- [ ] **6.2.2** Add deployment metrics:
  - Total deployments
  - Active deployments
  - Average build time
  - Success rate

- [ ] **6.2.3** Set up alerts (optional):
  - Email on deployment failures
  - Slack notifications
  - Disk space warnings

### Task 6.3: Performance Optimization
**Status:** 🟡 Ongoing  
**Time:** 2-3 hours

- [ ] **6.3.1** Cache Docker base images
- [ ] **6.3.2** Implement build queue (if concurrent builds cause issues)
- [ ] **6.3.3** Add CDN for static assets (optional)
- [ ] **6.3.4** Database query optimization

---

## 📋 Phase 7: Documentation & Polish (Day 11)

### Task 7.1: API Documentation
**Status:** 🔴 Needs update  
**Time:** 2 hours

- [ ] **7.1.1** Update `/docs` endpoint with new API
- [ ] **7.1.2** Create API usage examples:
  ```markdown
  # API Documentation
  
  ## Create Frontend from Contract
  
  POST /api/v1/contract-frontend
  
  Request:
  {
    "contract_address": "0x...",
    "abi": [...],
    "network": "sepolia",
    "ui_description": "Modern dashboard with stats"
  }
  
  Response:
  {
    "success": true,
    "url": "https://abc-123.code69.xyz",
    "project_id": "abc-123",
    "estimated_time": "2-3 minutes"
  }
  ```

- [ ] **7.1.3** Add code examples for popular languages (Python, JavaScript, cURL)

### Task 7.2: User Guide
**Status:** 🔴 New docs  
**Time:** 1-2 hours

- [ ] **7.2.1** Create `DEPLOYMENT_GUIDE.md` with:
  - How to use the API
  - How to customize frontends
  - How to use custom domains
  - Troubleshooting

- [ ] **7.2.2** Update README.md with new deployment info

---

## 📋 Phase 8: Production Launch (Day 12)

### Task 8.1: Final Checks
**Status:** 🔴 Pre-launch  
**Time:** 2-3 hours

- [ ] **8.1.1** Security audit:
  - Rate limiting enabled
  - SSL certificates valid
  - Firewall configured (only 80, 443, 22 open)
  - Database not exposed publicly
  - Environment variables secure

- [ ] **8.1.2** Backup setup:
  ```bash
  # Create backup script
  # /opt/scripts/backup.sh
  pg_dump webbuilder > /backups/webbuilder-$(date +%Y%m%d).sql
  tar -czf /backups/projects-$(date +%Y%m%d).tar.gz /opt/webbuilder/projects/
  
  # Add to crontab
  0 2 * * * /opt/scripts/backup.sh
  ```

- [ ] **8.1.3** Test disaster recovery:
  - Restore from backup
  - Verify deployments work after restore

### Task 8.2: Go Live
**Status:** 🔴 Launch ready  
**Time:** 1 hour

- [ ] **8.2.1** Final DNS check (propagation complete)
- [ ] **8.2.2** Test all endpoints one more time
- [ ] **8.2.3** Create first production deployment
- [ ] **8.2.4** Announce launch! 🚀

---

## 🔧 Maintenance Tasks (Ongoing)

### Weekly
- [ ] Review logs for errors
- [ ] Check disk space usage
- [ ] Clean up old deployments
- [ ] Update dependencies

### Monthly
- [ ] Database vacuum/optimize
- [ ] Review and update SSL certificates
- [ ] Security updates
- [ ] Performance analysis

---

## 📊 Success Metrics

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | < 500ms | - |
| Frontend Build Time | < 3 min | - |
| Success Rate | > 95% | - |
| Uptime | > 99% | - |
| Concurrent Deployments | 10+ | - |

---

## 🚨 Troubleshooting Guide

### Issue: Deployment fails
**Check:**
1. Docker daemon running: `systemctl status docker`
2. Disk space: `df -h`
3. Logs: `journalctl -u webbuilder -n 100`

### Issue: Frontend not accessible
**Check:**
1. Container running: `docker ps | grep project-id`
2. Port allocated: `netstat -tlnp | grep 3000`
3. Nginx config: `nginx -t`
4. DNS resolution: `nslookup project-id.code69.xyz`

### Issue: Slow builds
**Solutions:**
1. Pre-cache base images
2. Use build queue
3. Increase server resources

---

## 📚 Key Files Reference

```
webbuilder-main/
├── deployments/
│   ├── manager.py          # NEW: Docker deployment manager
│   ├── frontend.Dockerfile # NEW: Template for frontends
│   └── nginx_config.lua    # NEW: Dynamic routing
│
├── main.py                 # MODIFY: Add new endpoints
├── agent/service.py        # MODIFY: Replace E2B with Docker
├── db/models.py           # ADD: Deployment model
├── alembic/versions/      # ADD: Deployment migration
│
└── config/
    ├── nginx/             # NEW: Nginx configs
    └── systemd/           # NEW: Service files
```

---

## ✅ Launch Checklist

Before going live, ensure:

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Nginx configured and tested
- [ ] Docker working properly
- [ ] API endpoints tested
- [ ] Frontend deployment works
- [ ] Domain resolves correctly
- [ ] Monitoring set up
- [ ] Backups automated
- [ ] Documentation updated
- [ ] Security hardened

---

## 🎯 Timeline Summary

| Phase | Days | Key Deliverable |
|-------|------|----------------|
| 1. API Enhancement | 1-2 | Simplified contract-to-frontend endpoint |
| 2. Infrastructure | 3-4 | Domain + SSL + Server setup |
| 3. Database | 5 | Deployment tracking |
| 4. Backend Deploy | 6-7 | Backend live on code69.xyz |
| 5. Docker System | 8-9 | Frontend deployment working |
| 6. Testing | 10 | End-to-end tests passing |
| 7. Documentation | 11 | Complete guides |
| 8. Launch | 12 | Production ready |

**Total: 12 days to production**

---

## 💰 Estimated Costs (Monthly)

| Item | Cost |
|------|------|
| Server (4 CPU, 8GB RAM) | $20-40 |
| Domain (code69.xyz) | $1-2 |
| SSL (Let's Encrypt) | Free |
| LLM API (OpenAI) | $10-50 |
| Database | Included |
| Backup storage | $5-10 |
| **Total** | **$36-102/mo** |

---

## 🎉 Success!

Once complete, you'll have:
✅ API that accepts contract ABI + address  
✅ Generates Web3 frontend automatically  
✅ Deploys to `*.code69.xyz` domains  
✅ Self-hosted on your infrastructure  
✅ No per-deployment costs (unlike E2B)  
✅ Full control and customization  

**Let's build! 🚀**
