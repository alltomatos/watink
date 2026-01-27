
import axios from 'axios';

const API_URL = 'http://localhost/api'; // Traefik exposed port 80, mapped to /api
// We need to set the Host header to match Traefik rule: Host(`api.localhost`)
const AXIOS_CONFIG = {
  headers: {
    'Host': 'api.localhost'
  }
};

const adminEmail = 'admin@admin.com';
const adminPassword = 'devadmin'; // From seed

async function runTest() {
  try {
    console.log('1. Authenticating...');
    const authRes = await axios.post(`${API_URL}/auth/login`, {
      email: adminEmail,
      password: adminPassword
    }, AXIOS_CONFIG);
    const token = authRes.data.token;
    console.log('   Authenticated. Token received.');

    const headers = { 
        ...AXIOS_CONFIG.headers,
        Authorization: `Bearer ${token}` 
    };

    // 2. Create a Group (Function)
    console.log('2. Creating a Group (Function)...');
    const groupName = `Test Group ${Date.now()}`;
    const groupRes = await axios.post(`${API_URL}/groups`, {
      name: groupName,
      isActive: true,
      userIds: [1] // Using userIds array as per controller logic
    }, { headers });
    const group = groupRes.data;
    console.log(`   Group created: ${group.id} - ${group.name}`);

    // 3. Create a User with that Group
    console.log('3. Creating a User with the Group...');
    const userEmail = `testuser${Date.now()}@test.com`;
    const userRes = await axios.post(`${API_URL}/users`, {
      name: 'Test User',
      email: userEmail,
      password: 'password123',
      profile: 'user',
      groupId: group.id // The fix allows sending groupId directly
    }, { headers });
    const user = userRes.data;
    console.log(`   User created: ${user.id} - ${user.email}`);

    // 4. Verify User has the Group
    console.log('4. Verifying User Group assignment...');
    const showUserRes = await axios.get(`${API_URL}/users/${user.id}`, { headers });
    const fetchedUser = showUserRes.data;
    
    console.log('   Fetched User Data:', JSON.stringify(fetchedUser, null, 2));

    if (fetchedUser.groupId === group.id) {
      console.log('   SUCCESS: User has the correct groupId.');
    } else {
      console.error(`   FAILURE: Expected groupId ${group.id}, got ${fetchedUser.groupId}`);
      
      // Check groups array if present
      if (fetchedUser.groups && fetchedUser.groups.length > 0) {
        console.log(`   User has groups: ${fetchedUser.groups.map((g: any) => g.id).join(', ')}`);
        if (fetchedUser.groups.some((g: any) => g.id === group.id)) {
             console.log('   (User has the group in "groups" array, but "groupId" field might be missing/wrong in response)');
        }
      }
    }

    // 5. Cleanup
    console.log('5. Cleanup...');
    await axios.delete(`${API_URL}/users/${user.id}`, { headers });
    await axios.delete(`${API_URL}/groups/${group.id}`, { headers });
    console.log('   Cleanup done.');

  } catch (error: any) {
    console.error('Test Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

runTest();
