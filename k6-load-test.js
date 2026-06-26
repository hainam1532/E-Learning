/**
 * K6 Load Test for E-Learning System
 * Test scenarios:
 * 1. Login with 200 concurrent users
 * 2. Video streaming with 200 concurrent users
 * 
 * How to run:
 * 1. Install k6: https://k6.io/docs/getting-started/installation/
 * 2. Run test: k6 run k6-load-test.js
 * 
 * Options:
 * - Single scenario: k6 run k6-load-test.js --env SCENARIO=login
 * - Custom vus: k6 run k6-load-test.js --vus 200 --duration 30s
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ==================== CONFIG ====================
const BASE_URL = __ENV.BASE_URL || 'http://10.30.2.247:5000';
const SCENARIO = __ENV.SCENARIO || 'all'; // login, video, all

// Custom metrics
const loginErrors = new Counter('login_errors');
const loginSuccess = new Counter('login_success');
const videoStreamErrors = new Counter('video_stream_errors');
const videoStreamSuccess = new Counter('video_stream_success');
const loginDuration = new Trend('login_duration');
const videoStreamDuration = new Trend('video_stream_duration');
const loginFailureRate = new Rate('login_failure_rate');
const videoStreamFailureRate = new Rate('video_stream_failure_rate');

// ==================== TEST DATA ====================
// Test users - in real scenario, you would fetch these from database
// Using a pool of test users for concurrent login testing
const testUsers = [
  { usercode: '0017471', password: '123456' },
];

// Video ID to test - will be fetched dynamically
let testVideoId = null;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get a random test user
 */
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

/**
 * Get auth token by logging in
 */
function login(user) {
  const url = `${BASE_URL}/api/auth/login`;
  const payload = JSON.stringify({
    usercode: user.usercode,
    password: user.password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;
  
  loginDuration.add(duration);

  if (res.status === 200) {
    loginSuccess.add(1);
    loginFailureRate.add(0);
    try {
      const body = JSON.parse(res.body);
      return body.accessToken;
    } catch (e) {
      loginErrors.add(1);
      loginFailureRate.add(1);
      return null;
    }
  } else {
    loginErrors.add(1);
    loginFailureRate.add(1);
    return null;
  }
}

/**
 * Fetch video streaming URL
 */
function getVideoStreamUrl(videoId, token) {
  const url = `${BASE_URL}/api/videos/${videoId}/stream`;
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const res = http.get(url, params);
  const duration = Date.now() - startTime;
  
  videoStreamDuration.add(duration);

  if (res.status === 200) {
    videoStreamSuccess.add(1);
    videoStreamFailureRate.add(0);
    try {
      const body = JSON.parse(res.body);
      return body.data?.streamUrl;
    } catch (e) {
      videoStreamErrors.add(1);
      videoStreamFailureRate.add(1);
      return null;
    }
  } else {
    videoStreamErrors.add(1);
    videoStreamFailureRate.add(1);
    return null;
  }
}

/**
 * Get video list
 */
function getVideos(token) {
  const url = `${BASE_URL}/api/videos`;
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.get(url, params);

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.data && body.data.length > 0) {
        // Find first completed video
        const completedVideo = body.data.find(v => v.status === 'COMPLETED');
        return completedVideo || body.data[0];
      }
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Get user profile (requires auth)
 */
function getProfile(token) {
  const url = `${BASE_URL}/api/auth/profile`;
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.get(url, params);
  return res.status === 200;
}

// ==================== TEST SCENARIOS ====================

/**
 * Login Test - Simulates concurrent user logins
 */
export function loginTest() {
  group('Login Test', () => {
    const user = getRandomUser();
    
    // Attempt login
    const token = login(user);
    
    // Verify we got a token
    check(token, {
      'login successful': (t) => t !== null,
    });

    // If we got a token, verify it's valid
    if (token) {
      const valid = getProfile(token);
      check(valid, {
        'token valid': (v) => v === true,
      });
    }

    sleep(1);
  });
}

/**
 * Video Streaming Test - Simulates concurrent video viewing
 */
export function videoStreamingTest() {
  group('Video Streaming Test', () => {
    // First, login to get token
    const user = getRandomUser();
    const token = login(user);
    
    if (!token) {
      videoStreamErrors.add(1);
      videoStreamFailureRate.add(1);
      return;
    }

    // If no video ID, fetch one
    if (!testVideoId) {
      const video = getVideos(token);
      if (video) {
        testVideoId = video.id;
      }
    }

    if (!testVideoId) {
      videoStreamErrors.add(1);
      videoStreamFailureRate.add(1);
      return;
    }

    // Get video stream URL
    const streamUrl = getVideoStreamUrl(testVideoId, token);
    
    // Verify we got a stream URL
    check(streamUrl, {
      'got stream URL': (s) => s !== null,
    });

    sleep(1);
  });
}

/**
 * Combined Test - Login + Video Streaming
 */
export function combinedTest() {
  group('Combined Test', () => {
    const user = getRandomUser();
    
    // Step 1: Login
    const token = login(user);
    
    check(token, {
      'login successful': (t) => t !== null,
    });

    if (!token) {
      videoStreamFailureRate.add(1);
      return;
    }

    // Step 2: Get videos
    const video = getVideos(token);
    
    if (video && !testVideoId) {
      testVideoId = video.id;
    }

    if (!testVideoId) {
      videoStreamErrors.add(1);
      videoStreamFailureRate.add(1);
      return;
    }

    // Step 3: Get streaming URL
    const streamUrl = getVideoStreamUrl(testVideoId, token);
    
    check(streamUrl, {
      'got stream URL': (s) => s !== null,
    });

    sleep(1);
  });
}

// ==================== MAIN EXECUTION ====================

/**
 * Default function - runs for each VU
 */
export default function () {
  if (SCENARIO === 'login') {
    loginTest();
  } else if (SCENARIO === 'video') {
    videoStreamingTest();
  } else {
    combinedTest();
  }
}

/**
 * Setup function - runs once at the start
 */
export function setup() {
  console.log(`Starting K6 Load Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Scenario: ${SCENARIO}`);
  
  // Test connectivity
  const healthRes = http.get(`${BASE_URL}/api/health`);
  console.log(`Health check: ${healthRes.status}`);
  
  // Try to get a test user token to fetch videos
  const user = getRandomUser();
  const token = login(user);
  
  if (token) {
    const video = getVideos(token);
    if (video) {
      testVideoId = video.id;
      console.log(`Test video ID: ${testVideoId}`);
    }
  }
  
  return { testVideoId };
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  console.log(`Test completed`);
  console.log(`Test video used: ${testVideoId}`);
}

// ==================== OPTIONS ====================

export const options = {
  // Run test for 30 seconds with up to 200 virtual users
  scenarios: {
    // Load test: ramp up to 200 users over 30s, hold for 1m, ramp down
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 }, // ramp up to 200 users
        { duration: '1m', target: 200 },   // hold at 200 users
        { duration: '30s', target: 0 },  // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },

  // Thresholds
  thresholds: {
    // Login should complete within 2s
    login_duration: ['p(95)<2000'],
    // Video streaming should complete within 3s
    video_stream_duration: ['p(95)<3000'],
    // Login failure rate should be less than 5%
    login_failure_rate: ['rate<0.05'],
    // Video streaming failure rate should be less than 5%
    video_stream_failure_rate: ['rate<0.05'],
  },
};
