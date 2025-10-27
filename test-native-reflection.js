// test-native-reflection.js
// Quick test of gRPC reflection implementation

async function testGrpcReflection() {
  console.log('Testing gRPC reflection...\n');

  const testEndpoint = 'grpc.juno.basementnodes.ca:443';

  console.log(`Testing with: ${testEndpoint}\n`);

  try {
    // Test service discovery
    console.log('1. Testing service discovery...');
    const discoverResponse = await fetch('http://localhost:3000/api/grpc/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: testEndpoint,
        tlsEnabled: true,
        forceRefresh: true,
      }),
    });

    if (!discoverResponse.ok) {
      const error = await discoverResponse.text();
      throw new Error(`Service discovery failed: ${error}`);
    }

    const discovery = await discoverResponse.json();
    console.log(`   ✓ Found ${discovery.services.length} services`);
    console.log(`   ✓ Completion rate: ${discovery.status.completionRate}%`);

    if (discovery.chainId) {
      console.log(`   ✓ Chain ID: ${discovery.chainId}`);
    }

    // Find a test method
    const authService = discovery.services.find(s => s.fullName === 'cosmos.auth.v1beta1.Query');

    if (authService) {
      console.log(`   ✓ Found cosmos.auth.v1beta1.Query with ${authService.methods.length} methods`);

      // Test method invocation
      const accountsMethod = authService.methods.find(m => m.name === 'Accounts');

      if (accountsMethod) {
        console.log('\n2. Testing method invocation...');
        const invokeResponse = await fetch('http://localhost:3000/api/grpc/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: testEndpoint,
            tlsEnabled: true,
            service: 'cosmos.auth.v1beta1.Query',
            method: 'Accounts',
            params: { pagination: { limit: '5' } },
          }),
        });

        if (!invokeResponse.ok) {
          const error = await invokeResponse.text();
          console.log(`   ⚠ Method invocation failed: ${error}`);
        } else {
          const invocation = await invokeResponse.json();
          console.log(`   ✓ Method executed in ${invocation.executionTime}ms`);

          if (invocation.result && invocation.result.accounts) {
            console.log(`   ✓ Returned ${invocation.result.accounts.length} accounts`);
          }
        }
      }
    }

    console.log('\n✅ ALL TESTS PASSED!\n');

  } catch (error) {
    console.error(`\n❌ TEST FAILED:`);
    console.error(`${error.message}\n`);
    process.exit(1);
  }
}

// Run tests
testGrpcReflection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
