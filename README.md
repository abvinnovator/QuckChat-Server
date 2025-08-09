# QuickChat Server

A real-time anonymous chat application built with Node.js and Socket.IO, enabling users to connect with random partners for instant messaging.

## ☁️ AWS Deployment

This application is deployed on **AWS Elastic Beanstalk** with full WebSocket support.

### Deployment Configuration

#### 1. WebSocket Configuration
Created `.ebextensions/01_websocket.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx
  aws:elasticbeanstalk:environment:proxy:nginx:
    WebSockets: true
```

#### 2. Setup AWS CLI & EB CLI

```bash

pip install awscli awsebcli

aws configure
```

#### 3. Initialize & Deploy

```bash

eb init

eb create production

eb deploy
```

#### 4. Environment Configuration

```bash

eb setenv NODE_ENV=production PORT=8080
```

### Deployment Features
- ✅ Auto-scaling based on traffic
- ✅ Load balancing for high availability  
- ✅ Health monitoring and auto-recovery
- ✅ SSL/HTTPS support
- ✅ WebSocket proxy configuration

## 🔗 API Events

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `find_partner` | - | Request to find a chat partner |
| `send_message` | `{ message: string }` | Send message to current partner |
| `disconnect` | - | User disconnection |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `partner_found` | - | Successfully matched with partner |
| `waiting_for_partner` | - | Added to waiting queue |
| `message_received` | `{ message: string }` | Received message from partner |
| `partner_disconnected` | - | Chat partner has disconnected |

## 🏗️ Project Structure

```
quickchat-server/
├── .ebextensions/
│   └── 01_websocket.config     # AWS EB WebSocket config
├── public/                     # Static files
├── server.js                   # Main server file
├── package.json               # Dependencies & scripts
└── README.md                  # Project documentation
```


---

## 🚀 Features

### Real-Time Chat System
- **Anonymous Connections**: Users can chat without registration
- **Random Partner Matching**: Intelligent partner assignment using queue-based algorithm
- **Live Messaging**: Real-time message exchange with Socket.IO
- **Connection Management**: Automatic handling of user connections and disconnections

### Backend Architecture

#### User Connection Flow
- **User Connects**: Added to `connectedUsers` Map with unique socket ID
- **Find Partner**: User emits `find_partner` event to join chat queue
- **Partner Assignment**: Server matches users using random selection algorithm
- **Chat Session**: Paired users can exchange messages in real-time

#### Core Data Structures

| Structure | Type | Purpose |
|-----------|------|---------|
| `connectedUsers` | Map | Stores all active socket connections |
| `waitingQueue` | Set | Queue of users waiting for chat partners |
| `partnerships` | Map | Active chat partnerships between users |

### Message Handling Process

1. **Message Sent**: Client emits `send_message` event
2. **Server Validation**: Validates active partnership exists
3. **Message Relay**: Forwards message to partner's socket
4. **Message Delivery**: Partner receives `message_received` event

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Real-time Communication**: Socket.IO
- **Web Framework**: Express.js
- **Deployment**: AWS Elastic Beanstalk
- **Proxy Server**: Nginx (for WebSocket support)

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd quickchat-server

# Install dependencies
npm install

# Start development server
npm start

# Server will run on http://localhost:3000
```

### Environment Variables

```bash
PORT=3000
NODE_ENV=development
```
