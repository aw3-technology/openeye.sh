# Scale & Reliability (146–158)

---

## 146. Kubernetes Deployment (Helm Chart)

**As an enterprise ops team member, I can deploy OpenEye to Kubernetes using an official Helm chart with configurable replicas, resources, and ingress.**

### Acceptance Criteria

- [ ] An official Helm chart is published at `oci://ghcr.io/openeye-ai/charts/openeye` and indexed in the Helm repository at `https://charts.openeye.ai`
- [ ] `helm install openeye oci://ghcr.io/openeye-ai/charts/openeye --namespace openeye --create-namespace` deploys a working OpenEye inference server with sensible defaults
- [ ] Chart source lives in `deploy/helm/openeye/` with `Chart.yaml`, `values.yaml`, and templates for Deployment, Service, ConfigMap, Secret, ServiceAccount, Ingress, PDB, HPA, and PVC
- [ ] `values.yaml` exposes all key configuration: `replicaCount`, `image.repository`, `image.tag`, `resources.requests`, `resources.limits`, `gpu.enabled`, `gpu.count`, `model.name`, `model.version`, `ingress.enabled`, `ingress.className`, `ingress.hosts`, `ingress.tls`
- [ ] GPU support: setting `gpu.enabled: true` and `gpu.count: 1` adds `nvidia.com/gpu: 1` to resource requests/limits and sets `runtimeClassName: nvidia`
- [ ] Model configuration: `model.name: yolov8` and `model.pullPolicy: IfNotPresent` control which model is loaded and whether it is re-downloaded on pod restart
- [ ] ConfigMap mounts the OpenEye server configuration at `/etc/openeye/config.yaml` inside the container
- [ ] Secrets (API keys, TLS certs, registry credentials) are managed via Kubernetes Secrets referenced in `values.yaml` as `existingSecret` or created inline
- [ ] Ingress template supports `nginx`, `traefik`, and `istio` ingress controllers with appropriate annotations
- [ ] `helm test openeye` runs a test pod that hits the `/health` endpoint and validates the server is ready
- [ ] Chart passes `helm lint` and `helm template` validation in CI on every commit
- [ ] Chart version follows SemVer and is published automatically on tagged releases via GitHub Actions
- [ ] `helm upgrade openeye ...` performs a rolling update by default (see story 151)
- [ ] `helm uninstall openeye` cleanly removes all resources including PVCs if `persistence.cleanupOnUninstall: true` is set

### Edge Cases

- [ ] Deploying without GPU nodes: if `gpu.enabled: true` but no nodes have `nvidia.com/gpu` capacity, pods remain `Pending` with a clear event message — `helm status openeye` shows the scheduling failure reason
- [ ] Image pull failure (registry auth, rate limit): pods enter `ImagePullBackOff` with a descriptive event. Chart supports `imagePullSecrets` in `values.yaml` for private registries
- [ ] Conflicting namespace: if the namespace already contains a release named `openeye`, `helm install` fails with a clear message — use `helm upgrade --install` for idempotent deployments
- [ ] Values override precedence: `--set` flags override `values.yaml`, and `--values custom.yaml` overrides defaults — standard Helm merge behavior is documented in chart README
- [ ] Resource quota enforcement: if the namespace has a `ResourceQuota` and the requested resources exceed it, the Deployment fails with a quota exceeded event — chart documents minimum resource requirements
- [ ] Multi-architecture images: the container image is published as a multi-arch manifest (`linux/amd64`, `linux/arm64`) so the chart works on both x86 and ARM K8s clusters (Graviton, Apple Silicon dev clusters)
- [ ] Helm chart with CRDs: the chart does not install CRDs by default. If `serviceMonitor.enabled: true` (for Prometheus, see story 150), the chart documents the prerequisite CRD installation
- [ ] Large model download on first pod start: if the model is not cached in the PVC (story 152), the init container downloads it — `initialDelaySeconds` on the readiness probe is set to `120` by default to allow model download time
- [ ] TLS termination at ingress vs pod: `ingress.tls` handles termination at the ingress controller. `server.tls.enabled` handles pod-level TLS — both are documented with mutual exclusivity notes
- [ ] Helm rollback: `helm rollback openeye 1` reverts to the previous release. Chart hooks ensure database migrations (if any) are forward-compatible to support rollbacks
- [ ] Secret rotation: Kubernetes Secrets referenced via `envFrom` are not updated in running pods. Chart supports `secretChecksum` annotation on the Deployment to trigger a rolling restart when secrets change — alternatively, documents integration with external-secrets-operator or secrets-store-csi-driver for auto-rotation
- [ ] NetworkPolicy isolation: chart includes an optional `NetworkPolicy` template (`networkPolicy.enabled: true`) that restricts ingress to only the Service port and egress to only the model registry, queue backend, and DNS — prevents lateral movement from compromised pods in multi-tenant clusters
- [ ] Pod security context: chart sets `securityContext.runAsNonRoot: true`, `readOnlyRootFilesystem: true` (with writable `emptyDir` for temp files), and drops all capabilities except `NET_BIND_SERVICE`. GPU containers require `privileged: false` with `nvidia` runtime class — documented exceptions for GPU access
- [ ] NVIDIA device plugin prerequisite: chart includes a pre-install hook Job that checks for the `nvidia.com/gpu` resource type in the cluster. If absent, the Job fails with a message linking to the NVIDIA device plugin DaemonSet installation guide — prevents cryptic scheduling failures
- [ ] Air-gapped init container: when `offlineMode: true`, the init container skips `openeye pull` entirely and expects models pre-loaded on the PVC. If the PVC is empty, the init container exits with a clear error: "Offline mode enabled but no models found on PVC. Use `openeye bundle install` to pre-load models" — does not hang attempting DNS resolution
- [ ] CRD lifecycle on upgrade: if KEDA `ScaledObject` CRDs (story 147) change between Helm chart versions, `helm upgrade` does not manage CRD updates (Helm limitation). Chart README documents the manual CRD update step and the `--skip-crds` flag behavior
- [ ] Compliance audit logging: for regulated environments, chart includes an optional audit log sidecar (`audit.enabled: true`) that captures all API requests with source IP, timestamp, endpoint, response status, and user identity (from API key) — writes to the audit PVC (story 152) in append-only JSONL format
- [ ] Admission webhook rejection: OPA/Gatekeeper/Kyverno policies may reject pods silently — `helm install` succeeds but no pods appear. Add post-install hook or `helm test` validating at least 1 pod reaches Running state
- [ ] RBAC misconfiguration: if ServiceAccount lacks permissions for leader election (Lease API) or ConfigMap reads, pods start but features fail at runtime — validate RBAC bindings match requirements
- [ ] PV mount race on multi-replica first deploy: all init containers attempt to download model to same PVC simultaneously — need file lock or leader init container to prevent concurrent writes
- [ ] Pod Security Standards (PSS) violation: clusters enforcing `restricted` PSS reject pods using `runAsUser: 0` — chart must document PSS compatibility or provide rootless option

### Technical Notes

- Base container image: `ghcr.io/openeye-ai/openeye:latest` (or pinned tag)
- Chart templates use Helm's `tpl` function for templated values (e.g., `ingress.hosts[0].host: "{{ .Values.global.domain }}"`)
- Default resource requests: `cpu: 500m`, `memory: 1Gi` (CPU mode); `cpu: 1`, `memory: 4Gi`, `nvidia.com/gpu: 1` (GPU mode)
- PodDisruptionBudget is enabled by default with `minAvailable: 1` for HA deployments (see story 150)
- ServiceAccount supports IRSA (AWS), Workload Identity (GCP), and Azure AD annotations for cloud provider integration

### Example Usage

```bash
# Basic deployment
helm install openeye oci://ghcr.io/openeye-ai/charts/openeye \
  --namespace openeye --create-namespace \
  --set model.name=yolov8 \
  --set replicaCount=2

# GPU-enabled with ingress
helm install openeye oci://ghcr.io/openeye-ai/charts/openeye \
  --namespace openeye --create-namespace \
  --values custom-values.yaml

# custom-values.yaml
replicaCount: 3
gpu:
  enabled: true
  count: 1
model:
  name: yolov8
  version: "8.1"
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: openeye.corp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: openeye-tls
      hosts:
        - openeye.corp.example.com
resources:
  requests:
    cpu: "2"
    memory: 8Gi
    nvidia.com/gpu: 1
  limits:
    cpu: "4"
    memory: 16Gi
    nvidia.com/gpu: 1
```

---

## 147. Horizontal Pod Autoscaling

**As an enterprise ops team member, I can configure OpenEye deployments on K8s to auto-scale inference replicas based on GPU utilization, request queue depth, or custom metrics.**

### Acceptance Criteria

- [ ] The Helm chart (story 146) includes an HPA template enabled via `autoscaling.enabled: true` in `values.yaml`
- [ ] Default HPA configuration scales based on CPU utilization (`targetCPUUtilizationPercentage: 70`) and memory utilization (`targetMemoryUtilizationPercentage: 80`)
- [ ] GPU-based scaling: when `autoscaling.gpu.enabled: true`, HPA scales on `nvidia.com/gpu_utilization` via the DCGM exporter and Prometheus adapter, targeting `autoscaling.gpu.targetUtilization: 70`
- [ ] Custom metrics scaling: `autoscaling.metrics` accepts arbitrary Prometheus metrics — e.g., `openeye_inference_queue_depth` with a target average value
- [ ] `autoscaling.minReplicas` (default: 1) and `autoscaling.maxReplicas` (default: 10) are configurable in `values.yaml`
- [ ] Scale-up behavior: `autoscaling.behavior.scaleUp.stabilizationWindowSeconds: 60` prevents thrashing on bursty workloads — pods are added only after sustained high load
- [ ] Scale-down behavior: `autoscaling.behavior.scaleDown.stabilizationWindowSeconds: 300` prevents premature scale-down — pods are removed only after sustained low load
- [ ] Scale-down policy: `autoscaling.behavior.scaleDown.policies` defaults to removing at most 1 pod per 60 seconds to ensure graceful connection draining
- [ ] The OpenEye server exposes `/metrics` in Prometheus format with `openeye_inference_queue_depth`, `openeye_inference_latency_seconds`, `openeye_gpu_memory_used_bytes`, and `openeye_active_connections` gauges
- [ ] A `ServiceMonitor` (or `PodMonitor`) template is included for Prometheus Operator integration: `serviceMonitor.enabled: true` in `values.yaml`
- [ ] HPA uses `autoscaling/v2` API to support multiple metrics with configurable behavior policies
- [ ] `openeye status --k8s` displays current replica count, HPA target vs actual metrics, and scaling events
- [ ] Scale-to-zero is optionally supported via KEDA integration: `autoscaling.keda.enabled: true` with `idleReplicaCount: 0` and `minReplicaCount: 1`

### Edge Cases

- [ ] DCGM exporter not installed: if GPU-based scaling is enabled but DCGM metrics are not available, HPA reports `<unknown>` for the metric and does not scale — logs a clear event explaining the missing metrics source and installation steps for the DCGM exporter
- [ ] Prometheus adapter not configured: if custom metrics (e.g., `openeye_inference_queue_depth`) are referenced but the Prometheus adapter is not installed, HPA reports `FailedGetExternalMetric` — chart documents the prerequisite Prometheus adapter installation
- [ ] Rapid burst: 100x traffic spike within seconds — scale-up stabilization window delays pod creation by 60s. If this latency is unacceptable, `stabilizationWindowSeconds: 0` can be set, but chart warns about potential thrashing in the values comments
- [ ] Scale-down during active inference: the HPA respects the PDB (`minAvailable: 1`, story 150) and the pod's `terminationGracePeriodSeconds: 60` — in-flight requests complete before the pod terminates
- [ ] GPU node pool exhausted: scale-up triggers a new pod but no GPU nodes are available — pod stays `Pending`. If cluster autoscaler is enabled, it provisions a new GPU node (latency: 2-5 min). Chart documents the expected delay
- [ ] Conflicting HPA and manual scaling: if `kubectl scale deployment openeye --replicas=5` is used alongside HPA, HPA overrides the manual setting — chart documents this behavior
- [ ] KEDA scale-to-zero: when all replicas are removed, the first incoming request triggers a cold start (model load, ~30-60s). KEDA's `scaleTargetRef.pollingInterval` (default: 30s) determines wake-up latency
- [ ] Metric lag: Prometheus scrape interval (default: 15s) plus adapter cache (default: 30s) means metrics may be up to 45s stale — scale-up decisions lag real load. Chart documents this and recommends reducing scrape intervals for latency-sensitive workloads
- [ ] Multi-metric HPA: when CPU and GPU metrics disagree (CPU low, GPU high), HPA scales to satisfy the metric that requires the most replicas — this is standard K8s behavior but should be documented
- [ ] HPA flapping between min and max: if the workload oscillates, repeated scaling events generate excessive events in `kubectl describe hpa` — chart sets `behavior.scaleDown.stabilizationWindowSeconds: 300` by default to dampen oscillation
- [ ] Scale-from-zero cold-start cascade (KEDA): when scaling from 0 to N replicas, all new pods simultaneously load models into GPU memory. If pods share a GPU node (MIG/time-slicing, story 148), concurrent model loading causes memory contention. KEDA `minReplicaCount: 1` avoids scale-to-zero for latency-sensitive workloads — documented as the recommended setting for production
- [ ] Queue metric invisibility during fallback: if the Redis queue backend (story 154) is unavailable and the server falls back to an in-memory queue, the `openeye_inference_queue_depth` Prometheus metric reflects only the in-memory queue. HPA scaling decisions based on queue depth may be incorrect (queue appears empty when Redis is down). Chart documents this interaction and recommends alerting on Redis availability alongside HPA
- [ ] Autoscaler state loss on pod restart: HPA state is managed by the Kubernetes controller manager and survives pod restarts. However, if using a custom autoscaler sidecar (for advanced multi-metric logic), its cooldown timers and flap detection counters are in-memory and lost on restart — the sidecar should persist state to a ConfigMap or Redis to prevent post-restart scaling storms
- [ ] Predictive scaling with sparse data: if `autoscaling.predictive.enabled: true` is set but fewer than 7 days of metric history exist, the predictive model produces unreliable forecasts. The autoscaler falls back to reactive-only scaling for the first 7 days with a log message: "Insufficient history for predictive scaling — using reactive scaling only"
- [ ] Cost guardrails with spot pricing: the `--max-hourly-cost` guardrail (if implemented via custom autoscaler) requires instance pricing data. Spot/preemptible instance prices fluctuate — the autoscaler uses the on-demand price as a conservative upper bound. Stale pricing data (>90 days) triggers a warning
- [ ] Compound metric rule evaluation: multi-metric HPA with OR logic (e.g., "scale up if queue_depth > 50 OR gpu_util > 80%") evaluates all metrics in a single cycle and takes the maximum recommended replica count — not the sum. This prevents double-scaling when both conditions are true simultaneously
- [ ] Resource fragmentation with heterogeneous GPU nodes: HPA requests pod, cluster autoscaler adds wrong GPU type (T4 vs A100) — pod crashes on model load, creating infinite scale-up loop
- [ ] KEDA ScaledObject and HPA conflict: if both `autoscaling.enabled` and `autoscaling.keda.enabled` are true, they fight over replica count causing oscillation
- [ ] Scale-to-zero recovery under burst: KEDA scales to zero, 100 concurrent requests arrive — 99 timeout during 30-60s cold start. No request buffering during scale-from-zero
- [ ] HPA `desiredReplicas` exceeds available nodes with anti-affinity: topological constraint blocks scheduling even though `maxReplicas` check passes

