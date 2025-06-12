# QuickChat Server Handling


## Backend Partner Assignment Logic

### User Connection Flow
- **User Connects**: Added to `connectedUsers` Map.
- **Start Chatting**: Emits `find_partner` event.

### Partner Assignment Process
- **Server Checks `waitingQueue`**: Uses random selection algorithm.
  - **If Partner Found**: Creates partnership via `createPartnership()`.
  - **If No Partner**: User is added to `waitingQueue` Set.

## Key Data Structures

| Data Structure | Description |
|---------------|-------------|
| `connectedUsers` | A Map containing all connected users. |
| `waitingQueue` | A Set of users waiting for partners. |
| `partnerships` | A Map of active chat partnerships. |

## Message Flow

1. **Client Sends Message**: Emits `send_message` event.
2. **Server Validation**: Validates the partnership.
3. **Message Forwarding**: Forwards the message to the partner.
4. **Partner Receives Message**: Receives `message_received` event.
