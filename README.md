# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

A local-first smart home integration platform that puts **you** back in control.

SALTA is a modern, modular and vendor-independent smart home platform designed to integrate multiple local ecosystems into a single, reliable automation layer—without requiring cloud services or a monolithic home automation system.

---

## Why SALTA?

Most smart home ecosystems become increasingly dependent on cloud services, vendor-specific apps, or large automation platforms.

SALTA takes a different approach.

Instead of replacing your existing infrastructure, SALTA connects and orchestrates it.

Every system continues doing what it does best while SALTA provides a unified device model, automation layer, diagnostics and HomeKit integration.

---

# Philosophy

SALTA is built around a few simple principles.

* 🏠 **Local First** – Your home continues working without Internet access.
* 🔒 **Privacy by Design** – Your data stays inside your network.
* 🔌 **Vendor Independent** – Use the devices you already own.
* 🧩 **Modular** – Every integration is an isolated adapter.
* ⚡ **Event Driven** – Instant updates instead of heavy polling.
* 🛡️ **Reliable** – Automatic reconnects and state reconciliation.
* 🍎 **HomeKit Native** – Apple Home is the preferred user interface.
* 🤖 **AI Optional** – AI is an assistant, never a dependency.

---

# Supported Platforms (Roadmap)

## Shelly

* Shelly Plug S
* Shelly 1
* Shelly 3EM Gen1
* Shelly 2PM Gen4 (Cover Mode)

## Zigbee

Using an existing **Phoscon / deCONZ** installation.

Supported device types include:

* Lights
* Smart Plugs
* Motion Sensors
* Contact Sensors
* Temperature Sensors
* Humidity Sensors
* Buttons
* Groups

---

## HomeMatic

Using an existing **OpenCCU** installation.

Initial focus:

* Classic HomeMatic thermostats

Future support:

* Additional HomeMatic devices
* Homematic IP

---

## Apple HomeKit

Using **HAP-NodeJS**

Supported accessory types include:

* Lights
* Outlets
* Switches
* Thermostats
* Window Coverings
* Sensors
* Motion Sensors
* Contact Sensors

---

# Architecture

```text
                     Apple Home
                          │
                    HomeKit Bridge
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        │            SALTA Core             │
        │                                   │
        ├───────────────────────────────────┤
        │ Device Registry                   │
        │ Event Bus                         │
        │ Command Service                   │
        │ Automation Engine                 │
        │ Diagnostics                       │
        │ REST API                          │
        │ Web UI                            │
        └──────┬──────────────┬─────────────┘
               │              │
      ┌────────┘              └─────────┐
      │                                 │
 Shelly Adapter                  deCONZ Adapter
      │                                 │
      └──────────────┬──────────────────┘
                     │
              OpenCCU Adapter

                     │
                 PostgreSQL
```

---

# Technology Stack

## Backend

* TypeScript
* Node.js
* Fastify
* PostgreSQL
* HAP-NodeJS
* Docker
* Docker Compose

## Frontend

* Modern responsive Web UI
* Flat Design
* Mobile-friendly
* Dark Mode support

## Infrastructure

* PostgreSQL
* REST API
* WebSockets
* Structured Logging
* Health Checks
* Metrics
* Docker

---

# Design Goals

SALTA is designed to be:

* Local-first
* Cloud-independent
* Event-driven
* Modular
* Extensible
* Reliable
* Secure
* Observable
* Easy to self-host

Every integration runs independently.

If one adapter fails, the remaining integrations continue operating.

---

# Planned Features

## Core

* Unified device registry
* Adapter framework
* Persistent device model
* PostgreSQL persistence
* Diagnostics
* Audit log
* User management

## Integrations

* Shelly
* Phoscon / deCONZ
* OpenCCU
* Apple HomeKit

Planned future integrations:

* Matter
* MQTT
* KNX
* Modbus
* Philips Hue
* ESPHome
* Tasmota

---

## Automation

* Local automation engine
* Event-based triggers
* Time-based triggers
* Conditions
* Actions
* Scheduler

---

## AI (Optional)

AI is completely optional.

When enabled it may assist with:

* Diagnostics
* Automation creation
* Device discovery
* Natural language control
* Configuration suggestions

The smart home must continue functioning normally when AI is disabled or unavailable.

---

# Current Status

🚧 **Early Development**

Current focus:

* Core architecture
* PostgreSQL persistence
* Device registry
* Mock adapters
* HomeKit bridge
* REST API
* Responsive Web UI
* Docker deployment

---

# Project Goals

SALTA is **not** another monolithic smart home platform.

It does not try to replace Phoscon, OpenCCU or Shelly.

Instead, SALTA provides a modern orchestration layer that connects existing local systems into one unified platform.

Think of SALTA as the operating system for your smart home.

---

# Name

**SALTA**

**S**mart-home
**A**bstraction &
**L**ocal
**T**ransport
**A**rchitecture

The name reflects the project's purpose:

A lightweight platform that abstracts different smart-home ecosystems while keeping all communication local.

---

# Contributing

Contributions, ideas and discussions are welcome.

The project aims to remain:

* Open Source
* Modular
* Well documented
* Easy to extend
* Easy to self-host

---

# License

License to be determined.

Current candidates:

* MIT
* Apache 2.0

---

# Vision

> **Your home. Your hardware. Your rules.**

SALTA believes your smart home should belong to you.

No mandatory cloud.

No vendor lock-in.

No subscriptions.

No unnecessary complexity.

Just a fast, reliable and local smart home platform.
