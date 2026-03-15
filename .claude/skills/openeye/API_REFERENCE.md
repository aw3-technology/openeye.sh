# OpenEye API Reference

## Inference Server (`openeye serve`)

Started via `openeye serve <model>`, runs on `--host 0.0.0.0 --port 8000`.

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{"status": "ok", "model": "<name>"}` |
| `POST` | `/predict` | Multipart upload — returns `PredictionResult` |
| `GET` | `/config` | Get runtime config |
| `PUT` | `/config` | Update runtime config |
| `GET` | `/metrics` | Prometheus-style inference metrics |
| `GET` | `/queue/status` | Request queue depth and status |

### WebSocket

`WS /ws` — Send base64-encoded frames, receive `PredictionResult` JSON per frame.

### PredictionResult Schema

```typescript
interface PredictionResult {
  model: string;
  task: string;
  timestamp: string;
  image: { width: number; height: number; source: string };
  objects: Array<{
    label: string;
    confidence: number;
    bbox: { x: number; y: number; w: number; h: number }; // normalized 0-1
  }>;
  depth_map?: string; // base64-encoded PNG (depth models only)
  inference_ms: number;
}
```

---

## Fleet Control Plane (`backend/src/fleet/`)

Runs on port 8001. All endpoints require `Authorization: Bearer <OPENEYE_TOKEN>`.

### Devices

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/devices` | Register device (201) |
| `GET` | `/devices` | List devices (filters: `status`, `device_type`, `tag_key`, `tag_value`) |
| `GET` | `/devices/{id}` | Get device |
| `PATCH` | `/devices/{id}` | Update device |
| `PUT` | `/devices/{id}/tags` | Set tags (key-value dict) |
| `PUT` | `/devices/{id}/config` | Set config overrides |
| `GET` | `/devices/{id}/resources` | Resource history (query: `limit`, default 100) |
| `POST` | `/devices/{id}/restart` | Restart (202, returns `command_id`) |
| `DELETE` | `/devices/{id}` | Decommission (query: `wipe_data`) |
| `POST` | `/devices/batch` | Batch ops on tagged devices |

### Deployments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/deployments` | Create deployment (201) |
| `GET` | `/deployments` | List (filter: `status`) |
| `GET` | `/deployments/{id}` | Get deployment |
| `GET` | `/deployments/{id}/devices` | Device statuses in deployment |
| `POST` | `/deployments/{id}/advance` | Advance to next stage |
| `POST` | `/deployments/{id}/pause` | Pause deployment |
| `POST` | `/deployments/{id}/rollback` | Rollback deployment |

### Heartbeats & Commands

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/heartbeats` | Device heartbeat (device API key auth) |
| `GET` | `/commands` | List commands (filter: `device_id`, `status`) |
| `POST` | `/commands/{id}/complete` | Complete command |

### Device Groups

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/groups` | Create device group |
| `GET` | `/groups` | List groups |
| `GET` | `/groups/{id}` | Get group details |
| `DELETE` | `/groups/{id}` | Delete group (fails if active deployments) |
| `POST` | `/groups/{id}/members` | Add device to group |
| `DELETE` | `/groups/{id}/members/{device_id}` | Remove device from group |
| `GET` | `/groups/{id}/members` | List devices in group |

### Maintenance Windows

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/maintenance` | Create maintenance window |
| `GET` | `/maintenance` | List windows (query: `active_only`) |
| `GET` | `/maintenance/{id}` | Get single window |
| `PATCH` | `/maintenance/{id}` | Update window |
| `DELETE` | `/maintenance/{id}` | Delete window |

### Alerts, OTA & Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/alerts` | List alerts (filter: `resolved`, `severity`) |
| `POST` | `/alerts/{id}/resolve` | Resolve alert |
| `POST` | `/ota/update` | Push OTA update (202) |
| `GET` | `/health` | `{"status": "ok", "service": "fleet-control-plane"}` |

