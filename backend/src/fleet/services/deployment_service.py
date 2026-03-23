"""Staged deployment orchestration service."""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from ..models import CommandType, DeploymentCreateRequest, DeploymentStatus

logger = logging.getLogger(__name__)


class DeploymentService:
    def __init__(self, sb: Client):
        self.sb = sb

    def create(self, user_id: str, req: DeploymentCreateRequest) -> Dict[str, Any]:
        if not req.rollout_stages:
            raise ValueError("At least one rollout stage is required")

        device_ids = self._resolve_target_devices(user_id, req.target_device_ids, req.target_group_id)
        if not device_ids:
            raise ValueError("No target devices found. Specify target_device_ids or a target_group_id with members.")

        row = {
            "user_id": user_id,
            "name": req.name,
            "model_id": req.model_id,
            "model_version": req.model_version,
            "model_url": req.model_url,
            "model_checksum": req.model_checksum,
            "strategy": req.strategy.value,
            "status": DeploymentStatus.PENDING.value,
            "rollout_stages": [s.model_dump() for s in req.rollout_stages],
            "current_stage": 0,
            "target_device_ids": req.target_device_ids,
            "target_group_id": req.target_group_id,
            "bandwidth_limit_mbps": req.bandwidth_limit_mbps,
        }
        result = self.sb.table("deployments").insert(row).execute()
        if not result.data:
            raise RuntimeError("Failed to insert deployment")
        deployment = result.data[0]

        # Create per-device status entries
        for did in device_ids:
            self.sb.table("deployment_device_status").insert({
                "deployment_id": deployment["id"],
                "device_id": did,
                "status": "pending",
                "stage": 0,
            }).execute()

        # Store current model version for rollback (use majority version across devices)
        dev_result = self.sb.table("devices").select("current_model_version").in_("id", device_ids).execute()
        if dev_result.data:
            versions = [d["current_model_version"] for d in dev_result.data if d.get("current_model_version")]
            if versions:
                rollback_ver = max(set(versions), key=versions.count)
                self.sb.table("deployments").update(
                    {"rollback_version": rollback_ver}
                ).eq("id", deployment["id"]).execute()
                deployment["rollback_version"] = rollback_ver

        return deployment

    def advance_stage(self, user_id: str, deployment_id: str) -> Dict[str, Any]:
        dep = self._get_deployment(user_id, deployment_id)
        stages = dep.get("rollout_stages", [])
        current = dep.get("current_stage", 0)
        next_stage = current + 1

        if dep["status"] not in (DeploymentStatus.PENDING.value, DeploymentStatus.IN_PROGRESS.value):
            raise ValueError(f"Cannot advance deployment in status {dep['status']}")
        if next_stage >= len(stages):
            raise ValueError("Already at final stage")

        # Enforce min_wait_seconds between stage transitions
        current_stage_def = stages[current] if current < len(stages) else {}
        min_wait = current_stage_def.get("min_wait_seconds", 0)
        # Check elapsed time since the current stage started (via per-device status timestamps)
        if min_wait:
            stage_started = dep.get("started_at")
            # Try to get a more accurate stage start time from device statuses
            try:
                dev_statuses = self.get_device_statuses(dep.get("user_id", ""), dep["id"])
                stage_times = [
                    ds.get("started_at") for ds in dev_statuses
                    if ds.get("stage") == current and ds.get("started_at")
                ]
                if stage_times:
                    stage_started = min(stage_times)
            except Exception:
                pass
            if stage_started:
                started = datetime.fromisoformat(stage_started)
                elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed < min_wait:
                remaining = int(min_wait - elapsed)
                raise ValueError(
                    f"Must wait {remaining}s more before advancing (min_wait_seconds={min_wait})"
                )

        stage_def = stages[next_stage]
        device_ids = self._resolve_target_devices(user_id, dep.get("target_device_ids", []), dep.get("target_group_id"))
        count = max(1, math.ceil(len(device_ids) * stage_def["percentage"] / 100))
        batch = device_ids[:count]

        # Queue deploy commands for this stage's devices
        for did in batch:
            self._enqueue_deploy_command(user_id, dep, did)
            self.sb.table("deployment_device_status").update(
                {"status": "in_progress", "stage": next_stage, "started_at": datetime.now(timezone.utc).isoformat()}
            ).eq("deployment_id", deployment_id).eq("device_id", did).execute()

        now = datetime.now(timezone.utc).isoformat()
        updates: Dict[str, Any] = {"current_stage": next_stage, "status": DeploymentStatus.IN_PROGRESS.value}
        if current == 0:
            updates["started_at"] = now
        result = self.sb.table("deployments").update(updates).eq("id", deployment_id).execute()
        return result.data[0] if result.data else dep

    def rollback(self, user_id: str, deployment_id: str) -> Dict[str, Any]:
        dep = self._get_deployment(user_id, deployment_id)
        rollback_version = dep.get("rollback_version")
        if not rollback_version:
            raise ValueError("No rollback version available")

        device_ids = self._resolve_target_devices(user_id, dep.get("target_device_ids", []), dep.get("target_group_id"))

        for did in device_ids:
            self.sb.table("device_commands").insert({
                "device_id": did,
                "user_id": user_id,
                "command_type": CommandType.ROLLBACK_MODEL.value,
                "payload": {"model_version": rollback_version},
                "status": "pending",
            }).execute()

        now = datetime.now(timezone.utc).isoformat()
        result = (
            self.sb.table("deployments")
            .update({"status": DeploymentStatus.ROLLING_BACK.value, "completed_at": now})
            .eq("id", deployment_id)
            .execute()
        )
        return result.data[0] if result.data else dep

    def pause(self, user_id: str, deployment_id: str) -> Dict[str, Any]:
        result = (
            self.sb.table("deployments")
            .update({"status": DeploymentStatus.PAUSED.value})
            .eq("id", deployment_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Deployment {deployment_id} not found")
        return result.data[0]

    def list_deployments(self, user_id: str, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        q = self.sb.table("deployments").select("*").eq("user_id", user_id)
        if status_filter:
            q = q.eq("status", status_filter)
        q = q.order("created_at", desc=True)
        return q.execute().data or []

    def get_deployment(self, user_id: str, deployment_id: str) -> Dict[str, Any]:
        return self._get_deployment(user_id, deployment_id)

    def get_device_statuses(self, user_id: str, deployment_id: str) -> List[Dict[str, Any]]:
        # Verify deployment ownership (defense-in-depth; router also checks)
        self._get_deployment(user_id, deployment_id)
        result = (
            self.sb.table("deployment_device_status")
            .select("*")
            .eq("deployment_id", deployment_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    # ── Internal helpers ──

    def _get_deployment(self, user_id: str, deployment_id: str) -> Dict[str, Any]:
        result = (
            self.sb.table("deployments")
            .select("*")
            .eq("id", deployment_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Deployment {deployment_id} not found")
        return result.data[0]

    def _resolve_target_devices(
        self, user_id: str, device_ids: List[str], group_id: Optional[str]
    ) -> List[str]:
        if device_ids:
            # Verify the user actually owns every specified device
            result = (
                self.sb.table("devices")
                .select("id")
                .eq("user_id", user_id)
                .in_("id", device_ids)
                .execute()
            )
            owned = {r["id"] for r in (result.data or [])}
            unauthorized = set(device_ids) - owned
            if unauthorized:
                raise PermissionError(
                    f"Devices not owned by user: {', '.join(sorted(unauthorized))}"
                )
            return device_ids
        if group_id:
            # Verify the user owns the group
            grp = (
                self.sb.table("device_groups")
                .select("id")
                .eq("id", group_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not grp.data:
                raise PermissionError(f"Group {group_id} not owned by user")
            result = (
                self.sb.table("device_group_members")
                .select("device_id")
                .eq("group_id", group_id)
                .execute()
            )
            return [r["device_id"] for r in (result.data or [])]
        return []

    def _enqueue_deploy_command(self, user_id: str, dep: Dict[str, Any], device_id: str) -> None:
        self.sb.table("device_commands").insert({
            "device_id": device_id,
            "user_id": user_id,
            "command_type": CommandType.DEPLOY_MODEL.value,
            "payload": {
                "deployment_id": dep["id"],
                "model_id": dep["model_id"],
                "model_version": dep["model_version"],
                "model_url": dep.get("model_url"),
                "model_checksum": dep.get("model_checksum"),
                "bandwidth_limit_mbps": dep.get("bandwidth_limit_mbps"),
            },
            "status": "pending",
        }).execute()
