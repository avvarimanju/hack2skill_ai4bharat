# AvvarI for Bharat API Documentation

## Overview

The AvvarI for Bharat API provides endpoints for heritage site digitization, including QR code processing, AI-powered content generation, Q&A functionality, and analytics.

## Base URL

```
https://api.avvari-for-bharat.com/prod
```

For local development:
```
http://localhost:3000/dev
```

## Authentication

Currently, the API does not require authentication. This may be added in future versions.

## Common Response Format

All API responses follow this format:

```json
{
  "success": boolean,
  "data": any,
  "error": {
    "code": string,
    "message": string,
    "details": any
  },
  "timestamp": string,
  "requestId": string
}
```

## Endpoints

### Health Check

Check API health status.

**GET** `/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00Z",
  "service": "AvvarI for Bharat API"
}
```

### QR Code Processing

Process QR code scans and retrieve artifact information.

**POST** `/qr`

**Request Body:**
```json
{
  "qrData": "string",
  "sessionId": "string (optional)",
  "userPreferences": {
    "language": "en|hi|ta|te|bn|mr|gu|kn|ml|pa",
    "audioSpeed": 1.0,
    "volume": 0.8,
    "highContrast": false,
    "largeText": false,
    "audioDescriptions": false
  },
  "location": {
    "latitude": number,
    "longitude": number,
    "altitude": number
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "artifactId": "string",
    "siteId": "string",
    "artifactInfo": {
      "name": "string",
      "type": "pillar|statue|temple|carving|inscription|architecture|painting|artifact",
      "description": "string"
    },
    "sessionId": "string"
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "requestId": "string"
}
```

### Content Generation

Generate AI-powered multimedia content for artifacts.

**POST** `/content`

**Request Body:**
```json
{
  "artifactId": "string",
  "siteId": "string",
  "language": "en|hi|ta|te|bn|mr|gu|kn|ml|pa",
  "contentTypes": ["audio_guide", "video", "infographic", "text"],
  "userPreferences": {
    "language": "en|hi|ta|te|bn|mr|gu|kn|ml|pa",
    "audioSpeed": 1.0,
    "volume": 0.8
  },
  "sessionId": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "string",
    "content": {
      "audioUrl": "string",
      "videoUrl": "string",
      "infographicData": {},
      "text": "string"
    },
    "metadata": {
      "language": "string",
      "duration": number,
      "fileSize": number
    }
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "requestId": "string"
}
```

**GET** `/content/{artifactId}`

Retrieve existing content for an artifact.

**Query Parameters:**
- `language`: Language code (default: en)
- `contentType`: Type of content to retrieve

### Q&A Processing

Process questions using RAG-based AI system.

**POST** `/qa`

**Request Body:**
```json
{
  "question": "string",
  "sessionId": "string",
  "artifactId": "string (optional)",
  "siteId": "string (optional)",
  "language": "en|hi|ta|te|bn|mr|gu|kn|ml|pa"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "string",
    "confidence": number,
    "sources": [
      {
        "id": "string",
        "title": "string",
        "url": "string",
        "confidence": number
      }
    ],
    "suggestedFollowUps": ["string"],
    "language": "string"
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "requestId": "string"
}
```

**GET** `/qa/{sessionId}`

Get conversation history for a session.

### Analytics

Record analytics events and retrieve reports.

**POST** `/analytics`

**Request Body:**
```json
{
  "eventType": "qr_scan|content_view|content_generation|question_asked|session_start|session_end|error",
  "sessionId": "string",
  "siteId": "string (optional)",
  "artifactId": "string (optional)",
  "language": "string (optional)",
  "metadata": {}
}
```

**GET** `/analytics`

**Query Parameters:**
- `siteId`: Filter by heritage site
- `startDate`: Start date for report (ISO 8601)
- `endDate`: End date for report (ISO 8601)
- `reportType`: Type of report (usage|engagement|performance)

## Error Codes

- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_UNAVAILABLE`: External service unavailable

## Rate Limits

- 1000 requests per minute per IP
- 2000 burst requests per minute per IP

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`