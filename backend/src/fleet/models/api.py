"""Hosted API response models for inference endpoints."""

from typing import Dict, List

from pydantic import BaseModel, Field


class BBox(BaseModel):
    x: float = Field(description="Left edge (0-1)")
    y: float = Field(description="Top edge (0-1)")
    w: float = Field(description="Width (0-1)")
    h: float = Field(description="Height (0-1)")


class DetectedObjectResponse(BaseModel):
    label: str = Field(description="Class label")
    confidence: float = Field(description="Detection confidence (0-1)")
    bbox: BBox = Field(description="Normalized bounding box")


class ImageInfoResponse(BaseModel):
    width: int = Field(description="Image width in pixels")
    height: int = Field(description="Image height in pixels")


class DetectResponse(BaseModel):
    model: str = "yolov8"
    objects: List[DetectedObjectResponse] = Field(default_factory=list)
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 1


class DepthResponse(BaseModel):
    model: str = "depth-anything-v2"
    depth_map: str = Field(description="Base64-encoded PNG depth map")
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 2


class DescribeResponse(BaseModel):
    model: str = "gpt-4o"
    description: str = Field(description="Natural language scene description")
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 3


class ModelInfo(BaseModel):
    id: str = Field(description="Model identifier")
    name: str = Field(description="Human-readable model name")
    task: str = Field(description="Task type (detection, depth, description)")
    credits_per_call: int = Field(description="Credit cost per API call")
    description: str = Field(default="", description="Model description")


class UsageResponse(BaseModel):
    balance: int = Field(description="Current credit balance")
    total_requests: int = Field(default=0, description="Total API requests in period")
    total_credits_used: int = Field(default=0, description="Total credits used in period")
    by_endpoint: Dict[str, int] = Field(default_factory=dict, description="Request counts by endpoint")
    daily_credits: Dict[str, int] = Field(default_factory=dict, description="Credits used per day")
    truncated: bool = Field(default=False, description="True if usage data exceeds 1,000 rows and was truncated")


class ErrorResponse(BaseModel):
    error: str = Field(description="Error type")
    message: str = Field(description="Human-readable error message")
    status_code: int = Field(description="HTTP status code")
