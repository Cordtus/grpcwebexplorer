# gRPC Explorer Web UI

Web interface for exploring and interacting with gRPC services using reflection.

## Features

- Connect to gRPC servers with reflection enabled
- Dynamic service and method discovery
- Hierarchical navigation (chain > module > service > methods)
- Parameter form generation based on protobuf definitions
- TLS/non-TLS connection support
- JSON response viewer with filtering and formatting
- Suppoprts multiple endpoints per network

## Prerequisites

- Node.js v14+
- Yarn (or npm
- [grpcurl](https://github.com/fullstorydev/grpcurl) *make sure to confgiure in PATH*

## Installation

```bash
# Clone repository
git clone <repo-url> grpc-explorer-web
cd grpc-explorer-web

# Install dependencies and bootstrap project
yarn install
yarn bootstrap

# Start development server
yarn dev
