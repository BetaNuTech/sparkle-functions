#!/usr/bin/env node

/**
 * Set up ClickUp test structure for Sparkle integration testing
 * 
 * Creates the following hierarchy in ClickUp:
 * Workspace: Bluecrest Residential
 *   └── Space: "Test Property" 
 *       └── Folder: "Sparkle"
 *           ├── List: "Deficient Items"
 *           └── List: "Jobs"
 * 
 * Usage: node scripts/setup-clickup-test-structure.js
 * Requires: CLICKUP_API_TOKEN environment variable
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
try {
  const cwd = process.cwd();
  dotenv.config({ path: `${cwd}/.env` });
  dotenv.config({ path: path.resolve(`${cwd}/..`, '.env') });
  dotenv.config({ path: path.resolve(`${cwd}/../..`, '.env') });
} catch (err) {} // eslint-disable-line no-empty

const clickupService = require('../services/clickup');

async function setupTestStructure() {
  const apiToken = process.env.CLICKUP_API_TOKEN;
  const workspaceId = '20656884'; // Bluecrest Residential workspace
  
  console.log('🏗️ Setting up ClickUp test structure for Sparkle integration...');
  
  try {
    // Step 1: Check if "Test Property" space exists
    console.log('\n📍 Step 1: Checking for "Test Property" space...');
    const spacesResponse = await clickupService.fetchSpaces(apiToken, workspaceId);
    
    let testPropertySpace = spacesResponse.spaces.find(space => 
      space.name === 'Test Property'
    );
    
    if (testPropertySpace) {
      console.log(`✅ Found existing "Test Property" space (ID: ${testPropertySpace.id})`);
    } else {
      console.log('📝 Creating "Test Property" space...');
      testPropertySpace = await clickupService.createSpace(apiToken, workspaceId, {
        name: 'Test Property',
        multiple_assignees: true,
        features: {
          due_dates: {
            enabled: true,
            start_date: true,
            remap_due_dates: false,
            remap_closed_due_date: false
          },
          time_tracking: {
            enabled: true
          },
          tags: {
            enabled: true
          },
          time_estimates: {
            enabled: true
          },
          checklists: {
            enabled: true
          },
          custom_fields: {
            enabled: true
          },
          remap_dependencies: {
            enabled: false
          },
          dependency_warning: {
            enabled: false
          },
          portfolios: {
            enabled: false
          }
        }
      });
      console.log(`✅ Created "Test Property" space (ID: ${testPropertySpace.id})`);
    }

    // Step 2: Check if "Sparkle" folder exists
    console.log('\n📁 Step 2: Checking for "Sparkle" folder...');
    const foldersResponse = await clickupService.fetchFolders(apiToken, testPropertySpace.id);
    
    let sparkleFolder = foldersResponse.folders.find(folder => 
      folder.name === 'Sparkle'
    );
    
    if (sparkleFolder) {
      console.log(`✅ Found existing "Sparkle" folder (ID: ${sparkleFolder.id})`);
    } else {
      console.log('📝 Creating "Sparkle" folder...');
      sparkleFolder = await clickupService.createFolder(apiToken, testPropertySpace.id, {
        name: 'Sparkle',
        hidden: false
      });
      console.log(`✅ Created "Sparkle" folder (ID: ${sparkleFolder.id})`);
    }

    // Step 3: Check if "Deficient Items" list exists
    console.log('\n📋 Step 3: Checking for "Deficient Items" list...');
    const listsResponse = await clickupService.fetchFolderLists(apiToken, sparkleFolder.id);
    
    let deficientItemsList = listsResponse.lists.find(list => 
      list.name === 'Deficient Items'
    );
    
    if (deficientItemsList) {
      console.log(`✅ Found existing "Deficient Items" list (ID: ${deficientItemsList.id})`);
    } else {
      console.log('📝 Creating "Deficient Items" list...');
      deficientItemsList = await clickupService.createList(apiToken, sparkleFolder.id, {
        name: 'Deficient Items',
        content: 'List for testing deficient item creation and management from Sparkle'
      });
      console.log(`✅ Created "Deficient Items" list (ID: ${deficientItemsList.id})`);
    }

    // Step 4: Check if "Jobs" list exists
    console.log('\n💼 Step 4: Checking for "Jobs" list...');
    
    let jobsList = listsResponse.lists.find(list => 
      list.name === 'Jobs'
    );
    
    if (jobsList) {
      console.log(`✅ Found existing "Jobs" list (ID: ${jobsList.id})`);
    } else {
      console.log('📝 Creating "Jobs" list...');
      jobsList = await clickupService.createList(apiToken, sparkleFolder.id, {
        name: 'Jobs',
        content: 'List for testing job creation and management from Sparkle'
      });
      console.log(`✅ Created "Jobs" list (ID: ${jobsList.id})`);
    }

    // Step 5: Get status information for both lists
    console.log('\n🎯 Step 5: Checking list statuses...');
    
    const deficientItemsDetails = await clickupService.fetchList(apiToken, deficientItemsList.id);
    const jobsDetails = await clickupService.fetchList(apiToken, jobsList.id);
    
    console.log('\n📊 Deficient Items List Statuses:');
    deficientItemsDetails.statuses.forEach((status, index) => {
      console.log(`   ${index + 1}. "${status.status}" (${status.type}, color: ${status.color})`);
    });
    
    console.log('\n📊 Jobs List Statuses:');
    jobsDetails.statuses.forEach((status, index) => {
      console.log(`   ${index + 1}. "${status.status}" (${status.type}, color: ${status.color})`);
    });

    console.log('\n✅ ClickUp test structure setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Workspace: Bluecrest Residential (ID: ${workspaceId})`);
    console.log(`   - Space: Test Property (ID: ${testPropertySpace.id})`);
    console.log(`   - Folder: Sparkle (ID: ${sparkleFolder.id})`);
    console.log(`   - List: Deficient Items (ID: ${deficientItemsList.id})`);
    console.log(`   - List: Jobs (ID: ${jobsList.id})`);
    
    console.log('\n🔑 Save these IDs for testing:');
    console.log(`CLICKUP_TEST_WORKSPACE_ID=${workspaceId}`);
    console.log(`CLICKUP_TEST_SPACE_ID=${testPropertySpace.id}`);
    console.log(`CLICKUP_TEST_FOLDER_ID=${sparkleFolder.id}`);
    console.log(`CLICKUP_TEST_DEFICIENT_ITEMS_LIST_ID=${deficientItemsList.id}`);
    console.log(`CLICKUP_TEST_JOBS_LIST_ID=${jobsList.id}`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.log('💡 This might be a permissions issue. Check that your API token has admin permissions to create spaces, folders, and lists.');
    }
    process.exit(1);
  }
}

setupTestStructure();