### Technical Notes

- HPA manifest uses `autoscaling/v2` (stable since K8s 1.23)
- GPU metrics require NVIDIA DCGM Exporter and the k8s-prometheus-adapter configured with custom metrics rules
- KEDA integration uses the `ScaledObject` CRD pointing at the OpenEye Deployment
- OpenEye server exposes Prometheus metrics via `/metrics` using the `prometheus_client` Python library
- Default metrics port is `9090` (configurable via `metrics.port` in values.yaml), separate from the inference port `8000`

### Example Config

```yaml
# values.yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  gpu:
    enabled: true
    targetUtilization: 70
  metrics:
    - type: Pods
      pods:
        metric:
          name: openeye_inference_queue_depth
        target:
          type: AverageValue
          averageValue: "5"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60

serviceMonitor:
  enabled: true
  interval: 15s
  scrapeTimeout: 10s
```

---

## 148. GPU Scheduling & Node Affinity

**As an enterprise ops team member, I can configure K8s deployments to intelligently schedule inference pods on GPU nodes with proper resource requests and affinity rules.**

### Acceptance Criteria

- [ ] When `gpu.enabled: true`, the Helm chart adds `nvidia.com/gpu: <count>` to both `resources.requests` and `resources.limits` on the inference container
- [ ] The chart sets `runtimeClassName: nvidia` (configurable via `gpu.runtimeClassName`) to ensure the NVIDIA container runtime is used
- [ ] Node affinity is configurable via `nodeAffinity` in `values.yaml` — default `preferredDuringSchedulingIgnoredDuringExecution` prefers nodes labeled `accelerator: nvidia-gpu`
- [ ] Node selector shorthand: `nodeSelector: { "nvidia.com/gpu.product": "NVIDIA-A100-SXM4-40GB" }` targets specific GPU models
- [ ] Tolerations are configurable: default toleration for `nvidia.com/gpu=present:NoSchedule` is added when GPU mode is enabled so pods can schedule on tainted GPU nodes
- [ ] GPU type affinity: `gpu.type: a100` adds a node affinity rule for `nvidia.com/gpu.product` matching the A100 — supports `a100`, `a10g`, `t4`, `l4`, `h100`, `rtx4090` as convenience aliases
- [ ] Multi-GPU pods: `gpu.count: 4` requests 4 GPUs and sets `CUDA_VISIBLE_DEVICES` appropriately — the OpenEye server uses all allocated GPUs for parallel inference
- [ ] GPU memory request: `gpu.memory: "16Gi"` adds an annotation `nvidia.com/gpu.memory` (or equivalent device plugin label) for scheduling on nodes with sufficient VRAM
- [ ] Topology-aware scheduling: when `gpu.topologyAware: true` and the GPU topology plugin is installed, pods requesting multiple GPUs are scheduled on NVLink-connected GPUs for optimal bandwidth
- [ ] Anti-affinity: `podAntiAffinity.preferredDuringSchedulingIgnoredDuringExecution` distributes inference pods across nodes by default to maximize fault tolerance (see story 150)
- [ ] The chart supports mixed node pools: inference pods with `gpu.enabled: true` land on GPU nodes while management plane pods (if any) run on CPU-only nodes
- [ ] `kubectl describe pod openeye-xxx` shows the GPU resource allocation and scheduling decision in the Events section
- [ ] Init container for GPU validation: an optional init container (`gpu.validation.enabled: true`) runs `nvidia-smi` and verifies the allocated GPU is functional before the main container starts

### Edge Cases

- [ ] No GPU nodes in cluster: pods stay `Pending` with event `FailedScheduling: 0/10 nodes are available: 10 Insufficient nvidia.com/gpu`. Chart documents the error and links to GPU node pool setup guides for EKS, GKE, and AKS
- [ ] GPU node with all GPUs already allocated: pod stays `Pending` until a GPU is freed or cluster autoscaler adds a node. `kubectl get events` shows the resource contention
- [ ] GPU driver version mismatch: if the node's NVIDIA driver is too old for the CUDA version in the container, the pod crashes with a `CUDA driver version is insufficient` error — the init container (if enabled) catches this and reports the required vs actual driver version
- [ ] Mixed GPU types in cluster (e.g., T4 and A100): without `gpu.type` affinity, pods may schedule on either GPU type, leading to unpredictable inference performance. Chart defaults to no GPU type preference but documents the importance of setting `gpu.type` in production
- [ ] GPU memory exhaustion: if the model requires more VRAM than the allocated GPU has (e.g., large model on T4 with 16GB), the pod OOMs at model load time — the readiness probe fails and K8s restarts the pod. After `restartPolicy` backoff, the pod enters `CrashLoopBackOff` with a clear log message about insufficient GPU memory
- [ ] NVIDIA device plugin not installed: `nvidia.com/gpu` resource type is unknown to the scheduler — pods fail with `InvalidResourceRequest`. Chart documents the prerequisite NVIDIA device plugin DaemonSet
- [ ] Spot/preemptible GPU instances: pods on preemptible nodes may be evicted. Chart supports `topologySpreadConstraints` to avoid placing all replicas on preemptible nodes — configurable via `spotTolerance.maxPercentage: 50`
- [ ] GPU sharing (MIG/MPS): `gpu.sharing.strategy: mig` configures NVIDIA Multi-Instance GPU partitioning, allowing multiple pods to share a single A100. MIG profile is configurable via `gpu.sharing.migProfile: "1g.5gb"`
- [ ] Node drain during upgrade: when a GPU node is cordoned, `PodDisruptionBudget` (story 150) ensures at least `minAvailable` inference pods remain running on other nodes before the drained pod is evicted
- [ ] Init container GPU validation timeout: if `nvidia-smi` hangs (driver lockup), the init container has a 30-second timeout after which it fails and K8s restarts the pod
- [ ] Time-slicing GPUs: when `gpu.sharing.strategy: time-slicing`, multiple pods share a GPU via time-slicing — chart warns about increased inference latency and jitter in the values comments
- [ ] Numerical precision across GPU architectures: the same model on different GPU types (e.g., T4 FP16 vs A100 TF32) produces slightly different floating-point results due to architecture-specific fused operations and rounding modes. Confidence scores may differ by 1-5%, causing different objects to pass/fail threshold filters. For safety-critical pipelines (e.g., hazard detection for robot HALT commands, story 83), chart documents the recommendation to pin `gpu.type` for consistent results
- [ ] Backend-specific model cache conflicts: if a pod switches GPU types during rescheduling (e.g., T4 node drained, pod rescheduled to A100 node), TensorRT engines cached on the PVC (story 152) are architecture-specific and will fail to load. TensorRT cache paths must be namespaced by GPU compute capability (e.g., `models/yolov8/tensorrt/sm75/` for T4 vs `sm80/` for A100) — mismatched engines are rebuilt automatically with a warning
- [ ] Heterogeneous GPU weighting in load balancer: when the cluster has mixed GPU types (e.g., some workers on T4, others on A100), inference latency varies drastically. The default round-robin or least-connections routing (story 149) may overload slower GPUs. Chart supports `gpu.performanceWeight` annotation (e.g., `T4: 1, A100: 4`) that feeds into Envoy/Istio weighted routing for proportional load distribution
- [ ] GPU ECC errors: A100 reports uncorrectable ECC memory errors — device plugin still advertises GPU as available, pods produce silent inference errors (corrupted tensor computations) with no crash signal
- [ ] GPU falls off PCIe bus: after thermal events, `nvidia-smi` returns `GPU is lost` — device plugin may not de-register GPU, new pods schedule on dead GPU
- [ ] CUDA compute capability mismatch: model compiled for 8.0 (A100) scheduled on 7.5 (T4) — operations fail at runtime with `no kernel image available`
- [ ] GPU clock throttling without pod eviction: under sustained load, inference latency doubles but no K8s signal generated — HPA may not scale because utilization still reads high

### Technical Notes

- GPU resource requests use the standard Kubernetes extended resource `nvidia.com/gpu` managed by the NVIDIA device plugin
- `runtimeClassName: nvidia` requires the NVIDIA Container Toolkit to be installed on GPU nodes
- Node labels for GPU type are set by the NVIDIA GPU Feature Discovery DaemonSet (`nvidia.com/gpu.product`, `nvidia.com/gpu.memory`, `nvidia.com/cuda.driver.major`)
- MIG support requires NVIDIA driver 470+ and the NVIDIA MIG Manager
- Topology scheduling uses the `topology.kubernetes.io/zone` and `nvidia.com/gpu.topology` labels

### Example Config

```yaml
# values.yaml
gpu:
  enabled: true
  count: 1
  type: a100  # Convenience alias for nvidia.com/gpu.product: NVIDIA-A100-*
  runtimeClassName: nvidia
  memory: "40Gi"
  topologyAware: false
  validation:
    enabled: true
  sharing:
    strategy: none  # none | mig | time-slicing

nodeSelector: {}
  # nvidia.com/gpu.product: NVIDIA-A100-SXM4-40GB

tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule

affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: accelerator
              operator: In
              values:
                - nvidia-gpu
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - openeye
          topologyKey: kubernetes.io/hostname
```

---

## 149. Load Balancing & Traffic Routing

**As an enterprise ops team member, I can route inference traffic across multiple OpenEye replicas via intelligent load balancing that considers GPU memory and queue depth.**

### Acceptance Criteria

- [ ] The Helm chart (story 146) creates a `Service` of type `ClusterIP` by default, with configurable `service.type` (`ClusterIP`, `NodePort`, `LoadBalancer`)
- [ ] Default load balancing via `kube-proxy` uses round-robin across healthy pods based on readiness probes
- [ ] Service mesh integration: `loadBalancing.serviceMesh: istio` injects an Istio `VirtualService` and `DestinationRule` with configurable routing policies
- [ ] Istio `DestinationRule` supports `loadBalancer.simple` values: `ROUND_ROBIN` (default), `LEAST_REQUEST`, `RANDOM`, `PASSTHROUGH`
- [ ] Weighted routing: `loadBalancing.weighted` accepts a map of deployment versions to traffic percentages for canary deployments — e.g., `v1: 90, v2: 10`
- [ ] Custom load balancing via Envoy/Istio: `loadBalancing.custom.metricName: openeye_inference_queue_depth` routes requests to the pod with the lowest queue depth using the `LEAST_REQUEST` policy with Envoy's `slow_start` configuration
- [ ] gRPC load balancing: when `grpc.enabled: true`, the Service uses `appProtocol: grpc` and headless service mode (`clusterIP: None`) for client-side gRPC load balancing
- [ ] Health-check routing: pods failing readiness checks are removed from the Service endpoint list within `readinessProbe.periodSeconds` (default: 10s) — no traffic is sent to unhealthy pods
- [ ] Session affinity: `service.sessionAffinity: ClientIP` with configurable `sessionAffinityConfig.clientIP.timeoutSeconds` (default: 10800) for stateful streaming connections
- [ ] External load balancer annotations: chart supports cloud-specific LB annotations — `service.annotations` for AWS NLB (`service.beta.kubernetes.io/aws-load-balancer-type: nlb`), GCP internal LB, Azure Standard LB
- [ ] Rate limiting at the ingress level: `ingress.rateLimit.requestsPerSecond: 100` and `ingress.rateLimit.burstSize: 200` are configurable per ingress class (nginx annotation `nginx.ingress.kubernetes.io/limit-rps`)
- [ ] Traffic splitting for A/B testing: `loadBalancing.headerRouting` routes requests with header `X-Model-Version: v2` to a specific deployment subset

### Edge Cases

