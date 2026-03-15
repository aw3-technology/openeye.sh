---
title: "Building Safety Systems That Actually Stop the Robot"
excerpt: "Most robot safety systems are advisory — they detect hazards and send alerts. OpenEye's safety pipeline is interventionist. It detects hazards and stops the robot. Here's the engineering behind making that reliable."
date: "2026-02-05"
author: "OpenEye Team"
category: "Safety"
readTime: "9 min read"
---

There's a meaningful difference between a safety system that says "danger detected" and one that actually stops the robot. The first is a monitoring tool. The second is a safety system. Most deployed robot perception systems are the first kind — they detect and report, but the actual intervention is left to other subsystems or human operators.

This is like a fire alarm that detects smoke but doesn't trigger the sprinklers. Useful, but not sufficient.

## The Intervention Gap

The typical architecture for robot safety looks like this:

1. Perception system detects a potential hazard
2. Perception system sends an alert to a monitoring dashboard
3. A human operator sees the alert (eventually)
4. The operator decides whether to intervene
5. The operator sends a stop command to the robot

The latency in this loop is measured in seconds — sometimes minutes. In that time, a robot arm has completed dozens of motion cycles. The hazard may have already caused harm before the operator even sees the alert.

This isn't a technology limitation. It's an architecture decision. Most perception vendors separate detection from intervention because intervention is scary. Stopping a robot has consequences — production delays, workflow disruptions, potential damage to the robot or workpiece. No one wants their perception system to cause unnecessary stops.

But the alternative — a perception system that detects hazards but can't act on them — is a system that only works when a human is watching.

## OpenEye's Safety Pipeline

OpenEye's safety system is designed to be interventionist from the ground up. The architecture has three stages:

### Stage 1: Continuous Monitoring
The fast brain (YOLO detection) runs at camera framerate, classifying every object in the scene and computing spatial relationships. Objects are assigned to zones:

- **Green zone**: Normal operating area. No restrictions.
- **Yellow zone**: Proximity alert area. Robot should slow down. Monitoring intensified.
- **Red zone**: Immediate hazard area. Robot must stop if a specified object type (human body part, unexpected obstacle) enters this zone.

Zone definitions are configurable per deployment. A collaborative assembly station has different zones than an autonomous warehouse.

### Stage 2: Hazard Classification
When an object enters a yellow or red zone, the hazard classifier evaluates the threat. Not every object in a red zone is a hazard — a tool that the robot is supposed to pick up should be in the red zone. A human hand should not be.

The classifier uses:
- Object class (human, tool, obstacle, unknown)
- Velocity and trajectory
- Historical context (has this object been in this zone before?)
- Smart brain analysis when available (contextual risk assessment)

The output is a hazard score from 0 (no risk) to 1 (immediate danger), along with a classification:
- **CLEAR**: No hazard. Continue normal operation.
- **CAUTION**: Potential hazard. Reduce speed, increase monitoring.
- **HALT**: Confirmed hazard. Stop the robot immediately.

### Stage 3: Intervention
When a HALT classification is issued, OpenEye sends a stop signal directly to the robot's motion controller through the configured adapter. This isn't a suggestion in a log file. It's a command on the control channel.

The intervention is:
- **Immediate**: The signal is sent within one frame of the HALT classification. At 30fps, that's 33ms.
- **Logged**: Every intervention is recorded with the full perception context — the frame, the detections, the scene graph, the hazard classification, and the zone state. This creates an auditable record.
- **Resumable**: The robot doesn't restart automatically. An operator must acknowledge the hazard and explicitly resume operation. The system is a guardian, not a dictator — but it errs on the side of caution.

## Making It Reliable

The hardest part of interventionist safety isn't the detection or the signaling — it's the reliability. A safety system that produces false stops is useless because operators will disable it. A safety system that misses real hazards is dangerous. You need high precision (few false positives) and high recall (few missed hazards).

### Reducing False Positives
False positives — stopping the robot when there's no real hazard — are the number one reason safety systems get disabled in production. We reduce them through:

**Zone calibration**: Zones are precisely defined for each deployment using the robot's actual kinematic model and motion envelope. The red zone isn't an arbitrary radius — it's the area where the robot can't stop before reaching an intruding object.

**Object classification thresholds**: The system only triggers halts for specific object classes at specific confidence levels. A shadow that might be classified as "unknown object" at 30% confidence doesn't trigger a halt. A hand classified at 85% confidence does.

**Temporal filtering**: A single frame with a detection in the red zone doesn't immediately trigger a halt. The system requires consistent detection across multiple frames (configurable, default 3 frames / ~100ms) before escalating to HALT. This eliminates transient false detections while maintaining safety margins.

**Smart brain confirmation**: When available, the VLM provides a second opinion on hazard classifications. If the fast brain says "hazard" but the smart brain says "that's the operator's tool, this is expected," the system can downgrade to CAUTION instead of HALT.

### Maximizing Recall
Missing a real hazard is the unforgivable failure mode. We maximize recall through:

**Conservative defaults**: The system ships with thresholds tuned for high recall. It's easier to reduce sensitivity after deployment than to explain why the system missed a hazard.

**Multi-model detection**: The fast brain runs object detection, but the safety pipeline also monitors for anomalies — anything in the scene that doesn't match the expected pattern, even if it's not classified as a specific object type. Unknown objects in the red zone get a HALT classification by default.

**Degradation handling**: If the detection model fails, the camera drops frames, or any component of the safety pipeline becomes unreliable, the system fails closed — it triggers a halt and alerts the operator that safety monitoring is degraded.

## The Trust Problem

The fundamental challenge with interventionist safety is trust. Teams need to trust the system enough to give it control over the robot's motion. That trust is built through:

1. **Transparency**: Every decision is logged and inspectable. Teams can review why every halt was triggered.
2. **Configurability**: Teams can adjust thresholds, zones, and behaviors for their specific deployment.
3. **Gradual deployment**: Start in advisory mode (detect and log, don't stop). Review the decisions. When confidence is high, enable intervention mode.
4. **Open source**: If you don't trust the logic, read it. Modify it. Test it. You're never relying on a black box.

```bash
# Start in advisory mode
openeye watch --reason --safety advisory

# When ready, enable intervention
openeye watch --reason --safety interventionist --halt-on hazard
```

Safety systems that can't stop the robot aren't safety systems — they're dashboards with concerning data. OpenEye builds the kind that actually keeps people safe.
