---
title: "Why We Built a CLI Instead of a Dashboard"
excerpt: "Everyone expects a perception platform to ship with a slick web dashboard. We shipped a terminal command instead. Here's the reasoning behind OpenEye's CLI-first design — and why it's actually better for production robotics."
date: "2026-03-05"
author: "OpenEye Team"
category: "Design Philosophy"
readTime: "7 min read"
---

When we first showed OpenEye to robotics engineers, the most common question was: "Where's the dashboard?" They expected a web UI with live camera feeds, detection overlays, charts, and configuration panels. Instead, we showed them a terminal:

```
$ openeye detect image.jpg
```

Some people got it immediately. Others needed convincing. Here's the argument.

## Dashboards Are for Watching. CLIs Are for Doing.

A dashboard is a monitoring tool. You look at it. A CLI is an automation tool. You script it, pipe it, chain it, schedule it, and embed it in larger systems. In production robotics, you need the latter far more than the former.

Consider the workflow for deploying perception on a fleet of warehouse robots. With a dashboard, someone sits at a screen and configures each robot through a web interface. With a CLI, you write a deployment script that configures all of them:

```bash
for robot in $(cat fleet.txt); do
  ssh $robot "openeye watch --reason --halt-on hazard --stream grpc://controller:50051"
done
```

That's fleet-wide safety perception deployed in four lines. No clicking through menus. No manual configuration. Reproducible, version-controlled, auditable.

## Composition Over Configuration

The Unix philosophy — small tools that do one thing well, composed through pipes — is one of the most successful software design patterns in history. We built OpenEye to work the same way.

```bash
openeye detect camera://0 | jq '.objects[] | select(.confidence > 0.9)' | openeye plan --stdin
```

Detection piped through a confidence filter piped into planning. Each piece is simple. The composition is powerful. You can't do this with a dashboard.

This matters because every deployment is different. A warehouse needs different confidence thresholds than a hospital. A construction site needs different hazard classifications than a kitchen. The CLI lets teams build exactly the pipeline they need by composing standard building blocks.

## SSH-First Operations

Robots are typically headless machines on a network. You access them via SSH. A CLI that runs over SSH is immediately accessible on every robot you can connect to. A web dashboard needs a browser, needs a port forwarded, needs CORS configured, needs authentication set up.

In practice, most robotics engineers spend their time in terminals. The CLI meets them where they are.

```bash
ssh robot@192.168.1.42 "openeye watch --reason"
```

Real-time perception, streamed back to your terminal, from any robot on the network. No setup, no configuration, no browser.

## Scriptability Is a Feature

Every OpenEye command outputs structured JSON by default. This makes it trivially scriptable:

```bash
# Log all hazard events to a file
openeye watch --reason | jq 'select(.hazards | length > 0)' >> /var/log/hazards.jsonl

# Trigger an alert when confidence drops
openeye detect stream://cam0 | jq -r 'if .avg_confidence < 0.7 then "LOW_CONFIDENCE" else empty end' | xargs -I{} notify-send {}

# Count objects per category over time
openeye watch | jq '.objects[].class' | sort | uniq -c | sort -rn
```

This isn't complexity for its own sake. This is production robotics, where perception needs to integrate with logging systems, monitoring dashboards, alerting pipelines, and other automation tools. A CLI with structured output does this natively. A dashboard requires an API, webhooks, or screen scraping.

## But What About Visualization?

Fair question. Sometimes you genuinely need to see what the robot sees. We handle this two ways:

1. **Terminal visualization**: `openeye watch` renders a live text representation of the scene in your terminal. Colored object labels, spatial positions, hazard indicators — all in a terminal UI that works over SSH.

2. **Streaming output**: `openeye stream` pushes structured data over gRPC or REST. You can build any visualization you want on top of this — a web dashboard, a mobile app, a VR overlay. The perception engine doesn't need to know or care about the frontend.

We didn't skip visualization. We decoupled it from the perception engine, because they have different requirements and different release cycles.

## The ffmpeg Analogy

We describe OpenEye as "ffmpeg for machine perception." That comparison is deliberate. ffmpeg doesn't have a GUI. It's a command-line tool that processes video. And it's the backbone of nearly every video platform on the internet — YouTube, Netflix, Twitch all use it.

ffmpeg succeeded because it focused on being a reliable, composable, scriptable engine. The GUIs came later, built on top by other teams. OpenEye follows the same path: be the best perception engine, and let the interfaces emerge.

The CLI isn't a temporary solution until we build a "real" UI. The CLI is the product. And we think that's exactly right for production robotics.
