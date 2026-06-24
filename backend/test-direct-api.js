require('dotenv').config();

// Simple direct test to call getWatchHistory
async function test() {
  const { app } = await import('./src/app');
  const express = require('express');
  
  // Create a test app
  const testApp = express();
  testApp.use((req, res, next) => {
    // Mock auth
    req.user = { id: 1 };
    next();
  });
  
  // Mount routes
  const progressRoutes = await import('./src/modules/progress/progress.routes');
  testApp.use('/api/progress', progressRoutes.default);
  
  // Test getWatchHistory directly
  const { getWatchHistory } = await import('./src/modules/progress/progress.controller');
  
  const mockReq = { user: { id: 1 } };
  const mockRes = {
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.error('Error:', data) })
  };
  
  console.log('Testing getWatchHistory directly...\n');
  await getWatchHistory(mockReq, mockRes);
}

test().catch(e => console.error('Test error:', e));
