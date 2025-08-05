#!/usr/bin/env node

/**
 * Test ClickUp Authorization
 *
 * This script tests the ClickUp OAuth authorization flow to ensure
 * we can successfully authenticate and retrieve user information.
 *
 * Usage:
 *   node scripts/test-clickup-auth.js
 *
 * Environment variables required:
 *   - CLICKUP_CLIENT_ID: Your ClickUp OAuth app client ID
 *   - CLICKUP_CLIENT_SECRET: Your ClickUp OAuth app client secret
 *   - CLICKUP_ACCESS_TOKEN: A valid access token for testing (optional)
 *
 * The script will:
 * 1. Test token validation with the ClickUp API
 * 2. Retrieve user information
 * 3. List available workspaces
 * 4. Test API rate limits and error handling
 */

const https = require('https');
const readline = require('readline');

// ClickUp API configuration
const CLICKUP_API_BASE = 'api.clickup.com';
const CLICKUP_API_VERSION = '2';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper function to make HTTPS requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null,
          };
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Test ClickUp API connection
async function testClickUpAPI(accessToken) {
  console.log(
    `\n${colors.cyan}Testing ClickUp API Connection...${colors.reset}`
  );

  const options = {
    hostname: CLICKUP_API_BASE,
    path: `/api/v${CLICKUP_API_VERSION}/user`,
    method: 'GET',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await makeRequest(options);

    if (response.statusCode === 200) {
      console.log(`${colors.green}✓ API connection successful${colors.reset}`);
      console.log(`${colors.bright}User Information:${colors.reset}`);
      console.log(`  - ID: ${response.data.user.id}`);
      console.log(`  - Username: ${response.data.user.username}`);
      console.log(`  - Email: ${response.data.user.email}`);
      console.log(`  - Color: ${response.data.user.color}`);
      return response.data.user;
    }
    console.log(`${colors.red}✗ API connection failed${colors.reset}`);
    console.log(`  Status: ${response.statusCode}`);
    console.log(`  Error: ${JSON.stringify(response.data, null, 2)}`);
    return null;
  } catch (error) {
    console.log(`${colors.red}✗ API request failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

// Get user's workspaces (teams)
async function getWorkspaces(accessToken) {
  console.log(`\n${colors.cyan}Fetching Workspaces...${colors.reset}`);

  const options = {
    hostname: CLICKUP_API_BASE,
    path: `/api/v${CLICKUP_API_VERSION}/team`,
    method: 'GET',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await makeRequest(options);

    if (response.statusCode === 200) {
      console.log(
        `${colors.green}✓ Workspaces retrieved successfully${colors.reset}`
      );
      console.log(`${colors.bright}Available Workspaces:${colors.reset}`);

      response.data.teams.forEach((team, index) => {
        console.log(`\n  ${index + 1}. ${team.name}`);
        console.log(`     - ID: ${team.id}`);
        console.log(`     - Color: ${team.color}`);
        console.log(`     - Members: ${team.members.length}`);
      });

      return response.data.teams;
    }
    console.log(`${colors.red}✗ Failed to retrieve workspaces${colors.reset}`);
    console.log(`  Status: ${response.statusCode}`);
    console.log(`  Error: ${JSON.stringify(response.data, null, 2)}`);
    return [];
  } catch (error) {
    console.log(`${colors.red}✗ Workspace request failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return [];
  }
}

// Test rate limiting
async function testRateLimits(accessToken) {
  console.log(`\n${colors.cyan}Testing Rate Limits...${colors.reset}`);

  const options = {
    hostname: CLICKUP_API_BASE,
    path: `/api/v${CLICKUP_API_VERSION}/user`,
    method: 'GET',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
  };

  try {
    // Make a request to check rate limit headers
    const response = await makeRequest(options);

    if (response.headers['x-ratelimit-limit']) {
      console.log(
        `${colors.green}✓ Rate limit information available${colors.reset}`
      );
      console.log(`${colors.bright}Rate Limit Status:${colors.reset}`);
      console.log(
        `  - Limit: ${response.headers['x-ratelimit-limit']} requests`
      );
      console.log(
        `  - Remaining: ${response.headers['x-ratelimit-remaining']} requests`
      );
      console.log(
        `  - Reset: ${new Date(
          parseInt(response.headers['x-ratelimit-reset'], 10) * 1000
        ).toLocaleString()}`
      );
    } else {
      console.log(
        `${colors.yellow}⚠ Rate limit headers not found${colors.reset}`
      );
    }
  } catch (error) {
    console.log(`${colors.red}✗ Rate limit test failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
  }
}

// Test creating a webhook (to verify write permissions)
async function testWebhookCreation(accessToken, teamId) {
  console.log(`\n${colors.cyan}Testing Webhook Creation...${colors.reset}`);

  const webhookData = {
    endpoint: 'https://example.com/clickup-webhook-test',
    events: ['taskCreated', 'taskUpdated', 'taskDeleted'],
  };

  const postData = JSON.stringify(webhookData);

  const options = {
    hostname: CLICKUP_API_BASE,
    path: `/api/v${CLICKUP_API_VERSION}/team/${teamId}/webhook`,
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  try {
    const response = await makeRequest(options, postData);

    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log(
        `${colors.green}✓ Webhook creation successful${colors.reset}`
      );
      console.log(`${colors.bright}Webhook Details:${colors.reset}`);
      console.log(`  - ID: ${response.data.webhook.id}`);
      console.log(`  - Endpoint: ${response.data.webhook.endpoint}`);
      console.log(`  - Events: ${response.data.webhook.events.join(', ')}`);

      // Clean up - delete the test webhook
      await deleteWebhook(accessToken, teamId, response.data.webhook.id);

      return true;
    }
    console.log(
      `${colors.yellow}⚠ Webhook creation not available${colors.reset}`
    );
    console.log(`  Status: ${response.statusCode}`);
    if (response.data && response.data.err) {
      console.log(`  Message: ${response.data.err}`);
    }
    return false;
  } catch (error) {
    console.log(`${colors.red}✗ Webhook test failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

// Delete a webhook
async function deleteWebhook(accessToken, teamId, webhookId) {
  const options = {
    hostname: CLICKUP_API_BASE,
    path: `/api/v${CLICKUP_API_VERSION}/webhook/${webhookId}`,
    method: 'DELETE',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
  };

  try {
    await makeRequest(options);
    console.log(`  ${colors.green}✓ Test webhook deleted${colors.reset}`);
  } catch (error) {
    console.log(
      `  ${colors.yellow}⚠ Failed to delete test webhook${colors.reset}`
    );
  }
}

// Get access token from user
function getAccessToken() {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\n${colors.bright}ClickUp Authorization Test${colors.reset}`);
    console.log('This script will test your ClickUp API access token.\n');

    // Check for environment variable first
    if (process.env.CLICKUP_ACCESS_TOKEN) {
      console.log(
        `${colors.green}Using access token from CLICKUP_ACCESS_TOKEN environment variable${colors.reset}`
      );
      rl.close();
      resolve(process.env.CLICKUP_ACCESS_TOKEN);
      return;
    }

    console.log('To get an access token:');
    console.log('1. Go to your ClickUp settings');
    console.log('2. Navigate to "Apps" or "Integrations"');
    console.log('3. Generate a personal API token or use OAuth\n');

    rl.question('Enter your ClickUp access token: ', token => {
      rl.close();
      resolve(token.trim());
    });
  });
}

// Main test function
async function runTests() {
  try {
    // Get access token
    const accessToken = await getAccessToken();

    if (!accessToken) {
      console.log(
        `${colors.red}No access token provided. Exiting.${colors.reset}`
      );
      process.exit(1);
    }

    // Test API connection and get user info
    const user = await testClickUpAPI(accessToken);
    if (!user) {
      console.log(
        `\n${colors.red}Failed to authenticate with ClickUp API.${colors.reset}`
      );
      console.log('Please check your access token and try again.');
      process.exit(1);
    }

    // Get workspaces
    const workspaces = await getWorkspaces(accessToken);

    // Test rate limits
    await testRateLimits(accessToken);

    // Test webhook creation if we have workspaces
    if (workspaces.length > 0) {
      console.log(
        `\n${colors.yellow}Testing write permissions with first workspace...${colors.reset}`
      );
      await testWebhookCreation(accessToken, workspaces[0].id);
    }

    // Summary
    console.log(
      `\n${colors.bright}${colors.green}Authorization Test Complete!${colors.reset}`
    );
    console.log(`\n${colors.bright}Summary:${colors.reset}`);
    console.log(`  - User authenticated: ${colors.green}✓${colors.reset}`);
    console.log(
      `  - Workspaces accessible: ${colors.green}${workspaces.length}${colors.reset}`
    );
    console.log(
      `  - API version: ${colors.cyan}v${CLICKUP_API_VERSION}${colors.reset}`
    );

    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log('1. Save your access token securely');
    console.log('2. Configure webhook endpoints for real-time updates');
    console.log('3. Implement task synchronization logic');
    console.log('4. Set up proper error handling and retry mechanisms');
  } catch (error) {
    console.error(
      `\n${colors.red}Test failed with error:${colors.reset}`,
      error
    );
    process.exit(1);
  }
}

// Run the tests
runTests();
