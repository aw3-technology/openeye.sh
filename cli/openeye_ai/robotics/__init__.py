"""OpenEye Robotics SDK — importable vision pipeline for robot control loops.

Usage::

    from openeye_ai.robotics import RobotVision, RobotVisionConfig

    vision = RobotVision(RobotVisionConfig(mode="edge", model="yolov8"))
    vision.start()

    result = vision.perceive(frame)
    result.objects        # DetectedObject3D list
    result.scene_graph    # SceneGraphData
    result.safety_alerts  # SafetyAlert list

    vision.stop()
"""

from openeye_ai.robotics.config import DeploymentMode, RobotVisionConfig
from openeye_ai.robotics.vision import RobotVision

__all__ = [
    "RobotVision",
    "RobotVisionConfig",
    "DeploymentMode",
]
