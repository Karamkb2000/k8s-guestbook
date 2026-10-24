# Guestbook — a real 3-tier app on Kubernetes

A working application you can demo end to end:

```
Users → frontend (nginx + HTML/JS) → backend (Node/Express API) → database (Postgres + disk)
```

- **frontend** — a real web UI (post a message, see the list live) served by nginx, which proxies `/api` to the backend.
- **backend** — a Node/Express REST API (`/api/health`, `/api/messages`) that reads/writes Postgres.
- **database** — Postgres with a PersistentVolume so messages survive restarts.

## Structure
```
guestbook/
├── backend/           # the API app + Dockerfile
│   ├── src/server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/          # the web app + Dockerfile
│   ├── public/{index.html,app.js,styles.css}
│   ├── nginx.conf
│   └── Dockerfile
└── k8s/               # Kubernetes manifests (kustomize)
    ├── kustomization.yaml
    ├── namespace.yaml
    ├── database/      # secret, pvc, deployment, service
    ├── backend/       # configmap, deployment, service
    ├── frontend/      # deployment, service
    └── ingress.yaml
```

## 1. Build the two images INTO minikube
The Deployments use local images (`guestbook-backend:1.0`, `guestbook-frontend:1.0`) with `imagePullPolicy: IfNotPresent`, so build them inside minikube's Docker so the cluster can find them.

```bash
eval $(minikube docker-env)          # point your docker CLI at minikube's docker
docker build -t guestbook-backend:1.0 ./backend
docker build -t guestbook-frontend:1.0 ./frontend
```
> `eval $(minikube docker-env)` makes `docker build` put the image inside the cluster's node — no registry needed. (To undo it in that shell: `eval $(minikube docker-env -u)`.)
> Alternative: build normally, then `minikube image load guestbook-backend:1.0` and `minikube image load guestbook-frontend:1.0`.

## 2. Deploy
```bash
kubectl apply -k k8s/
kubectl get all -n guestbook
kubectl get pods -n guestbook -w        # wait until every pod is Running / READY
```

## 3. Open it
```bash
minikube service frontend -n guestbook   # opens the NodePort URL in your browser
# or, via ingress (after mapping guestbook.local to `minikube ip` in your hosts file):
curl http://guestbook.local/
```
Post a message in the UI — it goes frontend → backend → Postgres and back.

## 4. Tear down
```bash
kubectl delete -k k8s/
# or: kubectl delete namespace guestbook
```

## Teaching hooks (what to demo)
- **Pods & replicas:** `kubectl get pods -n guestbook -o wide` — 2 frontend, 2 backend, 1 db, each with its own IP.
- **Services & DNS:** the frontend reaches the backend at `http://backend:5000`; the backend reaches Postgres at `database:5432` — by Service name.
- **Config vs secrets:** `backend-config` (ConfigMap) holds non-secret settings; `db-credentials` (Secret) holds the password.
- **Storage:** delete the db pod — data survives because of the PVC.
- **Self-healing:** `kubectl delete pod -l app=backend -n guestbook` → the Deployment recreates it.
- **Scaling:** `kubectl scale deployment/backend --replicas=4 -n guestbook`.
- **Which pod served me:** the `/api/health` response shows the backend pod name (visible in the UI header).

Needs a running cluster (see the session SETUP guide), kubectl, and Docker.