- [ ] All replicas unhealthy: if readiness probes fail on all pods simultaneously (e.g., model corruption), the Service has zero endpoints. Incoming requests get `503 Service Unavailable` — ingress returns a configurable custom error page (`ingress.errorPages.503`)
- [ ] Uneven GPU memory across replicas: if some pods have loaded additional models (warm cache) while others are cold, `LEAST_REQUEST` routing helps but is not GPU-memory-aware by default. Document that custom Envoy filters or service mesh policies are needed for true GPU-memory-aware routing
- [ ] Long-running inference requests (>30s) with `LEAST_REQUEST`: the LB may not account for in-flight requests that are still processing — recommend pairing with queue-depth metrics from the `/metrics` endpoint
- [ ] gRPC sticky connections: gRPC uses HTTP/2 multiplexing, so a single connection may pin all requests to one pod. Headless service + client-side load balancing (e.g., via `grpc.lookup_service`) distributes requests across pods
- [ ] WebSocket streaming sessions: `session affinity` ensures a streaming client stays connected to the same pod. If that pod is terminated during scale-down, the client must reconnect — the server sends a `GOAWAY` frame before shutdown
- [ ] Cloud LB health check path mismatch: AWS NLB uses TCP health checks by default, not HTTP. Setting `service.annotations["service.beta.kubernetes.io/aws-load-balancer-healthcheck-path"]: /health` enables HTTP health checks
- [ ] Canary deployment with weighted routing: if the canary (v2) pod crashes, Istio routes 100% of traffic to v1 automatically via outlier detection (`outlierDetection.consecutiveErrors: 3`)
- [ ] Mixed protocol (HTTP + gRPC) on the same service: Kubernetes 1.24+ supports `appProtocol` per port. Chart creates separate ports (`http: 8000`, `grpc: 50051`, `metrics: 9090`) with appropriate protocol labels
- [ ] Large request payloads (high-resolution images): ingress `proxy-body-size` (nginx) or `max_request_body_size` (Istio) must accommodate large uploads — chart defaults to `100m` (100MB) with a note to adjust for high-res use cases
- [ ] DNS caching: clients that cache DNS may continue sending requests to a terminated pod's IP. Service uses short `publishNotReadyAddresses: false` (default) and the app should use short DNS TTLs
- [ ] mTLS between load balancer and inference workers: in a service mesh deployment (Istio), mTLS is automatic. Without a mesh, inter-pod traffic is unencrypted — inference payloads (base64 images) and detection results traverse the cluster network in plaintext. Chart documents the recommendation to enable Istio strict mTLS or configure pod-level TLS via `server.tls.enabled: true` for environments without a service mesh
- [ ] API key header forwarding: when `--api-key` authentication is enabled on inference workers (story 86 from integration stories), the load balancer/ingress must forward the `Authorization: Bearer` header transparently. NGINX ingress strips non-standard headers by default — chart includes annotation `nginx.ingress.kubernetes.io/proxy-pass-headers: "Authorization,X-API-Key"` when auth is enabled
- [ ] Distributed tracing propagation: when a request flows through ingress → Service → pod, W3C Trace Context headers (`traceparent`, `tracestate`) must be propagated. The OpenEye server should inject `X-Request-ID` and forward incoming trace headers to downstream calls (webhooks, queue submissions). Without this, distributed traces break at the inference boundary — chart documents the requirement to set `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable
- [ ] Thundering herd on worker recovery: when a failed worker recovers and passes its readiness check, the load balancer immediately routes traffic to it. If the worker is still warming up (GPU caches cold, model not yet JIT-compiled), a burst of requests may overwhelm it. Envoy's `slow_start` configuration (documented in story 149 technical notes) ramps traffic over 30 seconds — chart should enable `slow_start` by default when using Istio/Envoy
- [ ] Retry idempotency: the load balancer retries failed requests (connection reset, 503) on other workers. Without a client-supplied `X-Idempotency-Key` header, the load balancer cannot distinguish a legitimate retry from a duplicate. For non-idempotent operations (e.g., batch job submission via story 154), retry must be disabled — chart configures retry only for GET and unary POST `/predict` endpoints, not for state-mutating endpoints
- [ ] Service mesh sidecar injection failure: if `istio-init` fails, pod starts without sidecar — traffic bypasses all routing rules silently
- [ ] gRPC long-lived connections surviving pod removal: existing HTTP/2 connections continue routing to terminating pod — `GOAWAY` frames may be lost by proxy
- [ ] Ingress controller crash: if NGINX/Traefik pod crashes, all traffic drops — actual SPOF in many K8s deployments. No edge case covers ingress controller HA
- [ ] Rate limiting causing retry amplification: rejected requests with immediate client retries create feedback loop amplifying load

### Technical Notes

- Default Service port: `8000` (HTTP), `50051` (gRPC), `9090` (metrics)
- Istio `DestinationRule` is templated only when `loadBalancing.serviceMesh: istio` is set — no Istio dependency by default
- gRPC load balancing best practice: use headless service + client-side balancing or Envoy/Istio for proxy-based balancing
- Envoy `slow_start` ramps traffic to new pods over a configurable window (default: 30s) to allow model warm-up
- Cloud LB annotations are documented per provider in the chart README

---

## 150. High Availability (Multi-Replica)

**As an enterprise ops team member, I can run OpenEye in HA mode with no single point of failure for the API server, model serving, and management plane.**

### Acceptance Criteria

- [ ] Setting `replicaCount: 3` in the Helm chart deploys 3 inference pods across different nodes (via pod anti-affinity, story 148)
- [ ] A `PodDisruptionBudget` (PDB) is created with `minAvailable: 1` (default, configurable via `pdb.minAvailable` or `pdb.maxUnavailable`) to prevent voluntary disruptions from killing all replicas
- [ ] Readiness probe: `httpGet /health` on port `8000` with `initialDelaySeconds: 30`, `periodSeconds: 10`, `failureThreshold: 3` — pod is removed from Service endpoints after 3 consecutive failures
- [ ] Liveness probe: `httpGet /health` on port `8000` with `initialDelaySeconds: 60`, `periodSeconds: 30`, `failureThreshold: 5` — pod is restarted after 5 consecutive failures to recover from deadlocks or OOM
- [ ] Startup probe: `httpGet /health` with `failureThreshold: 30`, `periodSeconds: 10` — allows up to 5 minutes for model loading on first start before the liveness probe kicks in
- [ ] Topology spread constraints: `topologySpreadConstraints` distributes pods evenly across availability zones (`topologyKey: topology.kubernetes.io/zone`, `maxSkew: 1`, `whenUnsatisfiable: ScheduleAnyway`)
- [ ] Shared model cache: all replicas mount the same PVC (story 152) for model weights via `ReadOnlyMany` access mode — models are downloaded once and shared, reducing cold start time
- [ ] Leader election for singleton tasks (e.g., model update checks, audit log rotation): uses Kubernetes Lease API with a `leader-election` sidecar or built-in support in the OpenEye server
- [ ] Management plane HA: if a management API or dashboard is deployed, it runs with `replicaCount: 2` and its own PDB
- [ ] Health endpoint returns `{"status": "ok", "model": "yolov8", "gpu": "available", "uptime": 3600, "version": "1.0.0"}` — load balancer uses this to route only to healthy pods
- [ ] Graceful shutdown: `preStop` lifecycle hook calls `/shutdown` which stops accepting new requests, drains in-flight requests (up to `terminationGracePeriodSeconds: 60`), and then exits cleanly
- [ ] No single point of failure: the architecture diagram in docs shows inference pods, the K8s Service, and the persistent volume as independent components — any single component failure does not bring down the system
- [ ] Pod priority class: `priorityClassName: system-cluster-critical` (or custom) ensures inference pods are not evicted before lower-priority workloads during node pressure

### Edge Cases

- [ ] All replicas in one AZ fail (AZ outage): topology spread ensures at least one replica is in another AZ. If `whenUnsatisfiable: DoNotSchedule` is set and no capacity exists in the other AZ, pods remain `Pending` — `ScheduleAnyway` (default) is preferred for HA
- [ ] PDB blocks node drain: if draining a node would violate the PDB (only 1 replica left), `kubectl drain` hangs until the PDB is satisfied or `--delete-emptydir-data --ignore-daemonsets --force` is used — chart documents this interaction
- [ ] Model loading takes >5 minutes (very large model): increase `startupProbe.failureThreshold` in `values.yaml`. If the model never loads (corrupt weights), pod enters `CrashLoopBackOff` with a log message about model load failure
- [ ] Readiness probe flapping: if the `/health` endpoint intermittently fails (e.g., GPU thermal throttling, story 90), the pod is repeatedly added/removed from the Service — `failureThreshold: 3` with `periodSeconds: 10` provides a 30-second grace period
- [ ] Leader election during pod restart: if the leader pod is killed, a new leader is elected within `leaseDurationSeconds` (default: 15s). During the election gap, singleton tasks are paused — no duplicate execution
- [ ] Zombie pods: if a pod process hangs but the liveness probe passes (e.g., inference thread deadlocked but health handler on a separate thread still responds), the `/health` endpoint should check inference thread health — return `503` if the inference loop is unresponsive for >30s
- [ ] Shared PVC with `ReadOnlyMany`: if the underlying storage class does not support `ReadOnlyMany` (e.g., some AWS EBS volumes), chart falls back to `ReadWriteOnce` with a single model-loader pod that copies to an `emptyDir` — documented as a workaround
- [ ] Resource exhaustion on a node: if a pod is evicted due to node memory pressure, the pod is rescheduled on another node. Pod priority class ensures inference pods are evicted last
- [ ] Cluster autoscaler interaction: when HPA (story 147) requests new replicas but no nodes have capacity, the cluster autoscaler provisions new nodes. PDB prevents existing pods from being evicted during this scale-up
- [ ] Split-brain leader election: if network partition causes two pods to believe they are leader, the Lease API's `renewTime` and `leaseDurationSeconds` resolve the conflict — only the pod that successfully updates the Lease is the true leader
- [ ] Singleton pattern in multi-process deployments: the `EventBus` and `TelemetryProvider` use singleton patterns that are per-process. With `uvicorn --workers N` (or multiple pods), each process/pod has its own singleton instance. Events published in one process are invisible to subscribers in another — this breaks gRPC event streaming (story 87 from integration stories) if the inference and gRPC handlers run in different processes. Solution: external event bus (Redis Pub/Sub) is required for multi-replica deployments. Chart documents this requirement when `replicaCount > 1`
- [ ] Concurrent cold starts on shared GPU nodes: when multiple replicas start simultaneously on the same GPU node (e.g., after a node restart or scale-up event), all pods attempt to load models into GPU memory concurrently. With MIG/time-slicing (story 148), each pod has limited VRAM — concurrent `torch.load()` calls may cause OOM before any pod finishes loading. Init containers should use a Kubernetes `Job` with `parallelism: 1` for model loading on shared GPU nodes
- [ ] Health check vs model loading race condition: during startup, the readiness probe may query `/health` while the model is actively loading. If the health endpoint returns `model_loaded: false`, the pod is not added to the Service — expected behavior. But if the health endpoint blocks while waiting for model loading (shared event loop), the liveness probe may also fail, causing a premature restart. The health endpoint must be non-blocking and run independently of the model loading thread
- [ ] Thundering herd on failover: when 1 of 3 replicas dies, sudden load increase on survivors may cascade — all pods become unhealthy simultaneously
- [ ] Leader election lease renewal failure due to API server load: during cluster-wide events, API server latency prevents lease renewal — leadership revoked, re-election also fails
- [ ] Shared PVC corruption from concurrent read/write: init container writing new model while existing pods read — `ReadOnlyMany` prevents multi-writer but not reader-during-write
- [ ] Priority class eviction cascade: evicting lower-priority pods (DCGM exporter, Prometheus adapter, FluentBit) breaks monitoring — system runs blind

### Technical Notes

- PDB manifest uses `policy/v1` (stable since K8s 1.21)
- Probes target the FastAPI `/health` endpoint which checks model loaded status, GPU availability, and inference thread health
- `preStop` hook uses `exec: ["sh", "-c", "curl -s -X POST http://localhost:8000/shutdown && sleep 5"]` to trigger graceful shutdown
- Leader election uses the `coordination.k8s.io/v1` Lease API
- Topology spread constraints require K8s 1.19+ (stable)

---

## 151. Rolling Updates & Zero-Downtime Deploys

**As an enterprise ops team member, I can deploy model and software updates with zero downtime using rolling update strategies and readiness probes.**

### Acceptance Criteria

- [ ] The Helm chart Deployment uses `strategy.type: RollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0` by default — ensures at least the current replica count is always available during updates
- [ ] `maxUnavailable: 0` combined with the readiness probe (story 150) ensures new pods are fully ready (model loaded, GPU allocated, health check passing) before old pods are terminated
- [ ] `helm upgrade openeye ... --set image.tag=v2.0` triggers a rolling update that creates new pods with the updated image, waits for readiness, then terminates old pods one at a time
- [ ] Model-only updates: changing `model.name` or `model.version` in `values.yaml` triggers a rollout via a ConfigMap hash annotation on the Deployment (`checksum/config`)
- [ ] Rollback: `helm rollback openeye <revision>` reverts to the previous deployment — the rollout follows the same rolling update strategy
- [ ] Canary deployments: a separate `openeye-canary` Deployment can be created via `canary.enabled: true` with `canary.replicaCount: 1` and traffic routing via Istio VirtualService (story 149)
- [ ] Blue-green deployment: `deploymentStrategy: blue-green` creates a second Deployment with the new version and switches the Service selector atomically — configurable via `values.yaml`
- [ ] `kubectl rollout status deployment/openeye` shows the progress of the rolling update in real-time
- [ ] Deployment annotations include `kubernetes.io/change-cause` with the Helm chart version and model version for audit trail
- [ ] Pre-upgrade hook: a Helm `pre-upgrade` Job optionally runs model validation (downloads and loads the new model in a temporary pod) before the rolling update begins — enabled via `preUpgrade.validation.enabled: true`
- [ ] Post-upgrade hook: a Helm `post-upgrade` Job runs a smoke test (sends a test image to the `/predict` endpoint) and reports success/failure — enabled via `postUpgrade.smokeTest.enabled: true`
- [ ] Revision history: `revisionHistoryLimit: 5` (configurable) retains the last 5 ReplicaSets for rollback capability
- [ ] Update timeout: `progressDeadlineSeconds: 600` (default, configurable) — if the rollout doesn't complete within 10 minutes, it is marked as failed

### Edge Cases

- [ ] New pod never becomes ready (bad image, model load failure): the rolling update stalls because `maxUnavailable: 0` prevents terminating old pods. After `progressDeadlineSeconds`, the Deployment condition `Progressing` is set to `False` — old pods continue serving traffic. Operator can `helm rollback` to recover
- [ ] Model download takes longer than `progressDeadlineSeconds`: increase the deadline or use a pre-upgrade hook to pre-download the model. Chart documents recommended `progressDeadlineSeconds` values for different model sizes
- [ ] Resource quota prevents creating the surge pod: if `maxSurge: 1` requires a pod beyond the namespace quota, the rolling update stalls. Chart documents that the namespace needs headroom for at least 1 extra pod during rollouts
- [ ] ConfigMap change triggers unnecessary rollout: the `checksum/config` annotation ensures rollouts only occur when config actually changes — not on every `helm upgrade` with identical values
- [ ] Canary with failing health check: if the canary pod crashes, Istio outlier detection (story 149) ejects it from the load balancer pool. Traffic falls back to 100% stable without manual intervention
- [ ] Blue-green switch during in-flight requests: the Service selector change is atomic, but in-flight requests to old pods continue until `terminationGracePeriodSeconds` expires — no dropped connections
- [ ] Rollback to a version with a different model: the rolled-back pods need to re-download the previous model version from the PVC or registry. If the old model is no longer cached, cold start time applies
- [ ] Multiple rapid `helm upgrade` commands: each upgrade triggers a new rollout. K8s cancels the previous in-progress rollout and starts the new one — chart documents this behavior and recommends waiting for `rollout status` completion between upgrades
- [ ] Webhook configurations change during rollout: old pods use the old webhook config, new pods use the new config. During the transition, duplicate webhooks may fire — deduplicate via `X-OpenEye-Idempotency-Key` header in webhook payloads
- [ ] GPU re-allocation during rolling update: the new pod requests a GPU before the old pod releases its GPU. If GPU node has only 1 GPU, `maxSurge: 1` fails to schedule the new pod. Solution: set `maxUnavailable: 1` instead of `maxSurge: 1` on single-GPU nodes, accepting brief downtime
- [ ] Proto schema backward compatibility during rollout: if the new version adds fields to gRPC `PerceptionFrame` or `DetectionFrame` messages, old clients connected to new pods see unknown fields (safely ignored by protobuf). However, if fields are removed or renumbered, old clients break. Rolling updates with gRPC schema changes require new fields to be `optional` with `reserved` ranges for removed fields — chart documents the proto versioning policy
- [ ] Mixed model versions producing inconsistent results: during a rolling update that changes the model version (`model.version: v2`), some pods serve v1 and others v2. Clients receiving responses from different pods see inconsistent detection results (different labels, confidence scores, or object counts). The response should include `X-Model-Version` header so clients can detect version skew. For strict consistency, `deploymentStrategy: blue-green` (with atomic Service selector switch) is recommended over rolling updates for model version changes
- [ ] Webhook deduplication during rollout: old pods use the old webhook config, new pods use the new config. If webhook URLs or payload schemas change, duplicate or inconsistent webhooks may fire during the transition period. Webhook payloads include an `X-OpenEye-Idempotency-Key` header (using the detection frame's unique ID) so downstream consumers can deduplicate
- [ ] Node drain during rolling update: cluster upgrade cordons nodes while update in progress — PDB interacts with both rolling update and drain, creating deadlock
- [ ] Init container model download holds GPU hostage: if model registry unreachable, stalled init container occupies GPU resource — old pod can't terminate (maxUnavailable: 0)
- [ ] Blue-green deployment doubles GPU cost: complete second Deployment needs full GPU allocation — cluster may lack capacity for both simultaneously

### Technical Notes

- Rolling update is the Kubernetes default strategy — chart makes `maxSurge` and `maxUnavailable` configurable
- ConfigMap hash annotation: `checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}` in the Deployment pod template
- Blue-green uses two Deployments (`openeye-blue`, `openeye-green`) with a Service selector toggling between them
- Canary deployment uses a separate Deployment with matching labels but different version labels for Istio traffic splitting
- `kubernetes.io/change-cause` is set via `helm upgrade --description` or a chart annotation

### Example Usage

```bash
# Rolling update with new image
helm upgrade openeye oci://ghcr.io/openeye-ai/charts/openeye \
  --set image.tag=v2.0.0