---

## gRPC Perception Service (port 50051)

Defined in `backend/src/perception_grpc/perception_service.py`.

| Method | Type | Description |
|--------|------|-------------|
| `GetLatestDetections` | Unary | Latest detection frame as JSON |
| `GetTelemetry` | Unary | Current telemetry metrics |
| `StreamDetections` | Server-streaming | Subscribe to detection events |
| `StreamTelemetry` | Server-streaming | Stream telemetry continuously |

### Detection Frame Format

```json
{
  "frame_index": 42,
  "timestamp": 1710500000.123,
  "detections": [
    { "label": "person", "confidence": 0.92, "bbox": { "x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.8 } }
  ],
  "source": "camera_0",
  "inference_ms": 12.5,
  "capture_ms": 3.2
}
```

---

## TypeScript Client Libraries

### OpenEyeClient (`src/lib/openeye-client.ts`)

```typescript
class OpenEyeClient {
  constructor(baseUrl: string)
  async health(): Promise<HealthResponse>
  async predict(file: File, prompt?: string): Promise<PredictionResult>
  async getConfig(): Promise<RuntimeConfig>
  async putConfig(config: RuntimeConfig): Promise<{ status: string }>
}

// Helpers
getStoredServerUrl(): string    // from localStorage
setStoredServerUrl(url: string): void
isCloudUrl(url: string): boolean
```

### OpenEyeWebSocket (`src/lib/openeye-ws.ts`)

```typescript
class OpenEyeWebSocket {
  constructor(url: string)
  get url(): string
  set url(newUrl: string)
  get connected(): boolean
  connect(): void
  disconnect(): void
  send(data: string): void
  subscribe(fn: Listener): () => void  // returns unsubscribe
  // Auto-reconnect: exponential backoff, max 10 attempts, cap 30s
}
```

### FleetClient (`src/lib/fleet-client.ts`)

```typescript
class FleetClient {
  constructor(baseUrl: string, token: string)

  // Devices
  registerDevice(req: DeviceRegisterRequest): Promise<DeviceResponse>
  listDevices(params?: { status?, device_type?, tag_key?, tag_value? }): Promise<DeviceResponse[]>
  getDevice(id: string): Promise<DeviceResponse>
  updateDevice(id: string, req: DeviceUpdateRequest): Promise<DeviceResponse>
  setTags(id: string, tags: Record<string, string>): Promise<DeviceResponse>
  setConfigOverrides(id: string, config: Record<string, unknown>): Promise<DeviceResponse>
  getResourceHistory(id: string, limit?: number): Promise<ResourceHistory[]>
  restartDevice(id: string): Promise<{ status: string; command_id: string }>
  decommissionDevice(id: string, req?: DecommissionRequest): Promise<DeviceResponse>
  batchOperation(req: BatchDeviceRequest): Promise<{ matched: number; commands: number }>

  // Deployments
  createDeployment(req: DeploymentCreateRequest): Promise<DeploymentResponse>
  listDeployments(status?: string): Promise<DeploymentResponse[]>
  getDeployment(id: string): Promise<DeploymentResponse>
  getDeploymentDevices(id: string): Promise<DeploymentDeviceStatusResponse[]>
  advanceDeployment(id: string): Promise<DeploymentResponse>
  pauseDeployment(id: string): Promise<DeploymentResponse>
  rollbackDeployment(id: string): Promise<DeploymentResponse>

  // Groups
  createGroup(req: DeviceGroupCreateRequest): Promise<DeviceGroupResponse>
  listGroups(): Promise<DeviceGroupResponse[]>
  getGroup(id: string): Promise<DeviceGroupResponse>
  deleteGroup(id: string): Promise<void>
  addGroupMember(groupId: string, deviceId: string): Promise<GroupMemberResponse>
  removeGroupMember(groupId: string, deviceId: string): Promise<void>
  listGroupMembers(groupId: string): Promise<DeviceResponse[]>
  setScalingPolicy(groupId: string, policy: AutoScalingPolicy): Promise<DeviceGroupResponse>

  // Maintenance
  createMaintenanceWindow(req): Promise<MaintenanceWindowResponse>
  listMaintenanceWindows(activeOnly?: boolean): Promise<MaintenanceWindowResponse[]>
  deleteMaintenanceWindow(id: string): Promise<void>

  // Alerts & OTA
  listAlerts(resolved?, severity?): Promise<FleetAlertResponse[]>
  resolveAlert(id: string): Promise<FleetAlertResponse>
  pushOTAUpdate(req: OTAUpdateRequest): Promise<{ status: string; command_count: number }>
}

// Helpers
getStoredFleetUrl(): string     // from localStorage
setStoredFleetUrl(url: string): void
```

