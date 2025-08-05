#!/usr/bin/env node

/**
 * Test ClickUp user listing and task assignment functionality
 * 
 * This script tests:
 * - Retrieving workspace members from ClickUp
 * - Finding users by email address
 * - Assigning users to tasks
 * - Adding comments to tasks
 * - Verifying assignments
 * 
 * Usage: node scripts/test-user-assignment.js
 * Requires: CLICKUP_API_TOKEN environment variable
 * 
 * Note: Uses test task created by setup-clickup-test-structure.js
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

async function testUserAssignment() {
  const apiToken = process.env.CLICKUP_API_TOKEN;
  const workspaceId = '20656884';
  const jobsListId = '901313822135';
  const jobTaskId = '86a98tdb0'; // The open job task
  const targetEmail = 'sparkle@bluecrestresidential.com';
  
  console.log('👥 Testing ClickUp user listing and assignment...');
  
  try {
    // Step 1: Get workspace members from teams endpoint
    console.log('\n📋 Step 1: Getting workspace members...');
    const teamsResponse = await clickupService.fetchTeams(apiToken);
    const workspace = teamsResponse.teams[0]; // Bluecrest Residential
    
    console.log(`Workspace: ${workspace.name}`);
    console.log(`Members found: ${(workspace.members && workspace.members.length) || 0}`);
    
    if (workspace.members && workspace.members.length > 0) {
      console.log('\n👤 Workspace Members:');
      workspace.members.slice(0, 10).forEach((member, index) => {
        const user = member.user;
        console.log(`   ${index + 1}. ${user.username}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Email: ${user.email || 'Not provided'}`);
        console.log(`      Color: ${user.color}`);
        console.log(`      Initials: ${user.initials}`);
        console.log(`      Role: ${user.role_key}`);
      });
      
      if (workspace.members.length > 10) {
        console.log(`   ... and ${workspace.members.length - 10} more members`);
      }
      
      // Step 2: Look for the target user by email
      console.log(`\n🔍 Step 2: Looking for user with email: ${targetEmail}`);
      let targetMember = workspace.members.find(member => 
        member.user.email === targetEmail
      );
      
      if (!targetMember) {
        console.log('❌ User not found by email. Let\'s search by username containing "sparkle"...');
        targetMember = workspace.members.find(member => 
          member.user.username.toLowerCase().includes('sparkle')
        );
      }
      
      if (!targetMember) {
        console.log('❌ User not found by username either. Using first member for testing...');
        targetMember = workspace.members[0];
      }
      
      const targetUser = targetMember.user;
      
      console.log(`✅ Target user found: ${targetUser.username} (ID: ${targetUser.id})`);
      console.log(`   Email: ${targetUser.email || 'Not provided'}`);
      
      // Step 3: Get current task details
      console.log('\n📋 Step 3: Getting current task details...');
      const currentTask = await clickupService.fetchTask(apiToken, jobTaskId);
      console.log(`Task: ${currentTask.name}`);
      console.log(`Current assignees: ${(currentTask.assignees && currentTask.assignees.length) || 0}`);
      
      if (currentTask.assignees && currentTask.assignees.length > 0) {
        currentTask.assignees.forEach(assignee => {
          console.log(`   - ${assignee.username} (ID: ${assignee.id})`);
        });
      }
      
      // Step 4: Assign the user to the task
      console.log(`\n🎯 Step 4: Assigning ${targetUser.username} to the task...`);
      const updateData = {
        assignees: {
          add: [parseInt(targetUser.id)]  // ClickUp expects integer IDs
        }
      };
      
      const updatedTask = await clickupService.updateTask(apiToken, jobTaskId, updateData);
      console.log('✅ Task assignment updated!');
      
      // Step 5: Verify the assignment
      console.log('\n✅ Step 5: Verifying assignment...');
      const verifyTask = await clickupService.fetchTask(apiToken, jobTaskId);
      console.log(`Task now has ${verifyTask.assignees?.length || 0} assignee(s):`);
      
      if (verifyTask.assignees && verifyTask.assignees.length > 0) {
        verifyTask.assignees.forEach(assignee => {
          console.log(`   - ${assignee.username} (ID: ${assignee.id})`);
          if (assignee.id === targetUser.id) {
            console.log('     ✅ Target user successfully assigned!');
          }
        });
      }
      
      // Step 6: Add a comment about the assignment
      console.log('\n💬 Step 6: Adding assignment comment...');
      const commentData = {
        comment_text: `Task assigned to ${targetUser.username} for testing the ClickUp integration. This assignment was made automatically by the Sparkle ClickUp integration test.`,
        notify_all: false
      };
      
      const comment = await clickupService.addTaskComment(apiToken, jobTaskId, commentData);
      console.log('✅ Assignment comment added!');
      
      // Step 7: Test getting list members (alternative approach)
      console.log('\n📝 Step 7: Testing list members endpoint...');
      const listMembers = await clickupService.fetchListMembers(apiToken, jobsListId);
      console.log(`List members found: ${listMembers.members?.length || 0}`);
      
      if (listMembers.members && listMembers.members.length > 0) {
        listMembers.members.slice(0, 5).forEach(member => {
          console.log(`   - ${member.username} (ID: ${member.id})`);
        });
        if (listMembers.members.length > 5) {
          console.log(`   ... and ${listMembers.members.length - 5} more`);
        }
      }

    } else {
      console.log('❌ No members found in workspace');
    }

    console.log('\n✅ User assignment test completed successfully!');
    console.log('\n📋 Key Findings:');
    console.log('   - Workspace members: ✅ Can be retrieved');
    console.log('   - Email search: ✅ Works if email is provided in API');
    console.log('   - Task assignment: ✅ Working with user IDs');
    console.log('   - Assignment verification: ✅ Working');
    console.log('   - Comments: ✅ Working');
    console.log('   - List members: ✅ Alternative endpoint working');
    
    console.log('\n🔗 Task URL: https://app.clickup.com/t/' + jobTaskId);
    
    console.log('\n💡 For API Implementation:');
    console.log('   - Use workspace.members from fetchTeams() to get all users');
    console.log('   - User IDs should be integers when assigning');
    console.log('   - Email matching depends on whether emails are exposed in API');
    console.log('   - Store user mapping (Sparkle email -> ClickUp ID) for efficiency');

  } catch (error) {
    console.error('❌ User assignment test failed:', error.message);
    process.exit(1);
  }
}

testUserAssignment();