# Check rollout status
kubectl rollout status deployment/openeye -n openeye

# Rollback to previous revision
helm rollback openeye 1

# Canary with 10% traffic
helm upgrade openeye oci://ghcr.io/openeye-ai/charts/openeye \
  --set canary.enabled=true \
  --set canary.replicaCount=1 \
  --set canary.trafficWeight=10 \
  --set canary.image.tag=v2.0.0
```

---

## 152. Persistent Volume Management

**As an enterprise ops team member, I can configure K8s deployments to properly manage persistent storage for models, configs, audit logs, and detection data.**

### Acceptance Criteria

- [ ] The Helm chart includes PVC templates for: `models` (model weights cache), `data` (detection output, frame snapshots), `logs` (audit logs, inference logs), and `config` (server configuration)
- [ ] Each PVC is independently toggleable: `persistence.models.enabled: true`, `persistence.data.enabled: true`, etc.
- [ ] Default storage class is used unless `persistence.<name>.storageClassName` is specified — supports `gp3` (AWS), `pd-ssd` (GCP), `managed-premium` (Azure)
- [ ] Default sizes: `persistence.models.size: 50Gi`, `persistence.data.size: 100Gi`, `persistence.logs.size: 10Gi` — all configurable
- [ ] Access modes: `persistence.models.accessMode: ReadOnlyMany` for shared model cache across replicas; `persistence.data.accessMode: ReadWriteOnce` for per-pod detection data
- [ ] Models PVC is pre-populated by an init container that runs `openeye pull <model>` on first deploy — subsequent pods mount the existing PVC without re-downloading
- [ ] `existingClaim` support: `persistence.models.existingClaim: my-models-pvc` allows using a pre-provisioned PVC instead of creating a new one
- [ ] Volume mount paths: models at `/var/openeye/models`, data at `/var/openeye/data`, logs at `/var/openeye/logs`, config at `/etc/openeye/`
- [ ] `emptyDir` fallback: if `persistence.<name>.enabled: false`, an `emptyDir` volume is used — data is ephemeral and lost on pod restart (appropriate for dev/test)
- [ ] Retention policy: `persistence.models.reclaimPolicy: Retain` (default) preserves the PV after the PVC is deleted — `Delete` can be set for ephemeral environments
- [ ] Volume snapshots: `persistence.snapshots.enabled: true` creates `VolumeSnapshot` objects on a configurable schedule (e.g., daily) for backup
- [ ] Storage capacity monitoring: the OpenEye server checks disk usage on mounted volumes and exposes `openeye_volume_usage_bytes` and `openeye_volume_capacity_bytes` Prometheus metrics
- [ ] Log rotation: audit logs in the `logs` PVC are rotated daily, compressed, and retained for `persistence.logs.retentionDays: 30` (configurable)

### Edge Cases

- [ ] PVC binding failure: if the requested `storageClassName` does not exist in the cluster, PVCs remain `Pending` with a clear event — `kubectl describe pvc openeye-models` shows the error. Chart documents required storage classes per cloud provider
- [ ] `ReadOnlyMany` not supported: some storage classes (e.g., AWS EBS `gp3`) only support `ReadWriteOnce`. Chart detects this via a values comment and suggests alternatives: EFS (AWS), Filestore (GCP), Azure Files
- [ ] PVC resize: if the models PVC fills up (new models pulled), `persistence.models.size` can be increased via `helm upgrade` — requires `allowVolumeExpansion: true` on the storage class. Chart documents this prerequisite
- [ ] Volume mount permissions: if the container runs as non-root (`securityContext.runAsUser: 1000`), the PVC mount may have root-owned directories. Chart includes an init container that runs `chown -R 1000:1000 /var/openeye/` with `runAsUser: 0`
- [ ] Model download interrupted: if the init container is killed mid-download (pod preemption, node failure), the PVC may contain a partial model file. The init container verifies model checksums on startup and re-downloads corrupted files
- [ ] Multiple pods writing to the same `ReadWriteOnce` PVC: K8s prevents this — second pod stays `Pending` with a `Multi-Attach` error. Chart documentation clarifies which PVCs need `ReadWriteMany` for multi-replica setups
- [ ] Volume snapshot quota: if the cluster has a `VolumeSnapshot` quota and the limit is reached, new snapshots fail — the chart logs a warning and continues operation without snapshots
- [ ] Disk pressure on node: if the node's ephemeral storage runs low, K8s may evict pods. PVC-backed volumes are not affected by ephemeral storage pressure, but `emptyDir` volumes are — chart documents this distinction
- [ ] Cloud provider PV limits: each cloud provider has per-node volume attachment limits (e.g., AWS EBS: 28 volumes per EC2 instance). If an OpenEye pod with 4 PVCs is co-located with other volume-heavy pods, scheduling may fail — chart documents volume limits
- [ ] Data PVC with detection frames accumulating: if `persistence.data.enabled: true` and detection frames are saved continuously, disk fills over time. Chart includes a CronJob template (`persistence.data.cleanup.enabled: true`) that deletes frames older than `persistence.data.cleanup.retentionDays: 7`
- [ ] StatefulSet vs Deployment: for per-pod persistent storage (e.g., each replica needs its own data volume), chart supports `workloadType: StatefulSet` which uses `volumeClaimTemplates` instead of shared PVCs
- [ ] Concurrent model pull file locking: if two pods using a shared `ReadWriteMany` PVC simultaneously run `openeye pull yolov8`, both write to the same model directory, potentially interleaving file writes and producing corrupted weights. The init container uses an advisory file lock (`fcntl.flock()`) on a `.lock` file in the model directory — the second pod waits until the first completes. Lock timeout is 5 minutes to prevent deadlocks from crashed pods
- [ ] Model weight modification while loaded: if an operator triggers `openeye pull yolov8` (re-downloading weights to the PVC) while a running pod has the model loaded in GPU memory, the disk version and memory version diverge silently. The next pod restart loads the new weights, potentially causing subtle behavior changes. The server watches model files via `inotify` and logs a warning when on-disk weights change for a loaded model — does not auto-reload to avoid disrupting active inference
- [ ] Air-gapped init container behavior: when `offlineMode: true` (story 146) but the init container command still references `openeye pull`, the init container attempts DNS resolution for `huggingface.co` with a 2-second timeout. In fully air-gapped networks where DNS itself is unavailable, this timeout applies to every retry, causing the init container to take `timeout × retries` seconds before failing. The air-gapped init container should skip the pull entirely and only verify that model files exist on the PVC with checksum validation
- [ ] CSI driver crash on node: PVCs on that node cannot mount/unmount — new pods hang in `ContainerCreating` indefinitely
- [ ] Cross-AZ PV access failure: EBS volume is AZ-local — pod rescheduled to different AZ cannot attach the PVC
- [ ] PV reclaim policy `Delete` with important data: accidental `helm uninstall` permanently destroys all model weights and detection data — no safeguard
- [ ] Init container chown on large PVC extremely slow: `chown -R` on 100Gi PVC with millions of files takes 30+ minutes — exceeds startup timeout, CrashLoopBackOff

### Technical Notes

- PVC templates are conditionally rendered based on `persistence.<name>.enabled` flags
- Init container for model download uses the same `openeye` image with `command: ["openeye", "pull", "<model>"]`
- `emptyDir` volumes use `sizeLimit` to prevent unbounded disk usage
- Volume snapshot schedule is implemented via a CronJob that creates `VolumeSnapshot` objects using the `snapshot.storage.k8s.io/v1` API
- Storage metrics are collected by the OpenEye server via `shutil.disk_usage()` on each mount point

### Example Config

```yaml
# values.yaml
persistence:
  models:
    enabled: true
    size: 50Gi
    accessMode: ReadOnlyMany
    storageClassName: efs-sc  # AWS EFS for ReadOnlyMany
    mountPath: /var/openeye/models
  data:
    enabled: true
    size: 100Gi
    accessMode: ReadWriteOnce
    storageClassName: gp3
    mountPath: /var/openeye/data
    cleanup:
      enabled: true
      retentionDays: 7
      schedule: "0 3 * * *"  # 3 AM daily
  logs:
    enabled: true
    size: 10Gi
    accessMode: ReadWriteOnce
    storageClassName: gp3
    mountPath: /var/openeye/logs
    retentionDays: 30
  snapshots:
    enabled: true
    schedule: "0 2 * * *"  # 2 AM daily
    snapshotClassName: csi-snapclass
