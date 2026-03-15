---
title: "From Hackathon to Open Source: The OpenEye Origin Story"
excerpt: "OpenEye started as a weekend project at a hackathon. It became something bigger when we realized the robotics industry needed open-source perception more than it needed another proprietary platform. Here's how it happened."
date: "2026-01-20"
author: "OpenEye Team"
category: "Story"
readTime: "7 min read"
---

OpenEye started at the Nebius.Build Hackathon in San Francisco. The original idea was modest: build a CLI tool that makes it easy to run computer vision models the way Ollama makes it easy to run language models. Pull a model, run it on an image, get structured output. Nothing revolutionary — just a quality-of-life improvement for robotics engineers who were tired of writing boilerplate model-loading code.

The hackathon prototype was 400 lines of Python. You could run `openeye detect image.jpg` and get JSON with bounding boxes. That was it. It worked, it was fast, and a few people said "oh, that's handy."

Then we started talking to robotics teams.

## The Conversations That Changed Everything

Over the following weeks, we had conversations with engineers at five different companies building robots for warehouses, hospitals, and construction sites. Every conversation followed the same pattern:

"How do you handle perception?"
"We have a custom pipeline. Took six months to build."

"How do you handle safety?"
"We have LiDAR curtains and emergency stops."

"How does the robot understand the scene?"
"It doesn't, really. It detects objects and follows waypoints."

"Can you audit the perception decisions?"
"No. The vendor's stack is a black box."

"What happens when you need to upgrade the detection model?"
"Major engineering project. We've been putting it off."

Every team had independently built a fragile, custom perception pipeline tightly coupled to specific hardware and specific models. Every team wanted something better. None of them had the bandwidth to build it — they were too busy maintaining what they had.

The pattern was clear. The robotics industry didn't need another proprietary perception platform. It needed an open-source foundation that any team could build on.

## The Pivot

We went back to the hackathon prototype and started redesigning. The original tool ran a single model on a single image. The new architecture needed to:

- Run multiple models in a pipeline (detection, scene understanding, reasoning)
- Process continuous video streams in real-time
- Support safety-critical applications with deterministic behavior
- Work with any camera and any robot platform
- Stream structured data to downstream systems
- Maintain persistent memory across sessions
- Be fully open source and community-driven

The six-layer architecture emerged from this redesign. Camera, Vision, Scene, LLM, Planning, Execution — each layer with clean boundaries and standard interfaces. The design was influenced by years of lessons from the robotics teams we talked to about what breaks in production perception systems.

## What We Learned Building It

Several principles crystallized during development:

**Terminal-first was the right call.** Every robotics engineer we talked to worked primarily in terminals. SSH into robots, run commands, inspect logs. A web dashboard would have been more visually impressive but less useful. The CLI-first design wasn't just a technical preference — it matched how the target users actually work.

**Structured data over video.** Early prototypes streamed processed video frames with overlaid bounding boxes. Teams didn't want this — they wanted structured JSON they could pipe into their existing systems. The switch to structured perception data (scene graphs, detection lists, hazard classifications) was one of our best design decisions.

**Safety can't be an afterthought.** We initially treated safety as a feature — something you could add to a detection pipeline. The conversations with robotics teams made it clear that safety needs to be architectural. The two-brain approach (fast detection + smart reasoning), zone-based monitoring, and the halt protocol all came from treating safety as a first-class concern, not a plugin.

**Memory is transformative.** The persistent memory system was the feature that most surprised people. Teams that were used to stateless frame-by-frame perception immediately saw the potential of a system that remembers environments, tracks changes, and learns patterns. Memory turned OpenEye from a perception tool into a perception system.

## The Community

The decision to open-source everything was deliberate. We'd seen what happened when critical infrastructure was proprietary — vendor lock-in, opaque failures, slow iteration. Robot perception is too important to be controlled by any single company.

The open-source community has already started shaping OpenEye in ways we didn't anticipate:

- A team in Munich contributed a thermal camera adapter for industrial applications
- A university lab in Tokyo integrated Grounding DINO for open-vocabulary detection
- A warehouse automation company in Atlanta contributed the MQTT streaming adapter
- Safety engineers from multiple countries have reviewed and hardened the halt protocol

This is the power of open source. The combined expertise of the global robotics community, focused on a shared foundation, producing better results than any single company could achieve alone.

## What's Next

OpenEye today is functional and deployed in real environments. But we're just getting started. The roadmap includes:

- **Multi-camera fusion**: Combining multiple camera views into a unified scene understanding
- **3D perception**: Depth estimation and 3D scene graph construction from monocular cameras
- **Sim-to-real transfer**: Training perception models in simulation and deploying them on physical robots
- **Edge optimization**: Running the full pipeline on embedded hardware (Jetson, Raspberry Pi 5)
- **Perception benchmarks**: Standardized benchmarks for robot perception accuracy and safety

The hackathon prototype was 400 lines. The current codebase is substantially larger. But the core idea hasn't changed: robot perception should be open, standard, and accessible to everyone building the future of autonomous systems.

We started with a CLI tool. We're building infrastructure. And we're doing it in the open, because that's the only way it works.