### Credits API (`src/lib/cred-api.ts`)

```typescript
const credApi = {
  syncUser(token: string): Promise<{ ok: boolean }>
  getBalance(token: string): Promise<CreditBalance>
  deduct(token: string, amount: number, description: string): Promise<CreditBalance>
  createCheckout(token: string, tierId: string, successUrl: string, cancelUrl: string): Promise<CheckoutSession>
  getPricingTiers(token: string): Promise<PricingTier[]>
  getTransactions(token: string, page?: number, pageSize?: number): Promise<{ data: CreditTransaction[]; count: number }>
}
```

---

## React Hooks

### Connection, Streaming & Utility

| Hook | Returns | Notes |
|------|---------|-------|
| `useOpenEyeConnection()` | `{ serverUrl, setServerUrl, client, isConnected, healthData }` | Context provider for server connection |
| `useOpenEyeStream()` | `{ isStreaming, latestResult, metrics, modelParams, setModelParams, startStream, stopStream, videoRef }` | WebSocket camera streaming |
| `useAuth()` | `{ user, session, loading, signOut }` | Supabase auth context |
| `useIsMobile()` | `boolean` | Responsive breakpoint (768px) |
| `useScrollSpy(ids)` | `string` | Active section ID from IntersectionObserver |
| `useToast()` | `{ toasts, toast, dismiss }` | Toast notification system (max 1 concurrent) |

### Data Query Hooks (TanStack React Query)

| Hook | Refetch | Purpose |
|------|---------|---------|
| `useHealth()` | 5s | Server health check |
| `usePredict()` | mutation | Single file prediction |
| `useInferenceHistory(page, pageSize)` | — | Paginated inference history |
| `useSaveInference()` | mutation | Save inference to Supabase |
| `useApiKeys()` | — | User's API keys |
| `useDevices()` | — | User's devices |
| `useCreditBalance()` | 30s | Credit balance |
| `useDeductCredits()` | mutation | Deduct credits (optimistic) |
| `useCreateCheckout()` | mutation | Stripe checkout |
| `usePricingTiers()` | stale 5m | Pricing tiers |
| `useCreditTransactions(page, pageSize)` | — | Transaction history |
| `useSyncCredUser()` | mutation | Sync user with credit system (retry: 3) |

### Fleet Hooks (`useFleetQueries.ts`)