```

---

## 153. Multi-Region Deployment

**As an enterprise ops team member, I can deploy OpenEye across multiple cloud regions with geo-routing and data sovereignty compliance.**

### Acceptance Criteria

- [ ] The Helm chart supports deployment in multiple regions by installing the same chart in different K8s clusters with region-specific `values.yaml` overrides
- [ ] A multi-region deployment guide documents the architecture: independent inference clusters per region with a global traffic management layer
- [ ] Global load balancing via DNS: AWS Route 53 (latency-based routing), GCP Cloud DNS (geolocation routing), or Azure Traffic Manager — configuration documented per provider
- [ ] Geo-routing rules: `multiRegion.routing: latency` (default), `geolocation`, or `failover` — determines how global traffic is distributed
- [ ] Data sovereignty: `multiRegion.dataResidency: eu` ensures detection data, audit logs, and frame snapshots are stored only in the configured region — no cross-region data replication unless explicitly enabled
- [ ] Model distribution: models are replicated to each region's container registry or object storage bucket — `multiRegion.modelRegistry` configures per-region pull sources (e.g., `us: ecr.us-east-1`, `eu: ecr.eu-west-1`)
- [ ] Cross-region model sync: `multiRegion.modelSync.enabled: true` automatically replicates model updates from a primary region to secondary regions using ECR replication rules, GCR multi-region, or Artifact Registry
- [ ] Configuration sync: a GitOps approach (ArgoCD, Flux) deploys consistent configuration across regions from a single Git repository — documented with ArgoCD `ApplicationSet` examples
- [ ] Per-region scaling: each region has independent HPA (story 147) settings to handle regional traffic patterns (e.g., US scales up during US business hours, EU during EU hours)
- [ ] Health-check failover: if all pods in a region fail health checks, the global LB routes traffic to the nearest healthy region within `multiRegion.failover.healthCheckInterval` (default: 30s)
- [ ] Cross-region latency monitoring: each region's OpenEye instance reports its region label in Prometheus metrics (`openeye_region="us-east-1"`) for multi-region dashboards
- [ ] Centralized logging: logs from all regions are aggregated to a central logging solution (e.g., Datadog, Splunk, CloudWatch cross-region) — chart includes optional FluentBit sidecar for log forwarding

### Edge Cases

- [ ] Complete region failure (AZ + region outage): DNS failover routes traffic to the next nearest region. DNS TTL must be low enough (e.g., 60s) for timely failover — chart documents recommended TTL values per provider
- [ ] Data sovereignty violation during failover: if `dataResidency: eu` is set and the EU region fails, traffic cannot failover to a US region. Chart supports `multiRegion.failover.respectDataResidency: true` (default) which restricts failover to regions within the same data residency scope (e.g., EU-to-EU only)
- [ ] Model version drift across regions: if model sync fails for one region, that region may serve an older model version. The `/health` endpoint includes `model_version` and the global dashboard flags version mismatches. `multiRegion.modelSync.requireConsistency: true` blocks traffic to regions with stale models
- [ ] DNS propagation delay: after a failover event, DNS changes may take up to 60s to propagate. During this window, some clients may still route to the failed region — document this limitation and recommend using lower TTLs in production
- [ ] Cross-region data replication conflict: if `multiRegion.dataReplication.enabled: true` and two regions process the same camera feed (edge case in overlapping geo-fences), last-write-wins with timestamp ordering resolves conflicts
- [ ] Cost implications: multi-region deployments multiply GPU costs. Chart includes cost estimation annotations (`openeye.io/estimated-monthly-cost`) based on replica count and GPU type per region
- [ ] Regulatory compliance logging: for GDPR compliance, all data access across regions is logged in an immutable audit trail — the audit log includes the source region, destination region, and data subject identifiers
- [ ] Region addition: adding a new region (e.g., `ap-southeast-1`) requires deploying the chart to a new cluster, configuring DNS, and syncing models — chart documents the step-by-step process
- [ ] Asymmetric capacity: if the US region has 10 GPU nodes and EU has 2, failover from US to EU would overwhelm EU capacity. `multiRegion.failover.maxTrafficPercent: 50` limits how much traffic a failover region accepts — excess traffic returns `503` with a `Retry-After` header
- [ ] Clock skew across regions: distributed timestamps use UTC and NTP-synchronized clocks. If clock skew exceeds 5 seconds between regions, a `CLOCK_SKEW_WARNING` metric is emitted
- [ ] GDPR data transfer violation via overflow routing: the overflow feature (`multiRegion.failover.maxTrafficPercent`) forwards requests to the next-nearest region when capacity is exhausted. If the overflow region is in a different jurisdiction (e.g., EU traffic overflowing to US), this violates GDPR Article 44+ data transfer restrictions. When `dataResidency` is set, overflow routing is restricted to regions within the same residency scope — cross-residency overflow is blocked with a `503` and `X-Data-Residency-Blocked: true` header
- [ ] Telemetry data residency: the `TelemetryProvider` stores frame telemetry with timestamps and detection metadata. If telemetry from EU users is aggregated at a central monitoring endpoint (e.g., Datadog US, Prometheus federation to US), this constitutes a GDPR data transfer. Each region's monitoring stack should be self-contained, with cross-region dashboards using aggregated/anonymized metrics only — no raw detection data or PII in cross-region telemetry
- [ ] Control plane authentication: inference nodes register with the control plane/management API via heartbeat (`--control-plane` URL). Without mTLS or token-based authentication, a rogue node can register as a legitimate region and redirect traffic or receive model deployments. Control plane endpoints require mutual TLS certificates or service account tokens — chart includes a `controlPlane.authToken` secret reference
- [ ] DNS spoofing in GeoDNS routing: if an attacker poisons DNS responses, client traffic is redirected to a malicious inference endpoint. Client SDKs should validate TLS certificates against expected hostnames. DNSSEC should be enabled on the GeoDNS provider — chart documents DNSSEC configuration per cloud provider
- [ ] Cross-region database topology: the control plane's PostgreSQL database (if centralized) becomes a cross-region latency bottleneck and a single point of failure for management operations. Options: (1) single-region DB with read replicas per region, (2) per-region independent DBs with eventual consistency via event sourcing, (3) globally distributed DB (CockroachDB, Spanner). Chart documents trade-offs and recommends option 1 for most deployments
- [ ] Region addition operational procedure: adding a new region requires deploying the Helm chart to a new cluster, configuring DNS routing, syncing models, and validating health. If model sync fails silently, the new region serves requests without a loaded model. The `openeye region add` command (or ArgoCD ApplicationSet) should include a post-deployment validation step that sends a test image to `/predict` before enabling DNS routing to the new region
- [ ] Global LB itself as SPOF: Route 53/Cloud DNS partial outage could cause false failovers — no edge case for LB service-level failures
- [ ] GitOps drift between regions: if one region's ArgoCD is down, that region runs stale config — no cross-region configuration drift detection
- [ ] Geo-routing misclassification: users behind VPNs/corporate proxies get routed to wrong region — potential data sovereignty violation

### Technical Notes

- Multi-region architecture is "shared nothing" per region — each region has its own K8s cluster, PVCs, and model cache
- Global LB is outside the Helm chart scope — documented as cloud-specific setup
- ArgoCD `ApplicationSet` with `generators.git` deploys the same chart to multiple clusters with per-region values from a directory structure: `regions/us-east-1/values.yaml`, `regions/eu-west-1/values.yaml`
- Data sovereignty is enforced at the storage layer (PVC storage class, object storage bucket region) and the network layer (VPC, firewall rules)

---

## 154. Queue-Based Batch Processing

**As an enterprise ops team member, I can submit high-volume inference workloads as batch jobs via a message queue (Redis, RabbitMQ, SQS).**

### Acceptance Criteria

- [ ] `openeye serve --queue redis --redis-url redis://redis:6379 --queue-name openeye:inference` starts a queue consumer that processes inference jobs from a Redis list
- [ ] `openeye serve --queue rabbitmq --amqp-url amqp://rabbitmq:5672 --queue-name openeye-inference` consumes from a RabbitMQ queue
- [ ] `openeye serve --queue sqs --sqs-url https://sqs.us-east-1.amazonaws.com/123456/openeye-inference` consumes from an AWS SQS queue
- [ ] Job message format: `{"job_id": "uuid", "image_url": "s3://bucket/image.jpg", "model": "yolov8", "callback_url": "https://api.corp.com/results", "priority": 1}`
- [ ] Supported image sources in `image_url`: S3 (`s3://`), GCS (`gs://`), Azure Blob (`az://`), HTTP/HTTPS URLs, and base64-encoded inline images
- [ ] Inference results are delivered via: callback URL (HTTP POST), result queue (`--result-queue openeye:results`), or both
- [ ] Result message format: `{"job_id": "uuid", "status": "completed", "result": <PredictionResult>, "inference_ms": 45, "processed_at": "2026-03-15T..."}`
- [ ] Priority queues: jobs with `priority: 0` (highest) are processed before `priority: 9` (lowest) — Redis uses sorted sets, RabbitMQ uses priority queues, SQS uses separate high/low priority queues
- [ ] Concurrency: `--queue-workers 4` processes 4 jobs in parallel (one per GPU if multi-GPU, or batched on a single GPU)
- [ ] Job timeout: `--job-timeout 60` (default, seconds) — jobs taking longer than this are marked as failed and the message is returned to the queue (nacked)
- [ ] Dead letter queue: failed jobs (after `--max-retries 3`) are moved to a DLQ (`--dlq openeye:dlq` for Redis, automatic for SQS/RabbitMQ) with the error message attached
- [ ] Batch submission: `openeye batch submit --queue redis --redis-url redis://... --images images/ --model yolov8` submits all images in a directory as individual jobs
- [ ] Job status tracking: `openeye batch status --job-id <uuid> --queue redis --redis-url redis://...` checks the status of a submitted job
- [ ] Queue metrics: `openeye_queue_depth`, `openeye_queue_jobs_processed_total`, `openeye_queue_job_latency_seconds` are exposed on `/metrics`

### Edge Cases