| Hook | Refetch | Purpose |
|------|---------|---------|
| `useFleetDevices(params?)` | 15s | List devices |
| `useFleetDevice(id)` | 10s | Single device |
| `useRegisterDevice()` | mutation | Register device |
| `useUpdateDevice()` | mutation | Update device |
| `useSetDeviceTags()` | mutation | Set tags |
| `useSetDeviceConfig()` | mutation | Config overrides |
| `useDeviceResourceHistory(id, limit)` | 15s | Resource metrics |
| `useRestartDevice()` | mutation | Restart command |
| `useDecommissionDevice()` | mutation | Decommission |
| `useFleetDeployments(status?)` | 10s | List deployments |
| `useFleetDeployment(id)` | 5s | Deployment detail |
| `useDeploymentDevices(id)` | 5s | Deployment device statuses |
| `useCreateDeployment()` | mutation | Create deployment |
| `useAdvanceDeployment()` | mutation | Advance stage |
| `useRollbackDeployment()` | mutation | Rollback |
| `useFleetGroups()` | — | List groups |
| `useCreateGroup()` | mutation | Create group |
| `useFleetAlerts(resolved?)` | 15s | Alerts |
| `useResolveAlert()` | mutation | Resolve alert |
| `usePushOTAUpdate()` | mutation | OTA update |
| `useFleetSummary()` | computed | Aggregate fleet stats |
| `useSetScalingPolicy()` | mutation | Auto-scaling policy |
| `useMaintenanceWindows(activeOnly?)` | — | List maintenance windows |
| `useCreateMaintenanceWindow()` | mutation | Create maintenance window |

---

## Key TypeScript Types

### Core Enums (`src/types/fleet.ts`)

```typescript
type DeviceStatus = "pending" | "online" | "offline" | "maintenance" | "error" | "decommissioned"
type DeviceType = "camera" | "robot" | "edge_node" | "gateway" | "drone"
type DeploymentStrategy = "canary" | "rolling" | "blue_green" | "all_at_once"
type DeploymentStatus = "pending" | "in_progress" | "paused" | "completed" | "rolling_back" | "rolled_back" | "failed"
type AlertSeverity = "info" | "warning" | "error" | "critical"
type AlertType = "device_offline" | "high_resource_usage" | "deployment_failed" | "ota_failed" | "heartbeat_missed" | "temperature_high" | "disk_full"
type CommandType = "restart" | "update_config" | "deploy_model" | "rollback_model" | "ota_update" | "decommission" | "collect_logs"
type CommandStatus = "pending" | "acked" | "in_progress" | "completed" | "failed"
```

### Device & Resource Types (`src/types/fleet.ts`)

```typescript
interface HardwareSpecs { cpu: string; cpu_cores: number; ram_gb: number; gpu: string; gpu_vram_gb: number; disk_gb: number; architecture: string }
interface ResourceUsage { cpu_percent: number; memory_percent: number; memory_used_gb: number; disk_percent: number; disk_used_gb: number }
interface HeartbeatRequest { device_id: string; status: DeviceStatus; firmware_version?: string; current_model_id?: string; current_model_version?: string; resource_usage?: ResourceUsage; ip_address?: string }
interface HeartbeatResponse { ack: boolean; commands: PendingCommand[] }
interface PendingCommand { command_id: string; command_type: CommandType; payload: Record<string, unknown> }
```

### Prediction Types (`src/types/openeye.ts`)

```typescript
interface PerformanceMetrics { fps: number; latency_ms: number; frame_count: number; gpu_usage?: number }
interface ModelParameters { confidence_threshold: number; nms_threshold: number; max_detections: number; class_filter: string[] }
interface InferenceHistoryRow { id: string; user_id: string; model: string; task: string; timestamp: string; image_width: number; image_height: number; image_source: string; object_count: number; objects_json: string; inference_ms: number; thumbnail_url?: string; created_at: string }
interface ApiKeyRow { id: string; user_id: string; name: string; key_prefix: string; key_hash: string; created_at: string; last_used_at?: string }
interface DeviceRow { id: string; user_id: string; name: string; device_type: string; server_url: string; last_seen_at?: string; created_at: string }
```

### Credits (`src/types/credits.ts`)

```typescript
const INFERENCE_CREDIT_COST = 1
interface CreditBalance { balance: number; user_id: string; project_id: string }
interface PricingTier { id: string; name: string; credits: number; price_cents: number; popular?: boolean }
interface CheckoutSession { url: string; session_id: string }
interface CreditTransaction { id: string; user_id: string; project_id: string; amount: number; type: "purchase" | "deduction" | "refund" | "bonus"; description: string; created_at: string }
```