- [ ] Queue connection failure on startup: retries with exponential backoff (1s → 60s). If the queue is unreachable for `--queue-connect-timeout` (default: 30s), exits with a clear error listing the connection URL (masking password)
- [ ] Queue goes down mid-processing: in-flight jobs continue processing. New job fetches fail — the consumer enters a reconnection loop with backoff. Completed results for in-flight jobs are buffered in memory and delivered when the queue reconnects
- [ ] Poison message (malformed JSON, missing fields): message is rejected (nacked without requeue) and sent to the DLQ with an error describing the validation failure — does not crash the consumer
- [ ] Image URL unreachable (S3 permission denied, HTTP 404): job is marked as failed with `status: "error"`, `error: "Image download failed: 403 Forbidden"` — the result is sent to the callback URL and/or result queue
- [ ] Duplicate job IDs: if a job with the same `job_id` is submitted twice, the second submission is processed independently (idempotency is the caller's responsibility). Result delivery includes `job_id` for deduplication on the consumer side
- [ ] SQS visibility timeout: `--sqs-visibility-timeout 120` (default: 2x `--job-timeout`) ensures messages are not re-delivered while processing. If processing exceeds the visibility timeout, the message becomes visible again and may be processed twice — document this limitation
- [ ] Large batch submission (>10,000 images): `openeye batch submit` uses batched `LPUSH` (Redis), batched `basic_publish` (RabbitMQ), or `send_message_batch` (SQS, max 10 per call) for efficient submission
- [ ] Memory pressure from concurrent workers: each worker loads the model independently. With `--queue-workers 4` on a single GPU, GPU memory is shared — if the model requires >25% of VRAM, fewer workers should be configured. Chart documents VRAM requirements per model per worker
- [ ] Callback URL returns non-2xx: retries the callback delivery with backoff (separate from the job retry). After 3 callback failures, the result is logged locally and a metric `openeye_callback_failures_total` is incremented
- [ ] Job cancellation: `openeye batch cancel --job-id <uuid>` publishes a cancellation message. Workers check for cancellation between inference steps (if using multi-step pipelines) and abort early
- [ ] Queue backpressure: if the result queue is full (Redis memory limit, RabbitMQ queue length limit), result delivery blocks — the worker slows down processing to match result delivery rate
- [ ] FIFO ordering (SQS FIFO queues): `--sqs-fifo --message-group-id camera-1` ensures messages from the same camera are processed in order — different cameras can be processed in parallel
- [ ] Redis authentication and encryption: `redis://localhost:6379` is unauthenticated and unencrypted. Production deployments must use `rediss://:password@host:6379` (TLS-encrypted with AUTH). Without TLS, inference payloads (base64 images) and detection results traverse the network in plaintext. Chart documents the `--redis-url` format for authenticated and TLS connections, including Redis Sentinel URLs (`redis+sentinel://`)
- [ ] Large payload memory pressure: the job schema stores images as `image_b64` in Redis. Base64 encoding increases size by ~33% — a 20MB image becomes ~27MB in Redis. With `--max-queue-size 10000` jobs queued, worst-case Redis memory usage is 270GB. The queue consumer validates image size before enqueue and rejects payloads exceeding `--max-job-size` (default: 50MB) at the API layer, returning `413 Payload Too Large`
- [ ] Job result access control: `GET /jobs/<job_id>` (if exposed via REST) returns results to anyone who knows the job ID. Without scoping, an attacker can enumerate UUIDs and access other users' inference results. Job IDs use UUID4 (unguessable), and when `--api-key` authentication is enabled, job results are scoped to the API key that submitted them — mismatched keys return `403 Forbidden`
- [ ] Content-hash deduplication ignoring prompts: the duplicate job detection by image content hash does not account for different prompts or model parameters. The same image with prompt "find cats" vs "find dogs" (for grounding-dino) should produce different results. Deduplication key includes `hash(image) + model + prompt + options` — not just the image hash
- [ ] In-memory fallback queue drain: during Redis outage, the in-memory fallback queue (bounded, default: 100 items) accepts jobs. If Redis never reconnects, these jobs are processed locally but their results cannot be stored in Redis. Results are written to local disk (`/var/openeye/queue-fallback/results/`) as JSONL for manual recovery. On Redis reconnection, buffered results are replayed to the result queue
- [ ] Dead letter queue alerting: jobs in the DLQ accumulate silently without notification. A Prometheus metric `openeye_dlq_depth{queue="openeye:dlq"}` is exposed, and a default alert rule fires when DLQ depth exceeds 0 — documented in the Helm chart's `PrometheusRule` template
- [ ] Redis Sentinel support: for Redis HA without Redis Cluster, the queue consumer supports Sentinel URLs (`redis+sentinel://sentinel1:26379,sentinel2:26379/mymaster`). Sentinel provides automatic failover from Redis primary to replica — the consumer reconnects to the new primary transparently
- [ ] Lazy model loading interaction with job timeout: when a queue worker pulls a job for a model that is not yet loaded (lazy loading, story 150 health check context), the model load time (up to 30s per story 157 from other docs) consumes the job timeout budget. A job with `--job-timeout 60` has only 30s remaining for actual inference after a cold model load. The queue consumer extends the message visibility timeout (SQS) or processing deadline (Redis/RabbitMQ) by the model load time before starting inference
- [ ] Redis cluster failover during BRPOPLPUSH: message may be lost (popped from old master, not pushed on new) — contradicts "at-least-once" claim
- [ ] SQS message size limit (256KB): large detection payloads may exceed limit — need S3 offloading for large results
- [ ] Queue consumer OOM killed by Kubernetes: in-flight jobs lost without graceful nack — messages reappear after visibility timeout but results may be inconsistent

### Technical Notes

- Redis queue uses `BRPOPLPUSH` (blocking pop with reliability) for at-least-once delivery
- RabbitMQ uses manual acknowledgment (`basic_ack` after processing, `basic_nack` on failure)
- SQS uses `receive_message` with long polling (`WaitTimeSeconds: 20`) and `delete_message` after successful processing
- Queue consumer lives in `cli/openeye_ai/queue/consumer.py` with provider-specific implementations in `redis.py`, `rabbitmq.py`, `sqs.py`
- Dependencies: `pip install openeye-ai[redis]` (installs `redis`), `pip install openeye-ai[rabbitmq]` (installs `pika`), `pip install openeye-ai[sqs]` (installs `boto3`)

### Example Usage

```bash
# Start queue consumer
openeye serve --queue redis \
  --redis-url redis://redis:6379 \
  --queue-name openeye:inference \
  --result-queue openeye:results \
  --queue-workers 4 \
  --models yolov8

# Submit a batch
openeye batch submit \
  --queue redis \
  --redis-url redis://redis:6379 \
  --queue-name openeye:inference \
  --images /data/batch-2026-03-15/ \
  --model yolov8 \
  --callback-url https://api.corp.com/results

# Check job status
openeye batch status --job-id abc123 \
  --queue redis --redis-url redis://redis:6379
```

---

## 155. Connection Pooling & Resource Limits

**As an enterprise ops team member, I can configure the OpenEye server to properly manage connection pools, file descriptors, GPU memory, and thread pools under high concurrency.**

### Acceptance Criteria

- [ ] `openeye serve --max-connections 100` limits the total number of concurrent HTTP/WebSocket connections (default: 100)
- [ ] Connection pool for outbound HTTP requests (webhooks, callbacks, model registry): configurable pool size via `--http-pool-size 20` (default: 20) with `--http-pool-timeout 30` (seconds)
- [ ] Thread pool for CPU-bound preprocessing (image decode, resize): `--worker-threads 4` (default: `min(4, cpu_count)`) — separate from the main async event loop
- [ ] GPU memory management: `--gpu-memory-fraction 0.8` (default) limits CUDA memory allocation to 80% of total VRAM, reserving 20% for system and other processes
- [ ] File descriptor limit: on startup, checks `ulimit -n` and warns if it is below `--min-fd-limit` (default: 65536). Suggests `ulimit -n 65536` or systemd `LimitNOFILE` configuration
- [ ] Request queue depth: `--max-queue-depth 50` (default) limits the number of pending inference requests. Excess requests receive `429 Too Many Requests` with a `Retry-After` header
- [ ] Connection timeout: idle HTTP connections are closed after `--idle-timeout 60` (default, seconds). WebSocket connections send ping frames every `--ws-ping-interval 30` (seconds) and close after `--ws-ping-timeout 10` missed pongs
- [ ] Memory limit: `--max-memory 8Gi` sets a soft memory limit — when RSS exceeds this, the server logs a warning and starts rejecting new requests. At 120% of the limit, the server initiates graceful shutdown
- [ ] Uvicorn worker configuration: `--uvicorn-workers 1` (default for GPU workloads — single worker avoids GPU context sharing issues) with `--uvicorn-worker-class uvicorn.workers.UvicornWorker`
- [ ] Database connection pool (if management DB is used): `--db-pool-size 5 --db-pool-max-overflow 10 --db-pool-timeout 30` configures SQLAlchemy connection pool
- [ ] `openeye status` reports current resource usage: open connections, thread pool utilization, GPU memory used/total, file descriptors used/limit, request queue depth
- [ ] Resource limits are exposed as Prometheus metrics: `openeye_connections_active`, `openeye_connections_max`, `openeye_gpu_memory_used_bytes`, `openeye_gpu_memory_total_bytes`, `openeye_thread_pool_active`, `openeye_fd_used`, `openeye_queue_depth`

### Edge Cases

- [ ] Connection limit reached: new connections receive `503 Service Unavailable` with `{"error": "Connection limit reached", "max_connections": 100, "retry_after": 5}` — existing connections are not affected
- [ ] File descriptor exhaustion: if the process hits the OS `ulimit`, new connections fail with `OSError: [Errno 24] Too many open files`. The server catches this, logs the fd count, and rejects new connections gracefully — does not crash
- [ ] GPU OOM during inference: if CUDA allocation fails, the inference request returns `500` with `{"error": "GPU out of memory"}`. The server remains operational — the failed CUDA allocation is freed and subsequent requests can succeed
- [ ] GPU memory fragmentation: after many allocation/deallocation cycles, available VRAM may be fragmented. `--gpu-memory-defrag-interval 3600` (default: disabled) triggers `torch.cuda.empty_cache()` periodically to consolidate free memory
- [ ] Thread pool exhaustion: if all worker threads are busy with preprocessing, new requests queue in the async event loop. If the queue depth exceeds `--max-queue-depth`, requests are rejected with `429`
- [ ] Memory leak detection: `--memory-leak-check-interval 300` (default: disabled) compares RSS every 5 minutes. If RSS increases monotonically for 6 consecutive checks, logs a `MEMORY_LEAK_SUSPECTED` warning with a heap summary
- [ ] Uvicorn with multiple workers and GPU: multiple workers each initialize CUDA contexts, multiplying GPU memory usage. Chart warns that `--uvicorn-workers > 1` is only appropriate for CPU-only inference. GPU workloads should use `--uvicorn-workers 1` with async processing
- [ ] WebSocket connection storm: 1000 clients connecting simultaneously — connection acceptance is rate-limited to `--ws-accept-rate 100` (per second) to prevent overwhelming the event loop
- [ ] Slow client draining: clients that consume data slowly (slow WebSocket readers) can cause server-side buffer buildup. Per-client send buffer is limited to `--ws-send-buffer 1MB` — if exceeded, the connection is closed with a `1008 Policy Violation` frame
- [ ] Container cgroup limits vs application limits: in K8s, the container memory limit (`resources.limits.memory`) may be lower than `--max-memory`. The server reads the cgroup memory limit on startup and uses `min(cgroup_limit * 0.9, --max-memory)` as the effective limit
- [ ] Graceful shutdown under load: when shutdown is triggered with 50 active connections, the server stops accepting new connections, sends `Connection: close` headers on HTTP and `GOAWAY` on HTTP/2, and waits up to `terminationGracePeriodSeconds` for in-flight requests to complete
- [ ] WebSocket origin validation bypass: CORS middleware applies to HTTP requests but WebSocket upgrade handshakes bypass CORS checks. Any origin can open a WebSocket connection — this is a DoS vector at scale. The server validates `Origin` header on WebSocket upgrade against `--ws-allowed-origins` (default: same as CORS origins). Connections from disallowed origins receive HTTP 403 during the upgrade handshake
- [ ] Per-client receive buffer attack: a malicious client can open a WebSocket connection and send data very slowly (slowloris attack on WebSocket). Each connection accumulates partial base64 image data in memory during `await ws.receive_text()`. With 1000 connections each dribbling data, server memory is exhausted. Per-connection receive timeout (`--ws-receive-timeout 30`, seconds) closes connections that don't send a complete message within the timeout
- [ ] Permessage-deflate compression memory overhead: each WebSocket connection with `permessage-deflate` enabled allocates a zlib compression/decompression context (~256KB per connection). At 1000 connections, this consumes ~250MB of memory solely for compression contexts. The server tracks compression memory in the `openeye_ws_compression_memory_bytes` metric. If compression memory exceeds `--ws-compression-memory-limit` (default: 512MB), new connections are accepted without compression (server omits `permessage-deflate` from the upgrade response)
- [ ] uvloop unavailability: the technical notes specify `uvloop` for high-performance async I/O, but `uvloop` does not support Windows and may not be installed on all Linux distributions. The server falls back to the default asyncio event loop when `uvloop` is unavailable, with a log message: "uvloop not available — using default asyncio loop. Install uvloop for better WebSocket performance." Performance targets (1000 connections) may not be achievable without uvloop — documented as a requirement for production deployments
- [ ] Per-client fairness in inference queue: the current `InferenceQueue` processes requests FIFO. A single fast WebSocket client submitting frames at 30 FPS can monopolize the inference queue, starving 999 other clients. A fair-scheduling policy (`--ws-fair-scheduling`) round-robins inference slots across active clients — each client gets at most `--ws-max-fps-per-client` (default: 10) frames per second processed, with excess frames dropped on the server side
- [ ] CUDA context corruption after GPU OOM: some OOM failures leave CUDA context corrupted — all subsequent operations fail, only recovery is process restart
- [ ] Ephemeral port exhaustion: many concurrent webhook deliveries with short-lived connections in TIME_WAIT — `bind: address already in use` for outbound connections
- [ ] DNS resolution failure for outbound connections: if CoreDNS is overloaded, HTTP pool connections may fail or use stale IPs — `httpx.AsyncClient` may cache DNS for pool lifetime

### Technical Notes

- Connection management uses Uvicorn's built-in connection limit (`--limit-concurrency`)
- Outbound HTTP pool uses `httpx.AsyncClient` with `limits=httpx.Limits(max_connections=20, max_keepalive_connections=10)`
- Thread pool uses `concurrent.futures.ThreadPoolExecutor` accessed via `asyncio.loop.run_in_executor()`
- GPU memory fraction is set via `torch.cuda.set_per_process_memory_fraction(0.8)`
- File descriptor check uses `resource.getrlimit(resource.RLIMIT_NOFILE)` on Linux/macOS
- Memory monitoring uses `psutil.Process().memory_info().rss`

---

## 156. Circuit Breaker & Graceful Degradation

**As an enterprise ops team member, I can configure OpenEye so that when downstream dependencies fail, the system degrades gracefully instead of cascading failures.**

### Acceptance Criteria

- [ ] Circuit breaker pattern is implemented for all outbound dependencies: webhook endpoints, queue backends (story 154), data lake sinks (story 196), ticketing systems (story 198), secrets managers (story 199), and model registries
- [ ] Circuit breaker states: `CLOSED` (normal operation), `OPEN` (dependency failed, requests short-circuited), `HALF_OPEN` (testing recovery with limited traffic)
- [ ] Transition thresholds: `--circuit-breaker-failure-threshold 5` (default) consecutive failures trigger transition from `CLOSED` to `OPEN`
- [ ] Recovery: after `--circuit-breaker-reset-timeout 60` (seconds, default), the breaker transitions to `HALF_OPEN` and allows a single probe request. If it succeeds, transitions to `CLOSED`; if it fails, transitions back to `OPEN`
- [ ] Graceful degradation modes per dependency:
  - Webhook failure: detections continue, webhook payloads are buffered locally (up to `--webhook-buffer-size 1000` events), replayed when the breaker closes
  - Queue failure: inference continues, results are written to local disk (`/var/openeye/queue-fallback/`) for later replay
  - Model registry failure: server continues with the currently loaded model — does not attempt model updates until the breaker closes
  - Secrets manager failure: continues with cached credentials until they expire (see story 199)
- [ ] The inference pipeline itself never stops due to a downstream dependency failure — detection results are always produced if the model and camera are functional
- [ ] Circuit breaker state is exposed via `/health` endpoint: `{"dependencies": {"webhook": "CLOSED", "queue": "OPEN", "model_registry": "CLOSED"}}`
- [ ] Circuit breaker state changes emit Prometheus metrics: `openeye_circuit_breaker_state{dependency="webhook"}` (0=CLOSED, 1=OPEN, 2=HALF_OPEN) and `openeye_circuit_breaker_transitions_total{dependency="webhook", from="CLOSED", to="OPEN"}`
- [ ] `openeye status` displays all circuit breaker states with last failure time and failure count
- [ ] Alerting: when a breaker opens, a `CIRCUIT_BREAKER_OPEN` log event at `ERROR` level is emitted with the dependency name and last error message
- [ ] Configuration per dependency: different dependencies can have different thresholds and timeouts — e.g., webhook breaker with 3 failures / 30s reset, queue breaker with 5 failures / 120s reset
- [ ] Bulkhead isolation: each dependency has its own connection pool and thread allocation — a slow/failing dependency does not consume resources that affect other dependencies or the inference pipeline

### Edge Cases

- [ ] All dependencies fail simultaneously (network partition): inference pipeline continues producing results, all breakers open, all results are buffered locally. When connectivity restores, buffered data is replayed in chronological order across all dependencies
- [ ] Breaker opens during batch processing (story 154): in-flight batch jobs continue processing, but result delivery (callback or result queue) is buffered locally. Jobs are not marked as failed — they are marked as `completed_pending_delivery`
- [ ] Half-open probe succeeds but next real request fails: breaker re-opens immediately with reset counter reset. `--circuit-breaker-half-open-max-calls 3` allows multiple probe requests before deciding — majority rule (2 of 3 must succeed)
- [ ] Local buffer overflow: if buffered events exceed `--webhook-buffer-size`, oldest events are evicted with a log warning. Evicted events are logged to a local file for manual recovery
- [ ] Dependency recovery during graceful shutdown: if a breaker closes (dependency recovers) during shutdown, buffered events are flushed before exit — up to `--shutdown-timeout` (default: 30s)
- [ ] Cascading circuit breakers: if dependency A calls dependency B (e.g., webhook sends to Jira which calls ServiceNow), only OpenEye's direct dependency breaker is managed. Downstream cascade is not controlled by OpenEye — document this boundary
- [ ] Circuit breaker state persistence: breaker state is in-memory by default. On pod restart, all breakers start `CLOSED` — if the dependency is still down, the breaker re-opens after `failure_threshold` failures. `--circuit-breaker-persist` writes state to a ConfigMap for survival across restarts
- [ ] False positive breaker opening: a transient network blip causes 5 consecutive failures in 100ms, opening the breaker unnecessarily. `--circuit-breaker-failure-window 60` (seconds) requires failures to occur within a time window — 5 failures in 100ms within a 60s window still opens the breaker, but the reset timeout allows quick recovery
- [ ] Slow dependency (not failing but taking >10s per request): the circuit breaker is not triggered by slow responses. `--circuit-breaker-timeout 10` (seconds) treats requests exceeding this duration as failures for breaker purposes
- [ ] Health check reporting with open breakers: `/health` returns `200 OK` with `"status": "degraded"` (not `"ok"`) when any breaker is open — the readiness probe still passes to keep the pod in the Service, but monitoring systems can alert on the degraded status
- [ ] Database connection string exposure: `--database-url postgresql://user:password@host/db` passes credentials as a command-line argument, visible in `/proc/<pid>/cmdline` on Linux and in `ps aux` output. Connection strings must be provided via environment variable (`DATABASE_URL`) or secret file (`--database-url-file /var/run/secrets/db-url`), never via CLI flags. The server logs a security warning if credentials are detected in CLI arguments
- [ ] PostgreSQL SSL/TLS enforcement: without `sslmode=verify-full` in the connection string, database connections are unencrypted. In multi-region deployments (story 153), database traffic may cross network boundaries. The server validates `sslmode` on startup — if set to `disable` or `prefer`, logs a `SECURITY_WARNING` recommending `verify-full` for production. Chart defaults to `sslmode=require` in the database URL template
- [ ] Concurrent Alembic migrations: in horizontally scaled deployments (story 150), multiple pods starting simultaneously may each run `openeye db migrate`. Alembic uses PostgreSQL advisory locks (`pg_advisory_lock`) to prevent concurrent migration execution — but some managed PostgreSQL services (certain Supabase configurations, Aurora Serverless v1) do not support advisory locks. A fallback using a `migrations_lock` table with row-level locking is provided
- [ ] Connection pool leak detection: if application code opens a database connection (via SQLAlchemy session) but does not close it due to an unhandled exception in a request handler, the pool gradually drains. `--db-pool-recycle 1800` (seconds, default) reaps connections older than 30 minutes. `--db-pool-pre-ping true` validates connections before checkout, detecting stale connections from database restarts or failovers
- [ ] Audit log retention compliance: the default audit log retention (`persistence.logs.retentionDays: 30`) is insufficient for many compliance frameworks. SOC 2 requires 1 year, HIPAA requires 6 years, PCI DSS requires 1 year. Chart supports `audit.retentionDays` as a separate setting from general log retention, with values documented per compliance framework. Logs older than the active retention period are archived to cold storage (S3 Glacier, GCS Archive) before deletion
- [ ] WAL archiving for point-in-time recovery: the disaster recovery story (157) mentions data replication with 15-minute RPO, but fine-grained recovery (e.g., restoring to a specific timestamp after data corruption) requires PostgreSQL WAL archiving and continuous backup. Document integration with `pgBackRest` or `wal-g` for PITR capability — the failover story's `openeye db backup` should support `--pitr-target "2026-03-15 14:30:00"` for point-in-time restoration
- [ ] Local buffer disk fills up: if dependencies down for extended period, buffer files grow without bound — if same PVC as detection data, inference pipeline fails too
- [ ] Thundering herd on breaker close: OPEN→CLOSED transition replays all buffered events plus new traffic — recently recovered dependency immediately overwhelmed, re-opens
- [ ] Dependency returns partial success: webhook returns 200 but empty/error body — circuit breaker counts as success but delivery actually failed. No semantic failure detection

### Technical Notes

- Circuit breaker implementation uses the `circuitbreaker` Python library or a custom implementation in `cli/openeye_ai/resilience/circuit_breaker.py`
- Bulkhead pattern uses separate `httpx.AsyncClient` instances per dependency with independent connection pools
- Local buffer for failed deliveries uses an append-only file at `/var/openeye/buffer/<dependency>.jsonl` with CRC checksums
- Buffer replay uses a background asyncio task that checks breaker state every `reset_timeout` seconds
- Integration with Kubernetes: breaker state is optionally synced to a ConfigMap via the K8s API for cross-pod visibility

---

## 157. Disaster Recovery & Failover

**As an enterprise ops team member, I can configure automatic failover to a standby cluster/region when the primary fails.**

### Acceptance Criteria

- [ ] The Helm chart supports active-passive deployment: primary cluster serves traffic, standby cluster is pre-provisioned with the same configuration but `standby.enabled: true` and `replicaCount: 0` (scaled down)
- [ ] Failover trigger: when the primary region's health check fails for `failover.healthCheck.failureThreshold: 3` consecutive checks at `failover.healthCheck.interval: 30s`, the global LB (story 153) routes traffic to the standby region
- [ ] Automatic standby activation: a failover controller (CronJob or external tool) detects the primary failure and scales up the standby deployment via `kubectl scale deployment openeye --replicas=3` in the standby cluster
- [ ] Model readiness: the standby cluster's PVCs (story 152) are pre-loaded with model weights via periodic sync — cold start on failover only requires model loading into GPU memory (~30-60s), not model download
- [ ] Data replication: detection data and audit logs are replicated from primary to standby via cross-region storage replication (S3 Cross-Region Replication, GCS Multi-Region, Azure GRS) — RPO (Recovery Point Objective) target: 15 minutes
- [ ] RTO (Recovery Time Objective) target: 5 minutes from primary failure detection to standby serving traffic
- [ ] Failover runbook: `openeye failover initiate --target standby-cluster` triggers a manual failover for planned maintenance — scales up standby, verifies health, switches DNS, then scales down primary
- [ ] Failback: `openeye failover revert --target primary-cluster` reverses the failover — syncs any data accumulated on the standby back to the primary before switching traffic
- [ ] Failover testing: `openeye failover test --dry-run` validates that the standby cluster is ready (PVCs populated, images pulled, configuration valid) without actually switching traffic
- [ ] Failover notifications: when failover is triggered, notifications are sent to configured channels (Slack, PagerDuty, email) via `failover.notifications.webhook: https://hooks.slack.com/...`
- [ ] Split-brain prevention: a distributed lock (etcd, DynamoDB, Cloud Spanner) ensures only one cluster is actively serving at a time — the standby cluster checks the lock before accepting traffic
- [ ] Failover audit log: all failover events (trigger, initiation, completion, revert) are recorded in an immutable audit log with timestamps, operator identity, and reason

### Edge Cases

- [ ] Standby cluster is also down (dual-region failure): failover controller detects this and does not attempt failover — sends a critical alert to the notification channel with "No healthy standby available"
- [ ] Network partition between primary and standby (split-brain): both clusters believe the other is down. Distributed lock prevents both from serving simultaneously — the cluster that acquires the lock serves traffic, the other stands down
- [ ] Failover during active batch processing (story 154): in-flight batch jobs on the primary are lost if the primary is unrecoverable. The message queue (if external to the primary cluster, e.g., managed SQS) retains unacknowledged jobs — the standby picks them up after failover
- [ ] Data replication lag: if the primary fails and the last replication was 10 minutes ago, up to 10 minutes of detection data may be lost. `failover.maxAcceptableRPO: 15m` — if replication lag exceeds this, the failover controller logs a warning about potential data loss
- [ ] Standby PVC out of date: if model sync to the standby failed, the standby cluster may have an older model version. Failover controller checks model version before activating standby and logs a warning if versions differ — `failover.requireModelConsistency: false` (default) allows failover with stale models
- [ ] DNS TTL propagation delay: after DNS switch, clients with cached DNS may still route to the failed primary for up to DNS TTL seconds. Document that TTL should be set to 60s (or lower) for production failover scenarios
- [ ] Failover flapping: if the primary recovers quickly and failover is triggered/reverted repeatedly, `failover.cooldown: 600` (seconds, default) prevents re-failover within the cooldown period after a revert
- [ ] Failover during Helm upgrade: if the primary is being upgraded (rolling update in progress, story 151) and a health check fails, the failover controller distinguishes between "upgrade in progress" (expected) and "actual failure" by checking the Deployment rollout status — does not failover during active rollouts unless all pods are unhealthy
- [ ] Cross-region latency increase after failover: users in the primary region now route to a farther standby region. Latency monitoring (`openeye_request_latency_seconds`) detects the increase and the dashboard alerts operators to either fix the primary or deploy a closer standby
- [ ] Data reconciliation after failback: detection data accumulated on the standby during the failover period must be replicated back to the primary before failback. `openeye failover revert` includes a `--sync-data` step that runs a cross-region copy job and validates row counts before switching traffic
- [ ] Lazy model loading interaction with failover cold start: the standby cluster's PVCs have model weights on disk, but with lazy loading (story 150 health check context), models are not loaded into GPU memory until the first request. Failover activation scales up replicas from 0 — the first batch of real traffic triggers model loading on all pods simultaneously (30s cold start per story 157 context). Combined with DNS propagation delay (30-60s), total failover RTO may exceed the 5-minute target. Standby pods should pre-load models at activation time via a `--preload` flag in the scale-up script, not wait for the first user request
- [ ] Batch job re-queue cascade during failover: if the primary cluster had in-flight batch jobs (story 154) when it failed, the queue backend (Redis/SQS) retains unacknowledged messages. When the standby activates and connects to the same queue, all unacknowledged jobs become visible and are processed by standby workers — but standby workers may need to cold-start their models, causing job timeouts and re-queues. The failover controller should pause queue consumption for `--failover-warmup-period` (default: 60s) after activation to allow model loading before processing queued jobs
- [ ] GDPR right to erasure across distributed stores: if inference results contain personally identifiable information (face detections, license plates), GDPR requires the ability to delete all data for a specific individual on request. With data spread across primary PVCs, standby PVCs, cross-region storage replication, Redis queues, audit logs (story 156 context), and backup snapshots (story 152), a comprehensive erasure mechanism must cascade across all stores. The `openeye gdpr erase --subject-id <id>` command should traverse all data stores and replication targets — document the erasure scope and any stores where erasure is technically infeasible (e.g., immutable backups, where retention policy expiry is the resolution)
- [ ] Distributed lock service unavailable: if DynamoDB/Spanner table unreachable, neither cluster can acquire lock — total outage from locking service failure
- [ ] Failover controller single point of failure: runs as CronJob in management cluster — if management cluster down, no automatic failover occurs
- [ ] Partial primary failure (degraded, not dead): 50% of pods healthy — health check may pass but primary can't handle full load. No threshold-based failover
- [ ] Standby cluster infrastructure drift: over weeks, standby may have expired certs, different K8s versions, stale drivers — `--dry-run` may not detect infrastructure-level drift

### Technical Notes

- Failover controller can be implemented as a Kubernetes CronJob in a "management" cluster that monitors both primary and standby health endpoints
- Distributed lock uses a cloud-native service: DynamoDB (AWS), Cloud Spanner (GCP), or Cosmos DB (Azure) for strong consistency
- DNS failover is the primary mechanism — cloud-specific implementations: Route 53 health checks + failover routing, GCP Cloud DNS + Traffic Director, Azure Traffic Manager + priority routing
- Model sync uses cloud storage replication — not a custom sync mechanism
- RTO breakdown: health check detection (30-90s) + standby scale-up (30-60s) + DNS propagation (30-60s) = ~2-4 minutes theoretical, 5 minutes target with buffer
- Failover runbook automation uses `kubectl` and cloud CLI tools — the `openeye failover` command is a wrapper around these

### Example Config

```yaml
# values.yaml for standby cluster
standby:
  enabled: true
  primaryHealthEndpoint: https://openeye-primary.corp.com/health

failover:
  healthCheck:
    interval: 30s
    failureThreshold: 3
    timeout: 10s
  cooldown: 600
  maxAcceptableRPO: 15m
  requireModelConsistency: false
  notifications:
    webhook: https://hooks.slack.com/services/T.../B.../xxx
    pagerduty:
      serviceKey: ${PAGERDUTY_SERVICE_KEY}
  distributedLock:
    provider: dynamodb  # dynamodb | spanner | cosmosdb
    tableName: openeye-failover-lock
    region: us-east-1
```

---

## 158. Capacity Planning & Load Testing

**As an enterprise ops team member, I get tools for load testing and capacity planning to right-size my OpenEye deployment.**

### Acceptance Criteria

- [ ] `openeye loadtest --target https://openeye.corp.com --rps 100 --duration 300` runs a load test sending 100 requests per second for 5 minutes against a running OpenEye deployment
- [ ] Load test modes: `--mode constant` (fixed RPS), `--mode ramp` (linearly increase from `--rps-start 10` to `--rps-end 200` over `--duration`), `--mode spike` (constant RPS with periodic spikes of `--spike-rps 500` every `--spike-interval 60s`)
- [ ] Test payloads: `--test-images images/` uses real images from a directory, `--test-image-size 1920x1080` generates synthetic images of the specified size, `--test-image-count 100` limits the image pool size
- [ ] Results report includes: p50/p95/p99 latency, throughput (inferences/sec), error rate, GPU utilization over time, memory usage over time, and queue depth over time
- [ ] Results export: `--output report.json` saves the full results, `--output report.html` generates an interactive HTML report with charts (latency distribution, throughput over time, error timeline)
- [ ] Capacity planning calculator: `openeye capacity-plan --model yolov8 --target-rps 50 --target-latency-p99 200ms --gpu-type a100` outputs recommended replica count, GPU type/count, and estimated cloud cost
- [ ] Capacity plan considers: model inference time per GPU type (benchmarked), preprocessing overhead, network latency, queue depth impact, and autoscaling headroom
- [ ] GPU benchmark: `openeye benchmark --model yolov8 --gpu` runs a local benchmark and reports single-image latency, max throughput (batch=1), batch throughput (batch=8, 16, 32), and GPU memory usage
- [ ] Benchmark results are stored locally at `~/.openeye/benchmarks/<model>/<gpu>.json` and can be uploaded to a shared benchmark registry for fleet-wide capacity planning
- [ ] Stress test: `--mode stress` continuously increases RPS until the server returns errors or latency exceeds `--stress-latency-limit 1000ms` — reports the maximum sustainable RPS (saturation point)
- [ ] Multi-endpoint load test: `--endpoints predict,stream,batch` tests multiple API endpoints simultaneously with configurable traffic ratios (`--endpoint-ratio predict:80,stream:15,batch:5`)
- [ ] Connection warmup: `--warmup 30` sends a low-rate warmup for 30 seconds before the main test to stabilize GPU caches, JIT compilation, and connection pools
- [ ] Comparison mode: `openeye loadtest compare report-v1.json report-v2.json` generates a side-by-side comparison of two load test runs highlighting regressions and improvements

### Edge Cases

- [ ] Load test against production: `--target` pointing at a production endpoint — the tool warns "This will send real load to the target. Are you sure? Use --confirm-production to proceed." Without the flag, the test is aborted
- [ ] Target server overwhelmed: if the server returns >10% error rate during the first 30 seconds, the test pauses and warns "High error rate detected. The target may not handle this load. Continue? [y/N]" — `--force` skips the prompt
- [ ] Load test from single client bottleneck: if the load test client itself becomes the bottleneck (CPU-bound image generation, network bandwidth), the tool detects this by monitoring client-side CPU and network utilization and warns "Client may be the bottleneck — consider distributed load testing"
- [ ] Distributed load testing: `openeye loadtest --distributed --workers 5 --worker-image ghcr.io/openeye-ai/openeye-loadtest` runs the load test from multiple K8s pods (as a Job) for higher aggregate RPS — results are collected and aggregated by a coordinator pod
- [ ] Clock synchronization in distributed tests: all worker pods use NTP-synchronized clocks. If clock skew between workers exceeds 100ms, the coordinator logs a warning about potential latency measurement inaccuracy
- [ ] Capacity plan for multi-model deployment: if the deployment runs multiple models (e.g., `yolov8` + `depth-anything`), `openeye capacity-plan --models yolov8,depth-anything` accounts for the combined GPU memory and inference time
- [ ] GPU benchmark with thermal throttling: if the GPU throttles during the benchmark (detected via `nvidia-smi` clock speed monitoring), the benchmark report flags the results as "thermally limited" and reports both peak and sustained throughput
- [ ] Capacity plan cloud cost estimation: `--cloud aws` uses AWS GPU instance pricing (e.g., `p3.2xlarge` for V100, `g5.xlarge` for A10G). Pricing data is fetched from a bundled pricing table updated quarterly — `--refresh-pricing` fetches the latest pricing from the cloud provider's API
- [ ] Load test with authentication: `--api-key sk-...` includes the API key in all requests. `--api-key-per-request` generates a unique API key per request to test authentication overhead
- [ ] Streaming endpoint load test: `--mode stream --stream-duration 60 --stream-clients 50` opens 50 concurrent WebSocket streaming connections, each lasting 60 seconds — reports per-stream frame rate, latency jitter, and dropped frames
- [ ] HTML report generation fails (missing dependency): `plotly` is an optional dependency for HTML reports. If not installed, the tool falls back to a plain-text summary and logs "Install plotly for HTML reports: pip install openeye-ai[loadtest]"
- [ ] Load test resume: if the load test is interrupted (`Ctrl+C`), partial results collected so far are saved to `--output` — the report is marked as "partial" with the actual test duration noted
- [ ] Load test with autoscaling feedback loop: running a load test against a system with HPA (story 147) enabled creates a feedback loop — the test triggers scale-up, which changes capacity, which changes the test's results. The load test report notes whether replica count changed during the test (via `kubectl get hpa` or Prometheus metric query). For stable benchmarking, document the recommendation to fix replica count (`kubectl scale --replicas=N`) during load tests and re-enable HPA afterward
- [ ] Result validation for correctness: the load test measures latency and error rates but does not validate inference result accuracy. A server under extreme load might return truncated JSON, empty detection arrays, or results from a wrong model version. `--validate-results` enables optional result validation: a subset of test images have known-good detection outputs, and the load test verifies that server responses match expected labels and bounding boxes within a tolerance threshold
- [ ] Distributed worker metric aggregation: the `--distributed --workers 5` mode spawns 5 worker pods. Each worker independently records latency measurements. Percentiles are not additive — the aggregate p99 is NOT the average of per-worker p99 values. Workers must report raw latency histograms (HdrHistogram) to the coordinator pod, which computes correct aggregate percentiles across all workers. The coordinator merges histograms before calculating final statistics
- [ ] Load generator file descriptor cleanup: with 10,000 simulated devices using `httpx` WebSocket connections, the load test tool creates 10,000+ file descriptors. If the test is interrupted (`SIGKILL`, OOM), these FDs may not be cleaned up, causing the load test machine to hit `ulimit -n` limits on subsequent runs. The tool registers a `SIGTERM` handler that closes all connections, and the final report includes the FD count at test end for leak detection
- [ ] Burst test vs queue depth interaction: burst test mode (`--mode spike --spike-rps 1000`) submits 1000 requests simultaneously. If the target uses a Redis queue (story 154) with `--max-queue-size 10000`, after 10 spikes the queue fills and all subsequent requests get `429`. The load test report distinguishes `queue_full_rejections` from `server_errors` and `client_errors` in the error breakdown, so operators can tune queue depth independently of server capacity
- [ ] Load test creating orphaned resources: if coordinator crashes mid-test, worker pods run indefinitely consuming GPU — no cleanup mechanism
- [ ] Benchmark not representative of production: synthetic noise images have different processing times than real images — capacity plans based on synthetic benchmarks may under-provision 2-3x
- [ ] Stress test mode causing cluster-wide impact: `--mode stress` can overwhelm shared ingress controller, DNS, or service mesh affecting all tenants

### Technical Notes

- Load test client uses `httpx.AsyncClient` for HTTP/WebSocket with configurable connection pool settings
- Image generation uses `PIL.Image.new()` with random noise for synthetic payloads — avoids model caching bias
- GPU benchmark uses `torch.cuda.Event` for precise GPU timing
- Capacity planning formula: `replicas = ceil(target_rps / single_replica_max_rps * (1 + headroom_factor))` where `headroom_factor` defaults to 0.3 (30% headroom for spikes)
- HTML report uses `plotly` for interactive charts rendered to a self-contained HTML file
- Distributed load testing uses Kubernetes Jobs with a shared results volume (or S3 bucket for cross-cluster tests)
- Dependencies: `pip install openeye-ai[loadtest]` installs `plotly` and `httpx` (if not already installed)

### Example Usage

```bash
# Quick load test
openeye loadtest \
  --target https://openeye.corp.com \
  --rps 50 \
  --duration 300 \
  --test-image-size 1920x1080 \
  --output report.html

# Ramp test to find saturation point
openeye loadtest \
  --target https://openeye.corp.com \
  --mode ramp \
  --rps-start 10 \
  --rps-end 200 \
  --duration 600 \
  --output ramp-test.json

# Stress test
openeye loadtest \
  --target https://openeye.corp.com \
  --mode stress \
  --stress-latency-limit 500ms \
  --output stress-report.html

# GPU benchmark
openeye benchmark --model yolov8 --gpu

# Capacity planning
openeye capacity-plan \
  --model yolov8 \
  --target-rps 100 \
  --target-latency-p99 200ms \
  --gpu-type a100 \
  --cloud aws

# Compare two test runs
openeye loadtest compare baseline.json canary.json
```

---

## Cross-Cutting Concerns (All Stories)

The following edge cases span multiple stories and address systemic risks that emerge from the interaction of scalability components.

### Security: End-to-End Encryption of Inference Data

**Affects:** Stories 146, 147, 148, 149, 150, 153, 154

- [ ] All inter-service communication (load balancer → worker, worker → Redis queue, worker → control plane, worker → webhook endpoints) must be encrypted in transit. The current gRPC server uses `add_insecure_port` and the FastAPI server has no TLS configuration. Chart documents two approaches: (1) service mesh (Istio strict mTLS) for zero-config encryption, or (2) pod-level TLS via `server.tls.enabled: true` with certificate management via cert-manager. Unencrypted deployments in production log a `SECURITY_WARNING` on every startup

### Observability: Distributed Trace Context Propagation

**Affects:** Stories 146, 149, 150, 154, 156

- [ ] When a request flows through ingress → load balancer → API → queue → inference worker → EventBus → gRPC subscriber → webhook, trace context must be propagated at every boundary. The `EventBus` (`event_bus.py`) has no trace context fields in `PerceptionEvent`. The `InferenceQueue` has no trace header forwarding. OpenTelemetry SDK integration is required: the server propagates W3C `traceparent`/`tracestate` headers on inbound requests, injects trace context into queue job metadata, and attaches `trace_id` to EventBus events. The Helm chart includes an optional OpenTelemetry Collector sidecar (`otel.enabled: true`) for trace export

### Architecture: Singleton Pattern in Multi-Process/Multi-Replica Deployments

**Affects:** Stories 146, 147, 150, 154

- [ ] The `EventBus` and `TelemetryProvider` use Python `@singleton` decorators, creating per-process instances. In multi-replica K8s deployments, each pod has its own EventBus — events from one pod (detection results, model lifecycle) are invisible to other pods. This breaks cross-pod features: gRPC streaming clients connected to pod A cannot see detections from pod B, telemetry dashboards show per-pod metrics without aggregation, and circuit breaker state (story 156) is local to each pod. Resolution: (1) replace in-process EventBus with Redis Pub/Sub for cross-pod event propagation, (2) use Prometheus federation for cross-pod metric aggregation, (3) use ConfigMap or Redis for shared circuit breaker state. Chart documents the Redis dependency as required for `replicaCount > 1`

### Compatibility: Proto Schema Versioning

**Affects:** Stories 149, 151, 153

- [ ] The gRPC `perception.proto` has no version field in messages, no `reserved` field ranges, and no package version indicator. When rolling updates (story 151) change the proto schema, old clients connected to new pods may receive unknown fields (safely ignored) or miss removed fields (silently breaks). Proto versioning policy: (1) new fields are always `optional`, (2) removed fields use `reserved` to prevent reuse, (3) breaking changes require a new service version (`PerceptionServiceV2`), (4) the `/health` endpoint reports the proto version for client compatibility checking

### Compliance: GDPR Right to Erasure Across Distributed Stores

**Affects:** Stories 152, 153, 154, 155, 156, 157

- [ ] Inference results may contain PII (face detections, license plates, biometric data). GDPR Article 17 requires deletion of all personal data on request. In a scaled deployment, PII exists in: inference results on PVCs (story 152), queued jobs in Redis/SQS (story 154), audit logs in PostgreSQL or PVC (story 156), cross-region storage replicas (story 153/157), backup snapshots (story 152/157), and in-memory caches (EventBus history, TelemetryProvider). A comprehensive `openeye gdpr erase --subject-id <id>` command must cascade across all stores. For immutable stores (backups, WAL archives), document that erasure occurs via retention policy expiry. Per-region erasure must be coordinated when data residency rules are in effect (story 153)

### Reliability: Autoscaling + Queue + Cold-Start Cascade

**Affects:** Stories 147, 150, 151, 154, 157, 158

- [ ] When the HPA (story 147) scales up in response to high queue depth (story 154), new pods start and connect to the Redis queue. Each new pod pulls a job from the queue immediately — but the model is not yet loaded (lazy loading context). The pod holds the job while loading the model (30s). The queue's job timeout (60s) may expire, causing the job to be re-queued. The re-queued job is picked up by another new pod also in cold-start, creating a cascade where jobs are perpetually re-queued. Resolution: (1) new pods do not start consuming from the queue until the readiness probe passes (model loaded), (2) the queue consumer registers a `startup_complete` flag that gates job consumption, (3) the HPA stabilization window (story 147) prevents rapid scale-up that creates many simultaneously cold pods

### Integration: ROS2 Adapter Interaction with Horizontal Scaling

**Affects:** Stories 146, 149, 150 (and integration stories 81-82)

- [ ] The ROS2 publisher adapter (integration story 81) publishes detections to `/openeye/detections` as a single topic. With multiple horizontally scaled pods, each pod runs its own ROS2 node publishing to the same topic. Downstream ROS2 subscribers receive interleaved frames from different pods with potentially different models loaded (due to lazy loading) or different model versions (during rolling updates). ROS2 node names must be unique per pod (`openeye_perception_<pod_id>`), and the topic should be namespaced per pod or aggregated via a dedicated ROS2 bridge node that deduplicates and orders frames by timestamp

### Integration: Solo CLI Backpressure with Queue-Based Processing

**Affects:** Stories 149, 154 (and integration story 84)

- [ ] The Solo CLI adapter (integration story 84) handles backpressure by dropping oldest frames when Solo CLI is slow to consume. However, if Solo CLI consumes via the queue-based async API (story 154), it polls `GET /jobs/<job_id>` and always receives results — the frame-dropping backpressure mechanism is bypassed. Solo CLI must implement its own client-side backpressure (discard old results when its planning buffer is full) or use the WebSocket streaming API (which preserves server-side backpressure) instead of the queue API for real-time operation

### Operational: GPU Memory Accounting Across Features

**Affects:** Stories 148, 150, 152, 155

- [ ] Multiple stories independently manage GPU memory: GPU scheduling (story 148) requests GPUs via K8s resource limits, connection pooling (story 155) sets `--gpu-memory-fraction`, model loading manages LRU eviction, and multi-model inference shares VRAM. No unified GPU memory dashboard exists. The server should expose a single set of GPU metrics: `openeye_gpu_memory_total_bytes`, `openeye_gpu_memory_allocated_bytes` (PyTorch allocator), `openeye_gpu_memory_reserved_bytes` (PyTorch cache), `openeye_gpu_memory_used_by_model_bytes{model="yolov8"}` (per-model), and `openeye_gpu_memory_available_bytes`. These metrics power capacity planning (story 158), autoscaling decisions (story 147), and alerting (story 156)
